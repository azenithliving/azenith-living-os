/**
 * Does the local Arabic reader actually run in this project's Node — and can it read
 * numbers written on a paper-like image? Measured before any parser is designed on
 * top of it. Builds a sketch-like PNG with sharp, then reads it with the bundled
 * offline engine.
 */
import sharp from 'sharp';

const svg = `<svg width="900" height="620" xmlns="http://www.w3.org/2000/svg">
  <rect width="900" height="620" fill="#f7f4ec"/>
  <rect x="120" y="120" width="640" height="360" fill="none" stroke="#222" stroke-width="6"/>
  <text x="440" y="100" font-family="Arial" font-size="44" text-anchor="middle" fill="#111">4.50 m</text>
  <text x="800" y="300" font-family="Arial" font-size="44" text-anchor="middle" fill="#111">3.20 m</text>
  <text x="300" y="520" font-family="Arial" font-size="40" text-anchor="middle" fill="#111">1.00</text>
</svg>`;

const png = await sharp(Buffer.from(svg)).png().toBuffer();
console.log(`fixture png bytes=${png.length}`);

const started = Date.now();
try {
  const { createWorker } = await import('tesseract.js');
  const worker = await createWorker('ara+eng');
  const result = await worker.recognize(png);
  await worker.terminate();
  const digits = (result.data.text.match(/\d+[.,]?\d*/g) || []).join(' ');
  console.log(`OCR ok in ${((Date.now() - started) / 1000).toFixed(1)}s confidence=${result.data.confidence}`);
  console.log(`raw text: ${JSON.stringify(result.data.text.trim().slice(0, 160))}`);
  console.log(`numbers read: ${JSON.stringify(digits)}`);
} catch (e) {
  console.log(`OCR FAILED after ${((Date.now() - started) / 1000).toFixed(1)}s: ${e.message}`);
}
