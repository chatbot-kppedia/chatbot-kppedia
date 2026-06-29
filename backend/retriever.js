const natural = require("natural");
const TfIdf = natural.TfIdf;

let tfidf = new TfIdf();
let storedChunks = [];

// Simpan chunks ke TF-IDF
function storeChunks(chunks) {
  tfidf = new TfIdf();
  storedChunks = chunks;

  chunks.forEach((chunk) => {
    tfidf.addDocument(chunk);
  });

  console.log(`✅ ${chunks.length} chunks berhasil disimpan ke vector store`);
}

// Cari chunks paling relevan berdasarkan query
function retrieve(query, topK = 5) {
  if (storedChunks.length === 0) {
    throw new Error("Vector store kosong. Jalankan storeChunks() terlebih dahulu.");
  }

  // Gunakan query langsung tanpa ekspansi statis agar pencarian lebih akurat
  const expandedQuery = query;

  const scores = [];

  tfidf.tfidfs(expandedQuery, (i, measure) => {
    scores.push({
      index: i,
      score: measure
    });
  });

  // Urutkan dari skor tertinggi
  scores.sort((a, b) => b.score - a.score);

  // Ambil top-K chunks
  const topChunks = scores
    .slice(0, topK)
    .filter((item) => item.score > 0)
    .map((item) => storedChunks[item.index]);

  return topChunks;
}

module.exports = {
  storeChunks,
  retrieve
};