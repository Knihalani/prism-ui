import { componentStrings } from '../strings';

export const artifactStrings = {
  ...componentStrings.artifact,
  title: 'Artifact', react: 'React', html: 'HTML', svg: 'SVG', js: 'JavaScript', markdown: 'Markdown',
  code: 'Code', preview: 'Preview', download: 'Download', downloadSource: 'Download source',
  copied: 'Copied', clipboardUnavailable: 'Clipboard unavailable', downloadUnavailable: 'Download unavailable',
  fullscreenUnavailable: 'Fullscreen unavailable', sourceTooLarge: 'Artifact source exceeds 1 MB.',
  compileFailed: 'Unable to compile artifact.', compilerFailed: 'Unable to start the artifact compiler.',
  compileTimeout: 'Artifact compilation timed out.', invalidImport: 'Invalid artifact import: {key}',
  scriptFailed: 'Script could not load: {src}', inlineScriptFailed: 'Inline script could not load.',
  missingExport: 'Export a React component as the default export.',
};

export function artifactError(text: string | undefined, strings: Record<string, string>) {
  if (text === undefined) return text;
  for (const [key, value] of Object.entries(artifactStrings)) {
    if (text === value) return strings[key] ?? text;
    const placeholder = value.match(/\{(\w+)\}/);
    if (placeholder) {
      const [before, after] = value.split(placeholder[0]);
      if (text.startsWith(before) && text.endsWith(after)) return (strings[key] ?? value).replace(placeholder[0], text.slice(before.length, after ? -after.length : undefined));
    }
  }
  return text;
}
