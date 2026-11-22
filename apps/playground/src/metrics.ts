export const metrics = { chunks: 0, bytes: 0, parseMs: 0, commits: 0 };
export function resetMetrics() { metrics.chunks = 0; metrics.bytes = 0; metrics.parseMs = 0; metrics.commits = 0; }
export function measure<T>(fn: () => T): T {
  const start = performance.now();
  try { return fn(); } finally { metrics.parseMs += performance.now() - start; }
}
