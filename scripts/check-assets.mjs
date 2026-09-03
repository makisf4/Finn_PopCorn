// Verifies all runtime assets referenced by HTML/JS exist in the worktree.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
let failures = 0;

const FILES = [
  "index.html",
  "src/entities3d/dog3d.js",
  "src/entities3d/dyno3d.js",
  "src/renderer2d.js",
];

function references(content) {
  const matches = new Set();
  const re = /assets\/sprites\/[A-Za-z0-9_\-.]+\.(webp|png|jpg|jpeg|svg)/g;
  for (const m of content.matchAll(re)) {
    matches.add(m[0]);
  }
  return matches;
}

for (const rel of FILES) {
  const content = readFileSync(join(ROOT, rel), "utf8");
  const seen = references(content);
  for (const path of seen) {
    const absolute = join(ROOT, path);
    if (!existsSync(absolute)) {
      console.error(`[asset-check] missing ${path} referenced from ${rel}`);
      failures += 1;
    }
  }
}

if (failures > 0) {
  process.exit(1);
}
console.log("[asset-check] OK (all asset refs resolve)");
