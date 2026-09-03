// Consistency check: URLs like `src=<name>.js?v=YYYYMMDD-N` must stamp the
// same version across HTML and module imports to keep cache clean.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

const root = fileURLToPath(new URL("..", import.meta.url));
const VERSION_TAG = /\?v=([0-9]{8}-[0-9]+)/g;

function listFilesWithVersionTags(content) {
  const tags = [];
  for (const m of content.matchAll(VERSION_TAG)) {
    tags.push(m[1]);
  }
  return tags;
}

const html = readFileSync(join(root, "index.html"), "utf8");
const src = [
  "src/main.js",
  "src/game.js",
  "src/entities3d/dog3d.js",
  "src/entities3d/dyno3d.js",
  "src/renderer2d.js",
  "src/renderer.js",
  "src/entities3d/character-sprite3d.js",
];

const allTags = [...listFilesWithVersionTags(html)];
for (const file of src) {
  const content = readFileSync(join(root, file), "utf8");
  for (const tag of listFilesWithVersionTags(content)) {
    allTags.push(tag);
  }
}

const unique = new Set(allTags);
if (unique.size !== 1) {
  console.error("[cache-version-check] Expected one shared tag across modules. Found:", [...unique].sort());
  process.exit(1);
}
console.debug(`[cache-version-check] unified tag: ${unique.values().next().value}`);

const indexEntry = html.match(/src="\.\/src\/main\.js\?v=([0-9]{8}-[0-9]+)"/);
if (!indexEntry) {
  console.error("[cache-version-check] Missing main module version tag.");
  process.exit(1);
}
if (html.includes("styles.css?v=") === false) {
  console.error("[cache-version-check] Missing stylesheet version tag.");
  process.exit(1);
}
console.debug(`[cache-version-check] main bundle tag ${indexEntry[1]}`);
console.debug("[cache-version-check] OK");
