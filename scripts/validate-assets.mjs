import {readFile, readdir, stat} from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const strictRequested = process.argv.includes('--strict');
const issues = [];
const warnings = [];

async function walk(directory, extensions) {
  const files = [];
  let entries;
  try { entries = await readdir(directory, {withFileTypes: true}); }
  catch { return files; }
  for (const entry of entries) {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await walk(full, extensions));
    else if (entry.isFile() && (!extensions || extensions.has(path.extname(entry.name).toLowerCase()))) files.push(full);
  }
  return files;
}

function webpSize(buffer) {
  if (buffer.toString('ascii', 0, 4) !== 'RIFF' || buffer.toString('ascii', 8, 12) !== 'WEBP') return null;
  let offset = 12;
  while (offset + 8 <= buffer.length) {
    const type = buffer.toString('ascii', offset, offset + 4);
    const length = buffer.readUInt32LE(offset + 4);
    const data = offset + 8;
    if (type === 'VP8X' && data + 10 <= buffer.length) {
      const width = 1 + buffer[data + 4] + (buffer[data + 5] << 8) + (buffer[data + 6] << 16);
      const height = 1 + buffer[data + 7] + (buffer[data + 8] << 8) + (buffer[data + 9] << 16);
      return {width, height};
    }
    if (type === 'VP8L' && data + 5 <= buffer.length && buffer[data] === 0x2f) {
      const width = 1 + buffer[data + 1] + ((buffer[data + 2] & 0x3f) << 8);
      const height = 1 + (buffer[data + 2] >> 6) + (buffer[data + 3] << 2) + ((buffer[data + 4] & 0x0f) << 10);
      return {width, height};
    }
    if (type === 'VP8 ' && data + 10 <= buffer.length && buffer[data + 3] === 0x9d && buffer[data + 4] === 0x01 && buffer[data + 5] === 0x2a) {
      return {width: buffer.readUInt16LE(data + 6) & 0x3fff, height: buffer.readUInt16LE(data + 8) & 0x3fff};
    }
    offset = data + length + (length % 2);
  }
  return null;
}

function jpegSize(buffer) {
  if (buffer[0] !== 0xff || buffer[1] !== 0xd8) return null;
  let offset = 2;
  while (offset + 9 < buffer.length) {
    if (buffer[offset] !== 0xff) { offset += 1; continue; }
    const marker = buffer[offset + 1];
    const length = buffer.readUInt16BE(offset + 2);
    if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker)) {
      return {height: buffer.readUInt16BE(offset + 5), width: buffer.readUInt16BE(offset + 7)};
    }
    if (length < 2) break;
    offset += 2 + length;
  }
  return null;
}

function inspectImage(buffer, extension) {
  if (extension === '.svg') {
    const text = buffer.toString('utf8');
    return /<svg\b/i.test(text) ? {format: 'svg'} : null;
  }
  if (extension === '.png' && buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) {
    return {format: 'png', width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20)};
  }
  if (extension === '.webp') {
    const size = webpSize(buffer);
    return size ? {format: 'webp', ...size} : null;
  }
  if (extension === '.jpg' || extension === '.jpeg') {
    const size = jpegSize(buffer);
    return size ? {format: 'jpeg', ...size} : null;
  }
  if (extension === '.gif' && buffer.toString('ascii', 0, 3) === 'GIF') {
    return {format: 'gif', width: buffer.readUInt16LE(6), height: buffer.readUInt16LE(8)};
  }
  if (extension === '.ico' && buffer.length >= 6 && buffer.readUInt16LE(0) === 0 && buffer.readUInt16LE(2) === 1) return {format: 'ico'};
  return null;
}

const basicInfo = await readFile(path.join(root, '站点数据采集目录', '基础信息.md'), 'utf8');
const configured = Boolean(basicInfo.match(/^> 游戏名称：[ \t]*(.*)$/m)?.[1]?.trim());
const strict = strictRequested && configured;
const imageExtensions = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg', '.ico']);
const publicImages = await walk(path.join(root, 'public'), imageExtensions);
const validImages = new Map();

for (const file of publicImages) {
  const buffer = await readFile(file);
  const extension = path.extname(file).toLowerCase();
  const info = inspectImage(buffer, extension);
  if (!info) issues.push(`${path.relative(root, file)} is not a valid ${extension || 'image'} file.`);
  else if (buffer.length === 0 || (extension !== '.svg' && extension !== '.ico' && buffer.length < 512)) issues.push(`${path.relative(root, file)} is too small to be a real image (${buffer.length} bytes).`);
  else validImages.set(path.resolve(file), {...info, bytes: buffer.length});
}

const sourceFiles = [
  ...await walk(path.join(root, 'src'), new Set(['.ts', '.tsx', '.json'])),
  ...await walk(path.join(root, 'content'), new Set(['.mdx']))
];
const referenced = new Set();
for (const file of sourceFiles) {
  const source = await readFile(file, 'utf8');
  for (const match of source.matchAll(/["']\/(images\/[^"']+|favicon[^"']*|apple-touch-icon[^"']*)["']/g)) {
    const target = path.join(root, 'public', match[1].split(/[?#]/)[0]);
    referenced.add(path.resolve(target));
    try { await stat(target); }
    catch { issues.push(`${path.relative(root, file)} references missing asset /${match[1]}.`); }
  }
  if (strict && /placeholder-(?:hero|card)\.svg/.test(source)) issues.push(`${path.relative(root, file)} still references template placeholder artwork.`);
}

if (strict) {
  const en = JSON.parse(await readFile(path.join(root, 'src', 'locales', 'en.json'), 'utf8'));
  const toPublicFile = (source) => path.join(root, 'public', String(source ?? '').replace(/^\//, ''));
  const heroSource = en.home?.hero?.image?.src ?? en.media?.heroImage;
  const hero = toPublicFile(heroSource);
  const heroInfo = validImages.get(path.resolve(hero));
  if (!heroInfo || heroInfo.format !== 'webp') issues.push(`${heroSource || 'Hero'} is required and must be a real WebP file.`);
  else {
    if (heroInfo.bytes < 10_000) issues.push(`Hero is suspiciously small (${heroInfo.bytes} bytes).`);
    if ((heroInfo.width ?? 0) < 1200 || (heroInfo.height ?? 0) < 600) issues.push(`Hero is ${heroInfo.width}×${heroInfo.height}; minimum is 1200×600.`);
  }

  const visibleHomeImages = [heroSource];
  if (en.home?.story?.enabled) {
    const storySource = en.home?.story?.image?.src;
    const storyInfo = validImages.get(path.resolve(toPublicFile(storySource)));
    visibleHomeImages.push(storySource);
    if (!storyInfo || !['png', 'jpeg', 'webp'].includes(storyInfo.format)) issues.push('Enabled home.story requires a valid raster image.');
    else if ((storyInfo.width ?? 0) < 1000 || (storyInfo.height ?? 0) < 500) issues.push(`Story image is ${storyInfo.width}×${storyInfo.height}; minimum is 1000×500.`);
  }

  const duplicates = visibleHomeImages.filter((value, index) => value && visibleHomeImages.indexOf(value) !== index);
  if (duplicates.length > 0) issues.push(`Visible homepage sections repeat image(s): ${[...new Set(duplicates)].join(', ')}.`);

  const articleSource = en.media?.articleImage;
  const articleInfo = validImages.get(path.resolve(toPublicFile(articleSource)));
  if (!articleInfo || !['png', 'jpeg', 'webp'].includes(articleInfo.format)) issues.push('media.articleImage must reference a valid raster fallback image.');

  const logoSource = en.media?.logoImage;
  const logoFile = toPublicFile(logoSource);
  if (!validImages.has(path.resolve(logoFile))) issues.push('media.logoImage must reference a valid favicon or logo file.');
  else if (path.extname(logoFile).toLowerCase() === '.svg' && /placeholder/i.test(await readFile(logoFile, 'utf8'))) issues.push('The placeholder favicon must be replaced before publishing a configured site.');
}

if (referenced.size === 0) warnings.push('No local image references were found.');
for (const warning of warnings) console.warn(`WARNING: ${warning}`);
if (issues.length > 0) {
  issues.forEach((message) => console.error(`ERROR: ${message}`));
  console.error(`Asset validation failed with ${issues.length} issue(s).`);
  process.exitCode = 1;
} else {
  console.log(`Asset validation passed: ${validImages.size} valid image file(s), ${referenced.size} referenced asset(s).`);
}
