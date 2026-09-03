export const DEFAULT_SITE_URL = 'https://game-wiki.example';

export const SITE_URL_ENV_NAMES = ['NEXT_PUBLIC_SITE_URL', 'SITE_URL'] as const;

export type SiteUrlSource = (typeof SITE_URL_ENV_NAMES)[number] | 'default';

export type SiteUrlResolution = {
  url: string;
  source: SiteUrlSource;
  usedFallback: boolean;
  reason?: 'missing' | 'invalid';
};

function unwrapQuotedValue(value: string): string {
  let result = value.trim();
  for (let index = 0; index < 2; index += 1) {
    const first = result.at(0);
    const last = result.at(-1);
    if (result.length >= 2 && (first === '"' || first === "'") && first === last) {
      result = result.slice(1, -1).trim();
    }
  }
  return result;
}

function unwrapMarkdownLink(value: string): string {
  const match = value.match(/^\[[^\]]*\]\(\s*(.*?)\s*\)$/);
  return match ? unwrapQuotedValue(match[1]) : value;
}

export function tryNormalizeSiteUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null;

  let candidate = unwrapQuotedValue(value);
  candidate = unwrapMarkdownLink(candidate);
  candidate = unwrapQuotedValue(candidate);
  if (!candidate || /\s/.test(candidate)) return null;

  if (!/^[a-z][a-z\d+.-]*:\/\//i.test(candidate)) {
    candidate = `https://${candidate}`;
  }

  try {
    const parsed = new URL(candidate);
    if (!['http:', 'https:'].includes(parsed.protocol)) return null;
    if (!parsed.hostname || parsed.username || parsed.password) return null;
    return parsed.origin;
  } catch {
    return null;
  }
}

export function normalizeSiteUrl(value: unknown, fallback = DEFAULT_SITE_URL): string {
  const normalized = tryNormalizeSiteUrl(value);
  if (normalized) return normalized;

  const normalizedFallback = tryNormalizeSiteUrl(fallback);
  return normalizedFallback ?? DEFAULT_SITE_URL;
}

export function resolveSiteUrlEnvironment(
  environment: Partial<Record<string, string | undefined>>
): SiteUrlResolution {
  const configured = SITE_URL_ENV_NAMES.find((name) => Boolean(environment[name]?.trim()));
  if (!configured) {
    return {url: DEFAULT_SITE_URL, source: 'default', usedFallback: true, reason: 'missing'};
  }

  const normalized = tryNormalizeSiteUrl(environment[configured]);
  if (!normalized) {
    return {url: DEFAULT_SITE_URL, source: configured, usedFallback: true, reason: 'invalid'};
  }

  return {url: normalized, source: configured, usedFallback: false};
}
