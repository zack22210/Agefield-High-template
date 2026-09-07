import {readdir, readFile, writeFile} from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const LEGAL_ROUTES = ['/about', '/privacy-policy', '/terms-of-service', '/copyright'];

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
    else if (entry.isFile() && entry.name.endsWith(extension)) files.push(target);
  }
  return files;
}

function unique(values) {
  return [...new Set(values)];
}

async function unprefixedRoutes(defaultLocale) {
  const navigation = await readFile(path.join(root, 'src', 'config', 'navigation.ts'), 'utf8');
  const categories = [...navigation.matchAll(/\{\s*key:\s*["']([^"']+)["'][\s\S]*?isContentType:\s*true\s*\}/g)]
    .map((match) => `/${match[1]}`);
  const articleRoot = path.join(root, 'content', defaultLocale);
  const articles = (await walk(articleRoot, '.mdx')).map((file) => {
    const relative = path.relative(articleRoot, file).replaceAll('\\', '/').replace(/\.mdx$/, '');
    return `/${relative}`;
  });
  return unique(['', ...LEGAL_ROUTES, ...categories, ...articles]);
}

function redirectLine(from, to) {
  const source = from === '' ? '/' : from;
  return `${source}    ${to}    302`;
}

const languages = JSON.parse(await readFile(path.join(root, '站点数据采集目录', 'languages.json'), 'utf8'));
const defaultLocale = languages.default ?? 'en';
const routes = await unprefixedRoutes(defaultLocale);
const lines = [
  '# Locale-prefix fallbacks for static hosts. First matching rule wins.',
  redirectLine('', `/${defaultLocale}`),
  ...routes.filter((route) => route !== '').map((route) => redirectLine(route, `/${defaultLocale}${route}`)),
  ''
];

const outputPath = path.join(root, 'out', '_redirects');
await writeFile(outputPath, lines.join('\n'), 'utf8');
console.log(`Wrote ${routes.length} static-hosting redirects to out/_redirects.`);
