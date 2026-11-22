export interface LinkBoundary { labelEnd: number; end: number; targetEnd?: number; referenceStart?: number }

/** Shared atom boundaries: delimiters inside code, links and autolinks cannot close emphasis. */
export class Precedence {
  private code?: Map<number, { length: number; close: number }>;
  private brackets?: Map<number, number>;
  private links = new Map<number, LinkBoundary | null>();
  constructor(private text: string, private atomEnd?: (pos: number) => number | undefined) {}

  codeAt(start: number): { length: number; close: number } {
    if (!this.code) {
      const runs: { start: number; length: number }[] = [];
      for (let i = 0; i < this.text.length; i++) {
        if (this.text.charCodeAt(i) !== 96) continue;
        const start = i; while (this.text.charCodeAt(i + 1) === 96) i++;
        runs.push({ start, length: i - start + 1 });
      }
      this.code = new Map(); const next = new Map<number, number>();
      for (let i = runs.length - 1; i >= 0; i--) {
        const run = runs[i]; this.code.set(run.start, { length: run.length, close: next.get(run.length) ?? -1 }); next.set(run.length, run.start);
      }
    }
    return this.code.get(start)!;
  }

  private bracketEnd(start: number): number {
    if (!this.brackets) {
      this.brackets = new Map(); const stack: number[] = [];
      for (let i = 0; i < this.text.length; i++) {
        const c = this.text.charCodeAt(i);
        if (c === 92) { i++; continue; }
        if (c === 96) { const span = this.codeAt(i); if (span.close >= 0) i = span.close + span.length - 1; else i += span.length - 1; }
        else if (c === 91) stack.push(i);
        else if (c === 93 && stack.length) this.brackets.set(stack.pop()!, i);
      }
    }
    return this.brackets.get(start) ?? -1;
  }

  linkAt(start: number): LinkBoundary | undefined {
    const cached = this.links.get(start); if (cached !== undefined) return cached ?? undefined;
    const labelEnd = this.bracketEnd(start);
    if (labelEnd < 0) { this.links.set(start, null); return; }
    const result: LinkBoundary = { labelEnd, end: labelEnd + 1 };
    if (this.text[labelEnd + 1] === '(') {
      let depth = 1; let quote = '';
      for (let i = labelEnd + 2; i < this.text.length; i++) {
        const c = this.text[i];
        if (c === '\\') { i++; continue; }
        if (quote) { if (c === quote) quote = ''; }
        else if (c === '"' || c === "'") quote = c;
        else if (c === '(') depth++;
        else if (c === ')' && --depth === 0) { result.targetEnd = i; result.end = i + 1; break; }
      }
    } else if (this.text[labelEnd + 1] === '[') {
      const end = this.bracketEnd(labelEnd + 1);
      if (end >= 0) { result.referenceStart = labelEnd + 2; result.end = end + 1; }
    }
    this.links.set(start, result); return result;
  }

  autolinkEnd(start: number): number {
    const end = this.text.indexOf('>', start + 1);
    if (end < 0) return -1;
    const url = this.text.slice(start + 1, end);
    return /^(?:https?:\/\/|mailto:)[^\s<>]+$/i.test(url) || /^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/.test(url) ? end : -1;
  }

  find(marker: string, from: number): number {
    for (let i = from; i < this.text.length; i++) {
      const end = this.atomEnd?.(i);
      if (end !== undefined) { i = end - 1; continue; }
      const c = this.text.charCodeAt(i);
      if (c === 92) { i++; continue; }
      if (c === 96) { const span = this.codeAt(i); if (span.close >= 0) i = span.close + span.length - 1; else i += span.length - 1; continue; }
      if (c === 91) { const link = this.linkAt(i); if (link) { i = link.end - 1; continue; } }
      if (c === 60) { const end = this.autolinkEnd(i); if (end >= 0) { i = end; continue; } }
      if (c === 104 && (i === 0 || this.text.charCodeAt(i - 1) <= 32) && (this.text.startsWith('http://', i) || this.text.startsWith('https://', i))) {
        while (i + 1 < this.text.length && this.text.charCodeAt(i + 1) > 32 && this.text[i + 1] !== '<' && this.text[i + 1] !== '>') i++;
        continue;
      }
      if (this.text.startsWith(marker, i)) return i;
    }
    return -1;
  }
}
