import { parseWireframe, renderWireframe } from './wireframe';

const src = Array.from({ length: 100 }, (_, i) => `card\n  ### Project ${i}\n  row: img 16:9 | text*3 | [[Open project]]`).join('\n');
const times: number[] = [];
let bytes = 0;
for (let i = 0; i < 110; i++) {
  const start = performance.now();
  bytes = renderWireframe(parseWireframe(src)).length;
  if (i >= 10) times.push(performance.now() - start);
}
times.sort((a, b) => a - b);
const total = times.reduce((a, b) => a + b, 0);
console.log(`wireframe: lines=300 runs=${times.length} html=${bytes} bytes total=${total.toFixed(2)}ms avg=${(total / times.length).toFixed(3)}ms p95=${times[Math.floor(times.length * 0.95)]!.toFixed(3)}ms`);
