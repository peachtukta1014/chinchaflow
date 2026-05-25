#!/usr/bin/env node
/**
 * สร้างเทมเพลตบิลทั้ง 3 จากไฟล์ตัวอย่างใน bill-templates/
 * bill1.jpg → template-empty.jpg
 * bill2.jpg → template-credit.jpg
 * bill3.jpg → template-cash.jpg
 */
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const prepare = path.join(__dirname, 'prepare-bill-template.mjs');
const samples = path.join(__dirname, '../../../bill-templates');

const pairs = [
  ['bill1.jpg', 'template-empty.jpg'],
  ['bill2.jpg', 'template-credit.jpg'],
  ['bill3.jpg', 'template-cash.jpg'],
];

let failed = 0;
for (const [src, dest] of pairs) {
  const input = path.join(samples, src);
  console.log(`\n→ ${src} → public/bill-assets/${dest}`);
  const r = spawnSync('node', [prepare, input, dest], { stdio: 'inherit', encoding: 'utf8' });
  if (r.status !== 0) failed += 1;
}

process.exit(failed ? 1 : 0);
