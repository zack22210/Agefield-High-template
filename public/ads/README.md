# Adsterra Banner Ads

## 配置方式

1. 复制 `.env.example` 为 `.env.local`，填入广告 KEY  
2. 运行 `pnpm ads:sync`（`pnpm dev` / `pnpm build` 会自动执行）  
3. 脚本把 KEY 写入 `public/ads/banner-*.html`；页面用 iframe 加载这些 HTML，不再通过 URL 传 KEY  

`.env.local` 不要提交到 Git。提交的是生成后的 `banner-*.html`（内含 KEY）。

## Agent 维护的 KEY 变量名

```
NEXT_PUBLIC_AD_MOBILE_320X50=你的key
NEXT_PUBLIC_AD_SIDEBAR_160X600=你的key
NEXT_PUBLIC_AD_SIDEBAR_160X300=你的key
NEXT_PUBLIC_AD_BANNER_300X250=你的key
NEXT_PUBLIC_AD_BANNER_728X90=你的key
NEXT_PUBLIC_AD_BANNER_468X60=你的key
NEXT_PUBLIC_AD_NATIVE_BANNER=你的key
NEXT_PUBLIC_AD_NATIVE_SCRIPT=https://.../invoke.js
```

## 广告位（位置不变）

| 尺寸 | 位置 |
|------|------|
| 320×50 | 全站底部固定条（可关闭） |
| 160×300 | 文章/列表页左右侧栏（宽屏） |
| 728×90 | 首页与文章页页脚横幅 |
| Native | 首页 Index 模块上方 |
