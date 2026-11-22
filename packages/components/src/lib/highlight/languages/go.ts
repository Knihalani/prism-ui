import { cLike } from './c-like';
export const go = cLike({ name: 'go', aliases: ['golang'], flavor: 'go',
  keywords: 'break case chan const continue default defer else fallthrough for func go goto if import interface map package range return select struct switch type var',
  types: 'bool byte complex64 complex128 error float32 float64 int int8 int16 int32 int64 rune string uint uint8 uint16 uint32 uint64 uintptr any comparable',
  builtins: 'append cap clear close complex copy delete imag len make max min new panic print println real recover',
});
