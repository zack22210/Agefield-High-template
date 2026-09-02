import {mkdir, readFile, readdir, writeFile} from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const requirementsDir = path.join(root, '站点数据采集目录');
const extensions = new Set(['.md', '.mdx', '.json', '.ts', '.tsx']);

async function walk(directory) {
  const files = [];
  let entries;
  try { entries = await readdir(directory, {withFileTypes: true}); }
  catch { return files; }
  for (const entry of entries) {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await walk(full));
    else if (entry.isFile() && extensions.has(path.extname(entry.name).toLowerCase())) files.push(full);
  }
  return files;
}

function hostname(value) {
  try { return new URL(value).hostname.toLowerCase().replace(/^www\./, ''); }
  catch { return ''; }
}

const files = [
  path.join(requirementsDir, '基础信息.md'),
  path.join(requirementsDir, '首页探索模块.json'),
  ...await walk(path.join(root, 'src')),
  ...await walk(path.join(root, 'content'))
];
const references = new Map();
for (const file of files) {
  let source;
  try { source = await readFile(file, 'utf8'); } catch { continue; }
  for (const match of source.matchAll(/https?:\/\/[^\s)\]>'"]+/g)) {
    const url = match[0].replace(/[.,;:]$/, '');
    if (/localhost|127\.0\.0\.1|example\.com|_TO_REPLACE/i.test(url) || url === 'https://schema.org') continue;
    if (!references.has(url)) references.set(url, []);
    references.get(url).push(path.relative(root, file).replaceAll('\\', '/'));
  }
}

const policy = JSON.parse(await readFile(path.join(root, 'seoscout', 'source-policy.json'), 'utf8'));
const blocked = (policy.blocked_domains ?? []).map((value) => String(value).toLowerCase().replace(/^www\./, ''));
const results = [];
const queue = [...references.keys()];

async function check(url) {
  const host = hostname(url);
  if (blocked.some((domain) => host === domain || host.endsWith(`.${domain}`))) {
    return {url, status: null, ok: false, severity: 'error', message: `blocked competitor or risk domain: ${host}`, files: references.get(url)};
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20_000);
  try {
    const response = await fetch(url, {
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; GameWikiLinkCheck/1.0)',
        'Accept-Language': 'en-US,en;q=0.8'
      }
    });
    const status = response.status;
    if (status >= 200 && status < 400) return {url, final_url: response.url, status, ok: true, severity: 'ok', files: references.get(url)};
    if ([401, 403, 429].includes(status)) return {url, final_url: response.url, status, ok: true, severity: 'warning', message: 'server blocks automated checks; verify manually in a browser', files: references.get(url)};
    return {url, final_url: response.url, status, ok: false, severity: 'error', message: `HTTP ${status}`, files: references.get(url)};
  } catch (error) {
    return {url, status: null, ok: false, severity: 'error', message: error.name === 'AbortError' ? 'request timed out' : error.message, files: references.get(url)};
  } finally {
    clearTimeout(timer);
  }
}

async function worker() {
  while (queue.length > 0) {
    const url = queue.shift();
    results.push(await check(url));
  }
}

await Promise.all(Array.from({length: Math.min(5, Math.max(queue.length, 1))}, () => worker()));
results.sort((a, b) => a.url.localeCompare(b.url));
await mkdir(requirementsDir, {recursive: true});
await writeFile(path.join(requirementsDir, 'link-report.json'), `${JSON.stringify({checked_at: new Date().toISOString(), results}, null, 2)}\n`, 'utf8');

const errors = results.filter((item) => item.severity === 'error');
const warnings = results.filter((item) => item.severity === 'warning');
warnings.forEach((item) => console.warn(`WARNING: ${item.url} — ${item.message}`));
errors.forEach((item) => console.error(`ERROR: ${item.url} — ${item.message} — ${item.files.join(', ')}`));
if (errors.length > 0) {
  console.error(`Link validation failed: ${errors.length} invalid or blocked URL(s).`);
  process.exitCode = 1;
} else {
  console.log(`Link validation passed: ${results.length} URL(s), ${warnings.length} manual-check warning(s).`);
}
