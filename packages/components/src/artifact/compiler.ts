const defaultCompiler = 'https://esm.sh/sucrase@3.35.0/es2022/sucrase.bundle.mjs';
const MAX_SOURCE = 1_000_000;
type Request = { id: number; source: string };
type Response = { id: number; code?: string; error?: string };

function compilerRuntime(url: string) {
  const worker = self;
  let transformer: Promise<{ transform(source: string, options: object): { code: string } }> | undefined;
  const cache = new Map<string, { source: string; code: string }>();
  const encoder = new TextEncoder();
  worker.addEventListener('message', async ({ data }: MessageEvent<Request>) => {
    const { id, source } = data;
    try {
      let key: string;
      if (crypto.subtle) key = new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(source))).join(',');
      else {
        let hash = 2166136261;
        for (let i = 0; i < source.length; i++) hash = Math.imul(hash ^ source.charCodeAt(i), 16777619);
        key = String(hash);
      }
      const existing = cache.get(key);
      if (existing?.source === source) {
        cache.delete(key); cache.set(key, existing);
        worker.postMessage({ id, code: existing.code } satisfies Response);
        return;
      }
      transformer ??= import(url).catch(error => { transformer = undefined; throw error; });
      const { code } = (await transformer).transform(source, {
        transforms: ['typescript', 'jsx'], jsxRuntime: 'automatic', production: true,
      });
      cache.set(key, { source, code });
      if (cache.size > 32) cache.delete(cache.keys().next().value!);
      worker.postMessage({ id, code } satisfies Response);
    } catch (error) {
      worker.postMessage({ id, error: error instanceof Error ? error.message : String(error) } satisfies Response);
    }
  });
}

type Pending = { resolve: (code: string) => void; reject: (error: Error) => void };
const workers = new Map<string, { worker: Worker; pending: Map<number, Pending> }>();
let sequence = 0;

export async function compileArtifact(source: string, compilerUrl = defaultCompiler): Promise<string> {
  if (source.length > MAX_SOURCE) throw new Error('Artifact source exceeds 1 MB.');
  const url = new URL(compilerUrl, document.baseURI).href;
  let entry = workers.get(url);
  if (!entry) {
    const blob = URL.createObjectURL(new Blob([`(${compilerRuntime.toString()})(${JSON.stringify(url)})`], { type: 'text/javascript' }));
    let worker: Worker;
    try { worker = new Worker(blob, { type: 'module', name: 'prism-artifact' }); }
    finally { URL.revokeObjectURL(blob); }
    const pending = new Map<number, Pending>();
    worker.onmessage = ({ data }: MessageEvent<Response>) => {
      const task = pending.get(data.id);
      if (!task) return;
      pending.delete(data.id);
      if (data.code !== undefined) task.resolve(data.code);
      else task.reject(new Error(data.error ?? 'Unable to compile artifact.'));
    };
    worker.onerror = () => {
      workers.delete(url); worker.terminate();
      for (const task of pending.values()) task.reject(new Error('Unable to start the artifact compiler.'));
      pending.clear();
    };
    workers.set(url, entry = { worker, pending });
  }
  const { worker, pending } = entry;
  const id = ++sequence;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      pending.delete(id); reject(new Error('Artifact compilation timed out.'));
    }, 20_000);
    pending.set(id, { resolve: code => { clearTimeout(timer); resolve(code); }, reject: error => { clearTimeout(timer); reject(error); } });
    worker.postMessage({ id, source } satisfies Request);
  });
}
