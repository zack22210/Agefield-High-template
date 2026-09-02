import {mkdir, readFile, readdir, rename, stat, writeFile} from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const flags = new Set(process.argv.slice(2));
const seoscoutMode = flags.has('--seoscout');
const contentOnly = flags.has('--content');
const strict = flags.has('--strict') || seoscoutMode || contentOnly;
const quarantine = flags.has('--quarantine');
const requirementsDir = path.join(root, '站点数据采集目录');
const issues = [];
const warnings = [];
const invalidFiles = new Set();

function addIssue(message, file) {
  issues.push({message, file});
  if (file) invalidFiles.add(path.resolve(file));
}

async function readJson(file) {
  try {
    return JSON.parse(await readFile(file, 'utf8'));
  } catch (error) {
    addIssue(`Invalid or missing JSON: ${error.message}`, file);
    return null;
  }
}

async function walk(directory, extension) {
  const results = [];
  let entries;
  try { entries = await readdir(directory, {withFileTypes: true}); }
  catch { return results; }
  for (const entry of entries) {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) results.push(...await walk(full, extension));
    else if (entry.isFile() && (!extension || entry.name.endsWith(extension))) results.push(full);
  }
  return results;
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

function metadataFrom(source) {
  const block = source.match(/export\s+const\s+metadata\s*=\s*\{([\s\S]*?)\}\s*;?/m)?.[1];
  if (!block) return null;
  return {
    title: field(block, 'title'),
    description: field(block, 'description'),
    category: field(block, 'category'),
    date: field(block, 'date'),
    lastModified: field(block, 'lastModified'),
    image: field(block, 'image')
  };
}

function hostFromUrl(value) {
  try { return new URL(value).hostname.toLowerCase().replace(/^www\./, ''); }
  catch { return ''; }
}

function domainMatches(host, blocked) {
  return blocked.some((domain) => host === domain || host.endsWith(`.${domain}`));
}

function categorySlug(category) {
  return category.toLowerCase().trim().replace(/\s+/g, '-');
}

function keywordSlug(keyword) {
  return keyword.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
}

async function validateMdx(file, locale, expectedCategory, blockedDomains) {
  const source = await readFile(file, 'utf8');
  const localIssues = [];
  const report = (message) => localIssues.push(message);
  const metadata = metadataFrom(source);

  if (!source.trimStart().startsWith('export const metadata = {')) report('file must begin with export const metadata = {');
  if (!metadata) {
    report('missing metadata export');
  } else {
    for (const key of ['title', 'description', 'category', 'date']) {
      if (!metadata[key]) report(`metadata.${key} is required`);
    }
    if (metadata.title && metadata.title.length > 60) report(`metadata.title is ${metadata.title.length} characters; maximum is 60`);
    if (metadata.description) {
      const min = locale === 'en' ? 140 : 80;
      if (metadata.description.length < min || metadata.description.length > 160) {
        report(`metadata.description is ${metadata.description.length} characters; expected ${min}–160 for ${locale}`);
      }
    }
    if (metadata.category && metadata.category !== expectedCategory) report(`metadata.category must be ${expectedCategory}`);
    if (metadata.date && !/^\d{4}-\d{2}-\d{2}$/.test(metadata.date)) report('metadata.date must use YYYY-MM-DD');
  }

  if (/^#\s+/m.test(source)) report('Markdown H1 is not allowed');
  if (/GAME_NAME_TO_REPLACE|OFFICIAL_GAME_URL_TO_REPLACE|\{\{(?:GAME_NAME|TOPIC|KEYWORD|DOMAIN)[^}]*\}\}/i.test(source)) report('unresolved template placeholder');

  const urls = [...source.matchAll(/https?:\/\/[^\s)\]>'"]+/g)].map((match) => match[0].replace(/[.,;:]$/, ''));
  if (urls.length === 0) report('article must include at least one direct source URL');
  for (const url of urls) {
    const host = hostFromUrl(url);
    if (domainMatches(host, blockedDomains)) report(`blocked source domain: ${host}`);
  }

  const body = source.replace(/export\s+const\s+metadata\s*=\s*\{[\s\S]*?\}\s*;?/, '');
  if (locale === 'en') {
    const words = body.match(/\b[A-Za-z0-9][A-Za-z0-9'’-]*\b/g)?.length ?? 0;
    if (words < 250) report(`article body is too short (${words} English words)`);
  } else if (body.trim().length < 800) {
    report(`translated article body is too short (${body.trim().length} characters)`);
  }

  if (localIssues.length > 0) {
    for (const message of localIssues) addIssue(message, file);
    return {valid: false, metadata, source, body};
  }
  return {valid: true, metadata, source, body};
}

async function blockedDomains() {
  const policy = await readJson(path.join(root, 'seoscout', 'source-policy.json'));
  return (policy?.blocked_domains ?? []).map((value) => String(value).toLowerCase().replace(/^www\./, ''));
}

async function validateSeoscout() {
  const keywordsPath = path.join(root, 'seoscout', 'keywords.json');
  const data = await readJson(keywordsPath);
  if (!data) return;
  const topic = String(data.topic_name ?? '').trim();
  if (!topic) {
    addIssue('seoscout/keywords.json topic_name is empty', keywordsPath);
    return;
  }

  const project = topic.toLowerCase().replace(/\s+/g, '_');
  const articlesRoot = path.join(root, 'seoscout', 'output', project, 'articles');
  const languages = ['en', ...(data.languages ?? [])];
  const blocked = await blockedDomains();
  const expected = [];
  for (const group of data.categories ?? []) {
    for (const keyword of group.keywords ?? []) {
      expected.push({
        keyword,
        category: categorySlug(group.category),
        relative: path.join(categorySlug(group.category), `${keywordSlug(keyword)}.mdx`)
      });
    }
  }

  const pending = [];
  const accepted = [];
  const englishValid = new Map();
  for (const item of expected) {
    const file = path.join(articlesRoot, 'en', item.relative);
    try { await stat(file); }
    catch {
      pending.push({keyword: item.keyword, category: item.category, reason: 'No generated English article; source material may be insufficient.'});
      continue;
    }
    const result = await validateMdx(file, 'en', item.category, blocked);
    englishValid.set(item.relative, result.valid);
    if (result.valid) accepted.push(path.relative(articlesRoot, file).replaceAll('\\', '/'));
    else {
      for (const locale of languages.slice(1)) {
        const translated = path.join(articlesRoot, locale, item.relative);
        try { await stat(translated); invalidFiles.add(path.resolve(translated)); } catch {}
      }
    }
  }

  for (const locale of languages.slice(1)) {
    for (const item of expected) {
      if (!englishValid.get(item.relative)) continue;
      const file = path.join(articlesRoot, locale, item.relative);
      try { await stat(file); }
      catch {
        addIssue(`missing ${locale} translation for ${item.relative}`);
        continue;
      }
      const result = await validateMdx(file, locale, item.category, blocked);
      if (result.valid) {
        const enSource = await readFile(path.join(articlesRoot, 'en', item.relative), 'utf8');
        const enMeta = metadataFrom(enSource);
        if (result.metadata?.title === enMeta?.title && result.metadata?.description === enMeta?.description) {
          addIssue(`${locale} metadata is still identical to English`, file);
        } else {
          accepted.push(path.relative(articlesRoot, file).replaceAll('\\', '/'));
        }
      }
    }
  }

  const rejectedBeforeMove = [...invalidFiles].filter((file) => file.startsWith(path.resolve(articlesRoot)));
  if (quarantine && rejectedBeforeMove.length > 0) {
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const rejectedRoot = path.join(root, 'seoscout', '_rejected', stamp);
    for (const file of rejectedBeforeMove) {
      const relative = path.relative(articlesRoot, file);
      const target = path.join(rejectedRoot, relative);
      await mkdir(path.dirname(target), {recursive: true});
      await rename(file, target);
    }
    warnings.push(`Moved ${rejectedBeforeMove.length} rejected generated file(s) to ${path.relative(root, rejectedRoot)} for one automatic retry.`);
  }

  const report = {
    generated_at: new Date().toISOString(),
    topic_name: topic,
    expected_english_articles: expected.length,
    accepted_files: accepted.length,
    pending,
    rejected_files: rejectedBeforeMove.map((file) => path.relative(articlesRoot, file).replaceAll('\\', '/')),
    issues: issues.map(({message, file}) => ({message, file: file ? path.relative(root, file).replaceAll('\\', '/') : null}))
  };
  await writeFile(path.join(root, 'seoscout', 'quality-report.json'), `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  if (pending.length > 0) warnings.push(`${pending.length} keyword(s) remain pending because no acceptable English article was generated.`);
}

function leafPaths(value, prefix = '') {
  if (Array.isArray(value)) return [prefix];
  if (!value || typeof value !== 'object') return [prefix];
  return Object.entries(value).flatMap(([key, child]) => leafPaths(child, prefix ? `${prefix}.${key}` : key));
}

function leafEntries(value, prefix = '') {
  if (Array.isArray(value)) return value.flatMap((child, index) => leafEntries(child, `${prefix}.${index}`));
  if (!value || typeof value !== 'object') return [[prefix, value]];
  return Object.entries(value).flatMap(([key, child]) => leafEntries(child, prefix ? `${prefix}.${key}` : key));
}

function shouldTranslateMessage(key, value) {
  if (typeof value !== 'string') return false;
  if (/^(?:links|media)(?:\.|$)|(?:^|\.)(?:href|src|url|path|videoId|localeCode)$/i.test(key)) return false;
  if (/^site\.(?:gameName|name|shortName)$/i.test(key)) return false;
  const text = value.trim();
  if (!text || /^https?:\/\//i.test(text) || /^\//.test(text) || /^[^@\s]+@[^@\s]+$/.test(text)) return false;
  const words = text.match(/[A-Za-z]+/g) ?? [];
  return words.length >= 2 || text.length >= 9;
}

async function validateSite() {
  const categoriesData = await readJson(path.join(requirementsDir, '关键词分类.json'));
  const languageData = await readJson(path.join(requirementsDir, 'languages.json'));
  const en = await readJson(path.join(root, 'src', 'locales', 'en.json'));
  if (!categoriesData || !languageData || !en) return;

  const basicInfoPath = path.join(requirementsDir, '基础信息.md');
  const basicInfo = await readFile(basicInfoPath, 'utf8');
  const gameName = basicInfo.match(/^> 游戏名称：[ \t]*(.*)$/m)?.[1]?.trim() ?? '';
  const configured = gameName.length > 0;
  const requiredLocales = (languageData.languages ?? []).map((item) => item.code);
  if (requiredLocales.length < 1 || requiredLocales.length > 4 || !requiredLocales.includes('en')) addIssue('languages.json must contain 1–4 locales including en.');
  if (requiredLocales.some((code) => code === 'zh' || String(code).startsWith('zh-'))) addIssue('Chinese locales are excluded by this template workflow.');

  const routingSource = await readFile(path.join(root, 'src', 'i18n', 'routing.ts'), 'utf8');
  const routingBlock = routingSource.match(/locales\s*:\s*\[([^\]]*)\]/)?.[1] ?? '';
  const routingLocales = [...routingBlock.matchAll(/["']([a-z]{2,3}(?:-[a-z]{2})?)["']/g)].map((match) => match[1]);
  if (JSON.stringify(routingLocales) !== JSON.stringify(requiredLocales)) addIssue(`routing.ts locales [${routingLocales}] do not match languages.json [${requiredLocales}].`);

  const englishLeaves = new Set(leafPaths(en));
  const englishEntries = new Map(leafEntries(en));
  for (const locale of requiredLocales) {
    const localeFile = path.join(root, 'src', 'locales', `${locale}.json`);
    const messages = await readJson(localeFile);
    if (!messages) continue;
    if (configured && locale !== 'en') {
      const localizedLeaves = new Set(leafPaths(messages));
      const missing = [...englishLeaves].filter((key) => !localizedLeaves.has(key));
      if (missing.length > 0) addIssue(`${locale}.json is missing ${missing.length} translated key(s), including ${missing.slice(0, 5).join(', ')}.`, localeFile);
      const unchanged = leafEntries(messages)
        .filter(([key, value]) => shouldTranslateMessage(key, value) && englishEntries.get(key) === value)
        .map(([key]) => key);
      if (unchanged.length >= 3) addIssue(`${locale}.json still has ${unchanged.length} English message(s), including ${unchanged.slice(0, 5).join(', ')}.`, localeFile);
    }
  }

  if (configured) {
    const domain = basicInfo.match(/^> 新域名：[ \t]*(.*)$/m)?.[1]?.trim() ?? '';
    const officialUrl = basicInfo.match(/^> 官方网站：[ \t]*(.*)$/m)?.[1]?.trim() ?? '';
    if (!domain) addIssue('基础信息.md must include the selected domain.', basicInfoPath);
    if (!/^https?:\/\//i.test(officialUrl)) addIssue('基础信息.md must include an absolute official game URL.', basicInfoPath);
    if (Object.keys(en.links ?? {}).length === 0) addIssue('Configured sites need at least one verified external link in en.links.');

    const checks = [
      ['seo.homeTitle', en.seo?.homeTitle, 0, 60],
      ['seo.homeDescription', en.seo?.homeDescription, 140, 160],
      ['seo.keywords', en.seo?.keywords, 0, 100]
    ];
    for (const [label, rawValue, min, max] of checks) {
      const value = String(rawValue ?? '');
      if (!value || value.length < min || value.length > max) addIssue(`${label} length is ${value.length}; expected ${min || 1}–${max}.`, path.join(root, 'src', 'locales', 'en.json'));
    }
    if (!String(en.home?.hero?.title ?? '').toLowerCase().includes(gameName.toLowerCase())) addIssue('home.hero.title must include the selected game name.');
    if ((en.home?.status?.items ?? []).length > 4) addIssue('home.status.items supports at most four items.');
    if (en.home?.status?.enabled && (en.home?.status?.items ?? []).length === 0) addIssue('Enabled home.status needs at least one item.');
    if (en.home?.facts?.enabled && (en.home?.facts?.items ?? []).length === 0) addIssue('Enabled home.facts needs at least one item.');
    if (en.home?.story?.enabled && (!en.home?.story?.title || !en.home?.story?.description || !en.home?.story?.image?.src)) addIssue('Enabled home.story needs title, description, and image.');
    if (en.home?.release?.enabled && (!en.home?.release?.title || !en.home?.release?.description)) addIssue('Enabled home.release needs title and description.');

    const unresolvedFiles = [
      ...await walk(path.join(root, 'src'), '.ts'),
      ...await walk(path.join(root, 'src'), '.tsx'),
      ...await walk(path.join(root, 'src', 'locales'), '.json'),
      ...await walk(path.join(root, 'content'), '.mdx')
    ];
    const oldKeyword = basicInfo.match(/^> 旧游戏关键词：[ \t]*(.*)$/m)?.[1]?.trim();
    for (const file of unresolvedFiles) {
      const source = await readFile(file, 'utf8');
      if (/GAME_NAME_TO_REPLACE|OFFICIAL_GAME_URL_TO_REPLACE|\{\{(?:GAME_NAME|TOPIC|DOMAIN)[^}]*\}\}/i.test(source)) addIssue('unresolved game placeholder', file);
      if (oldKeyword && source.toLowerCase().includes(oldKeyword.toLowerCase())) addIssue(`old game keyword remains: ${oldKeyword}`, file);
    }
  } else {
    if (en.site?.gameName !== 'Game' || en.site?.name !== 'Game Wiki') addIssue('Blank template identity must remain neutral until a game is selected.');
    if (Object.keys(en.nav ?? {}).length > 0 || Object.keys(en.contentTypes ?? {}).length > 0) addIssue('Blank template navigation and contentTypes must be empty.');
  }

  await validateContent(requiredLocales, await blockedDomains(), configured);
}

async function validateContent(requiredLocales, blocked, configured = true) {
  const contentRoot = path.join(root, 'content');
  const enRoot = path.join(contentRoot, 'en');
  const englishFiles = await walk(enRoot, '.mdx');
  const englishRelative = englishFiles.map((file) => path.relative(enRoot, file).replaceAll('\\', '/')).sort();
  const englishMetadata = new Map();
  const englishBodies = new Map();

  if (!configured && englishFiles.length > 0) addIssue('Blank template must not contain published MDX articles.');

  for (const file of englishFiles) {
    const relative = path.relative(enRoot, file);
    const category = relative.split(path.sep)[0];
    const result = await validateMdx(file, 'en', category, blocked);
    englishMetadata.set(relative.replaceAll('\\', '/'), result.metadata);
    englishBodies.set(relative.replaceAll('\\', '/'), result.body.trim());
  }

  if (configured) {
    for (const locale of requiredLocales.filter((value) => value !== 'en')) {
      const localeRoot = path.join(contentRoot, locale);
      const files = await walk(localeRoot, '.mdx');
      const relative = files.map((file) => path.relative(localeRoot, file).replaceAll('\\', '/')).sort();
      if (JSON.stringify(relative) !== JSON.stringify(englishRelative)) addIssue(`${locale} content paths do not exactly match English content paths.`);
      for (const file of files) {
        const rel = path.relative(localeRoot, file).replaceAll('\\', '/');
        const category = rel.split('/')[0];
        const result = await validateMdx(file, locale, category, blocked);
        const enMeta = englishMetadata.get(rel);
        if (enMeta && result.metadata?.title === enMeta.title && result.metadata?.description === enMeta.description) addIssue(`${locale} metadata is still identical to English`, file);
        if (englishBodies.get(rel) && result.body.trim() === englishBodies.get(rel)) addIssue(`${locale} article body is still identical to English`, file);
      }
    }

    const navigationSource = await readFile(path.join(root, 'src', 'config', 'navigation.ts'), 'utf8');
    const configuredContentTypes = [...navigationSource.matchAll(/key:\s*["']([^"']+)["'][\s\S]*?isContentType:\s*true/g)].map((match) => match[1]);
    const categoryCounts = new Map();
    for (const rel of englishRelative) categoryCounts.set(rel.split('/')[0], (categoryCounts.get(rel.split('/')[0]) ?? 0) + 1);
    for (const category of configuredContentTypes) {
      if (!categoryCounts.get(category)) addIssue(`Empty content category "${category}" must be removed from content navigation or converted to a status page.`);
    }
    for (const category of categoryCounts.keys()) {
      if (!configuredContentTypes.includes(category)) addIssue(`Published category "${category}" is missing from navigation configuration.`);
    }
  }
}

if (seoscoutMode) {
  await validateSeoscout();
} else if (contentOnly) {
  const languageData = await readJson(path.join(requirementsDir, 'languages.json'));
  await validateContent((languageData?.languages ?? []).map((item) => item.code), await blockedDomains(), true);
} else {
  await validateSite();
}

for (const warning of warnings) console.warn(`WARNING: ${warning}`);
if (issues.length > 0) {
  for (const issue of issues) {
    const label = issue.file ? `${path.relative(root, issue.file)}: ` : '';
    console.error(`ERROR: ${label}${issue.message}`);
  }
  console.error(`Validation failed with ${issues.length} issue(s).`);
  process.exitCode = 1;
} else {
  console.log(seoscoutMode ? 'SEOScout output quality gate passed.' : contentOnly ? 'MDX content validation passed.' : 'Wiki template validation passed.');
}
