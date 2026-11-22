import type { Patch } from '@prism-ui/state';
const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
export function parsePatch(source: string): Patch {
  const value: unknown = JSON.parse(source);
  if (!object(value) || !Object.keys(value).length || Object.keys(value).some(k => !['set', 'merge', 'delete'].includes(k))) throw new Error('Use a patch with set, merge, or delete keys.');
  for (const key of ['set', 'merge']) if (key in value && !object(value[key])) throw new Error(`${key} must be an object of store paths.`);
  if ('delete' in value && (!Array.isArray(value.delete) || value.delete.some(path => typeof path !== 'string'))) throw new Error('delete must be an array of store paths.');
  return value as Patch;
}
