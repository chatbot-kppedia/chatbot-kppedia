/**
 * Database Verification Script
 * Checks connection to MySQL and validates that all required tables and columns exist.
 */
const mysql = require('mysql2');
const path = require('path');

require('dotenv').config({
  path: path.resolve(__dirname, './.env')
});

const dbConfig = {
  host: process.env.DB_HOST || "localhost",
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  port: parseInt(process.env.DB_PORT || "3306", 10),
  database: process.env.DB_NAME || "chatbot-kppedia"
};

console.log("🔍 Memulai verifikasi database MySQL...");
console.log(`📡 Menghubungkan ke host: ${dbConfig.host}:${dbConfig.port}, user: ${dbConfig.user}, database: ${dbConfig.database}`);

const connection = mysql.createConnection({
  host: dbConfig.host,
  user: dbConfig.user,
  password: dbConfig.password,
  port: dbConfig.port,
  database: dbConfig.database
});

connection.connect((err) => {
  if (err) {
    console.error("❌ Gagal terhubung ke database MySQL!");
    console.error(err.message);
    process.exit(1);
  }
  console.log("✅ Koneksi database MySQL berhasil.");

  // Memeriksa tabel yang ada
  connection.query("SHOW TABLES", (err, results) => {
    if (err) {
      console.error("❌ Gagal mengambil daftar tabel!");
      console.error(err.message);
      connection.end();
      process.exit(1);
    }

    const tables = results.map(row => Object.values(row)[0]);
    console.log("📊 Tabel yang terdeteksi di database:", tables);

    const requiredTables = [
      'users', 'conversations', 'messages', 'user_checklists', 
      'documents', 'checklists', 'checklist_subtasks', 
      'eligibility_criteria', 'checklist_submissions'
    ];

    let allTablesExist = true;
    requiredTables.forEach(table => {
      if (tables.includes(table)) {
        console.log(`  🔹 Tabel [${table}]: Ada`);
      } else {
        console.error(`  ❌ Tabel [${table}]: TIDAK ADA!`);
        allTablesExist = false;
      }
    });

    if (!allTablesExist) {
      console.error("❌ Struktur tabel tidak lengkap. Pastikan backend server dijalankan terlebih dahulu untuk menginisialisasi tabel.");
      connection.end();
      process.exit(1);
    }

    console.log("✅ Semua tabel utama terverifikasi.");

    // Memeriksa kolom u.username di tabel users
    connection.query("DESCRIBE users", (err, cols) => {
      if (err) {
        console.error("❌ Gagal memeriksa struktur tabel 'users'!");
        console.error(err.message);
        connection.end();
        process.exit(1);
      }

      const colNames = cols.map(c => c.Field);
      
      // Cek apakah 'username' ada (dan bukan 'name')
      if (colNames.includes('username')) {
        console.log("  🔹 Kolom 'username' pada tabel 'users': Terverifikasi");
      } else {
        console.error("  ❌ Kolom 'username' pada tabel 'users' tidak ditemukan!");
      }

      // Cek apakah ada kolom penunjang kelayakan
      const extraCols = ['is_eligible', 'alamat', 'kelas', 'foto_profil'];
      extraCols.forEach(col => {
        if (colNames.includes(col)) {
          console.log(`  🔹 Kolom [${col}] pada tabel 'users': Terverifikasi`);
        } else {
          console.error(`  ❌ Kolom [${col}] pada tabel 'users' tidak ditemukan!`);
        }
      });

      // Cek akun admin default
      connection.query("SELECT id, username, role FROM users WHERE role = 'admin'", (err, adminUsers) => {
        if (err) {
          console.error("❌ Gagal memeriksa user admin!");
        } else {
          console.log("👑 User Admin Terdaftar:", adminUsers);
        }

        console.log("🎉 Verifikasi database selesai dengan sukses!");
        connection.end();
      });
    });
  });
});
