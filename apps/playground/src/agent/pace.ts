export interface Pace { thinking: () => number; delay: (chunk: string) => number; words: () => number }
export const fast: Pace = { thinking: () => 0, delay: () => 0, words: () => 3 };
export const realistic: Pace = {
  thinking: () => 400 + Math.random() * 400,
  delay: chunk => 15 + Math.random() * 30 + (/[.,?\n]\s*$/.test(chunk) ? 100 : 0),
  words: () => 1 + Math.floor(Math.random() * 3),
};
export function pause(ms: number, signal: AbortSignal): Promise<void> {
  if (!ms || signal.aborted) return Promise.resolve();
  return new Promise(resolve => {
    const finish = () => { clearTimeout(timer); signal.removeEventListener('abort', finish); resolve(); };
    const timer = setTimeout(finish, ms);
    signal.addEventListener('abort', finish, { once: true });
  });
}
export function* chunks(text: string, pace: Pace): Generator<string> {
  const units = text.match(/```[^\n]*\n[\s\S]*?(?:```|$)|^:{2,}[^\n]*(?:\n|$)|:[a-z]+\[[^\]]*\]\{[^}]*\}|\S+\s*|\s+/gm) ?? [];
  for (let i = 0; i < units.length;) {
    let chunk = units[i++];
    if (!/^(?:```|:)/.test(chunk)) {
      const count = Math.max(1, Math.min(3, pace.words()));
      for (let n = 1; n < count && i < units.length && !/^(?:```|:)/.test(units[i]); n++) chunk += units[i++];
    }
    yield chunk;
  }
}
export async function* streamText(text: string, signal: AbortSignal, pace: Pace = realistic) {
  await pause(pace.thinking(), signal);
  for (const delta of chunks(text, pace)) {
    if (signal.aborted) return;
    await pause(pace.delay(delta), signal);
    if (signal.aborted) return;
    yield delta;
  }
}
