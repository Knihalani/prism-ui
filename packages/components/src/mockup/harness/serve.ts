import { join } from 'node:path';

const directory = import.meta.dir;
const build = Bun.spawnSync(['bun', 'build', join(directory, 'entry.tsx'), '--outdir', join(directory, '.build'), '--target', 'browser'], { stdout: 'inherit', stderr: 'inherit' });
if (build.exitCode) process.exit(build.exitCode);
Bun.serve({ hostname: '127.0.0.1', port: 3417, async fetch(request) {
  const name = new URL(request.url).pathname;
  if (name === '/entry.js' || name === '/entry.css') return new Response(Bun.file(join(directory, '.build', name.slice(1))));
  return new Response(Bun.file(join(directory, 'index.html')));
} });
console.log('Mockup harness: http://127.0.0.1:3417/?only=1&theme=light');
