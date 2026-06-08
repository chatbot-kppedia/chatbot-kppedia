const fs = require('fs');
const path = require('path');

const PDF_PATH = path.join(__dirname, 'data', 'Pedoman KP.pdf');

async function extractAndChunk() {
  const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');

  const dataBuffer = fs.readFileSync(PDF_PATH);
  const loadingTask = pdfjsLib.getDocument({
    data: new Uint8Array(dataBuffer),
  });
  const pdfDoc = await loadingTask.promise;

  let fullText = '';

  for (let i = 1; i <= pdfDoc.numPages; i++) {
    const page = await pdfDoc.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items.map((item) => item.str).join(' ');
    fullText += pageText + '\n';
  }

  const cleanedText = cleanText(fullText);
  const chunks = chunkText(cleanedText, 200, 50);

  console.log(`Total halaman : ${pdfDoc.numPages}`);
  console.log(`Total chunks  : ${chunks.length}`);
  console.log(`\nContoh chunk pertama:\n`);
  console.log(chunks[0]);

  return chunks;
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

module.exports = { extractAndChunk };
