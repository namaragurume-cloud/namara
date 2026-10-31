// 単体で開けるデモHTML（namara-demo.html）を作る：npm run demo:build
import { readFileSync, writeFileSync, rmSync } from "node:fs";
import { execSync } from "node:child_process";

const dir = new URL("./", import.meta.url);
execSync("npx rolldown -c demo/rolldown.config.mjs", { stdio: "inherit", cwd: new URL("../", import.meta.url) });
const logic = readFileSync(new URL(".logic.js", dir), "utf8");
const ui = readFileSync(new URL("ui.js", dir), "utf8");
const html = readFileSync(new URL("template.html", dir), "utf8").replace("/*LOGIC*/", () => logic).replace("/*UI*/", () => ui);
writeFileSync(new URL("namara-demo.html", dir), html);
rmSync(new URL(".logic.js", dir));
console.log("demo/namara-demo.html を作成しました");
