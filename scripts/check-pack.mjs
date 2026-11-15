// CI check: the published tarball must contain every file the package
// exposes (main, types, each exports target) plus README/LICENSE.
//
//   node scripts/check-pack.mjs
//
// Exits non-zero listing anything that would silently ship broken.

import { readFileSync } from "node:fs";
import { execSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pkg = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8"));

const tarballs = JSON.parse(
  execSync("npm pack --dry-run --json", { cwd: root, encoding: "utf8" }),
);
const packed = new Set(tarballs[0].files.map((f) => f.path));

const required = [
  pkg.main,
  pkg.types,
  ...Object.values(pkg.exports ?? {}).flat(),
  "README.md",
  "LICENSE",
]
  .filter(Boolean)
  .map((f) => f.replace(/^\.\//, ""));

const missing = [...new Set(required)].filter((f) => !packed.has(f));
if (missing.length > 0) {
  console.error(`tarball is missing ${missing.length} required file(s):`);
  for (const f of missing) console.error(`  ${f}`);
  console.error('fix: add them to "files" in package.json');
  process.exit(1);
}
console.log(`pack ok: ${packed.size} files packed, all ${new Set(required).size} required entries present`);
