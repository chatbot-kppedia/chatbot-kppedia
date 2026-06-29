const path = require("path");

require("dotenv").config({
  path: path.resolve(__dirname, "../.env")
});



const express = require("express");
const cors = require("cors");
const Groq = require("groq-sdk");
const {
  extractAndChunk,
  init: initEmbedder
} = require("./embedder");
const {
  storeChunks,
  retrieve
} = require("./retriever");
const bcrypt = require("bcrypt");
const multer = require("multer");

// Konfigurasi Multer untuk upload PDF
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, "data"));
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || ".pdf";
    cb(null, file.fieldname + "-" + Date.now() + ext);
  }
});
const upload = multer({ 
  storage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype === "application/pdf") cb(null, true);
    else cb(new Error("Hanya file PDF yang diizinkan"));
  }
});

// Konfigurasi Multer untuk upload dokumen checklist
const checklistStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(__dirname, "../uploads");
    // Ensure the directory exists
    const fs = require("fs");
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, "checklist-" + Date.now() + Math.floor(Math.random() * 1000) + ext);
  }
});
const checklistUpload = multer({ 
  storage: checklistStorage,
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

// Konfigurasi Multer untuk upload foto profil
const profileStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(__dirname, "../uploads");
    const fs = require("fs");
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, "profile-" + Date.now() + Math.floor(Math.random() * 1000) + ext);
  }
});
const profileUpload = multer({ 
  storage: profileStorage,
  limits: { fileSize: 2 * 1024 * 1024 }, // Limit 2MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith("image/")) cb(null, true);
    else cb(new Error("Hanya file gambar yang diizinkan"));
  }
});

const jwt = require("jsonwebtoken");
const {
  OAuth2Client
} = require("google-auth-library");
const db = require("./database");

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
const JWT_SECRET = process.env.JWT_SECRET;

const app = express();
const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY
});

app.use(cors());
app.use(express.json());

app.use(
  "/documents",
  express.static(path.join(__dirname, "data"))
);

app.use(
  "/uploads",
  express.static(path.join(__dirname, "../uploads"))
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

  if (token == null) return res.status(401).json({
    error: "Akses ditolak. Silakan login."
  });

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err)
      return res
        .status(403)
        .json({
          error: "Sesi tidak valid atau telah berakhir."
        });
    req.user = user;
    next();
  });
}

// Middleware untuk verifikasi token admin
function authenticateAdmin(req, res, next) {
  authenticateToken(req, res, () => {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: "Akses ditolak. Memerlukan hak akses admin." });
    }
    next();
  });
}

// Endpoint: Register
app.post("/api/auth/register", async (req, res) => {
  try {
    const {
      username,
      email,
      password
    } = req.body;
    if (!username || !email || !password) {
      return res.status(400).json({
        error: "Username, email, dan password wajib diisi."
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const query = `INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)`;
    db.run(query, [username, email, hashedPassword], function (err) {
      if (err) {
        if (err.message.includes("UNIQUE constraint failed")) {
          return res.status(400).json({
            error: "Username atau email sudah terdaftar."
          });
        }
        return res.status(500).json({
          error: "Terjadi kesalahan pada database."
        });
      }
      res.status(201).json({
        message: "Registrasi berhasil! Silakan login."
      });
    });
  } catch (error) {
    res.status(500).json({
      error: "Terjadi kesalahan pada server."
    });
  }
});

// Endpoint: Login
app.post("/api/auth/login", (req, res) => {
  const {
    identifier,
    password
  } = req.body; // identifier bisa email atau username

  if (!identifier || !password) {
    return res.status(400).json({
      error: "Username/Email dan password wajib diisi."
    });
  }

  const query = `SELECT * FROM users WHERE email = ? OR username = ?`;
  db.get(query, [identifier, identifier], async (err, user) => {
    if (err) return res.status(500).json({
      error: "Terjadi kesalahan pada database."
    });

    if (!user || !user.password_hash) {
      return res.status(401).json({
        error: "Username/Email atau password salah."
      });
    }

    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      return res.status(401).json({
        error: "Username/Email atau password salah."
      });
    }

    const token = jwt.sign({
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role || 'user'
    }, JWT_SECRET, {
      expiresIn: '24h'
    });
    res.json({
      message: "Login berhasil!",
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role || 'user',
        is_eligible: user.is_eligible === 1
      }
    });
  });
});

// Endpoint: Google Login
app.post("/api/auth/google", async (req, res) => {
  const {
    token
  } = req.body;
  if (!token) return res.status(400).json({
    error: "Token tidak ditemukan."
  });

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
            .json({
              error: "Terjadi kesalahan pada database."
            });

        if (user) {
          // Update google_id jika belum ada tapi email sama
          if (!user.google_id) {
            db.run(`UPDATE users SET google_id = ? WHERE id = ?`, [googleId, user.id]);
          }
          const jwtToken = jwt.sign({
            id: user.id,
            username: user.username,
            email: user.email,
            role: user.role || 'user'
          }, JWT_SECRET, {
            expiresIn: '24h'
          });
          return res.json({
            message: "Login berhasil!",
            token: jwtToken,
            user: {
              id: user.id,
              username: user.username,
              email: user.email,
              role: user.role || 'user',
              is_eligible: user.is_eligible === 1
            }
          });
        } else {
          // Buat user baru
          db.run(`INSERT INTO users (username, email, google_id) VALUES (?, ?, ?)`, [username, email, googleId], function (err) {
            if (err) return res.status(500).json({
              error: "Gagal membuat user baru dari Google."
            });

            const jwtToken = jwt.sign({
              id: this.lastID,
              username,
              email,
              role: 'user'
            }, JWT_SECRET, {
              expiresIn: '24h'
            });
            res.json({
              message: "Login berhasil!",
              token: jwtToken,
              user: {
                id: this.lastID,
                username,
                email,
                role: 'user',
                is_eligible: false
              }
            });
          });
        }
      });
  } catch (error) {
    console.error("Google Auth Error:", error);
    res.status(401).json({
      error: "Token Google tidak valid."
    });
  }
});

// Endpoint: Get user profile
app.get("/api/auth/profile", authenticateToken, (req, res) => {
  db.get("SELECT id, username, email, role, is_eligible, alamat, kelas, foto_profil FROM users WHERE id = ?", [req.user.id], (err, user) => {
    if (err || !user) {
      return res.status(404).json({ error: "User tidak ditemukan." });
    }
    res.json({
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role || 'user',
      is_eligible: user.is_eligible === 1,
      alamat: user.alamat,
      kelas: user.kelas,
      foto_profil: user.foto_profil
    });
  });
});

// Endpoint: Update user profile
app.put("/api/auth/profile", authenticateToken, (req, res) => {
  profileUpload.single('foto_profil')(req, res, (err) => {
    if (err) {
      return res.status(400).json({ error: err.message });
    }
    
    const { alamat, kelas } = req.body;
    
    if (req.file) {
      const foto_profil_url = `/uploads/${req.file.filename}`;
      db.run("UPDATE users SET alamat = ?, kelas = ?, foto_profil = ? WHERE id = ?", 
        [alamat, kelas, foto_profil_url, req.user.id], function(err) {
          if (err) return res.status(500).json({ error: "Gagal update profil." });
          res.json({ message: "Profil berhasil diperbarui." });
      });
    } else {
      db.run("UPDATE users SET alamat = ?, kelas = ? WHERE id = ?", 
        [alamat, kelas, req.user.id], function(err) {
          if (err) return res.status(500).json({ error: "Gagal update profil." });
          res.json({ message: "Profil berhasil diperbarui." });
      });
    }
  });
});

// Endpoint: Get all conversations for logged in user
app.get("/api/chat/conversations", authenticateToken, (req, res) => {
  const userId = req.user.id;
  db.all(
    `SELECT * FROM conversations WHERE user_id = ? ORDER BY created_at DESC`,
    [userId],
    (err, rows) => {
      if (err)
        return res.status(500).json({
          error: "Gagal mengambil riwayat."
        });
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
      if (err || !conv) return res.status(404).json({
        error: "Percakapan tidak ditemukan."
      });

      db.all(`SELECT * FROM messages WHERE conversation_id = ? ORDER BY id ASC`, [conversationId], (err, rows) => {
        if (err) return res.status(500).json({
          error: "Gagal mengambil pesan."
        });
        res.json(rows);
      }, );
    }, );
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
        return res.status(404).json({
          error: "Percakapan tidak ditemukan."
        });

      // Hapus messages terlebih dahulu (foreign key constraint)
      db.run(
        `DELETE FROM messages WHERE conversation_id = ?`,
        [conversationId],
        (err) => {
          if (err)
            return res.status(500).json({
              error: "Gagal menghapus pesan."
            });

          // Hapus conversation
          db.run(
            `DELETE FROM conversations WHERE id = ?`,
            [conversationId],
            (err) => {
              if (err)
                return res
                  .status(500)
                  .json({
                    error: "Gagal menghapus percakapan."
                  });
              res.json({
                message: "Percakapan berhasil dihapus."
              });
            },
          );
        },
      );
    },
  );
});

// Endpoint: Get checklist
// Mengambil data checklist untuk user yang sedang login dari database SQLite
app.get("/api/checklist", authenticateToken, (req, res) => {
  const userId = req.user.id;
  db.all(
    `SELECT task_id, is_completed FROM user_checklists WHERE user_id = ?`,
    [userId],
    (err, rows) => {
      if (err) {
        return res
          .status(500)
          .json({
            error: "Gagal mengambil data checklist."
          });
      }
      res.json(rows);
    },
  );
});

// Endpoint: Update checklist
// Menyimpan atau memperbarui status kelayakan suatu tugas/subtask di database (SQLite upsert)
app.post("/api/checklist", authenticateToken, (req, res) => {
  const userId = req.user.id;
  const {
    taskId,
    isCompleted
  } = req.body;

  const query = `
    INSERT INTO user_checklists (user_id, task_id, is_completed) 
    VALUES (?, ?, ?)
    ON DUPLICATE KEY UPDATE is_completed = VALUES(is_completed)
  `;

  db.run(query, [userId, taskId, isCompleted], (err) => {
    if (err) {
      return res.status(500).json({
        error: "Gagal menyimpan checklist."
      });
    }
    res.json({
      message: "Checklist diperbarui."
    });
  });
});

// Endpoint: Reset checklist
// Menghapus seluruh data progres checklist milik user yang sedang login
app.delete("/api/checklist", authenticateToken, (req, res) => {
  const userId = req.user.id;
  db.run(`DELETE FROM user_checklists WHERE user_id = ?`, [userId], (err) => {
    if (err) {
      return res.status(500).json({
        error: "Gagal menghapus data checklist."
      });
    }
    res.json({
      message: "Checklist berhasil direset."
    });
  });
});

// Endpoint chat
app.post("/chat", authenticateToken, async (req, res) => {
  try {
    let {
      message,
      conversationId
    } = req.body;
    const userId = req.user.id;

    if (!message) {
      return res.status(400).json({
        error: "Pesan tidak boleh kosong."
      });
    }

    // 1. Buat percakapan baru jika conversationId kosong
    if (!conversationId) {
      const title = message.split(' ').slice(0, 5).join(' ') + (message.length > 20 ? '...' : '');
      conversationId = await new Promise((resolve, reject) => {
        db.run(`INSERT INTO conversations (user_id, title) VALUES (?, ?)`, [userId, title], function (err) {
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

    const relevantChunks = retrieve(message, 5);
    let reply = "";
    
    // Ambil data kelayakan dan checklist untuk injeksi konteks
    let userContext = "";
    try {
      const userStatus = await new Promise((resolve) => {
        db.get("SELECT is_eligible FROM users WHERE id = ?", [userId], (err, row) => resolve(row));
      });
      const checklists = await new Promise((resolve) => {
        db.all("SELECT task_id FROM user_checklists WHERE user_id = ? AND is_completed = 1", [userId], (err, rows) => resolve(rows || []));
      });
      const isEligibleStr = userStatus && userStatus.is_eligible ? "Sudah memenuhi syarat Kelayakan KP." : "Belum memenuhi syarat Kelayakan KP.";
      const completedTasks = checklists.map(c => c.task_id).join(", ");
      userContext = `\nInformasi Pengguna Saat Ini:\n- Status Kelayakan: ${isEligibleStr}\n- Progres Checklist yang sudah selesai (Task ID): ${completedTasks ? completedTasks : "Belum ada"}`;
    } catch(e) {
      console.error("Gagal mengambil context user", e);
    }

    if (relevantChunks.length === 0) {
      reply =
        "Maaf, saya tidak menemukan informasi yang relevan di dokumen pedoman KP.";
    } else {
      const context = relevantChunks.join("\n\n");
      const completion = await groq.chat.completions.create({
        model: "llama-3.1-8b-instant",
        messages: [{
            role: "system",
            content: `Kamu adalah asisten informasi Kerja Praktik (KP) Telkom University Surabaya. 
Jawab pertanyaan mahasiswa berdasarkan konteks dokumen pedoman KP berikut.
Jawab dengan bahasa Indonesia yang jelas dan profesional. Berikan arahan yang relevan dengan status pengguna.
Aturan penting:
- Jika informasi ADA di konteks, jawab dengan lengkap dan spesifik
- Jika ada angka atau syarat pasti, sebutkan secara eksplisit
- Jika informasi TIDAK ADA di konteks, katakan tidak tahu
- Jangan jawab dengan "lihat tabel" atau "lihat gambar", jelaskan isinya langsung
${userContext}

Konteks:
${context}`,
          },
          {
            role: "user",
            content: message
          },
        ],
        temperature: 0.3,
        max_tokens: 2048,
      });
      reply = completion.choices[0].message.content;
    }

    // Ambil dokumen dari DB
    const dbDocuments = await new Promise((resolve, reject) => {
      db.all("SELECT * FROM documents", (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
    const documents = dbDocuments.map(d => ({...d, keywords: JSON.parse(d.keywords)}));

    // Cek jika user meminta dokumen
    const lowerMessage = message.toLowerCase();

    let matchedDoc = null;
    let highestScore = 0;
    
    for (const doc of documents) {
      let score = 0;
      for (const k of doc.keywords) {
        if (lowerMessage.includes(k)) {
          score += k.length;
        }
      }
      if (score > highestScore) {
        highestScore = score;
        matchedDoc = doc;
      }
    }

    if (matchedDoc) {
      if (matchedDoc.type === "pdf") {
        reply += `\n\n[ATTACHMENT:${matchedDoc.name}.pdf|${matchedDoc.url}]`;
      } else {
        reply += `\n\n[LINK:${matchedDoc.name}|${matchedDoc.url}]`;
      }
    } else if (lowerMessage.includes("dokumen") || lowerMessage.includes("form") || lowerMessage.includes("template")) {
      // User meminta dokumen tapi tidak spesifik
      const optionsList = documents.map(d => d.name).join(',');
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

    res.json({
      reply,
      conversationId
    });
  } catch (error) {
    console.error("Error:", error.message);
    res.status(500).json({
      error: "Terjadi kesalahan pada server."
    });
  }
});

// --- ENDPOINT CEK KELAYAKAN KP ---
app.post("/api/eligibility/check", authenticateToken, (req, res) => {
  // 1. Ambil data yang dikirim dari frontend
  const {
    sks,
    ipk,
    status_akademik,
    status_prasyarat
  } = req.body;

  // 2. Validasi jika ada data yang kosong atau tidak dikirim
  if (sks === undefined || ipk === undefined || !status_akademik || !status_prasyarat) {
    return res.status(400).json({
      success: false,
      message: "Data tidak lengkap. Mohon isi semua bidang terlebih dahulu!",
    });
  }

  // 3. Konversi tipe data
  const parsedSks = parseInt(sks);
  const parsedIpk = parseFloat(ipk);

  // 4. Ambil kriteria dari database
  db.get("SELECT * FROM eligibility_criteria LIMIT 1", (err, criteria) => {
    if (err || !criteria) {
        criteria = { min_sks: 90, min_ipk: 2.0, status_required: 'aktif', prasyarat_required: 'sudah' }; // fallback
    }

    let isEligible = true;
    let reasons = [];

    if (parsedSks < criteria.min_sks) {
      isEligible = false;
      reasons.push(`SKS Anda (${parsedSks}) masih di bawah batas minimal (${criteria.min_sks} SKS).`);
    }
    if (parsedIpk < criteria.min_ipk) {
      isEligible = false;
      reasons.push(`IPK Anda (${parsedIpk}) di bawah ketentuan minimal (${criteria.min_ipk}).`);
    }
    if (status_akademik !== criteria.status_required) {
      isEligible = false;
      reasons.push(`Status akademik Anda (${status_akademik}) tidak memenuhi syarat (harus ${criteria.status_required}).`);
    }
    if (status_prasyarat !== criteria.prasyarat_required) {
      isEligible = false;
      const praStr = criteria.prasyarat_required === 'sudah' ? 'Lulus' : 'Belum Wajib';
      reasons.push(`Anda belum memenuhi syarat kelulusan matkul prasyarat (harus Sudah ${praStr}).`);
    }

    let pesanHasil = "";
    if (isEligible) {
      pesanHasil = "Selamat! Anda MEMENUHI SYARAT untuk mendaftar Kerja Praktik.";
    } else {
      pesanHasil = "Mohon maaf, Anda BELUM MEMENUHI SYARAT untuk mendaftar Kerja Praktik saat ini.<br><br><b>Alasan:</b><ul style='text-align: left; margin-top: 10px; margin-bottom: 0;'>";
      reasons.forEach(r => {
        pesanHasil += `<li>${r}</li>`;
      });
      pesanHasil += "</ul>";
    }

    // 5. Jika lolos, lakukan update database is_eligible = 1 untuk user tersebut
    if (isEligible) {
      db.run("UPDATE users SET is_eligible = 1 WHERE id = ?", [req.user.id], (updateErr) => {
        if (updateErr) {
          console.error("❌ Gagal update status kelayakan user:", updateErr.message);
          return res.status(500).json({
            success: false,
            message: "Terjadi kesalahan database saat memperbarui status kelayakan.",
          });
        }
        res.status(200).json({
          success: true,
          isEligible: isEligible,
          message: pesanHasil,
        });
      });
    } else {
      res.status(200).json({
        success: true,
        isEligible: isEligible,
        message: pesanHasil,
      });
    }
  });
});

// --- PUBLIC ENDPOINT: GET ELIGIBILITY CRITERIA ---
app.get("/api/eligibility/criteria", authenticateToken, (req, res) => {
  db.get("SELECT * FROM eligibility_criteria LIMIT 1", (err, row) => {
    if (err) return res.status(500).json({ error: "Gagal mengambil data." });
    res.json(row || { min_sks: 90, min_ipk: 2.0, status_required: 'aktif', prasyarat_required: 'sudah' });
  });
});

// --- ENDPOINT UNTUK CHECKLISTS MASTER ---
app.get("/api/checklists/master", authenticateToken, (req, res) => {
  db.all("SELECT * FROM checklists ORDER BY id ASC", (err, checklists) => {
    if (err) return res.status(500).json({ error: "Gagal mengambil data." });
    db.all("SELECT * FROM checklist_subtasks", (err, subtasks) => {
      if (err) return res.status(500).json({ error: "Gagal mengambil data." });
      
      const structured = checklists.map(c => {
        const subs = subtasks.filter(s => s.checklist_id === c.id).map(s => s.title);
        return {
          title: c.title,
          description: c.description,
          subTasks: subs.length > 0 ? subs : null
        };
      });
      res.json(structured);
    });
  });
});

// --- ADMIN ENDPOINTS ---

// Admin Documents
app.get("/api/admin/documents", authenticateAdmin, (req, res) => {
  db.all("SELECT * FROM documents", (err, rows) => {
    if (err) return res.status(500).json({ error: "Gagal mengambil data." });
    res.json(rows.map(r => ({...r, keywords: JSON.parse(r.keywords)})));
  });
});

app.post("/api/admin/documents", authenticateAdmin, upload.single('file'), (req, res) => {
  let { id, name, type, url, keywords } = req.body;
  if (!id || !name || !type || !keywords) return res.status(400).json({ error: "Data tidak lengkap" });
  
  if (type === 'pdf_upload') {
    if (!req.file) return res.status(400).json({ error: "File PDF tidak ditemukan" });
    url = `/documents/${req.file.filename}`;
    type = 'pdf'; // Ubah tipe menjadi pdf lokal
  } else {
    if (!url) return res.status(400).json({ error: "URL wajib diisi jika bukan upload file" });
  }

  const kwArray = keywords.split(",").map(k => k.trim()).filter(k => k);
  
  db.run("INSERT INTO documents (id, name, type, url, keywords) VALUES (?, ?, ?, ?, ?)", 
    [id, name, type, url, JSON.stringify(kwArray)], function(err) {
    if (err) {
      if (err.message.includes("UNIQUE")) {
        return res.status(400).json({ error: "ID Dokumen sudah digunakan. Silakan gunakan ID lain atau batalkan lalu edit." });
      }
      return res.status(500).json({ error: "Gagal menyimpan data." });
    }
    
    if (type === 'pdf') initEmbedder().catch(console.error);

    res.json({ message: "Dokumen berhasil ditambahkan" });
  });
});

app.put("/api/admin/documents/:id", authenticateAdmin, upload.single('file'), (req, res) => {
  let { id, name, type, url, keywords } = req.body;
  if (!id || !name || !type || !keywords) return res.status(400).json({ error: "Data tidak lengkap" });

  if (type === 'pdf_upload') {
    if (req.file) {
      url = `/documents/${req.file.filename}`;
    }
    type = 'pdf';
  }

  const kwArray = keywords.split(",").map(k => k.trim()).filter(k => k);

  db.run("UPDATE documents SET id = ?, name = ?, type = ?, url = COALESCE(?, url), keywords = ? WHERE id = ?",
    [id, name, type, url, JSON.stringify(kwArray), req.params.id], function(err) {
    if (err) {
      if (err.message.includes("UNIQUE")) {
        return res.status(400).json({ error: "ID Dokumen sudah digunakan. Silakan gunakan ID lain." });
      }
      return res.status(500).json({ error: "Gagal update data." });
    }
    
    if (type === 'pdf') initEmbedder().catch(console.error);

    res.json({ message: "Dokumen berhasil diupdate" });
  });
});

app.delete("/api/admin/documents/:id", authenticateAdmin, (req, res) => {
  db.run("DELETE FROM documents WHERE id = ?", [req.params.id], function(err) {
    if (err) return res.status(500).json({ error: "Gagal hapus data." });
    res.json({ message: "Dokumen berhasil dihapus" });
  });
});

// Checklist Submissions (Hard Tasks)

// Upload file untuk hard task
app.post("/api/checklist/upload", authenticateToken, checklistUpload.single("file"), (req, res) => {
  const user_id = req.user.id;
  const { task_id } = req.body;
  
  if (!task_id) {
    return res.status(400).json({ error: "task_id diperlukan" });
  }
  
  if (!req.file) {
    return res.status(400).json({ error: "File dokumen diperlukan" });
  }

  const file_url = "/uploads/" + req.file.filename;

  // Cek apakah sudah ada pending submission untuk task ini
  db.get("SELECT id FROM checklist_submissions WHERE user_id = ? AND task_id = ? AND status = 'pending'", [user_id, task_id], (err, row) => {
    if (row) {
      // Update
      db.run("UPDATE checklist_submissions SET file_url = ?, created_at = CURRENT_TIMESTAMP WHERE id = ?", [file_url, row.id], function(err) {
        if (err) return res.status(500).json({ error: "Gagal mengupdate pengajuan dokumen" });
        res.json({ message: "Dokumen berhasil diunggah ulang dan sedang menunggu verifikasi.", file_url: file_url });
      });
    } else {
      // Insert
      db.run("INSERT INTO checklist_submissions (user_id, task_id, file_url, status) VALUES (?, ?, ?, 'pending')", 
      [user_id, task_id, file_url], function(err) {
        if (err) return res.status(500).json({ error: "Gagal menyimpan pengajuan dokumen" });
        res.json({ message: "Dokumen berhasil diunggah dan sedang menunggu verifikasi.", file_url: file_url, submission_id: this.lastID });
      });
    }
  });
});

// Get submissions for logged in user
app.get("/api/checklist/submissions", authenticateToken, (req, res) => {
  const user_id = req.user.id;
  db.all("SELECT id, task_id, file_url, status, admin_feedback, created_at FROM checklist_submissions WHERE user_id = ? ORDER BY created_at DESC", 
  [user_id], (err, rows) => {
    if (err) {
      return res.status(500).json({ error: "Gagal mengambil data pengajuan" });
    }
    res.json(rows);
  });
});

// --- ADMIN API FOR SUBMISSIONS ---

function authenticateAdmin(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (token == null) return res.status(401).json({ error: "Akses ditolak" });

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: "Token tidak valid" });
    if (user.role !== 'admin') return res.status(403).json({ error: "Akses ditolak. Bukan admin." });
    req.user = user;
    next();
  });
}

// Get all submissions for admin
app.get("/api/admin/submissions", authenticateAdmin, (req, res) => {
  const query = `
    SELECT s.id, s.task_id, s.file_url, s.status, s.admin_feedback, s.created_at, 
           u.username as user_name, u.email as user_email
    FROM checklist_submissions s
    JOIN users u ON s.user_id = u.id
    WHERE s.id IN (
      SELECT MAX(id)
      FROM checklist_submissions
      GROUP BY user_id, task_id
    )
    ORDER BY CASE WHEN s.status = 'pending' THEN 0 ELSE 1 END, s.created_at DESC
  `;
  
  db.all(query, [], (err, rows) => {
    if (err) {
      return res.status(500).json({ error: "Gagal mengambil data pengajuan" });
    }
    res.json(rows);
  });
});

// Approve submission
app.put("/api/admin/submissions/:id/approve", authenticateAdmin, (req, res) => {
  const submissionId = req.params.id;
  
  db.get("SELECT user_id, task_id FROM checklist_submissions WHERE id = ?", [submissionId], (err, sub) => {
    if (err || !sub) {
      return res.status(404).json({ error: "Pengajuan tidak ditemukan" });
    }
    
    // Update submission status
    db.run("UPDATE checklist_submissions SET status = 'approved', admin_feedback = NULL WHERE id = ?", [submissionId], (err) => {
      if (err) return res.status(500).json({ error: "Gagal mengupdate status pengajuan" });
      
      // Auto complete the task for the user
      db.get("SELECT id FROM user_checklists WHERE user_id = ? AND task_id = ?", [sub.user_id, sub.task_id], (err, row) => {
        if (row) {
          db.run("UPDATE user_checklists SET is_completed = 1 WHERE user_id = ? AND task_id = ?", [sub.user_id, sub.task_id]);
        } else {
          db.run("INSERT INTO user_checklists (user_id, task_id, is_completed) VALUES (?, ?, 1)", [sub.user_id, sub.task_id]);
        }
      });
      
      res.json({ message: "Pengajuan disetujui dan task otomatis selesai." });
    });
  });
});

// Reject submission
app.put("/api/admin/submissions/:id/reject", authenticateAdmin, (req, res) => {
  const submissionId = req.params.id;
  const { feedback } = req.body;
  
  if (!feedback) {
    return res.status(400).json({ error: "Alasan penolakan wajib diisi" });
  }
  
  db.run("UPDATE checklist_submissions SET status = 'rejected', admin_feedback = ? WHERE id = ?", [feedback, submissionId], (err) => {
    if (err) return res.status(500).json({ error: "Gagal mengupdate status pengajuan" });
    res.json({ message: "Pengajuan ditolak." });
  });
});

// Admin Checklists
app.get("/api/admin/checklists", authenticateAdmin, (req, res) => {
  db.all("SELECT * FROM checklists ORDER BY id ASC", (err, checklists) => {
    if (err) return res.status(500).json({ error: "Gagal mengambil data." });
    db.all("SELECT * FROM checklist_subtasks", (err, subtasks) => {
      if (err) return res.status(500).json({ error: "Gagal mengambil data." });
      const structured = checklists.map(c => {
        return {
          id: c.id,
          title: c.title,
          description: c.description,
          subTasks: subtasks.filter(s => s.checklist_id === c.id)
        };
      });
      res.json(structured);
    });
  });
});

app.post("/api/admin/checklists", authenticateAdmin, (req, res) => {
  const { title, description, subTasks } = req.body; // subTasks is array of strings
  if (!title) return res.status(400).json({ error: "Title wajib diisi" });
  
  db.run("INSERT INTO checklists (title, description) VALUES (?, ?)", [title, description], function(err) {
    if (err) return res.status(500).json({ error: "Gagal menyimpan data." });
    const checklistId = this.lastID;
    
    if (subTasks && subTasks.length > 0) {
      const stmt = db.prepare("INSERT INTO checklist_subtasks (checklist_id, title) VALUES (?, ?)");
      subTasks.forEach(st => stmt.run([checklistId, st]));
      stmt.finalize();
    }
    res.json({ message: "Checklist berhasil ditambahkan" });
  });
});

app.put("/api/admin/checklists/:id", authenticateAdmin, (req, res) => {
  const { title, description, subTasks } = req.body;
  const checklistId = req.params.id;
  
  db.run("UPDATE checklists SET title = ?, description = ? WHERE id = ?", [title, description, checklistId], function(err) {
    if (err) return res.status(500).json({ error: "Gagal update data." });
    
    // Replace subtasks: delete old, insert new
    db.run("DELETE FROM checklist_subtasks WHERE checklist_id = ?", [checklistId], (err) => {
      if (subTasks && subTasks.length > 0) {
        const stmt = db.prepare("INSERT INTO checklist_subtasks (checklist_id, title) VALUES (?, ?)");
        subTasks.forEach(st => stmt.run([checklistId, st]));
        stmt.finalize();
      }
      res.json({ message: "Checklist berhasil diupdate" });
    });
  });
});

app.delete("/api/admin/checklists/:id", authenticateAdmin, (req, res) => {
  db.run("DELETE FROM checklists WHERE id = ?", [req.params.id], function(err) {
    if (err) return res.status(500).json({ error: "Gagal hapus data." });
    // Cascade delete on subtasks handles the rest
    res.json({ message: "Checklist berhasil dihapus" });
  });
});

// Admin Eligibility Criteria
app.get("/api/admin/eligibility", authenticateAdmin, (req, res) => {
  db.get("SELECT * FROM eligibility_criteria LIMIT 1", (err, row) => {
    if (err) return res.status(500).json({ error: "Gagal mengambil data." });
    res.json(row || { min_sks: 90, min_ipk: 2.0, status_required: 'aktif', prasyarat_required: 'sudah' });
  });
});

app.put("/api/admin/eligibility", authenticateAdmin, (req, res) => {
  const { min_sks, min_ipk, status_required, prasyarat_required } = req.body;
  if (min_sks === undefined || min_ipk === undefined) return res.status(400).json({ error: "Data tidak lengkap" });
  
  const statusReq = status_required || 'aktif';
  const prasyaratReq = prasyarat_required || 'sudah';

  db.get("SELECT id FROM eligibility_criteria LIMIT 1", (err, row) => {
    if (row) {
      db.run("UPDATE eligibility_criteria SET min_sks = ?, min_ipk = ?, status_required = ?, prasyarat_required = ? WHERE id = ?", 
      [min_sks, min_ipk, statusReq, prasyaratReq, row.id], function(err) {
        if (err) return res.status(500).json({ error: "Gagal update data." });
        res.json({ message: "Kriteria kelayakan berhasil diupdate" });
      });
    } else {
      db.run("INSERT INTO eligibility_criteria (min_sks, min_ipk, status_required, prasyarat_required) VALUES (?, ?, ?, ?)", 
      [min_sks, min_ipk, statusReq, prasyaratReq], function(err) {
        if (err) return res.status(500).json({ error: "Gagal insert data." });
        res.json({ message: "Kriteria kelayakan berhasil ditambahkan" });
      });
    }
  });
});

// Jalankan server
const PORT = process.env.PORT || 3000;
app.listen(PORT, async () => {
  console.log(`🚀 Server berjalan di http://localhost:${PORT}`);
  await init();
});