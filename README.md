# 📋 Panduan Instalasi Chatbot KPedia - Untuk Tim Pengembang

Panduan lengkap untuk setup project chatbot KPedia. Ikuti langkah-langkah di bawah untuk memastikan environment Anda siap mengembangkan.

---

## 📋 Daftar Isi
- [Prasyarat Sistem](#prasyarat-sistem)
- [Langkah Instalasi](#langkah-instalasi)
- [Konfigurasi Environment](#konfigurasi-environment)
- [Menjalankan Project](#menjalankan-project)
- [Troubleshooting](#troubleshooting)

---

## 🖥️ Prasyarat Sistem

Sebelum memulai, pastikan Anda sudah memiliki tools berikut di komputer Anda:

### 1. **Node.js & npm**
Project ini menggunakan Node.js. Anda membutuhkan:
- **Node.js** versi 14+ (disarankan versi 18+)
- **npm** (biasanya sudah include dengan Node.js)

**Cek apakah sudah terinstall:**
```bash
node --version
npm --version
```

**Jika belum terinstall:**
- Download dari: https://nodejs.org/
- Pilih versi LTS (Long Term Support)
- Install sesuai sistem operasi Anda (Windows/Mac/Linux)

### 2. **Git**
Untuk clone dan manage repository.

**Cek apakah sudah terinstall:**
```bash
git --version
```

**Jika belum terinstall:**
- Download dari: https://git-scm.com/

### 3. **Text Editor / IDE** (Optional)
Disarankan menggunakan:
- **VS Code** (https://code.visualstudio.com/)
- **WebStorm**
- **Sublime Text**
- Atau editor favorit Anda

---

## 📦 Langkah Instalasi

### Langkah 1: Clone Repository

```bash
# Clone project ke komputer Anda
git clone https://github.com/chatbot-kppedia/chatbot-kppedia.git

# Masuk ke folder project
cd chatbot-kppedia
```

### Langkah 2: Install Dependencies

```bash
# Install semua package yang diperlukan
npm install
```

**Apa yang akan diinstall?**

Project ini menggunakan beberapa package penting:
- **Express.js** (v5.2.1) - Backend framework
- **CORS** (v2.8.6) - Untuk handle cross-origin requests
- **Groq SDK** (v1.2.1) - AI API client
- **Natural** (v8.1.1) - Natural Language Processing
- **PDF.js** (v6.0.227) - Extract text dari PDF

Proses instalasi ini akan membuat folder `node_modules/` dengan semua dependencies.

### Langkah 3: Setup Environment Variables

Project menggunakan file `.env` untuk menyimpan konfigurasi sensitif.

**Ada 2 cara setup:**

#### Cara 1: Copy dari template
```bash
# Jika ada file .env.example
cp .env.example .env
```

#### Cara 2: Buat manual
```bash
# Buat file .env di root directory
touch .env
```

Kemudian buka file `.env` dan tambahkan:
```
GROQ_API_KEY=your_api_key_here
```

**Dapatkan API Key:**
1. Kunjungi: https://console.groq.com/
2. Sign up atau login dengan akun Anda
3. Buat API key baru
4. Copy paste API key ke dalam file `.env`

⚠️ **PENTING:** 
- File `.env` sudah di-add ke `.gitignore`, jadi tidak akan ter-push ke repository
- Setiap tim member harus memiliki `.env` sendiri dengan API key mereka

---

## ⚙️ Konfigurasi Environment

### Structure Project

```
chatbot-kppedia/
├── backend/
│   ├── server.js          # Express server utama
│   ├── embedder.js        # Extract & process PDF
│   ├── retriever.js       # Retrieve relevant chunks
│   └── data/
│       └── Pedoman KP.pdf # Database (PDF)
├── index.html             # Frontend
├── script.js              # Frontend logic
├── style.css              # Frontend styling
├── package.json           # Project config & dependencies
├── package-lock.json      # Lock file untuk dependencies
├── .env                   # Environment variables (jangan commit!)
├── .gitignore             # Files yang di-ignore dari git
└── README.md              # Project documentation
```

### Port Server

Project berjalan di:
- **Backend Server:** `http://localhost:3000`
- **Frontend:** Accessible di `http://localhost:3000`

Jika ingin ubah port, buka `backend/server.js` dan cari baris:
```javascript
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => { ... })
```

---

## 🚀 Menjalankan Project

### Cara 1: Jalankan Backend (Production Mode)
```bash
# Dari root directory
node backend/server.js
```

Output yang seharusnya muncul:
```
✅ Server siap menerima pertanyaan!
Server berjalan di http://localhost:3000
```

### Cara 2: Jalankan dengan Development Mode (dengan hot reload)
```bash
# Install nodemon (global atau local)
npm install --save-dev nodemon

# Jalankan dengan nodemon
npx nodemon backend/server.js
```

### Akses Aplikasi
1. Buka browser
2. Kunjungi: `http://localhost:3000`
3. Interface chatbot siap digunakan

---

## 🔧 Troubleshooting

### Problem: "npm: command not found"
**Solusi:**
- Node.js belum terinstall dengan benar
- Install ulang dari https://nodejs.org/
- Restart terminal/computer

### Problem: "Cannot find module 'express'"
**Solusi:**
```bash
# Pastikan Anda sudah di folder project
cd chatbot-kppedia

# Install dependencies lagi
npm install
```

### Problem: "API_KEY is undefined"
**Solusi:**
- Pastikan file `.env` ada di root directory
- Pastikan format benar: `GROQ_API_KEY=your_key_here`
- Jangan ada spasi atau quote
- Restart server setelah edit `.env`

### Problem: "Port 3000 sudah digunakan"
**Solusi:**
```bash
# Jika di Mac/Linux, cari process yang menggunakan port 3000
lsof -i :3000

# Kill process tersebut (ganti PID dengan nomor yang muncul)
kill -9 <PID>

# Atau ubah port di backend/server.js
# Ubah: const PORT = process.env.PORT || 3000;
# Menjadi: const PORT = process.env.PORT || 3001;
```

### Problem: "PDF tidak ter-extract dengan baik"
**Solusi:**
- Pastikan file `backend/data/Pedoman KP.pdf` ada
- Cek ukuran file PDF tidak corrupt
- Lihat console untuk error detail
- Update path PDF jika diperlukan di `embedder.js`

### Problem: "CORS error"
**Solusi:**
- CORS sudah di-enable di server
- Pastikan request dari domain yang seharusnya
- Cek `backend/server.js` untuk CORS configuration

---

## 📝 Workflow Untuk Tim

### 1. **Setup Pertama (Setiap Anggota Tim)**
```bash
git clone https://github.com/chatbot-kppedia/chatbot-kppedia.git
cd chatbot-kppedia
npm install
cp .env.example .env  # atau buat manual
# Edit .env dengan API key Anda
```

### 2. **Saat Develop**
```bash
# Pull latest changes
git pull origin main

# Cek ada dependency baru?
npm install

# Jalankan dengan development mode
npx nodemon backend/server.js
```

### 3. **Sebelum Push ke Repository**
```bash
# Update .env jangan sampai ter-commit!
# Sudah di-ignore di .gitignore ✓

# Commit perubahan
git add .
git commit -m "Deskripsi perubahan"

# Push ke repository
git push origin branch-anda
```

---

## 📚 Dokumentasi Lebih Lanjut

- **Express.js Docs:** https://expressjs.com/
- **Groq API Docs:** https://console.groq.com/docs
- **Node.js Docs:** https://nodejs.org/docs/
- **Git Guide:** https://git-scm.com/doc

---

## ✅ Checklist Instalasi

Sebelum mulai develop, pastikan:

- [ ] Node.js v14+ terinstall
- [ ] npm terinstall dan working
- [ ] Git terinstall
- [ ] Repository sudah di-clone
- [ ] `npm install` sudah dijalankan
- [ ] File `.env` sudah dibuat
- [ ] API key sudah ditambahkan ke `.env`
- [ ] Server bisa dijalankan dengan `node backend/server.js`
- [ ] Bisa akses `http://localhost:3000` di browser
- [ ] Chatbot bisa menerima & merespons pertanyaan

---

## 💬 Butuh Bantuan?

Jika ada masalah atau pertanyaan:
1. Cek bagian **Troubleshooting** di atas
2. Lihat console error untuk detail
3. Hubungi tim lead
4. Buat issue di GitHub repository

---

## 📄 License

Project ini menggunakan ISC License. Lihat file `package.json` untuk detail lebih lanjut.

---

**Happy Coding Teman - Teman! 🚀**
