import { cLike } from './c-like';
export const javascript = cLike({
  name: 'js', aliases: ['javascript', 'mjs', 'cjs'], flavor: 'js',
  keywords: 'as async await break case catch class const continue debugger default delete do else export extends finally for from function get if import in instanceof let new of return set static super switch this throw try typeof var void while with yield',
  builtins: 'console Math JSON Object Array String Number Boolean Date RegExp Promise Map Set WeakMap WeakSet Symbol BigInt Error Intl undefined NaN Infinity parseInt parseFloat isNaN fetch require module exports setTimeout setInterval',
});
