import 'server-only';

import fs from 'node:fs/promises';
import path from 'node:path';
import type {ComponentType} from 'react';
import {routing, type Locale} from '@/i18n/routing';
import {CONTENT_TYPES, NAVIGATION_CONFIG, type ContentType} from '@/config/navigation';
import en from '@/locales/en.json';

export const CONTENT_GROUP_CONFIG: Record<
  ContentType,
  {order: number; titles: Record<Locale, string>}
> = {};

type ContentTypeMessages = Record<string, {overviewTitle: string; overviewDescription: string}>;

let configurationValidated = false;

export function validateContentConfiguration(): void {
  if (configurationValidated) return;

  const navigationKeys = NAVIGATION_CONFIG.map((item) => item.key);
  const uniqueNavigationKeys = new Set(navigationKeys);
  if (uniqueNavigationKeys.size !== navigationKeys.length) {
    throw new Error('Content configuration error: navigation keys must be unique.');
  }

  const configuredKeys = NAVIGATION_CONFIG.filter((item) => item.isContentType).map((item) => item.key);
  const uniqueKeys = new Set(configuredKeys);
  const navigationMessageKeys = Object.keys(en.nav).sort();
  const contentMessages = en.contentTypes as ContentTypeMessages;
  const messageKeys = Object.keys(contentMessages).sort();
  const groupKeys = Object.keys(CONTENT_GROUP_CONFIG).sort();
  const expectedKeys = [...uniqueKeys].sort();
  const expectedSignature = expectedKeys.join('|');

  if (navigationMessageKeys.join('|') !== [...uniqueNavigationKeys].sort().join('|')) {
    throw new Error('Content configuration error: en.nav keys must exactly match NAVIGATION_CONFIG keys.');
  }

  if (messageKeys.join('|') !== expectedSignature) {
    throw new Error(`Content configuration error: en.contentTypes keys must exactly match navigation content keys (${expectedSignature}).`);
  }
  if (groupKeys.join('|') !== expectedSignature) {
    throw new Error(`Content configuration error: CONTENT_GROUP_CONFIG keys must exactly match navigation content keys (${expectedSignature}).`);
  }

  for (const item of NAVIGATION_CONFIG) {
    if (item.path !== `/${item.key}`) {
      throw new Error(`Content configuration error: path for "${item.key}" must be "/${item.key}".`);
    }
    if (!item.isContentType) continue;
    const overview = contentMessages[item.key];
    if (!overview?.overviewTitle || !overview.overviewDescription) {
      throw new Error(`Content configuration error: en.contentTypes.${item.key} needs overviewTitle and overviewDescription.`);
    }
    if (CONTENT_GROUP_CONFIG[item.key].titles.en !== overview.overviewTitle) {
      throw new Error(`Content configuration error: group title for "${item.key}" must match en.contentTypes.${item.key}.overviewTitle.`);
    }
    for (const locale of routing.locales) {
      if (!CONTENT_GROUP_CONFIG[item.key].titles[locale]) {
        throw new Error(`Content configuration error: group title for "${item.key}" is missing locale "${locale}".`);
      }
    }
  }

  configurationValidated = true;
}

export type ContentMetadata = {
  title: string;
  description: string;
  category: string;
  date: string;
  lastModified: string;
  image: string;
};

export type ContentSummary = ContentMetadata & {
  slug: string;
  contentType: string;
  locale: Locale;
};

export type LoadedContent = ContentSummary & {
  MDXContent: ComponentType;
  headings: Array<{id: string; text: string}>;
};

export type ContentGroup = {
  contentType: string;
  articles: ContentSummary[];
};

function headingId(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
}

function extractHeadings(source: string): Array<{id: string; text: string}> {
  return [...source.matchAll(/^##\s+(.+)$/gm)].map((match) => ({
    id: headingId(match[1].trim()),
    text: match[1].trim()
  }));
}

const CONTENT_ROOT = path.join(process.cwd(), 'content');

export function fileNameToSlug(value: string): string {
  return value
    .replace(/\.mdx?$/i, '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
}

async function walk(directory: string): Promise<string[]> {
  try {
    const entries = await fs.readdir(directory, {withFileTypes: true});
    const nested = await Promise.all(
      entries.map(async (entry) => {
        const target = path.join(directory, entry.name);
        return entry.isDirectory() ? walk(target) : /\.mdx$/i.test(entry.name) ? [target] : [];
      })
    );
    return nested.flat();
  } catch {
    return [];
  }
}

export function extractMetadata(source: string): ContentMetadata {
  const block = source.match(/export\s+const\s+metadata\s*=\s*\{([\s\S]*?)\n\}/)?.[1] ?? '';
  const values = Object.fromEntries(
    [...block.matchAll(/([A-Za-z][A-Za-z0-9]*)\s*:\s*["']([^"']*)["']/g)].map((match) => [
      match[1],
      match[2]
    ])
  );

  return {
    title: values.title ?? '',
    description: values.description ?? '',
    category: values.category ?? '',
    date: values.date ?? '',
    lastModified: values.lastModified ?? values.date ?? '',
    image: values.image ?? en.media.articleImage
  };
}

function relativeFileToSlug(file: string, typeDirectory: string): string {
  return path
    .relative(typeDirectory, file)
    .split(path.sep)
    .map(fileNameToSlug)
    .join('/');
}

async function readContentSummaries(
  contentType: string,
  locale: Locale
): Promise<ContentSummary[]> {
  const directory = path.join(CONTENT_ROOT, locale, contentType);
  const files = await walk(directory);
  const entries = await Promise.all(
    files.map(async (file) => {
      const source = await fs.readFile(file, 'utf8');
      return {
        ...extractMetadata(source),
        slug: relativeFileToSlug(file, directory),
        contentType,
        locale
      };
    })
  );

  return entries;
}

export async function getAllContent(contentType: string, language: string): Promise<ContentSummary[]> {
  const safeLocale = routing.locales.includes(language as Locale) ? (language as Locale) : routing.defaultLocale;
  const englishEntries = await readContentSummaries(contentType, routing.defaultLocale);
  if (safeLocale === routing.defaultLocale) {
    return englishEntries.sort((a, b) => b.date.localeCompare(a.date));
  }

  const localizedEntries = await readContentSummaries(contentType, safeLocale);
  const localizedBySlug = new Map(localizedEntries.map((entry) => [entry.slug, entry]));
  const merged = englishEntries.map((entry) => localizedBySlug.get(entry.slug) ?? entry);
  const englishSlugs = new Set(englishEntries.map((entry) => entry.slug));
  merged.push(...localizedEntries.filter((entry) => !englishSlugs.has(entry.slug)));

  return merged.sort((a, b) => b.date.localeCompare(a.date));
}

export async function getContentTypes(_language: string = routing.defaultLocale): Promise<string[]> {
  validateContentConfiguration();
  const root = path.join(CONTENT_ROOT, routing.defaultLocale);
  let directoryTypes: string[] = [];

  try {
    const entries = await fs.readdir(root, {withFileTypes: true});
    directoryTypes = entries
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name);
  } catch {
    directoryTypes = [];
  }

  const unconfigured = directoryTypes.filter((contentType) => !CONTENT_TYPES.includes(contentType as ContentType));
  if (unconfigured.length > 0) {
    throw new Error(`Content configuration error: unconfigured content directories: ${unconfigured.join(', ')}.`);
  }

  return [...CONTENT_TYPES].sort(
    (a, b) => CONTENT_GROUP_CONFIG[a].order - CONTENT_GROUP_CONFIG[b].order
  );
}

export async function getAllContentGroups(language: string): Promise<ContentGroup[]> {
  const contentTypes = await getContentTypes(language);
  return Promise.all(
    contentTypes.map(async (contentType) => ({
      contentType,
      articles: await getAllContent(contentType, language)
    }))
  );
}

async function findContentFile(
  contentType: string,
  slug: string,
  locale: string
): Promise<{file: string; locale: Locale; relativePath: string} | null> {
  const candidates = [locale, routing.defaultLocale].filter(
    (value, index, values) => routing.locales.includes(value as Locale) && values.indexOf(value) === index
  ) as Locale[];

  for (const candidate of candidates) {
    const directory = path.join(CONTENT_ROOT, candidate, contentType);
    const files = await walk(directory);
    const match = files.find((file) => relativeFileToSlug(file, directory) === slug);
    if (match) {
      return {
        file: match,
        locale: candidate,
        relativePath: path.relative(directory, match).split(path.sep).join('/')
      };
    }
  }

  return null;
}

export async function getContent(contentType: string, slug: string, language: string): Promise<LoadedContent | null> {
  const found = await findContentFile(contentType, slug, language);
  if (!found) return null;

  const source = await fs.readFile(found.file, 'utf8');
  const metadata = extractMetadata(source);
  const module = (await import(
    `../../content/${found.locale}/${contentType}/${found.relativePath}`
  )) as {
    default: ComponentType;
    metadata: ContentMetadata;
  };

  return {
    ...metadata,
    ...module.metadata,
    slug,
    contentType,
    locale: found.locale,
    headings: extractHeadings(source),
    MDXContent: module.default
  };
}

export async function getAllContentPaths(_language = 'en'): Promise<
  Array<{contentType: string; slug: string; pathSegments: string[]; lastModified: string}>
> {
  validateContentConfiguration();
  const englishRoot = path.join(CONTENT_ROOT, routing.defaultLocale);
  const files = await walk(englishRoot);

  return Promise.all(files.map(async (file) => {
    const relative = path.relative(englishRoot, file).split(path.sep);
    const contentType = relative[0];
    if (!CONTENT_TYPES.includes(contentType as ContentType)) {
      throw new Error(`Content configuration error: article found in unconfigured content type "${contentType}".`);
    }
    const slug = relative.slice(1).map(fileNameToSlug).join('/');
    const metadata = extractMetadata(await fs.readFile(file, 'utf8'));
    return {
      contentType,
      slug,
      pathSegments: [contentType, ...slug.split('/')],
      lastModified: metadata.lastModified
    };
  }));
}
