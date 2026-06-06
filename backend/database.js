const sqlite3 = require("sqlite3").verbose();
const path = require("path");

// Membuat dan menyambungkan ke database users.db
const dbPath = path.join(__dirname, "users.db");
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error("❌ Gagal terhubung ke database SQLite:", err.message);
    } else {
        console.log("✅ Terhubung ke database SQLite.");
        
        // Buat tabel users jika belum ada
        const createTableQuery = `
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE,
                email TEXT UNIQUE,
                password_hash TEXT,
                google_id TEXT UNIQUE,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `;
        
        db.run(createTableQuery, (err) => {
            if (err) {
                console.error("❌ Gagal membuat tabel users:", err.message);
            } else {
                console.log("✅ Tabel users siap digunakan.");
            }
        });

        // Buat tabel conversations
        const createConversationsQuery = `
            CREATE TABLE IF NOT EXISTS conversations (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER,
                title TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users (id)
            )
        `;
        db.run(createConversationsQuery, (err) => {
            if (err) console.error("❌ Gagal membuat tabel conversations:", err.message);
        });

        // Buat tabel messages
        const createMessagesQuery = `
            CREATE TABLE IF NOT EXISTS messages (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                conversation_id INTEGER,
                role TEXT,
                content TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (conversation_id) REFERENCES conversations (id)
            )
        `;
        db.run(createMessagesQuery, (err) => {
            if (err) console.error("❌ Gagal membuat tabel messages:", err.message);
        });

        // Buat tabel user_checklists
        const createChecklistsQuery = `
            CREATE TABLE IF NOT EXISTS user_checklists (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER,
                task_id TEXT,
                is_completed BOOLEAN DEFAULT 0,
                FOREIGN KEY (user_id) REFERENCES users (id),
                UNIQUE(user_id, task_id)
            )
        `;
        db.run(createChecklistsQuery, (err) => {
            if (err) console.error("❌ Gagal membuat tabel user_checklists:", err.message);
        });
    }
});

module.exports = db;
