import {readFile, writeFile} from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const requirementsDir = path.join(root, '站点数据采集目录');
const categoriesPath = path.join(requirementsDir, '关键词分类.json');
const languagesPath = path.join(requirementsDir, 'languages.json');
const outputPath = path.join(root, 'seoscout', 'keywords.json');
const riskyIntent = /\b(script|scripts|hack|hacks|exploit|exploits|executor|injector|injection|pastebin|auto\s*(farm|quest|egg|eggs|click|grind)|no\s*key|keyless|inf(?:inite)?\s*(money|coins|gems)|dupe|cheat|cheats)\b/i;

function fail(message) {
  console.error(`ERROR: ${message}`);
  process.exitCode = 1;
}

async function loadJson(file) {
  try {
    return JSON.parse(await readFile(file, 'utf8'));
  } catch (error) {
    throw new Error(`${file}: ${error.message}`);
  }
}

const categoriesData = await loadJson(categoriesPath);
const languagesData = await loadJson(languagesPath);
const topic = String(categoriesData.topic_name ?? '').trim().toLowerCase();
const categories = Array.isArray(categoriesData.categories) ? categoriesData.categories : [];
const languages = Array.isArray(languagesData.languages) ? languagesData.languages : [];

if (!topic) fail('关键词分类.json 的 topic_name 不能为空。');
if (!/^[\x20-\x7e]+$/.test(topic)) fail('topic_name 必须是纯英文 ASCII。');
if (categories.length < 1 || categories.length > 8) fail('分类数量必须在 1–8 之间。');
if (!categories.some((item) => item.category === 'guide')) fail('必须包含 guide 分类。');
if (languagesData.default !== 'en') fail('languages.json 的 default 必须是 en。');
if (languages.length < 1 || languages.length > 4) fail('语言数量必须在 1–4 之间。');

const languageCodes = languages.map((item) => String(item.code ?? '').trim().toLowerCase());
if (languageCodes.filter((code) => code === 'en').length !== 1) fail('语言列表必须且只能包含一个 en。');
if (languageCodes.some((code) => code === 'zh' || code.startsWith('zh-'))) fail('本模板语言集合不包含中文。');
if (languageCodes.some((code) => !/^[a-z]{2,3}(?:-[a-z]{2})?$/.test(code))) fail('语言代码必须使用 en、es、pt-br、ja 等标准格式。');
if (new Set(languageCodes).size !== languageCodes.length) fail('languages.json 存在重复语言代码。');

const seenCategories = new Set();
const seenKeywords = new Map();
let keywordCount = 0;

for (const item of categories) {
  const category = String(item.category ?? '').trim().toLowerCase();
  const keywords = Array.isArray(item.keywords) ? item.keywords : [];
  if (!/^[a-z]+$/.test(category) && category !== 'tier list') {
    fail(`分类 "${category}" 必须是单个英文单词；固定词组只允许 tier list。`);
  }
  if (seenCategories.has(category)) fail(`重复分类：${category}`);
  seenCategories.add(category);
  if (category === 'codes' && keywords.length > 1) fail('codes 分类只能保留一个关键词。');

  for (const rawKeyword of keywords) {
    const keyword = String(rawKeyword ?? '').trim().toLowerCase();
    keywordCount += 1;
    if (!keyword) fail(`${category} 分类存在空关键词。`);
    if (!/^[\x20-\x7e]+$/.test(keyword)) fail(`关键词必须是纯英文 ASCII：${rawKeyword}`);
    if (!keyword.startsWith(`${topic} `)) fail(`关键词必须以 "${topic}" 开头：${keyword}`);
    if (riskyIntent.test(keyword)) fail(`检测到作弊、脚本或风险意图：${keyword}`);
    if (seenKeywords.has(keyword)) fail(`关键词重复出现在 ${seenKeywords.get(keyword)} 和 ${category}：${keyword}`);
    seenKeywords.set(keyword, category);
  }
}

if (keywordCount === 0) fail('尚未填写任何可生成关键词。');
if (keywordCount > 60) console.warn(`WARNING: 当前保留 ${keywordCount} 个关键词；允许继续，但请确认额外文章都有独立搜索意图和足够资料。`);

if (process.exitCode) process.exit();

const normalized = {
  topic_name: topic,
  languages: languageCodes.filter((code) => code !== 'en'),
  categories: categories.map((item) => ({
    category: String(item.category).trim().toLowerCase(),
    keywords: item.keywords.map((keyword) => String(keyword).trim().toLowerCase())
  }))
};

await writeFile(outputPath, `${JSON.stringify(normalized, null, 2)}\n`, 'utf8');
console.log(`Prepared seoscout/keywords.json: ${keywordCount} keywords, ${categories.length} categories, ${languageCodes.length} locales.`);
