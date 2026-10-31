import { fileURLToPath } from "node:url";

// デモ用HTMLに埋め込むため、検索・推薦・広告・集計の本物のロジックを1ファイルにまとめる
const config = {
  input: fileURLToPath(new URL("./entry.ts", import.meta.url)),
  resolve: { alias: { "@": fileURLToPath(new URL("../src", import.meta.url)) } },
  output: { file: fileURLToPath(new URL("./.logic.js", import.meta.url)), format: "iife", minify: true },
};

export default config;
