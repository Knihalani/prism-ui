import { availableThemes } from '../themes';
import { slugName, toTheme, tokenCatalogue, type ThemeDraft } from './model';
import type { Tokens } from '@prism-ui/react';

export { slugName } from './model';

const reserved = new Set('await break case catch class const continue debugger default delete do else enum export extends false finally for function if implements import in instanceof interface let new null package private protected public return static super switch this throw true try typeof var void while with yield eval arguments'.split(' '));
const literal = (value: string) => JSON.stringify(value).replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');

export function exportTheme(draft: ThemeDraft): string {
  const theme = toTheme(draft, availableThemes), name = slugName(draft.name);
  let identifier = name.replace(/[-_]+([a-z0-9])/g, (_, char: string) => char.toUpperCase());
  if (reserved.has(identifier)) identifier = 'theme' + identifier[0].toUpperCase() + identifier.slice(1);
  if (identifier === 'defineTheme' || identifier === theme.extends?.name) identifier += 'Theme';
  const lines = ["import { defineTheme } from '@prism-ui/react';"];
  if (theme.extends) lines.push(`import { ${theme.extends.name} } from '@prism-ui/themes';`);
  lines.push('', `export const ${identifier} = defineTheme({`, `  name: ${literal(name)},`);
  if (theme.extends) lines.push(`  extends: ${theme.extends.name},`);
  for (const field of ['tokens', 'dark'] as const) {
    const tokens: Partial<Tokens> | undefined = theme[field];
    if (!tokens) continue;
    lines.push(`  ${field}: {`);
    for (const { key } of tokenCatalogue) if (tokens[key] !== undefined) lines.push(`    ${key}: ${literal(tokens[key]!)},`);
    lines.push('  },');
  }
  lines.push('});', '');
  return lines.join('\n');
}
