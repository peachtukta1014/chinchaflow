#!/usr/bin/env node
/**
 * ใช้ใน CI หรือมือ: สร้าง LIFF ถ้ายังไม่มี แล้วพิมพ์ LIFF ID
 *
 *   node apps/webhook-core/scripts/provision-shrimp-liff.mjs --ensure
 *   LINE_CHANNEL_ACCESS_TOKEN=xxx node ... --ensure --endpoint https://ko-seafood.top/liff-order.html
 */
import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const require = createRequire(import.meta.url);
const {
  ensureShrimpLiffApp,
  liffOpenUrl,
  DEFAULT_ENDPOINT,
  SLIP_DEFAULT_ENDPOINT,
  normalizeEndpoint,
} = require('../src/provisionShrimpLiff.js');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_LIFF_JSON = path.join(__dirname, '../shrimp-liff-id.json');
const REPO_LIFF_SLIP_JSON = path.join(__dirname, '../shrimp-liff-slip-id.json');

function readRepoLiffId() {
  try {
    if (!fs.existsSync(REPO_LIFF_JSON)) return '';
    const data = JSON.parse(fs.readFileSync(REPO_LIFF_JSON, 'utf8'));
    return String(data.liffId || '').trim();
  } catch {
    return '';
  }
}

const args = process.argv.slice(2);
const ensure = args.includes('--ensure');
const printUrl = args.includes('--print-url');

function argValue(flag) {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : null;
}

const endpoint = argValue('--endpoint')
  || process.env.SHRIMP_LIFF_ENDPOINT
  || (args.includes('--slip') ? SLIP_DEFAULT_ENDPOINT : DEFAULT_ENDPOINT);

function readRepoJson(filePath) {
  try {
    if (!fs.existsSync(filePath)) return '';
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    return String(data.liffId || '').trim();
  } catch {
    return '';
  }
}

async function main() {
  if (!ensure && !printUrl) {
    console.error('Usage: --ensure [--endpoint URL] [--slip] [--print-url]');
    process.exit(2);
  }

  const isSlip = args.includes('--slip') || normalizeEndpoint(endpoint) === normalizeEndpoint(SLIP_DEFAULT_ENDPOINT);
  const preset = String(
    isSlip
      ? (process.env.LINE_LIFF_SLIP_ID || process.env.VITE_LIFF_SLIP_ID || readRepoJson(REPO_LIFF_SLIP_JSON) || '')
      : (process.env.LINE_LIFF_ID || process.env.VITE_LIFF_ID || readRepoLiffId() || ''),
  ).trim();
  if (preset) {
    console.log(preset);
    if (printUrl) console.error(liffOpenUrl(preset));
    return;
  }

  const liffId = await ensureShrimpLiffApp({
    token: process.env.LINE_CHANNEL_ACCESS_TOKEN,
    endpoint,
    description: isSlip ? 'ฝากสลิป · โกอ้วน คลังซีฟู้ด' : 'สั่งกุ้ง · โกอ้วน คลังซีฟู้ด',
  });
  const outJson = isSlip ? REPO_LIFF_SLIP_JSON : REPO_LIFF_JSON;
  if (ensure && liffId) {
    fs.writeFileSync(outJson, `${JSON.stringify({ liffId, endpoint: normalizeEndpoint(endpoint) }, null, 2)}\n`);
  }
  console.log(liffId);
  if (printUrl) console.error(liffOpenUrl(liffId));
}

main().catch((e) => {
  const msg = e.message || String(e);
  console.error('provision-shrimp-liff:', msg);
  if (e.body) console.error(JSON.stringify(e.body));
  console.error(
    'Hint: LINE Developers → channel กุ้ง → LIFF → Add → Endpoint https://ko-seafood.top/liff-order.html',
  );
  console.error('Then copy liffId to apps/webhook-core/shrimp-liff-id.json or GitHub Secrets LINE_LIFF_ID + VITE_LIFF_ID');
  process.exit(1);
});
