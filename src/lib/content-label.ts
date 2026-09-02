const LOWERCASE_NAV_WORDS = new Set(['a', 'an', 'and', 'as', 'at', 'for', 'in', 'is', 'it', 'of', 'on', 'or', 'the', 'to']);

export function formatArticleNavigationLabel(slug: string): string {
  const segment = slug.split('/').at(-1) ?? slug;
  return segment
    .split(/[-_]+/)
    .filter(Boolean)
    .map((word, index) => {
      if (index > 0 && LOWERCASE_NAV_WORDS.has(word)) return word;
      if (/\d/.test(word) || (word.length <= 3 && !LOWERCASE_NAV_WORDS.has(word))) return word.toUpperCase();
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(' ');
}
