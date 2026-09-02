# 非 Roblox 游戏 Wiki 模板执行规则

本仓库是一个可复用的非 Roblox 游戏 Wiki 模板。新项目允许根据游戏调整主题、字体、图片、间距和布局表现，但必须保留现有页面框架、路由、MDX、SEO、多语言、法律页、响应式行为和广告位置。不要配置远程部署。

## 固定工作流

### 阶段 A：收到游戏名和域名后立即执行

1. 核验游戏官网、开发商、发行商、第一方商店页面、官方社群、官方 YouTube、可播放的 gameplay/tutorial/showcase 视频、发布日期、平台、更新和玩家关心的数据。
2. 官方来源优先，权威游戏媒体仅作补充。禁止竞对 Wiki、Fandom、wiki.gg、Fextralife、聚合攻略 Wiki、404、盗版、APK、密钥转售、脚本、作弊、注入和自动刷取来源。
3. 把研究结果写入 `站点数据采集目录/基础信息.md`，把首页各模块的最终数据写入 `站点数据采集目录/首页探索模块.json`，把语言结论写入 `站点数据采集目录/languages.json`。
4. 下载并验证 Hero、启用的 Story 图片、文章后备图和 favicon。首页同时可见的图片应互不重复；禁用模块不要求素材。
5. 更新游戏名、域名、主题、字体、英文首页、官方链接、法律页、manifest、结构化数据和图片。Hero、Status、Facts、Story、Release、Index 中不适合该游戏的模块可以禁用或替换，但不重建底层框架。
6. 英语固定存在；最多再选择三种非中文语言。阶段 A 先完成英语与语言配置，不生成虚构文章。
7. 英文首页、链接、主题、素材和本地构建完成后停止，等待用户把关键词放入 `站点数据采集目录/原始关键词.txt`。

### 阶段 B：用户提供关键词后连续执行

1. 手工分析全部关键词，过滤核心主词、跑题词和作弊/外挂/脚本意图，合并同义词、单复数和相同搜索意图。
2. `guide` 为必备分类；最多 8 类；通常保留 40–60 个独立高价值意图，资料充分时允许更多。每个保留关键词对应一个 MDX 内页。
3. 将结果写入 `站点数据采集目录/关键词分类.json`，运行 `pnpm research:prepare` 同步到 `seoscout/keywords.json`。
4. 运行 `pnpm seoscout:run`，连续完成搜索、采集、英文 MDX、最多三种非英文语言翻译、质量检查与内容同步。
5. 所有语言使用相同英文 ASCII slug；已启用语言必须完整翻译 UI、列表页、metadata、标题和正文，不能把英文回退当成完成。
6. 没有文章的分类不进入导航。资料不足的关键词记录在质量报告中，不创建假文章或假状态页。
7. 根据最终分类同步 `navigation.ts`、`content.ts`、`sitemap.ts`、locale JSON 和首页内部链接，禁止空链接或捏造路径。

## SEO 与内容硬规则

- 首页 title 不超过 60 字符；英文 description 为 140–160 字符；keywords 不超过 100 字符。
- MDX 必须以 `export const metadata = {` 开头，包含 title、description、category、date；正文从 H2 开始，不产生第二个 H1。
- 游戏事实只能来自已采集且可访问的来源。资料不足时缩短文章或跳过，禁止编造。
- 每篇文章必须列出实际使用的来源 URL，且不得包含竞对、404、盗版、风险或作弊来源。
- 一份 MDX 对应一个独立搜索意图，标题和正文自然覆盖关键词，不机械堆词。
- 广告保留现有位置，待用户配置广告 Key 后再评估密度。
- 只保证本地构建和验证通过，不配置 Vercel、Cloudflare、Docker 或其他远程部署。

## 真相源与命令

- 资料真相源：`站点数据采集目录/`
- 分类真相源：`站点数据采集目录/关键词分类.json`
- 语言真相源：`站点数据采集目录/languages.json`
- SEOScout 共享安装：`D:\Web出海\tools\seoscout`
- 项目级 SEOScout 配置与结果：`seoscout/`
- 发布文章：`content/<locale>/<category>/<english-slug>.mdx`
- 生成前准备：`pnpm research:prepare`
- 全流程：`pnpm seoscout:run`
- 全面验证：`pnpm validate:all`

共享 SEOScout 源码是脚本管理的工具目录，不复制进每个 Wiki 项目。
