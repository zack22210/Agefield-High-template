import {readFile, readdir, stat} from 'node:fs/promises';
import path from 'node:path';

const LEGAL_PAGES = ['about', 'privacy', 'terms', 'copyright'];
const LEGAL_ROUTES = ['/about', '/privacy-policy', '/terms-of-service', '/copyright'];
const ASCII_SLUG_SEGMENT = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

async function walk(directory, extension) {
  const files = [];
  let entries;
  try {
    entries = await readdir(directory, {withFileTypes: true});
  } catch (error) {
    if (error.code === 'ENOENT') return files;
    throw error;
  }
  for (const entry of entries) {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await walk(target, extension));
    else if (entry.isFile() && (!extension || entry.name.endsWith(extension))) files.push(target);
  }
  return files;
}

function getPath(value, dottedPath) {
  return dottedPath.split('.').reduce((current, key) => current?.[key], value);
}

function field(block, name) {
  const match = block.match(new RegExp(`${name}\\s*:\\s*(["'])`));
  if (!match || match.index === undefined) return undefined;
  const quote = match[1];
  const start = match.index + match[0].length;
  let value = '';
  let escaped = false;
  for (let index = start; index < block.length; index += 1) {
    const character = block[index];
    if (escaped) {
      value += character;
      escaped = false;
    } else if (character === '\\') {
      escaped = true;
    } else if (character === quote) {
      return value;
    } else {
      value += character;
    }
  }
  return undefined;
}

export function metadataFromMdx(source) {
  const block = source.match(/export\s+const\s+metadata\s*=\s*\{([\s\S]*?)\}\s*;?/m)?.[1];
  if (!block) return null;
  return Object.fromEntries(
    ['title', 'description', 'category', 'date', 'lastModified', 'image'].map((name) => [name, field(block, name)])
  );
}

function navigationCategories(source) {
  return [...source.matchAll(/\{\s*key:\s*["']([^"']+)["'][\s\S]*?isContentType:\s*true\s*\}/g)]
    .map((match) => match[1]);
}

function localePrefix(locale, defaultLocale) {
  return `/${locale}`;
}

function normalizeRoute(value) {
  const route = `/${String(value).split(/[?#]/, 1)[0].replace(/^\/+|\/+$/g, '')}`;
  return route === '/' ? '/' : route;
}

function internalReferences(source) {
  const values = [
    ...[...source.matchAll(/\]\(([^)\s]+)(?:\s+["'][^"']*["'])?\)/g)].map((match) => match[1]),
    ...[...source.matchAll(/\bhref\s*=\s*["']([^"']+)["']/g)].map((match) => match[1])
  ];
  return values.filter((value) => /^(?:\/|\.\/|\.\.\/)/.test(value));
}

function localImageReferences(source) {
  return [
    ...[...source.matchAll(/(?:\bsrc|\bimage)\s*[:=]\s*["'](\/(?:images\/|favicon)[^"']*)["']/g)].map((match) => match[1]),
    ...[...source.matchAll(/!\[[^\]]*\]\((\/(?:images\/|favicon)[^)\s]+)\)/g)].map((match) => match[1])
  ];
}

function jsonImageReferences(value, location = '$') {
  if (Array.isArray(value)) return value.flatMap((child, index) => jsonImageReferences(child, `${location}.${index}`));
  if (value && typeof value === 'object') {
    return Object.entries(value).flatMap(([key, child]) => jsonImageReferences(child, `${location}.${key}`));
  }
  return typeof value === 'string' && /^\/(?:images\/|favicon)/.test(value)
    ? [{value, location}]
    : [];
}

function routeForRelative(locale, defaultLocale, relative) {
  const withoutExtension = relative.replace(/\.mdx$/i, '');
  return `${localePrefix(locale, defaultLocale)}/${withoutExtension}`.replace(/\/{2,}/g, '/');
}

async function existsAsFile(file) {
  try {
    return (await stat(file)).isFile();
  } catch {
    return false;
  }
}

export async function validateIntegrity({root = process.cwd()} = {}) {
  const issues = [];
  const warnings = [];
  const addIssue = (area, message, context = {}) => issues.push({area, message, ...context});
  const requirementsDir = path.join(root, '站点数据采集目录');
  const localesDir = path.join(root, 'src', 'locales');
  const contentRoot = path.join(root, 'content');
  const publicRoot = path.resolve(root, 'public');

  async function readJson(file, context = {}) {
    try {
      return JSON.parse(await readFile(file, 'utf8'));
    } catch (error) {
      addIssue('locale/data', `invalid or missing JSON: ${error.message}`, {file, ...context});
      return null;
    }
  }

  const languageFile = path.join(requirementsDir, 'languages.json');
  const languageData = await readJson(languageFile, {locale: 'configuration'});
  const locales = (languageData?.languages ?? []).map((item) => String(item.code ?? '')).filter(Boolean);
  const defaultLocale = String(languageData?.default ?? 'en');
  if (locales.length === 0 || !locales.includes(defaultLocale)) {
    addIssue('locale/data', `languages.json must include its default locale "${defaultLocale}".`, {file: languageFile});
  }

  let routingSource = '';
  const routingFile = path.join(root, 'src', 'i18n', 'routing.ts');
  try {
    routingSource = await readFile(routingFile, 'utf8');
  } catch (error) {
    addIssue('locale/data', `cannot read routing configuration: ${error.message}`, {file: routingFile});
  }
  const routingBlock = routingSource.match(/locales\s*:\s*\[([^\]]*)\]/)?.[1] ?? '';
  const routingLocales = [...routingBlock.matchAll(/["']([^"']+)["']/g)].map((match) => match[1]);
  const routingDefault = routingSource.match(/defaultLocale\s*:\s*["']([^"']+)["']/)?.[1];
  const routingPrefix = routingSource.match(/localePrefix\s*:\s*["']([^"']+)["']/)?.[1];
  if (JSON.stringify(routingLocales) !== JSON.stringify(locales)) {
    addIssue('locale/data', `routing locales [${routingLocales.join(', ')}] do not match languages.json [${locales.join(', ')}].`, {file: routingFile});
  }
  if (routingDefault !== defaultLocale) {
    addIssue('locale/data', `routing defaultLocale "${routingDefault ?? 'missing'}" does not match languages.json "${defaultLocale}".`, {file: routingFile});
  }
  if (routingPrefix !== 'always') {
    addIssue('url/metadata', `routing localePrefix must be "always" so canonical, sitemap, and public routes stay aligned; found "${routingPrefix ?? 'missing'}".`, {file: routingFile});
  }

  const messagesByLocale = new Map();
  for (const locale of locales) {
    const localeFile = path.join(localesDir, `${locale}.json`);
    const messages = await readJson(localeFile, {locale});
    if (messages) messagesByLocale.set(locale, {file: localeFile, messages});
  }

  let navigationSource = '';
  const navigationFile = path.join(root, 'src', 'config', 'navigation.ts');
  try {
    navigationSource = await readFile(navigationFile, 'utf8');
  } catch (error) {
    addIssue('content/path', `cannot read navigation: ${error.message}`, {file: navigationFile});
  }
  const categories = navigationCategories(navigationSource);
  if (new Set(categories).size !== categories.length) {
    addIssue('content/path', 'navigation contains duplicate content categories.', {file: navigationFile});
  }

  let configured = false;
  try {
    const basicInfo = await readFile(path.join(requirementsDir, '基础信息.md'), 'utf8');
    configured = Boolean(basicInfo.match(/^> 游戏名称：[ \t]*(.*)$/m)?.[1]?.trim());
  } catch {
    warnings.push('基础信息.md was not available; configured-site-only link checks were skipped.');
  }

  const filesByLocale = new Map();
  for (const locale of locales) {
    const localeRoot = path.join(contentRoot, locale);
    const files = await walk(localeRoot, '.mdx');
    const relativeFiles = files.map((file) => path.relative(localeRoot, file).replaceAll('\\', '/')).sort();
    filesByLocale.set(locale, {localeRoot, files, relativeFiles});
  }
  const englishRelative = filesByLocale.get(defaultLocale)?.relativeFiles ?? [];

  for (const locale of locales) {
    const current = filesByLocale.get(locale)?.relativeFiles ?? [];
    const missing = englishRelative.filter((relative) => !current.includes(relative));
    const extra = current.filter((relative) => !englishRelative.includes(relative));
    for (const relative of missing) {
      addIssue('content/path', `localized MDX is missing; English fallback is forbidden: ${relative}`, {
        file: path.join(contentRoot, locale, relative),
        locale,
        category: relative.split('/')[0],
        slug: relative.replace(/^[^/]+\//, '').replace(/\.mdx$/, ''),
        route: routeForRelative(locale, defaultLocale, relative)
      });
    }
    for (const relative of extra) {
      addIssue('content/path', `localized MDX has no matching ${defaultLocale} slug: ${relative}`, {
        file: path.join(contentRoot, locale, relative), locale
      });
    }
  }

  const categoryCounts = new Map();
  const allRoutes = new Set(['/']);
  for (const locale of locales) {
    const prefix = localePrefix(locale, defaultLocale);
    allRoutes.add(prefix);
    LEGAL_ROUTES.forEach((route) => allRoutes.add(`${prefix}${route}` || '/'));
    categories.forEach((category) => allRoutes.add(`${prefix}/${category}`.replace(/\/{2,}/g, '/')));
    for (const relative of filesByLocale.get(locale)?.relativeFiles ?? []) {
      allRoutes.add(routeForRelative(locale, defaultLocale, relative));
    }
    if (locale === defaultLocale) {
      LEGAL_ROUTES.forEach((route) => allRoutes.add(route));
      categories.forEach((category) => allRoutes.add(`/${category}`));
      for (const relative of filesByLocale.get(locale)?.relativeFiles ?? []) {
        allRoutes.add(`/${relative.replace(/\.mdx$/i, '')}`);
      }
    }
  }

  const contentRecords = [];
  for (const locale of locales) {
    const {localeRoot, files} = filesByLocale.get(locale) ?? {localeRoot: path.join(contentRoot, locale), files: []};
    for (const file of files) {
      const relative = path.relative(localeRoot, file).replaceAll('\\', '/');
      const segments = relative.replace(/\.mdx$/i, '').split('/');
      const category = segments[0];
      const slug = segments.slice(1).join('/');
      const route = routeForRelative(locale, defaultLocale, relative);
      for (const segment of segments) {
        if (!ASCII_SLUG_SEGMENT.test(segment)) {
          addIssue('content/path', `MDX path segment "${segment}" must be lowercase English ASCII kebab-case.`, {file, locale, category, slug, route});
        }
      }

      let source = '';
      try {
        source = await readFile(file, 'utf8');
      } catch (error) {
        addIssue('content/path', `generateStaticParams cannot read this content: ${error.message}`, {file, locale, category, slug, route});
        continue;
      }
      const metadata = metadataFromMdx(source);
      if (!source.trimStart().startsWith('export const metadata = {')) {
        addIssue('mdx/frontmatter', 'MDX must begin with export const metadata = {', {file, locale, category, slug, route});
      }
      if (!metadata) {
        addIssue('mdx/frontmatter', 'metadata export is missing or cannot be parsed.', {file, locale, category, slug, route});
      } else {
        for (const fieldName of ['title', 'description', 'category', 'date']) {
          if (!metadata[fieldName]) addIssue('mdx/frontmatter', `metadata.${fieldName} is required.`, {file, locale, category, slug, route});
        }
        if (metadata.category && metadata.category !== category) {
          addIssue('mdx/frontmatter', `metadata.category "${metadata.category}" does not match path category "${category}".`, {file, locale, category, slug, route});
        }
        if (metadata.date && !/^\d{4}-\d{2}-\d{2}$/.test(metadata.date)) {
          addIssue('mdx/frontmatter', 'metadata.date must use YYYY-MM-DD.', {file, locale, category, slug, route});
        }
      }
      contentRecords.push({file, locale, category, slug, route, source, metadata});
      if (locale === defaultLocale) categoryCounts.set(category, (categoryCounts.get(category) ?? 0) + 1);
    }
  }

  for (const category of categories) {
    if (!categoryCounts.get(category)) {
      addIssue('content/path', `navigation category "${category}" has no English article.`, {file: navigationFile, category, route: `/${category}`});
    }
  }
  for (const category of categoryCounts.keys()) {
    if (!categories.includes(category)) {
      addIssue('content/path', `published category "${category}" is missing from navigation.`, {file: navigationFile, category});
    }
  }
  if (configured && englishRelative.length > 0 && !categories.includes('guide')) {
    addIssue('content/path', 'configured sites require the guide category.', {file: navigationFile, category: 'guide', route: '/guide'});
  }

  const requiredMessagePaths = [
    'site.name', 'seo.defaultDescription', 'seo.homeTitle', 'seo.homeDescription', 'seo.keywords',
    ...LEGAL_PAGES.flatMap((key) => [`legal.${key}.metaTitle`, `legal.${key}.metaDescription`])
  ];
  for (const [locale, {file, messages}] of messagesByLocale) {
    for (const messagePath of requiredMessagePaths) {
      if (!String(getPath(messages, messagePath) ?? '').trim()) {
        addIssue('url/metadata', `metadata input "${messagePath}" is missing.`, {file, locale, route: localePrefix(locale, defaultLocale)});
      }
    }
    for (const category of categories) {
      for (const key of ['overviewTitle', 'overviewDescription']) {
        if (!String(getPath(messages, `contentTypes.${category}.${key}`) ?? '').trim()) {
          addIssue('url/metadata', `category metadata input "contentTypes.${category}.${key}" is missing.`, {
            file, locale, category, route: `${localePrefix(locale, defaultLocale)}/${category}`.replace(/\/{2,}/g, '/')
          });
        }
      }
    }
  }

  async function validateAsset(reference, context) {
    const clean = reference.split(/[?#]/, 1)[0];
    const target = path.resolve(publicRoot, clean.replace(/^\/+/, ''));
    if (target !== publicRoot && !target.startsWith(`${publicRoot}${path.sep}`)) {
      addIssue('image/resource', `asset path escapes public/: ${reference}`, context);
      return;
    }
    if (!await existsAsFile(target)) {
      addIssue('image/resource', `referenced local image does not exist: ${reference}`, {...context, asset: target});
    }
  }

  for (const [locale, {file, messages}] of messagesByLocale) {
    for (const reference of jsonImageReferences(messages)) {
      await validateAsset(reference.value, {file, locale, source: reference.location, route: localePrefix(locale, defaultLocale)});
    }
  }
  for (const record of contentRecords) {
    const references = new Set([
      ...(record.metadata?.image ? [record.metadata.image] : []),
      ...localImageReferences(record.source)
    ]);
    for (const reference of references) {
      await validateAsset(reference, record);
    }
  }

  for (const record of contentRecords) {
    for (const reference of internalReferences(record.source)) {
      let target;
      try {
        target = normalizeRoute(new URL(reference, `https://internal.invalid${record.route}`).pathname);
      } catch {
        addIssue('content/path', `invalid internal link: ${reference}`, record);
        continue;
      }
      if (!allRoutes.has(target)) {
        addIssue('content/path', `internal link has no generated route: ${reference} -> ${target}`, record);
      }
    }
  }

  for (const [locale, {file, messages}] of messagesByLocale) {
    const footerLinks = Array.isArray(messages.footer?.links) ? messages.footer.links : [];
    for (const item of footerLinks.filter((entry) => entry?.kind === 'internal' && entry.href)) {
      const target = normalizeRoute(`${localePrefix(locale, defaultLocale)}${item.href}`);
      if (!allRoutes.has(target)) addIssue('content/path', `footer link has no generated route: ${item.href}`, {file, locale, route: target});
    }

    if (!configured) continue;
    const home = messages.home ?? {};
    for (const action of home.hero?.enabled ? home.hero.actions ?? [] : []) {
      if (action.kind === 'contentType' && action.contentType && !categories.includes(action.contentType)) {
        addIssue('content/path', `homepage hero action references missing category "${action.contentType}".`, {file, locale, category: action.contentType});
      }
    }
    const articleActions = [
      ...(home.story?.enabled && home.story?.action ? [home.story.action] : []),
      ...(home.release?.enabled ? home.release.actions ?? [] : [])
    ];
    for (const action of articleActions) {
      const article = action?.article;
      if (!article?.contentType || !article?.slug) continue;
      const target = `${localePrefix(locale, defaultLocale)}/${article.contentType}/${article.slug}`.replace(/\/{2,}/g, '/');
      if (!allRoutes.has(target)) addIssue('content/path', `homepage action references missing article route: ${target}`, {file, locale, category: article.contentType, slug: article.slug, route: target});
    }
  }

  const generatedRoutes = [...allRoutes].sort();
  return {
    issues,
    warnings,
    routes: generatedRoutes,
    summary: {
      locales: locales.length,
      categories: categories.length,
      articles: contentRecords.length,
      generatedRoutes: generatedRoutes.length,
      configured
    }
  };
}

export function formatIntegrityIssue(root, issue) {
  const location = issue.file ? path.relative(root, issue.file).replaceAll('\\', '/') : '';
  const context = [
    issue.locale ? `locale=${issue.locale}` : '',
    issue.category ? `category=${issue.category}` : '',
    issue.slug ? `slug=${issue.slug}` : '',
    issue.route ? `route=${issue.route}` : '',
    issue.source ? `source=${issue.source}` : ''
  ].filter(Boolean).join(' ');
  return `[${issue.area}]${location ? ` ${location}` : ''}${context ? ` (${context})` : ''}: ${issue.message}`;
}
