export function interpolate(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (placeholder, key: string) => Object.hasOwn(values, key) && values[key] !== undefined ? String(values[key]) : placeholder);
}
