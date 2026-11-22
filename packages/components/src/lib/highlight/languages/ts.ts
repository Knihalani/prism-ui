import { cLike } from './c-like';
export const typescript = cLike({
  name: 'ts', aliases: ['typescript', 'mts'], flavor: 'js',
  keywords: 'abstract as asserts async await break case catch class const continue debugger declare default delete do else enum export extends finally for from function get if implements import in infer instanceof interface is keyof let namespace new of private protected public readonly return satisfies set static super switch this throw try type typeof var void while with yield',
  types: 'any unknown never string number boolean bigint symbol object undefined null',
  builtins: 'console Math JSON Object Array String Number Boolean Date RegExp Promise Map Set WeakMap WeakSet Symbol BigInt Error Intl NaN Infinity parseInt parseFloat fetch require module exports setTimeout setInterval',
});
