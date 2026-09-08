import {readFile, writeFile} from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const requirementsDir = path.join(root, '站点数据采集目录');
const categoriesPath = path.join(requirementsDir, '关键词分类.json');
const languagesPath = path.join(requirementsDir, 'languages.json');
const outputPath = path.join(root, 'seoscout', 'keywords.json');
const generatePromptPath = path.join(root, 'seoscout', 'prompts', 'generate.md');
const policyPath = path.join(root, 'seoscout', 'source-policy.json');
const riskyIntent = /\b(script|scripts|hack|hacks|exploit|exploits|executor|injector|injection|pastebin|auto\s*(farm|quest|egg|eggs|click|grind)|no\s*key|keyless|inf(?:inite)?\s*(money|coins|gems)|dupe|cheat|cheats)\b/i;
const unfinishedValue = /^(待填写|待研究|待核验|暂无|未核验)?$/;

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

function hostnameFromUrl(value) {
  try {
    return new URL(value).hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    return '';
  }
}

function domainMatches(host, domains) {
  return domains.some((domain) => host === domain || host.endsWith(`.${domain}`));
}

async function applyProjectSeoScoutConfig() {
  const basicInfo = await readFile(path.join(requirementsDir, '基础信息.md'), 'utf8');
  const gameName = (basicInfo.match(/^> 游戏名称：[ \t]*(.*)$/m)?.[1] ?? '').trim();
  const officialUrl = (basicInfo.match(/^> 官方网站：[ \t]*(.*)$/m)?.[1] ?? '').trim();
  if (!gameName || unfinishedValue.test(gameName)) {
    fail('基础信息.md 的游戏名称不能为空。准备 SEOScout 前先完成阶段 A。');
    return;
  }
  if (!/^https?:\/\//i.test(officialUrl) || unfinishedValue.test(officialUrl)) {
    fail('基础信息.md 必须包含可访问的官方网站 URL。准备 SEOScout 前先完成阶段 A。');
    return;
  }

  let prompt = await readFile(generatePromptPath, 'utf8');
  if (prompt.includes('GAME_NAME_TO_REPLACE') || prompt.includes('OFFICIAL_GAME_URL_TO_REPLACE')) {
    prompt = prompt.replaceAll('GAME_NAME_TO_REPLACE', gameName).replaceAll('OFFICIAL_GAME_URL_TO_REPLACE', officialUrl);
    await writeFile(generatePromptPath, prompt, 'utf8');
    console.log(`Filled seoscout/prompts/generate.md for ${gameName}.`);
  }

  const policy = await loadJson(policyPath);
  const blocked = (policy.blocked_domains ?? []).map((domain) => String(domain).toLowerCase().replace(/^www\./, ''));
  const urls = [
    officialUrl,
    ...[...basicInfo.matchAll(/https?:\/\/[^\s)|\]>"'`]+/gi)].map((match) => match[0].replace(/[.,;]+$/g, ''))
  ];
  const official = [];
  const seen = new Set();
  for (const url of urls) {
    const host = hostnameFromUrl(url);
    if (!host || seen.has(host) || domainMatches(host, blocked)) continue;
    seen.add(host);
    official.push(host);
  }
  policy.official_domains = official;
  await writeFile(policyPath, `${JSON.stringify(policy, null, 2)}\n`, 'utf8');
  console.log(`Updated seoscout/source-policy.json with ${official.length} official domain(s).`);
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

await applyProjectSeoScoutConfig();
if (process.exitCode) process.exit();

await writeFile(outputPath, `${JSON.stringify(normalized, null, 2)}\n`, 'utf8');
console.log(`Prepared seoscout/keywords.json: ${keywordCount} keywords, ${categories.length} categories, ${languageCodes.length} locales.`);
