import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dist = path.join(root, "dist");
const indexPath = path.join(dist, "index.html");
if (!existsSync(indexPath)) {
  console.error("pages-routes: dist/index.html missing");
  process.exit(1);
}
const appShell = readFileSync(indexPath);
for (const route of ["articles", "topics", "settings", "covers"]) {
  mkdirSync(path.join(dist, route), { recursive: true });
  writeFileSync(path.join(dist, route, "index.html"), appShell);
}
writeFileSync(path.join(dist, "404.html"), appShell);
console.log("pages-routes: wrote SPA fallbacks");
