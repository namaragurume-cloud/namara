// 1ファイル版デモを作る: node demo/build.mjs → demo/namara-review-demo.html
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { build } from "rolldown";

const root = fileURLToPath(new URL("..", import.meta.url));
const result = await build({
  input: `${root}demo/src/main.ts`,
  resolve: { alias: { "@": `${root}src` } },
  output: { format: "iife", minify: true },
  write: false,
});
const js = result.output[0].code.replace(/<\/script/gi, "<\\/script");
const css = await readFile(`${root}demo/src/style.css`, "utf8");
const html = `<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>NAMARA REVIEW デモ</title>
<style>${css}</style>
</head>
<body>
<div id="app"></div>
<div id="toast" class="toast" role="status" aria-live="polite"></div>
<script>${js}</script>
</body>
</html>
`;
await writeFile(`${root}demo/namara-review-demo.html`, html);
console.log(`demo/namara-review-demo.html (${(html.length / 1024).toFixed(0)} KB)`);
