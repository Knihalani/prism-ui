import { artifactStrings } from './strings';
export type ArtifactKind = 'html' | 'react' | 'svg' | 'js' | 'markdown';

export const defaultArtifactImports = Object.freeze({
  react: 'https://esm.sh/react@19.0.0/es2022/react.mjs',
  'react/jsx-runtime': 'https://esm.sh/react@19.0.0/es2022/jsx-runtime.mjs',
  'react-dom': 'https://esm.sh/react-dom@19.0.0/X-ZXJlYWN0/es2022/react-dom.bundle.mjs',
  'react-dom/client': 'https://esm.sh/react-dom@19.0.0/X-ZXJlYWN0/es2022/client.bundle.mjs',
  'lucide-react': 'https://esm.sh/lucide-react@0.468.0/X-ZXJlYWN0/es2022/lucide-react.bundle.mjs',
  'd3-scale': 'https://esm.sh/d3-scale@4.0.2/es2022/d3-scale.bundle.mjs',
  'date-fns': 'https://esm.sh/date-fns@4.1.0/es2022/date-fns.bundle.mjs',
});

export interface ArtifactOptions {
  enabled?: boolean;
  /** Replaces the default import map. Map package names to CORS-enabled immutable ESM URLs. */
  imports?: Readonly<Record<string, string>>;
  /** Self-contained ESM build exporting Sucrase's transform; defaults to a pinned CDN build. */
  compilerUrl?: string;
  /** Literal store paths accessible to the frame; a path includes its descendants. Defaults to no access. */
  statePaths?: readonly string[];
}

export function importMap(imports: ArtifactOptions['imports'], base: string): Record<string, string> {
  return Object.fromEntries(Object.entries(imports ?? defaultArtifactImports).map(([key, value]) => {
    const url = new URL(value, base);
    if (!/^https?:$/.test(url.protocol) || url.username || url.password || /[';,\s]/.test(url.href) ||
        !/^[\w@.-]+(?:\/[\w.-]+)*$/.test(key)) throw new Error(artifactStrings.invalidImport.replace('{key}', key));
    url.hash = '';
    return [key, url.href];
  }));
}

export function allowedPath(value: unknown, grants: readonly string[]): value is string {
  if (typeof value !== 'string' || value.length > 256) return false;
  const segments = value.split('.');
  return segments.length <= 32 && segments.every(segment =>
    segment && !['__proto__', 'constructor', 'prototype', '*'].includes(segment) &&
    (!/^\d+$/.test(segment) || Number(segment) < 10_000)) &&
    grants.some(grant => value === grant || value.startsWith(grant + '.'));
}
