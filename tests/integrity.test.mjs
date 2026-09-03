import assert from 'node:assert/strict';
import {mkdtemp, mkdir, rm, writeFile} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {validateIntegrity} from '../scripts/lib/integrity.mjs';

const metadata = (description = 'A complete description for a fixture article.') => `export const metadata = {
  title: "Fixture Guide",
  description: "${description}",
  category: "guide",
  date: "2026-09-04",
  image: "/images/article.webp"
};

## Start

Fixture body.
`;

function localeMessages(language) {
  return {
    site: {name: `Fixture Wiki ${language}`},
    seo: {
      defaultDescription: 'Fixture default description',
      homeTitle: 'Fixture home title',
      homeDescription: 'Fixture home description',
      keywords: 'fixture, guide'
    },
    media: {heroImage: '/images/hero.webp', logoImage: '/favicon.svg', articleImage: '/images/article.webp'},
    contentTypes: {guide: {overviewTitle: `Guide ${language}`, overviewDescription: `Overview ${language}`}},
    home: {hero: {enabled: true, actions: []}, story: {enabled: false}, release: {enabled: false}},
    footer: {links: [{kind: 'internal', label: 'About', href: '/about'}]},
    legal: Object.fromEntries(['about', 'privacy', 'terms', 'copyright'].map((key) => [key, {
      metaTitle: `${key} ${language}`,
      metaDescription: `${key} description ${language}`
    }]))
  };
}

async function fixture() {
  const root = await mkdtemp(path.join(os.tmpdir(), 'wiki-integrity-'));
  const directories = [
    '站点数据采集目录', 'src/locales', 'src/i18n', 'src/config',
    'content/en/guide', 'content/es/guide', 'public/images'
  ];
  await Promise.all(directories.map((directory) => mkdir(path.join(root, directory), {recursive: true})));
  await Promise.all([
    writeFile(path.join(root, '站点数据采集目录', 'languages.json'), JSON.stringify({default: 'en', languages: [{code: 'en'}, {code: 'es'}]})),
    writeFile(path.join(root, '站点数据采集目录', '基础信息.md'), '> 游戏名称：Fixture Game\n'),
    writeFile(path.join(root, 'src', 'i18n', 'routing.ts'), "locales: ['en', 'es'], defaultLocale: 'en', localePrefix: 'always'"),
    writeFile(path.join(root, 'src', 'config', 'navigation.ts'), "{key: 'guide', path: '/guide', isContentType: true}"),
    writeFile(path.join(root, 'src', 'locales', 'en.json'), JSON.stringify(localeMessages('EN'))),
    writeFile(path.join(root, 'src', 'locales', 'es.json'), JSON.stringify(localeMessages('ES'))),
    writeFile(path.join(root, 'content', 'en', 'guide', 'getting-started.mdx'), metadata()),
    writeFile(path.join(root, 'content', 'es', 'guide', 'getting-started.mdx'), metadata('Una descripción completa para el artículo de prueba.')),
    writeFile(path.join(root, 'public', 'images', 'hero.webp'), 'fixture'),
    writeFile(path.join(root, 'public', 'images', 'article.webp'), 'fixture'),
    writeFile(path.join(root, 'public', 'favicon.svg'), '<svg></svg>')
  ]);
  return root;
}

test('all enabled locale routes use matching ASCII slugs', async (t) => {
  const root = await fixture();
  t.after(() => rm(root, {recursive: true, force: true}));
  const result = await validateIntegrity({root});
  assert.deepEqual(result.issues, []);
  assert.ok(result.routes.includes('/guide/getting-started'));
  assert.ok(result.routes.includes('/es/guide'));
  assert.ok(result.routes.includes('/es/guide/getting-started'));
});

test('a damaged locale JSON identifies the file and locale', async (t) => {
  const root = await fixture();
  t.after(() => rm(root, {recursive: true, force: true}));
  const file = path.join(root, 'src', 'locales', 'es.json');
  await writeFile(file, '{not valid JSON');
  const result = await validateIntegrity({root});
  assert.ok(result.issues.some((issue) => issue.area === 'locale/data' && issue.file === file && issue.locale === 'es'));
});

test('missing MDX metadata identifies the article file', async (t) => {
  const root = await fixture();
  t.after(() => rm(root, {recursive: true, force: true}));
  const file = path.join(root, 'content', 'en', 'guide', 'getting-started.mdx');
  await writeFile(file, metadata('').replace('  description: "",\n', ''));
  const result = await validateIntegrity({root});
  assert.ok(result.issues.some((issue) => issue.area === 'mdx/frontmatter' && issue.file === file && issue.message.includes('metadata.description')));
});

test('a missing image identifies the referencing source', async (t) => {
  const root = await fixture();
  t.after(() => rm(root, {recursive: true, force: true}));
  const file = path.join(root, 'src', 'locales', 'es.json');
  const messages = localeMessages('ES');
  messages.media.heroImage = '/images/missing.webp';
  await writeFile(file, JSON.stringify(messages));
  const result = await validateIntegrity({root});
  assert.ok(result.issues.some((issue) => issue.area === 'image/resource' && issue.file === file && issue.message.includes('/images/missing.webp')));
});
