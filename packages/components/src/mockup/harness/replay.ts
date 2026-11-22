export function replayStart(source: string) {
  const body = source.indexOf('\n') + 1;
  const style = /^\s*<style\b[^>]*>[\s\S]*?<\/style>\s*/i.exec(source.slice(body));
  return source.slice(0, body + (style?.[0].length ?? 0) + 160);
}
