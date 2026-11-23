export function formatSource(source: string) {
  return source.replace(/^(```ui:[\w]+[^\n]*\n)([\s\S]*?)(\n```)/gm, (match, start, payload, end) => {
    try { return start + JSON.stringify(JSON.parse(payload), null, 2) + end; }
    catch { return match; }
  });
}
