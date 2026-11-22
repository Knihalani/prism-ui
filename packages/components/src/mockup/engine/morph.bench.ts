import { Window } from 'happy-dom';
import { createStreamMorpher, morphDocument } from './morph';

const page = '<div class="page"><main><section class="products">' +
  Array.from({ length: 400 }, (_, i) => `<article id="card-${i}"><h2>Product ${i}</h2><p>A thoughtfully designed product for everyday creative work, with durable materials and a beautiful finish.</p><ul><li>Free delivery</li><li>Two year warranty</li></ul><button data-key="buy-${i}">Add to cart</button></article>`).join('') + '</section></main></div>';
const full = `<!doctype html><html><head><meta charset="utf-8"><style>article{padding:16px}</style><link rel="stylesheet" href="data:text/css,body%7Bmargin:0%7D"></head><body>${page}</body></html>`;
for (const [kind, source] of [['fragment', page], ['document', full]] as const) {
console.log(`${kind}: bytes=${source.length} chunkSize=50`);
for (const name of ['innerHTML', 'morphDocument', 'streamMorpher'] as const) {
  const doc = new Window().document as unknown as Document;
  const stream = createStreamMorpher(doc);
  const update = name === 'innerHTML' ? (html: string) => { (kind === 'document' ? doc.documentElement : doc.body).innerHTML = html; }
    : name === 'morphDocument' ? (html: string) => morphDocument(doc, html) : stream.update;
  const times: number[] = [];
  const start = performance.now();
  for (let size = 50; size < source.length + 50; size += 50) {
    const before = performance.now();
    update(source.slice(0, size));
    times.push(performance.now() - before);
  }
  const total = performance.now() - start;
  times.sort((a, b) => a - b);
  const expected = doc.implementation.createHTMLDocument('');
  expected.documentElement.innerHTML = source;
  if (doc.body.innerHTML !== expected.body.innerHTML) throw new Error(`${name}: final DOM differs from full parse`);
  console.log(`${name}: total=${total.toFixed(1)}ms chunks=${times.length} avg=${(total / times.length).toFixed(3)}ms p95=${times[Math.floor(times.length * 0.95)]!.toFixed(3)}ms`);
}
}
