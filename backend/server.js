const path = require("path");

require("dotenv").config({
    path: path.resolve(__dirname, "../.env")
});

console.log("API KEY =", process.env.GROQ_API_KEY);

const express = require("express");
const cors = require("cors");
const Groq = require("groq-sdk");
const documents = require("./documents");
const { extractAndChunk } = require("./embedder");
const { storeChunks, retrieve } = require("./retriever");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { OAuth2Client } = require("google-auth-library");
const db = require("./database");

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
const JWT_SECRET = process.env.JWT_SECRET;

const app = express();
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

app.use(cors());
app.use(express.json());

app.use(
    "/documents",
    express.static(path.join(__dirname, "../documents"))
);

app.use(express.static(path.join(__dirname, "..")));

// Inisialisasi chunks saat server start
async function init() {
  const chunks = await extractAndChunk();
  storeChunks(chunks);
  console.log("✅ Server siap menerima pertanyaan!");
}

// Middleware untuk verifikasi token JWT
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    if (token == null) return res.status(401).json({ error: "Akses ditolak. Silakan login." });

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err)
      return res
        .status(403)
        .json({ error: "Sesi tidak valid atau telah berakhir." });
    req.user = user;
    next();
  });
}

// Endpoint: Register
app.post("/api/auth/register", async (req, res) => {
    try {
        const { username, email, password } = req.body;
        if (!username || !email || !password) {
            return res.status(400).json({ error: "Username, email, dan password wajib diisi." });
        }
        
        const hashedPassword = await bcrypt.hash(password, 10);
        
        const query = `INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)`;
        db.run(query, [username, email, hashedPassword], function(err) {
            if (err) {
                if (err.message.includes("UNIQUE constraint failed")) {
                    return res.status(400).json({ error: "Username atau email sudah terdaftar." });
                }
                return res.status(500).json({ error: "Terjadi kesalahan pada database." });
            }
            res.status(201).json({ message: "Registrasi berhasil! Silakan login." });
        });
    } catch (error) {
        res.status(500).json({ error: "Terjadi kesalahan pada server." });
    }
});

// Endpoint: Login
app.post("/api/auth/login", (req, res) => {
    const { identifier, password } = req.body; // identifier bisa email atau username
    
    if (!identifier || !password) {
        return res.status(400).json({ error: "Username/Email dan password wajib diisi." });
    }
    
    const query = `SELECT * FROM users WHERE email = ? OR username = ?`;
    db.get(query, [identifier, identifier], async (err, user) => {
        if (err) return res.status(500).json({ error: "Terjadi kesalahan pada database." });
        
        if (!user || !user.password_hash) {
            return res.status(401).json({ error: "Username/Email atau password salah." });
        }
        
        const match = await bcrypt.compare(password, user.password_hash);
        if (!match) {
            return res.status(401).json({ error: "Username/Email atau password salah." });
        }
        
        const token = jwt.sign({ id: user.id, username: user.username, email: user.email }, JWT_SECRET, { expiresIn: '24h' });
        res.json({ message: "Login berhasil!", token, user: { username: user.username, email: user.email } });
    });
});

// Endpoint: Google Login
app.post("/api/auth/google", async (req, res) => {
  const { token } = req.body;
  if (!token) return res.status(400).json({ error: "Token tidak ditemukan." });

  try {
    const ticket = await googleClient.verifyIdToken({
      idToken: token,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    const googleId = payload["sub"];
    const email = payload["email"];
    const username = payload["name"] || email.split("@")[0];

    // Cari atau buat user baru
    db.get(
      `SELECT * FROM users WHERE google_id = ? OR email = ?`,
      [googleId, email],
      (err, user) => {
        if (err)
          return res
            .status(500)
            .json({ error: "Terjadi kesalahan pada database." });

            if (user) {
                // Update google_id jika belum ada tapi email sama
                if (!user.google_id) {
                    db.run(`UPDATE users SET google_id = ? WHERE id = ?`, [googleId, user.id]);
                }
                const jwtToken = jwt.sign({ id: user.id, username: user.username, email: user.email }, JWT_SECRET, { expiresIn: '24h' });
                return res.json({ message: "Login berhasil!", token: jwtToken, user: { username: user.username, email: user.email } });
            } else {
                // Buat user baru
                db.run(`INSERT INTO users (username, email, google_id) VALUES (?, ?, ?)`, [username, email, googleId], function(err) {
                    if (err) return res.status(500).json({ error: "Gagal membuat user baru dari Google." });
                    
                    const jwtToken = jwt.sign({ id: this.lastID, username, email }, JWT_SECRET, { expiresIn: '24h' });
                    res.json({ message: "Login berhasil!", token: jwtToken, user: { username, email } });
                });
            }
        });
    } catch (error) {
        console.error("Google Auth Error:", error);
        res.status(401).json({ error: "Token Google tidak valid." });
    }
});

// Endpoint: Get all conversations for logged in user
app.get("/api/chat/conversations", authenticateToken, (req, res) => {
  const userId = req.user.id;
  db.all(
    `SELECT * FROM conversations WHERE user_id = ? ORDER BY created_at DESC`,
    [userId],
    (err, rows) => {
      if (err)
        return res.status(500).json({ error: "Gagal mengambil riwayat." });
      res.json(rows);
    },
  );
});

// Endpoint: Get messages for a specific conversation
app.get(
  "/api/chat/conversations/:id/messages",
  authenticateToken,
  (req, res) => {
    const userId = req.user.id;
    const conversationId = req.params.id;

    // Pastikan conversation milik user ini
    db.get(`SELECT * FROM conversations WHERE id = ? AND user_id = ?`, [conversationId, userId], (err, conv) => {
        if (err || !conv) return res.status(404).json({ error: "Percakapan tidak ditemukan." });
        
        db.all(`SELECT * FROM messages WHERE conversation_id = ? ORDER BY id ASC`, [conversationId], (err, rows) => {
            if (err) return res.status(500).json({ error: "Gagal mengambil pesan." });
            res.json(rows);
          },
        );
      },
    );
  },
);

// Endpoint: Delete a conversation and its messages
app.delete("/api/chat/conversations/:id", authenticateToken, (req, res) => {
  const userId = req.user.id;
  const conversationId = req.params.id;

  // Pastikan conversation milik user ini
  db.get(
    `SELECT * FROM conversations WHERE id = ? AND user_id = ?`,
    [conversationId, userId],
    (err, conv) => {
      if (err || !conv)
        return res.status(404).json({ error: "Percakapan tidak ditemukan." });

      // Hapus messages terlebih dahulu (foreign key constraint)
      db.run(
        `DELETE FROM messages WHERE conversation_id = ?`,
        [conversationId],
        (err) => {
          if (err)
            return res.status(500).json({ error: "Gagal menghapus pesan." });

          // Hapus conversation
          db.run(
            `DELETE FROM conversations WHERE id = ?`,
            [conversationId],
            (err) => {
              if (err)
                return res
                  .status(500)
                  .json({ error: "Gagal menghapus percakapan." });
              res.json({ message: "Percakapan berhasil dihapus." });
            },
          );
        },
      );
    },
  );
});

// Endpoint: Get checklist
app.get("/api/checklist", authenticateToken, (req, res) => {
  const userId = req.user.id;
  db.all(
    `SELECT task_id, is_completed FROM user_checklists WHERE user_id = ?`,
    [userId],
    (err, rows) => {
      if (err)
        return res
          .status(500)
          .json({ error: "Gagal mengambil data checklist." });
      res.json(rows);
    },
  );
});

// Endpoint: Update checklist
app.post("/api/checklist", authenticateToken, (req, res) => {
    const userId = req.user.id;
    const { taskId, isCompleted } = req.body;
    
    // SQLite upsert
    const query = `
        INSERT INTO user_checklists (user_id, task_id, is_completed) 
        VALUES (?, ?, ?)
        ON CONFLICT(user_id, task_id) 
        DO UPDATE SET is_completed = excluded.is_completed
    `;
  db.run(query, [userId, taskId, isCompleted], (err) => {
    if (err)
      return res.status(500).json({ error: "Gagal menyimpan checklist." });
    res.json({ message: "Checklist diperbarui." });
  });
});

// Endpoint chat
app.post("/chat", authenticateToken, async (req, res) => {
  try {
    let { message, conversationId } = req.body;
    const userId = req.user.id;

    if (!message) {
      return res.status(400).json({ error: "Pesan tidak boleh kosong." });
    }

        // 1. Buat percakapan baru jika conversationId kosong
        if (!conversationId) {
            const title = message.split(' ').slice(0, 5).join(' ') + (message.length > 20 ? '...' : '');
            conversationId = await new Promise((resolve, reject) => {
                db.run(`INSERT INTO conversations (user_id, title) VALUES (?, ?)`, [userId, title], function(err) {
                    if (err) reject(err);
                    else resolve(this.lastID);
                });
            });
        }

    // 2. Simpan pesan user
    await new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO messages (conversation_id, role, content) VALUES (?, ?, ?)`,
        [conversationId, "user", message],
        (err) => {
          if (err) reject(err);
          else resolve();
        },
      );
    });

    const relevantChunks = retrieve(message, 3);
    let reply = "";

    if (relevantChunks.length === 0) {
      reply =
        "Maaf, saya tidak menemukan informasi yang relevan di dokumen pedoman KP.";
    } else {
      const context = relevantChunks.join("\n\n");
      const completion = await groq.chat.completions.create({
        model: "llama-3.1-8b-instant",
        messages: [
          {
            role: "system",
            content: `Kamu adalah asisten informasi Kerja Praktik (KP) Telkom University Surabaya. 
Jawab pertanyaan mahasiswa berdasarkan konteks dokumen pedoman KP berikut.
Jawab dengan bahasa Indonesia yang jelas dan ringkas.
Aturan penting:
- Jika informasi ADA di konteks, jawab dengan lengkap dan spesifik
- Jika ada angka atau syarat pasti, sebutkan secara eksplisit
- Jika informasi TIDAK ADA di konteks, katakan tidak tahu
- Jangan jawab dengan "lihat tabel" atau "lihat gambar", jelaskan isinya langsung

Konteks:
${context}`,
          },
          { role: "user", content: message },
        ],
        temperature: 0.3,
        max_tokens: 512,
      });
      reply = completion.choices[0].message.content;
    }

        // Cek jika user meminta dokumen
        const lowerMessage = message.toLowerCase();
        const DOCUMENTS = [
            { id: "pedoman", name: "Buku Pedoman KP", url: "#", keywords: ["pedoman", "buku", "panduan"] },
            { id: "proposal", name: "Template Proposal KP", url: "#", keywords: ["proposal", "template proposal"] },
            { id: "logbook", name: "Form Logbook Harian", url: "#", keywords: ["logbook", "harian", "jurnal"] },
            { id: "nilai", name: "Form Penilaian Pembimbing", url: "#", keywords: ["nilai", "penilaian", "form nilai"] }
        ];

        let matchedDoc = null;
        for (const doc of DOCUMENTS) {
            if (doc.keywords.some(k => lowerMessage.includes(k))) {
                matchedDoc = doc;
                break;
            }
        }

        if (matchedDoc) {
            // User meminta dokumen spesifik
            reply += `\n\n[ATTACHMENT:${matchedDoc.name}.pdf|${matchedDoc.url}]`;
        } else if (lowerMessage.includes("dokumen") || lowerMessage.includes("form") || lowerMessage.includes("template")) {
            // User meminta dokumen tapi tidak spesifik
            const optionsList = DOCUMENTS.map(d => d.name).join(',');
            reply += `\n\n[OPTIONS:${optionsList}]`;
        }

    // 3. Simpan pesan bot
    await new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO messages (conversation_id, role, content) VALUES (?, ?, ?)`,
        [conversationId, "bot", reply],
        (err) => {
          if (err) reject(err);
          else resolve();
        },
      );
    });

    res.json({ reply, conversationId });
  } catch (error) {
    console.error("Error:", error.message);
    res.status(500).json({ error: "Terjadi kesalahan pada server." });
  }
});

// --- ENDPOINT CEK KELAYAKAN KP ---
app.post("/api/eligibility/check", (req, res) => {
  // 1. Ambil data yang dikirim dari frontend
  const { sks, ipk, status, prasyarat } = req.body;

  // 2. Validasi jika ada data yang kosong atau tidak dikirim
  if (!sks || !ipk || !status || !prasyarat) {
    return res.status(400).json({
      success: false,
      message: "Data tidak lengkap. Mohon isi semua bidang terlebih dahulu!",
    });
  }

  // 3. Konversi tipe data
  const parsedSks = parseInt(sks);
  const parsedIpk = parseFloat(ipk);

  // 4. Logika Kelayakan (SKS >= 90, IPK >= 2.00, Aktif, Sudah Lulus Prasyarat)
  let isEligible = false;
  let pesanHasil = "";

  if (
    parsedSks >= 90 &&
    parsedIpk >= 2.0 &&
    status === "aktif" &&
    prasyarat === "sudah"
  ) {
    isEligible = true;
    pesanHasil = "Selamat! Anda MEMENUHI SYARAT untuk mendaftar Kerja Praktik.";
  } else {
    isEligible = false;
    pesanHasil =
      "Mohon maaf, Anda BELUM MEMENUHI SYARAT untuk mendaftar Kerja Praktik saat ini.";
  }

  // 5. Kirim balasan ke frontend
  res.status(200).json({
    success: true,
    isEligible: isEligible,
    message: pesanHasil,
  });
});

// Jalankan server
const PORT = process.env.PORT || 3000;
app.listen(PORT, async () => {
  console.log(`🚀 Server berjalan di http://localhost:${PORT}`);
  await init();
});
