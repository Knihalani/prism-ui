import { cLike } from './c-like';
export const rust = cLike({ name: 'rust', aliases: ['rs'], flavor: 'rust',
  keywords: 'as async await break const continue crate dyn else enum extern false fn for if impl in let loop match mod move mut pub ref return self Self static struct super trait true type unsafe use where while',
  types: 'bool char str i8 i16 i32 i64 i128 isize u8 u16 u32 u64 u128 usize f32 f64',
  builtins: 'Some None Ok Err',
});
