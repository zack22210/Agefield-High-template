import {spawn, spawnSync} from 'node:child_process';
import {readFile, readdir, rm} from 'node:fs/promises';
import net from 'node:net';
import path from 'node:path';
import process from 'node:process';
import {metadataFromMdx, validateIntegrity} from './lib/integrity.mjs';
import {resolveSiteUrlEnvironment} from '../src/config/site-url.ts';

const root = process.cwd();
const runEnvironment = {...process.env, CI: process.env.CI || 'true'};
const sensitiveValues = Object.entries(runEnvironment)
  .filter(([name, value]) => /(?:authorization|cookie|api_?key|token|secret|password)/i.test(name) && value && value.length >= 4)
  .map(([, value]) => value)
  .sort((a, b) => b.length - a.length);

function redact(value) {
  let output = String(value ?? '')
    .replace(/\b(authorization|cookie|api[-_ ]?key|token|secret|password)\b\s*[:=]\s*([^\s,;]+)/gi, '$1=[REDACTED]')
    .replace(/(https?:\/\/)[^/@\s]+@/gi, '$1[REDACTED]@');
  for (const sensitive of sensitiveValues) output = output.replaceAll(sensitive, '[REDACTED]');
  return output;
}

function runStep(label, command, args) {
  console.log(`\n== ${label} ==`);
  const result = spawnSync(command, args, {
    cwd: root,
    env: runEnvironment,
    encoding: 'utf8',
    maxBuffer: 30 * 1024 * 1024,
    shell: false
  });
  if (result.stdout) process.stdout.write(redact(result.stdout));
  if (result.stderr) process.stderr.write(redact(result.stderr));
  if (result.error) throw new Error(`${label} could not start: ${redact(result.error.message)}`);
  if (result.status !== 0) throw new Error(`${label} failed with exit code ${result.status}.`);
}

function pnpmInvocation(args) {
  const cli = process.env.npm_execpath;
  if (cli && /pnpm(?:\.c?m?js)?$/i.test(cli)) {
    return {command: process.execPath, args: [cli, ...args]};
  }
  return {command: process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm', args};
}

function runPnpmStep(label, args) {
  const invocation = pnpmInvocation(args);
  runStep(label, invocation.command, invocation.args);
}

async function cleanNextOutput(reason) {
  const nextDirectory = path.resolve(root, '.next');
  if (path.dirname(nextDirectory) !== path.resolve(root) || path.basename(nextDirectory) !== '.next') {
    throw new Error(`Refusing to clean unexpected build path: ${nextDirectory}`);
  }
  await rm(nextDirectory, {recursive: true, force: true});
  console.log(`Removed the previous .next build output ${reason}.`);
}

async function emptyPort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : 0;
      server.close(() => resolve(port));
    });
  });
}

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

function localePrefix(locale, defaultLocale) {
  return `/${locale}`;
}

function canonicalFor(origin, locale, defaultLocale, route) {
  const prefix = localePrefix(locale, defaultLocale);
  const pathname = `${prefix}${route}`.replace(/\/{2,}/g, '/');
  return `${origin}${pathname.replace(/\/$/, '')}`;
}

function decodeHtml(value) {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&mdash;|&#x2014;/g, '—')
    .replace(/&ndash;|&#x2013;/g, '–')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

function htmlText(value) {
  return decodeHtml(value.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim());
}

function canonicalFromHtml(html) {
  const links = html.match(/<link\b[^>]*>/gi) ?? [];
  const tag = links.find((value) => /\brel=["']canonical["']/i.test(value));
  return tag?.match(/\bhref=["']([^"']+)["']/i)?.[1] ?? '';
}

async function fetchWithContext(url, label, options) {
  try {
    return await fetch(url, options);
  } catch (error) {
    const detail = error instanceof Error
      ? `${error.message}${error.cause instanceof Error ? ` (${error.cause.message})` : ''}`
      : String(error);
    throw new Error(`${label} request failed for ${url}: ${redact(detail)}`);
  }
}

async function representativePages(origin) {
  const languageData = JSON.parse(await readFile(path.join(root, '站点数据采集目录', 'languages.json'), 'utf8'));
  const locales = languageData.languages.map((item) => item.code);
  const defaultLocale = languageData.default ?? 'en';
  const pages = [];
  const defaultMessages = JSON.parse(await readFile(path.join(root, 'src', 'locales', `${defaultLocale}.json`), 'utf8'));
  pages.push({path: '/', title: defaultMessages.seo.homeTitle, marker: defaultMessages.home.hero.title, canonical: `${origin}/${defaultLocale}`, label: 'homepage'});
  pages.push({path: `/${defaultLocale}`, title: defaultMessages.seo.homeTitle, marker: defaultMessages.home.hero.title, canonical: `${origin}/${defaultLocale}`, label: 'explicit English homepage'});
  pages.push({path: `/${defaultLocale}/about`, title: defaultMessages.legal.about.metaTitle, marker: defaultMessages.legal.about.title, canonical: `${origin}/${defaultLocale}/about`, label: 'legal page'});

  const englishFiles = await walk(path.join(root, 'content', defaultLocale), '.mdx');
  const guideFile = englishFiles.find((file) => path.relative(path.join(root, 'content', defaultLocale), file).replaceAll('\\', '/').startsWith('guide/'));
  if (guideFile) {
    const messages = defaultMessages;
    pages.push({
      path: `/${defaultLocale}/guide`,
      title: `${messages.contentTypes.guide.overviewTitle} — ${messages.site.name}`,
      marker: messages.contentTypes.guide.overviewTitle,
      canonical: `${origin}/${defaultLocale}/guide`,
      label: 'English guide category'
    });
    const relative = path.relative(path.join(root, 'content', defaultLocale), guideFile).replaceAll('\\', '/').replace(/\.mdx$/, '');
    const article = metadataFromMdx(await readFile(guideFile, 'utf8'));
    pages.push({
      path: `/${defaultLocale}/${relative}`,
      title: `${article.title} — ${messages.site.name}`,
      marker: article.title,
      canonical: `${origin}/${defaultLocale}/${relative}`,
      label: 'English article'
    });
  } else {
    console.log('INFO: /en/guide and an English article are not applicable until the blank template has published content.');
  }

  const nonEnglish = locales.find((locale) => locale !== defaultLocale);
  if (nonEnglish && englishFiles.length > 0) {
    const relative = path.relative(path.join(root, 'content', defaultLocale), englishFiles[0]).replaceAll('\\', '/').replace(/\.mdx$/, '');
    const category = relative.split('/')[0];
    const localizedFile = path.join(root, 'content', nonEnglish, `${relative}.mdx`);
    const messages = JSON.parse(await readFile(path.join(root, 'src', 'locales', `${nonEnglish}.json`), 'utf8'));
    const article = metadataFromMdx(await readFile(localizedFile, 'utf8'));
    pages.push({
      path: `/${nonEnglish}/${category}`,
      title: `${messages.contentTypes[category].overviewTitle} — ${messages.site.name}`,
      marker: messages.contentTypes[category].overviewTitle,
      canonical: canonicalFor(origin, nonEnglish, defaultLocale, `/${category}`),
      label: 'non-English category'
    });
    pages.push({
      path: `/${nonEnglish}/${relative}`,
      title: `${article.title} — ${messages.site.name}`,
      marker: article.title,
      canonical: canonicalFor(origin, nonEnglish, defaultLocale, `/${relative}`),
      label: 'non-English article'
    });
  } else {
    console.log('INFO: non-English category/article smoke tests are not applicable until a non-English locale and articles are enabled.');
  }
  return pages;
}

async function waitForServer(baseUrl, child) {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`Production server exited early with code ${child.exitCode}.`);
    try {
      const response = await fetch(`${baseUrl}/robots.txt`, {redirect: 'follow'});
      if (response.ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error('Production server did not become ready within 30 seconds.');
}

async function stopServer(child) {
  if (child.exitCode !== null) return;
  child.kill('SIGTERM');
  await Promise.race([
    new Promise((resolve) => child.once('exit', resolve)),
    new Promise((resolve) => setTimeout(resolve, 5_000))
  ]);
  if (child.exitCode === null) child.kill('SIGKILL');
}

async function smokeTest() {
  const port = await emptyPort();
  const baseUrl = `http://127.0.0.1:${port}`;
  const nextBin = path.join(root, 'node_modules', 'next', 'dist', 'bin', 'next');
  let serverOutput = '';
  const child = spawn(process.execPath, [nextBin, 'start', '-H', '127.0.0.1', '-p', String(port)], {
    cwd: root,
    env: runEnvironment,
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true
  });
  const append = (chunk) => {
    serverOutput = `${serverOutput}${chunk}`.slice(-12_000);
  };
  child.stdout.on('data', append);
  child.stderr.on('data', append);

  const terminate = () => child.kill('SIGTERM');
  process.once('SIGINT', terminate);
  process.once('SIGTERM', terminate);
  try {
    await waitForServer(baseUrl, child);
    const origin = resolveSiteUrlEnvironment(runEnvironment).url;
    const pages = await representativePages(origin);
    for (const page of pages) {
      const response = await fetchWithContext(`${baseUrl}${page.path}`, page.label, {redirect: 'follow'});
      const html = await response.text();
      const title = decodeHtml(html.match(/<title>([\s\S]*?)<\/title>/i)?.[1] ?? '');
      const canonical = decodeHtml(canonicalFromHtml(html));
      const text = htmlText(html);
      if (response.status !== 200) throw new Error(`${page.label} ${page.path} returned HTTP ${response.status}.`);
      if (title !== page.title) throw new Error(`${page.label} ${page.path} title mismatch: expected "${page.title}", received "${title}".`);
      if (!/<main\b/i.test(html) || !text.includes(page.marker)) throw new Error(`${page.label} ${page.path} is missing its main content marker.`);
      if (canonical !== page.canonical) throw new Error(`${page.label} ${page.path} canonical mismatch: expected ${page.canonical}, received ${canonical || 'none'}.`);
      console.log(`OK: ${page.label} ${page.path} -> 200, title/body/canonical verified.`);
    }

    const resources = [
      ['/sitemap.xml', (body) => body.includes('<urlset') && body.includes(`${origin}/`), 'sitemap'],
      ['/robots.txt', (body) => body.includes(`Sitemap: ${origin}/sitemap.xml`), 'robots'],
      ['/manifest.webmanifest', (body) => body.includes('"name"') && body.includes('"start_url":"/"'), 'manifest']
    ];
    for (const [resourcePath, verify, label] of resources) {
      const response = await fetchWithContext(`${baseUrl}${resourcePath}`, label);
      const body = await response.text();
      if (response.status !== 200 || !verify(body)) throw new Error(`${label} ${resourcePath} failed response validation (HTTP ${response.status}).`);
      console.log(`OK: ${label} ${resourcePath} -> 200, payload verified.`);
    }
  } catch (error) {
    if (serverOutput) console.error(`Production server output (redacted):\n${redact(serverOutput)}`);
    throw error;
  } finally {
    process.removeListener('SIGINT', terminate);
    process.removeListener('SIGTERM', terminate);
    await stopServer(child);
  }
}

try {
  runStep('Environment configuration', process.execPath, [path.join(root, 'scripts', 'validate-env.mjs')]);
  runStep('Pinned toolchain', process.execPath, [path.join(root, 'scripts', 'validate-toolchain.mjs')]);
  runPnpmStep('Frozen lockfile installation state', [
    '--config.manage-package-manager-versions=false',
    '--config.confirm-modules-purge=false',
    'install', '--frozen-lockfile', '--offline', '--reporter=append-only'
  ]);
  await cleanNextOutput('before local checks');
  runPnpmStep('Regression tests', ['test']);
  runPnpmStep('TypeScript', ['typecheck']);
  runPnpmStep('Locale, content, route, metadata, and asset integrity', ['validate:integrity']);

  console.log('\n== Clean production build ==');
  await cleanNextOutput('before production build');
  runStep('Next.js production build', process.execPath, [path.join(root, 'node_modules', 'next', 'dist', 'bin', 'next'), 'build']);

  console.log('\n== Production HTTP smoke tests ==');
  await smokeTest();
  console.log('\nDeployment validation passed. The production server was stopped cleanly.');
} catch (error) {
  console.error(`\nDEPLOYMENT VALIDATION FAILED: ${redact(error instanceof Error ? error.message : error)}`);
  process.exitCode = 1;
}
