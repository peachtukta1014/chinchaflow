#!/usr/bin/env node
// อัปเดตส่วน <!-- TREE_START / TREE_END --> ใน docs/PROJECT_STRUCTURE.md
// รันโดย .github/workflows/sync-project-tree.yml ทุก push main
import { execSync } from 'child_process';
import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DOC = join(ROOT, 'docs/PROJECT_STRUCTURE.md');
const IGNORE = 'node_modules|.git|dist|package-lock.json|.firebase';

let raw = execSync(
  `tree --dirsfirst -a --noreport -I '${IGNORE}' -L 3`,
  { cwd: ROOT }
).toString().trimEnd();

// แทนบรรทัดแรก '.' ด้วยชื่อ repo
raw = 'chinchaflow/' + raw.slice(1);

const doc = readFileSync(DOC, 'utf8');
const next = doc.replace(
  /<!-- TREE_START -->[\s\S]*?<!-- TREE_END -->/,
  `<!-- TREE_START -->\n\`\`\`\n${raw}\n\`\`\`\n<!-- TREE_END -->`
);

if (next === doc) {
  console.log('ℹ️  tree unchanged');
} else {
  writeFileSync(DOC, next);
  console.log('✅ PROJECT_STRUCTURE.md tree updated');
}
