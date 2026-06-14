const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'backend', 'users.db');
const db = new sqlite3.Database(dbPath);

const checklistStages = [
  {
    title: "Verifikasi Syarat Kerja Praktik",
    description: "Pastikan telah lulus minimal 90 SKS dan memenuhi syarat KP.",
  },
  {
    title: "Pencarian Instansi & Konsultasi Dosen Pembimbing Akademik",
    description: "Mencari perusahaan tujuan dan berdiskusi dengan Dosen Pembimbing Akademik.",
  },
  {
    title: "Penyusunan Proposal Kerja Praktik",
    description: "Menyusun proposal sesuai format pedoman KP.",
  },
  {
    title: "Pengajuan Permohonan Kerja Praktik",
    description: "Mengisi formulir pengajuan KP dan mengunggah proposal.",
  },
  {
    title: "Pengajuan Surat Pengantar TOSS",
    description: "Mengajukan surat pengantar KP melalui TOSS.",
  },
  {
    title: "Pengiriman Proposal ke Instansi",
    description: "Mengirim surat pengantar dan proposal ke perusahaan tujuan.",
  },
  {
    title: "Penerimaan dari Instansi",
    description: "Menerima surat penerimaan dari perusahaan atau instansi.",
  },
  {
    title: "Pelaksanaan Kerja Praktik",
    description: "Melaksanakan KP sesuai jadwal, minimal 6 minggu.",
    subTasks: [
      "Pelaksanaan Tugas KP sesuai Rencana dan Arahan Pembimbing Lapangan",
      "Mengumpulkan Data dan Informasi terkait Tugas KP",
      "Dokumentasi Kegiatan KP",
      "Bimbingan DPA 1",
      "Bimbingan DPA 2",
      "Bimbingan DPA 3",
      "Bimbingan DPA 4",
      "Bimbingan Lapangan 1",
      "Bimbingan Lapangan 2",
      "Bimbingan Lapangan 3",
      "Bimbingan Lapangan 4",
      "Menyelesaikan Tugas dari Pembimbing Lapangan",
      "Penyampaian Hasil KP ke Perusahaan",
      "Penilaian Perusahaan Diterima",
      "Selesai KP",
    ],
  },
  {
    title: "Penyusunan Laporan Kerja Praktik",
    description: "Menyusun laporan akhir berdasarkan hasil KP.",
  },
  {
    title: "Presentasi Hasil Kerja Praktik",
    description: "Melakukan presentasi hasil KP kepada dosen pembimbing.",
  },
  {
    title: "Pengumpulan Laporan Akhir",
    description: "Mengunggah laporan ke OpenLib dan mengisi formulir pengumpulan.",
  },
];

db.serialize(() => {
  db.run("DELETE FROM checklist_subtasks");
  db.run("DELETE FROM checklists");

  checklistStages.forEach((stage) => {
    db.run("INSERT INTO checklists (title, description) VALUES (?, ?)", [stage.title, stage.description], function(err) {
      if (err) return console.error(err);
      const checklistId = this.lastID;
      
      if (stage.subTasks) {
        stage.subTasks.forEach(sub => {
          db.run("INSERT INTO checklist_subtasks (checklist_id, title) VALUES (?, ?)", [checklistId, sub]);
        });
      }
    });
  });
});

// We can't close immediately if we have async callbacks from db.run inside the loop, 
// wait a little bit or just don't close.
setTimeout(() => {
  db.close((err) => {
    if (err) console.error(err.message);
    else console.log('Seeding checklists completed.');
  });
}, 2000);
