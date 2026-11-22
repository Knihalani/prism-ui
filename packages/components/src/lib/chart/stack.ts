export type StackOffset = 'none' | 'expand' | 'diverging';
export type StackSeries<K> = [number, number][] & { key: K };
export function stack<T extends object, K extends keyof T>(data: readonly T[], keys: readonly K[], { offset = 'none' }: { offset?: StackOffset } = {}): StackSeries<K>[] {
  const series = keys.map(key => Object.assign(new Array<[number, number]>(data.length), { key }));
  for (let row = 0; row < data.length; row++) {
    let total = 0;
    if (offset === 'expand') for (const key of keys) { const value = data[row][key]; if (typeof value === 'number' && Number.isFinite(value)) total += Math.abs(value); }
    let positive = 0, negative = 0;
    for (let col = 0; col < keys.length; col++) {
      const raw = data[row][keys[col]];
      let value = typeof raw === 'number' && Number.isFinite(raw) ? raw : 0;
      if (offset === 'expand') value = total ? value / total : 0;
      if (offset === 'diverging' && value < 0) { series[col][row] = [negative, negative + value]; negative += value; }
      else { series[col][row] = [positive, positive + value]; positive += value; }
    }
  }
  return series;
}
