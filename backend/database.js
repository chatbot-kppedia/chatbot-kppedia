const mysql = require("mysql2");
const path = require("path");
const fs = require("fs");

require("dotenv").config({
  path: path.resolve(__dirname, "../.env")
});

const dbConfig = {
  host: process.env.DB_HOST || "localhost",
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  port: parseInt(process.env.DB_PORT || "3306", 10),
  database: process.env.DB_NAME || "chatbot-kppedia",
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
};

// Create connection pool
const pool = mysql.createPool(dbConfig);

// Emulate sqlite3 API on top of MySQL connection pool
const db = {
  get(sql, params, callback) {
    if (typeof params === 'function') {
      callback = params;
      params = [];
    }
    pool.query(sql, params, (err, results) => {
      if (err) {
        if (callback) callback(err);
        return;
      }
      if (callback) {
        callback(null, results && results.length > 0 ? results[0] : null);
      }
    });
  },

  all(sql, params, callback) {
    if (typeof params === 'function') {
      callback = params;
      params = [];
    }
    pool.query(sql, params, (err, results) => {
      if (err) {
        if (callback) callback(err);
        return;
      }
      if (callback) {
        callback(null, results || []);
      }
    });
  },

  run(sql, params, callback) {
    if (typeof params === 'function') {
      callback = params;
      params = [];
    }
    pool.query(sql, params, function (err, results) {
      if (err) {
        if (callback) callback(err);
        return;
      }
      if (callback) {
        const context = {
          lastID: results ? results.insertId : null,
          changes: results ? results.affectedRows : null
        };
        callback.call(context, null);
      }
    });
  },

  prepare(sql) {
    return {
      run(params, callback) {
        if (typeof params === 'function') {
          callback = params;
          params = [];
        }
        pool.query(sql, params, (err, results) => {
          if (callback) {
            const context = {
              lastID: results ? results.insertId : null,
              changes: results ? results.affectedRows : null
            };
            callback.call(context, err);
          }
        });
      },
      finalize(callback) {
        if (callback) callback(null);
      }
    };
  },

  close(callback) {
    pool.end((err) => {
      if (callback) callback(err);
    });
  }
};

// Initialize Database structure (tables)
const initializeDatabase = async () => {
  const connection = mysql.createConnection({
    host: dbConfig.host,
    user: dbConfig.user,
    password: dbConfig.password,
    port: dbConfig.port
  });

  // 1. Create DB if not exists
  await new Promise((resolve, reject) => {
    connection.query(`CREATE DATABASE IF NOT EXISTS \`${dbConfig.database}\``, (err) => {
      if (err) {
        console.error("❌ Gagal membuat database MySQL:", err.message);
        reject(err);
      } else {
        console.log(`✅ Database MySQL '${dbConfig.database}' siap.`);
        resolve();
      }
    });
  });
  connection.end();

  // 2. Create tables sequentially
  const runQuery = (sql) => {
    return new Promise((resolve, reject) => {
      pool.query(sql, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  };

  try {
    // Table users
    await runQuery(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(255) UNIQUE,
        email VARCHAR(255) UNIQUE,
        password_hash VARCHAR(255),
        google_id VARCHAR(255) UNIQUE,
        role VARCHAR(50) DEFAULT 'user',
        is_eligible TINYINT(1) DEFAULT 0,
        alamat TEXT,
        kelas VARCHAR(50),
        foto_profil TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB
    `);
    console.log("✅ Tabel 'users' siap.");

    // Table conversations
    await runQuery(`
      CREATE TABLE IF NOT EXISTS conversations (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT,
        title VARCHAR(255),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB
    `);
    console.log("✅ Tabel 'conversations' siap.");

    // Table messages
    await runQuery(`
      CREATE TABLE IF NOT EXISTS messages (
        id INT AUTO_INCREMENT PRIMARY KEY,
        conversation_id INT,
        role VARCHAR(50),
        content TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
      ) ENGINE=InnoDB
    `);
    console.log("✅ Tabel 'messages' siap.");

    // Table user_checklists
    await runQuery(`
      CREATE TABLE IF NOT EXISTS user_checklists (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT,
        task_id VARCHAR(255),
        is_completed TINYINT(1) DEFAULT 0,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE KEY user_task_unique (user_id, task_id)
      ) ENGINE=InnoDB
    `);
    console.log("✅ Tabel 'user_checklists' siap.");

    // Table documents
    await runQuery(`
      CREATE TABLE IF NOT EXISTS documents (
        id VARCHAR(255) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        type VARCHAR(50) NOT NULL,
        url VARCHAR(255) NOT NULL,
        keywords TEXT NOT NULL
      ) ENGINE=InnoDB
    `);
    console.log("✅ Tabel 'documents' siap.");

    // Table checklists (master)
    await runQuery(`
      CREATE TABLE IF NOT EXISTS checklists (
        id INT AUTO_INCREMENT PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        description TEXT
      ) ENGINE=InnoDB
    `);
    console.log("✅ Tabel 'checklists' siap.");

    // Table checklist_subtasks
    await runQuery(`
      CREATE TABLE IF NOT EXISTS checklist_subtasks (
        id INT AUTO_INCREMENT PRIMARY KEY,
        checklist_id INT,
        title VARCHAR(255) NOT NULL,
        FOREIGN KEY (checklist_id) REFERENCES checklists(id) ON DELETE CASCADE
      ) ENGINE=InnoDB
    `);
    console.log("✅ Tabel 'checklist_subtasks' siap.");

    // Table eligibility_criteria
    await runQuery(`
      CREATE TABLE IF NOT EXISTS eligibility_criteria (
        id INT AUTO_INCREMENT PRIMARY KEY,
        min_sks INT NOT NULL,
        min_ipk DOUBLE NOT NULL,
        status_required VARCHAR(50) DEFAULT 'aktif',
        prasyarat_required VARCHAR(50) DEFAULT 'sudah'
      ) ENGINE=InnoDB
    `);
    console.log("✅ Tabel 'eligibility_criteria' siap.");

    // Table checklist_submissions
    await runQuery(`
      CREATE TABLE IF NOT EXISTS checklist_submissions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        task_id VARCHAR(255) NOT NULL,
        file_url VARCHAR(255) NOT NULL,
        status VARCHAR(50) DEFAULT 'pending',
        admin_feedback TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB
    `);
    console.log("✅ Tabel 'checklist_submissions' siap.");

    // Seed default eligibility criteria if empty
    db.get("SELECT COUNT(*) AS count FROM eligibility_criteria", (err, row) => {
      if (!err && row && row.count === 0) {
        db.run("INSERT INTO eligibility_criteria (min_sks, min_ipk, status_required, prasyarat_required) VALUES (90, 2.0, 'aktif', 'sudah')");
      }
    });

    // Seed default admin if empty
    db.get("SELECT COUNT(*) AS count FROM users WHERE role = 'admin'", (err, row) => {
      if (!err && row && row.count === 0) {
        const bcrypt = require("bcrypt");
        bcrypt.hash("admin", 10, (err, hash) => {
          if (!err) {
            db.run(`INSERT INTO users (username, email, password_hash, role) VALUES ('admin', 'admin@kppedia.com', ?, 'admin')`, [hash]);
          }
        });
      }
    });

    // Seed default documents if empty
    db.get("SELECT COUNT(*) AS count FROM documents", (err, row) => {
      if (!err && row && row.count === 0) {
        const docPath = path.join(__dirname, "documents.json");
        if (fs.existsSync(docPath)) {
          const defaultDocs = require("./documents.json");
          if (defaultDocs && defaultDocs.length > 0) {
            const stmt = db.prepare("INSERT INTO documents (id, name, type, url, keywords) VALUES (?, ?, ?, ?, ?)");
            defaultDocs.forEach(doc => {
              stmt.run([doc.id, doc.name, doc.type, doc.url, JSON.stringify(doc.keywords)]);
            });
            stmt.finalize();
            console.log("✅ Seeding documents master default berhasil.");
          }
        }
      }
    });

  } catch (error) {
    console.error("❌ Gagal menginisialisasi tabel-tabel MySQL:", error.message);
  }
};

initializeDatabase();

module.exports = db;