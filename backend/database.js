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
                role TEXT DEFAULT 'user',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `;

        db.run(createTableQuery, (err) => {
            if (err) {
                console.error("❌ Gagal membuat tabel users:", err.message);
            } else {
                console.log("✅ Tabel users siap digunakan.");
                
                // Tambahkan kolom role jika database sudah ada sebelumnya (SQLite alter table fallback)
                db.run("ALTER TABLE users ADD COLUMN role TEXT DEFAULT 'user'", (err) => {
                    // Ignore error if column already exists
                });

                // Buat default admin account (password: admin)
                const bcrypt = require("bcrypt");
                bcrypt.hash("admin", 10, (err, hash) => {
                    if (!err) {
                        db.run(`INSERT INTO users (username, email, password_hash, role) VALUES ('admin', 'admin@kppedia.com', ?, 'admin')`, [hash], (err) => {
                            // Ignore error if already exists due to UNIQUE constraint
                        });
                    }
                });
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

        // Buat tabel documents
        const createDocumentsQuery = `
            CREATE TABLE IF NOT EXISTS documents (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                type TEXT NOT NULL,
                url TEXT NOT NULL,
                keywords TEXT NOT NULL
            )
        `;
        db.run(createDocumentsQuery, (err) => {
            if (err) {
                console.error("❌ Gagal membuat tabel documents:", err.message);
            } else {
                // Seed initial documents if empty
                db.get("SELECT COUNT(*) AS count FROM documents", (err, row) => {
                    if (!err && row.count === 0) {
                        const defaultDocs = require("./documents.json");
                        if(defaultDocs) {
                            const stmt = db.prepare("INSERT INTO documents (id, name, type, url, keywords) VALUES (?, ?, ?, ?, ?)");
                            defaultDocs.forEach(doc => {
                                stmt.run([doc.id, doc.name, doc.type, doc.url, JSON.stringify(doc.keywords)]);
                            });
                            stmt.finalize();
                        }
                    }
                });
            }
        });

        // Buat tabel checklists (master)
        const createChecklistsMasterQuery = `
            CREATE TABLE IF NOT EXISTS checklists (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL,
                description TEXT
            )
        `;
        db.run(createChecklistsMasterQuery, (err) => {
            if (err) console.error("❌ Gagal membuat tabel checklists:", err.message);
        });

        // Buat tabel checklist_subtasks
        const createChecklistSubtasksQuery = `
            CREATE TABLE IF NOT EXISTS checklist_subtasks (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                checklist_id INTEGER,
                title TEXT NOT NULL,
                FOREIGN KEY (checklist_id) REFERENCES checklists (id) ON DELETE CASCADE
            )
        `;
        db.run(createChecklistSubtasksQuery, (err) => {
            if (err) console.error("❌ Gagal membuat tabel checklist_subtasks:", err.message);
        });

        // Buat tabel eligibility_criteria
        const createEligibilityCriteriaQuery = `
            CREATE TABLE IF NOT EXISTS eligibility_criteria (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                min_sks INTEGER NOT NULL,
                min_ipk REAL NOT NULL,
                status_required TEXT DEFAULT 'aktif',
                prasyarat_required TEXT DEFAULT 'sudah'
            )
        `;
        db.run(createEligibilityCriteriaQuery, (err) => {
            if (err) {
                console.error("❌ Gagal membuat tabel eligibility_criteria:", err.message);
            } else {
                db.get("SELECT COUNT(*) AS count FROM eligibility_criteria", (err, row) => {
                    if (!err && row.count === 0) {
                        db.run("INSERT INTO eligibility_criteria (min_sks, min_ipk, status_required, prasyarat_required) VALUES (90, 2.0, 'aktif', 'sudah')");
                    }
                });
                
                // Fallback for existing database
                db.run("ALTER TABLE eligibility_criteria ADD COLUMN status_required TEXT DEFAULT 'aktif'", () => {});
                db.run("ALTER TABLE eligibility_criteria ADD COLUMN prasyarat_required TEXT DEFAULT 'sudah'", () => {});
            }
        });
    }
});

// Enable foreign keys
db.run("PRAGMA foreign_keys = ON;");

module.exports = db;