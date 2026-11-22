import { cLike } from './c-like';
export const tsx = cLike({ name: 'tsx', flavor: 'js', jsx: true,
  keywords: 'abstract as asserts async await break case catch class const continue declare default delete do else enum export extends finally for from function if implements import in infer instanceof interface is keyof let namespace new of private protected public readonly return satisfies static super switch this throw try type typeof var void while yield',
  types: 'any unknown never string number boolean bigint symbol object',
  builtins: 'console Math JSON Object Array String Number Date Promise Map Set',
});
