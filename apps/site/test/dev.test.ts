import { expect, test } from 'bun:test';
import { fetch } from 'bun';
import { fileURLToPath } from 'node:url';

for (const base of ['/', '/prism-ui/']) test(`development serves pages and assets under ${base}`, async () => {
  const child = Bun.spawn(['bun', 'run', 'scripts/dev.ts'], {
    cwd: fileURLToPath(new URL('../', import.meta.url)),
    env: { ...process.env, SITE_BASE: base, NO_COLOR: '1' }, stdout: 'pipe', stderr: 'pipe',
  });
  try {
    let output = '', address = '';
    const reader = child.stdout.getReader();
    try {
      while (!address) {
        const { done, value } = await reader.read();
        if (done) break;
        output += new TextDecoder().decode(value);
        address = output.match(/http:\/\/localhost:\d+\/[^\s\x1b]*/)?.[0] ?? '';
      }
    } finally { reader.releaseLock(); }
    if (!address) throw new Error(await new Response(child.stderr).text());
    for (const path of ['', 'components/pick/', 'docs/integration/']) {
      const response = await fetch(address + path);
      expect(response.status).toBe(200);
      expect(await response.text()).toContain('id="main"');
    }
    const asset = await fetch(address + 'src/client.ts');
    expect(asset.status).toBe(200);
    expect(asset.headers.get('content-type')).toContain('javascript');
    expect((await fetch(address + 'missing-page/')).status).toBe(404);
  } finally {
    child.kill(); await child.exited;
  }
}, 60000);
