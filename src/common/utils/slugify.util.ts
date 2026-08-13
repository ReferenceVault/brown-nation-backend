// Combining diacritical marks block (U+0300-U+036F), stripped after NFKD
// normalization so e.g. "café" -> "cafe" before slugifying.
const DIACRITICS_REGEX = new RegExp('[\\u0300-\\u036f]', 'g');

export function slugify(input: string): string {
  return input
    .normalize('NFKD')
    .replace(DIACRITICS_REGEX, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
