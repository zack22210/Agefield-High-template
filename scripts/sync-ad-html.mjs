#!/usr/bin/env node
/**
 * Reads NEXT_PUBLIC_AD_* from .env.local (or process.env) and generates public/ads/banner-*.html.
 * Run: pnpm ads:sync
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const outDir = join(root, "public", "ads");

const SIZES = {
  "320x50": { width: 320, height: 50, env: "NEXT_PUBLIC_AD_MOBILE_320X50" },
  "300x250": { width: 300, height: 250, env: "NEXT_PUBLIC_AD_BANNER_300X250" },
  "728x90": { width: 728, height: 90, env: "NEXT_PUBLIC_AD_BANNER_728X90" },
  "468x60": { width: 468, height: 60, env: "NEXT_PUBLIC_AD_BANNER_468X60" },
  "160x600": { width: 160, height: 600, env: "NEXT_PUBLIC_AD_SIDEBAR_160X600" },
  "160x300": { width: 160, height: 300, env: "NEXT_PUBLIC_AD_SIDEBAR_160X300" },
};

function loadEnvFile(filePath) {
  try {
    const content = readFileSync(filePath, "utf8");
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      const value = trimmed.slice(eq + 1).trim();
      if (value && !process.env[key]) process.env[key] = value;
    }
  } catch {
    // optional file
  }
}

loadEnvFile(join(root, ".env.local"));
loadEnvFile(join(root, ".env"));

function buildHtml(key, width, height) {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>html, body { margin: 0; padding: 0; overflow: hidden; }</style>
  </head>
  <body>
    <script type="text/javascript">
      atOptions = {
        key: "${key}",
        format: "iframe",
        height: ${height},
        width: ${width},
        params: {},
      };
    </script>
    <script type="text/javascript" src="https://www.highperformanceformat.com/${key}/invoke.js"></script>
  </body>
</html>
`;
}

let wrote = 0;

for (const [format, { width, height, env }] of Object.entries(SIZES)) {
  const key = process.env[env]?.trim();
  if (!key) {
    console.warn(`skip banner-${format}.html (${env} not set in .env.local)`);
    continue;
  }
  writeFileSync(join(outDir, `banner-${format}.html`), buildHtml(key, width, height));
  console.log(`wrote banner-${format}.html`);
  wrote++;
}

if (wrote === 0) {
  console.warn("No banner HTML generated. Copy .env.example → .env.local and add your Adsterra keys.");
}
