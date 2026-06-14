const fs = require('fs');
const path = require('path');
const { storeChunks } = require('./retriever');

const DATA_DIR = path.join(__dirname, 'data');

async function extractAndChunk() {
  const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');
  let fullText = '';

  const files = fs.readdirSync(DATA_DIR).filter(file => file.endsWith('.pdf'));

  for (const file of files) {
    const pdfPath = path.join(DATA_DIR, file);
    try {
      const dataBuffer = fs.readFileSync(pdfPath);
      const loadingTask = pdfjsLib.getDocument({
        data: new Uint8Array(dataBuffer),
      });
      const pdfDoc = await loadingTask.promise;

      for (let i = 1; i <= pdfDoc.numPages; i++) {
        const page = await pdfDoc.getPage(i);
        const content = await page.getTextContent();
        const pageText = content.items.map((item) => item.str).join(' ');
        fullText += pageText + '\n';
      }
    } catch (err) {
      console.error(`Gagal membaca ${file}:`, err.message);
    }
  }


  const cleanedText = cleanText(fullText);
  const chunks = chunkText(cleanedText, 200, 50);

  console.log(`Total chunks dari semua PDF : ${chunks.length}`);

  return chunks;
}

async function init() {
  try {
    const chunks = await extractAndChunk();
    storeChunks(chunks);
  } catch (err) {
    console.error("Gagal inisialisasi embedder:", err);
  }
}

function cleanText(text) {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/(\w)-\n(\w)/g, '$1$2')
    .trim();
}

function chunkText(text, chunkSize = 500, overlap = 50) {
  const words = text.split(/\s+/);
  const chunks = [];

  for (let i = 0; i < words.length; i += chunkSize - overlap) {
    const chunk = words.slice(i, i + chunkSize).join(' ');
    if (chunk.trim().length > 0) {
      chunks.push(chunk.trim());
    }
    if (i + chunkSize >= words.length) break;
  }

  return chunks;
}

module.exports = {
  extractAndChunk,
  init
};