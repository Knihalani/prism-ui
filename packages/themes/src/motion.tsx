export const receiptMotion = `
  :scope .prism-estimate__submit[data-feedback] { display:inline-grid; }
  :scope .prism-estimate__submit.prism-pill[data-feedback][data-sent] { color:var(--prism-text); opacity:1; }
  :scope .prism-estimate__submit[data-feedback] .prism-check-mark path { animation:none; stroke-dasharray:20; stroke-dashoffset:20; transition:stroke-dashoffset var(--prism-motion-slow) var(--prism-motion-ease); }
  :scope .prism-estimate__submit[data-sent] .prism-check-mark path { stroke-dashoffset:0; }
`;
