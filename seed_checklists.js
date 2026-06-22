const path = require('path');
const db = require('./backend/database');

const checklistStages = [
  {
    title: "Verifikasi Syarat KP",
    description: "Pastikan telah lulus minimal 90 SKS dan memenuhi syarat KP.",
  },
  {
    title: "Pencarian Instansi dan Konsultasi DPA",
    description: "Mencari perusahaan tujuan dan berdiskusi dengan Dosen Pembimbing Akademik.",
  },
  {
    title: "Penyusunan Proposal KP",
    description: "Menyusun proposal sesuai format pedoman KP.",
  },
  {
    title: "Pengajuan Permohonan KP",
    description: "Mengisi formulir pengajuan KP dan mengunggah proposal.",
  },
  {
    title: "Pengajuan Surat Pengantar melalui TOSS",
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
    title: "Penyusunan Laporan KP",
    description: "Menyusun laporan akhir berdasarkan hasil KP.",
  },
  {
    title: "Presentasi Hasil KP",
    description: "Melakukan presentasi hasil KP kepada dosen pembimbing.",
  },
  {
    title: "Pengumpulan Laporan Akhir",
    description: "Mengunggah laporan ke OpenLib dan mengisi formulir pengumpulan.",
  },
];

const runQuery = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
};

async function seed() {
  try {
    await runQuery("DELETE FROM checklist_subtasks");
    await runQuery("DELETE FROM checklists");
    try {
      await runQuery("ALTER TABLE checklists AUTO_INCREMENT = 1");
      await runQuery("ALTER TABLE checklist_subtasks AUTO_INCREMENT = 1");
    } catch (e) {
      console.error("Gagal mereset auto-increment:", e.message);
    }

    for (let idx = 0; idx < checklistStages.length; idx++) {
      const stage = checklistStages[idx];
      const checklistId = idx + 1;
      await runQuery("INSERT INTO checklists (id, title, description) VALUES (?, ?, ?)", [checklistId, stage.title, stage.description]);
      
      if (stage.subTasks) {
        for (const sub of stage.subTasks) {
          await runQuery("INSERT INTO checklist_subtasks (checklist_id, title) VALUES (?, ?)", [checklistId, sub]);
        }
      }
    }
    console.log('Seeding checklists completed successfully.');
  } catch (err) {
    console.error('Error seeding checklists:', err);
  } finally {
    db.close((err) => {
      if (err) console.error(err.message);
    });
  }
}

seed();
