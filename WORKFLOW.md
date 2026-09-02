# 非 Roblox 游戏 Wiki 模板使用流程

## 一、新游戏资料阶段

克隆模板后提供游戏名和域名，默认连续完成：

1. 核验官网、开发商、发行商、Steam/Epic/GOG 或主机商店、官方社群、YouTube、平台、发售与更新信息。
2. 生成 `基础信息.md`、当前首页模块数据和最多四种语言的优先级结论。英语必选，不选择中文。
3. 下载并验证 Hero、启用的 Story 图片、文章后备图和 favicon。
4. 替换游戏名、域名、主题、字体、英文首页、官方链接、法律页、manifest 和结构化数据。
5. 按游戏实际情况启用、改写或关闭 Status、Facts、Story、Release、Index 模块。
6. 本地验证通过后暂停，等待人工挖掘的关键词。

这一阶段不生成虚构文章，不用竞对 Wiki 填补资料。所有进入页面的外部链接必须可打开。

## 二、关键词阶段

将关键词原样放入 `站点数据采集目录/原始关键词.txt`，然后进行人工语义判断：

- 过滤主词、跑题词和作弊/外挂/脚本意图。
- 合并同义词、单复数和相同搜索意图。
- 按玩家实际需求分类，必须包含 `guide`，最多 8 类。
- 通常保留 40–60 个精品意图；资料充分时可以更多。
- 每个最终关键词生成一个 MDX 文件。

结果保存到 `关键词分类.json`。分类完成后不再逐步确认，直接进入生成流程。

## 三、SEOScout 共享工具

共享源码路径：

```text
D:\Web出海\tools\seoscout
```

项目仅保留：

```text
seoscout/
├── .env
├── keywords.json
├── source-policy.json
├── prompts/
└── output/
```

首次使用运行 `pnpm seoscout:setup`。项目使用本地 Trafilatura 抽取网页正文，不需要 Jina Key。

## 四、生成、翻译与同步

```bash
pnpm research:prepare
pnpm seoscout:run
```

完整流程包括搜索、来源过滤、正文与视频字幕采集、英文 MDX、多语言翻译、质量检查、一次自动重试和通过文件同步。资料不足的关键词进入 `quality-report.json`，不生成猜测内容。

## 五、多语言

语言保存在 `站点数据采集目录/languages.json`，最多四种并必须包含英语，不包含中文。所有语言使用相同英文 slug，但 UI、导航、列表、metadata、文章标题与正文必须完整翻译。

## 六、发布前检查

```bash
pnpm validate:links
pnpm validate:all
```

检查真实素材、SEO 长度、MDX metadata、来源链接、语言路径一致性、旧游戏残留、导航与分类一致性、TypeScript 和生产构建。模板保留广告位置，不配置远程部署。
