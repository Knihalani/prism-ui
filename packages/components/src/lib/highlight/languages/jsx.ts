import { cLike } from './c-like';
export const jsx = cLike({ name: 'jsx', flavor: 'js', jsx: true,
  keywords: 'as async await break case catch class const continue default delete do else export extends finally for from function if import in instanceof let new of return static super switch this throw try typeof var void while yield',
  builtins: 'console Math JSON Object Array String Number Date Promise Map Set',
});
