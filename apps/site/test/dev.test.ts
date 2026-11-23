import { expect, test } from 'bun:test';
import { fileURLToPath } from 'node:url';

for (const base of ['/', '/prism-ui/']) test(`development serves pages and assets under ${base}`, async () => {
  const process = Bun.spawn(['bun', 'run', 'scripts/dev.ts'], {
    cwd: fileURLToPath(new URL('../', import.meta.url)),
    env: { ...Bun.env, SITE_BASE: base, NO_COLOR: '1' }, stdout: 'pipe', stderr: 'pipe',
  });
  try {
    let output = '', address = '';
    for await (const chunk of process.stdout) {
      output += new TextDecoder().decode(chunk);
      address = output.match(/http:\/\/localhost:\d+\/[^\s\x1b]*/)?.[0] ?? '';
      if (address) break;
    }
    if (!address) throw new Error(await new Response(process.stderr).text());
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
    process.kill(); await process.exited;
  }
}, 60000);
