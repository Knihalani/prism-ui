import './site.css';
import './gallery.css';
import { exampleLoaders } from './islands/loaders';

const modeButton = document.querySelector<HTMLButtonElement>('[data-mode-toggle]');
if (modeButton) {
  modeButton.hidden = false;
  modeButton.addEventListener('click', () => {
    const root = document.documentElement;
    const mode = root.dataset.mode ?? (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    root.dataset.mode = mode === 'dark' ? 'light' : 'dark';
    modeButton.setAttribute('aria-label', `Switch to ${mode} mode`);
    try { localStorage.setItem('prism-site-mode', root.dataset.mode); } catch {}
  });
}

for (const element of Array.from(document.querySelectorAll<HTMLElement>('[data-island="hero"]'))) {
  import('./islands/hero').then(module => module.mount(element)).catch(() => {
    element.querySelector('button')?.setAttribute('disabled', '');
    const note = element.querySelector('.reply-note');
    if (note) note.textContent = 'The preview is offline. Refresh to try the interactive reply.';
  });
}

for (const element of Array.from(document.querySelectorAll<HTMLElement>('[data-island="example"]'))) {
  const load = exampleLoaders[element.dataset.component as keyof typeof exampleLoaders];
  load?.().then(module => module.mount(element)).catch(() => {
    const note = document.createElement('p'); note.setAttribute('role', 'status'); note.textContent = 'Interactive example unavailable. The finished example and source are still readable.'; element.append(note);
  });
}

for (const button of Array.from(document.querySelectorAll<HTMLButtonElement>('[data-copy]'))) {
  button.hidden = false;
  button.addEventListener('click', async () => {
    const code = document.getElementById(button.dataset.copy ?? '');
    if (!code) return;
    try { await navigator.clipboard.writeText(code.textContent ?? ''); button.textContent = 'Copied'; }
    catch { button.textContent = 'Select the command to copy'; }
    setTimeout(() => { button.textContent = 'Copy'; }, 2500);
  });
}
