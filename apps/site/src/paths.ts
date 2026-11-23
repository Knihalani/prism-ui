export function normalizeBase(value = '/') {
  if (!value.startsWith('/') || value.startsWith('//') || /[?#\\<>"'\s]/.test(value) || value.split('/').some(part => part === '.' || part === '..')) {
    throw new Error('SITE_BASE must be an absolute pathname, for example /prism-ui/');
  }
  return value.replace(/\/+$/, '') + '/';
}

export function sitePath(base: string, path = '') {
  return normalizeBase(base) + path.replace(/^\/+/, '');
}
