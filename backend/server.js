require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");
const Groq = require("groq-sdk");
const { extractAndChunk } = require("./embedder");
const { storeChunks, retrieve } = require("./retriever");

const app = express();
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "..")));

// Inisialisasi chunks saat server start
async function init() {
    const chunks = await extractAndChunk();
    storeChunks(chunks);
    console.log("✅ Server siap menerima pertanyaan!");
}

// Endpoint chat
app.post("/chat", async (req, res) => {
    try {
        const { message } = req.body;

        if (!message) {
            return res.status(400).json({ error: "Pesan tidak boleh kosong." });
        }

        const relevantChunks = retrieve(message, 3);

        if (relevantChunks.length === 0) {
            return res.json({
                reply: "Maaf, saya tidak menemukan informasi yang relevan di dokumen pedoman KP.",
            });
        }

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
                {
                    role: "user",
                    content: message,
                },
            ],
            temperature: 0.3,
            max_tokens: 512,
        });

        const reply = completion.choices[0].message.content;
        res.json({ reply });

    } catch (error) {
        console.error("Error:", error.message);
        res.status(500).json({ error: "Terjadi kesalahan pada server." });
    }
});

// Jalankan server
const PORT = process.env.PORT || 3000;
app.listen(PORT, async () => {
    console.log(`🚀 Server berjalan di http://localhost:${PORT}`);
    await init();
});