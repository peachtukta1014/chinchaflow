#!/usr/bin/env node
/**
 * แปลงภาพบิลที่แสกน (เปล่า) → template-empty.jpg สำหรับ generate บิล
 *
 * ใช้:
 *   node scripts/prepare-bill-template.mjs path/to/scan.jpg
 *   node scripts/prepare-bill-template.mjs path/to/scan.heic
 *
 * ผลลัพธ์: public/bill-assets/template-empty.jpg
 * ต้องมี Python3 + Pillow (pip install pillow pillow-heif ถ้าเป็น HEIC)
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

const MAX_WIDTH = 2200;
const JPEG_QUALITY = 76;

function usage() {
  console.log(`
แปลงภาพบิลเปล่าที่แสกน → template-empty.jpg

  node scripts/prepare-bill-template.mjs <ไฟล์รูป> [ชื่อไฟล์ปลายทาง]

ตัวอย่าง:
  node scripts/prepare-bill-template.mjs ~/Downloads/bill-empty.jpg
  node scripts/prepare-bill-template.mjs ../../bill-templates/bill1.jpg template-empty.jpg
  node scripts/prepare-bill-template.mjs ../../bill-templates/bill2.jpg template-credit.jpg
  node scripts/prepare-bill-template.mjs ../../bill-templates/bill3.jpg template-cash.jpg

หมายเหตุ:
  - ใช้บิลเปล่า (ไม่มีชื่อลูกค้า/รายการ/ยอดเงิน) ระบบจะวาดทับด้วย canvas
  - QR LINE ไม่ต้องใส่ในแสกน — แอปวาดจาก bill-assets/line-oa-qr.png
  - ถ้าตัวหนังสือเยื้องหลัง deploy ปรับ LAYOUT ใน generateBillImage.js (หรือสั่ง @cursor ใน #chincha-shrimp-agent)
`);
}

const input = process.argv[2];
const outName = process.argv[3] || 'template-empty.jpg';
if (!input) {
  usage();
  process.exit(1);
}

const absIn = path.resolve(input);
const outPath = path.join(root, 'public/bill-assets', outName);
if (!fs.existsSync(absIn)) {
  console.error(`ไม่พบไฟล์: ${input}`);
  process.exit(1);
}

fs.mkdirSync(path.dirname(outPath), { recursive: true });

const py = `
import sys
from PIL import Image
try:
    import pillow_heif
    pillow_heif.register_heif_opener()
except Exception:
    pass
src = sys.argv[1]
out = sys.argv[2]
max_w = int(sys.argv[3])
q = int(sys.argv[4])
im = Image.open(src).convert("RGB")
w, h = im.size
if w > max_w:
    nh = int(h * max_w / w)
    im = im.resize((max_w, nh), Image.LANCZOS)
im.save(out, "JPEG", quality=q, optimize=True)
print(f"OK {im.size[0]}x{im.size[1]} -> {out}")
`;

const r = spawnSync('python3', ['-c', py, absIn, outPath, String(MAX_WIDTH), String(JPEG_QUALITY)], {
  encoding: 'utf8',
});
if (r.status !== 0) {
  console.error(r.stderr || r.stdout || 'Python/Pillow failed');
  console.error('ติดตั้ง: pip install pillow pillow-heif');
  process.exit(1);
}
console.log(r.stdout.trim());
const stat = fs.statSync(outPath);
console.log(`ขนาดไฟล์: ${(stat.size / 1024).toFixed(0)} KB → ${outPath}`);
