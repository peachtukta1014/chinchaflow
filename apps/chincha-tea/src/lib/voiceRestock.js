import { burmeseToThai } from './burmeseToThai';
import { voiceAliasNames, escapeRegExp } from './voiceAliases';
import { restockCanonicalThai } from './restockDisplay';
import { hasRestockSubmitCommand } from './voiceTabCommands';

const STATUS_PATTERNS = [
  { re: /หมด(?:แล้ว)?|out\s*of\s*stock|ကုန်ပြီ/i, status: 'out' },
  { re: /เหลือน้อย|ใกล้หมด|low|နည်းနည်း/i, status: 'low' },
  { re: /ปกติ|พอ|normal|ပုံမှန်/i, status: 'normal' },
];

function normalizeRestockSpeech(raw) {
  const th = restockCanonicalThai(burmeseToThai(raw || '') || raw || '');
  return th.toLowerCase().replace(/\s+/g, ' ');
}

function buildCatalogMatchers(catalog) {
  const matchers = [];
  for (const item of catalog || []) {
    if (item.active === false) continue;
    const names = voiceAliasNames(item, [item.name, item.nameEn, item.nameMy].filter(Boolean));
    for (const name of names) {
      if (name.length < 2) continue;
      matchers.push({
        item,
        name,
        re: new RegExp(escapeRegExp(name), 'i'),
        compact: name.replace(/\s+/g, '').toLowerCase(),
      });
    }
  }
  return matchers.sort((a, b) => b.name.length - a.name.length);
}

function parseStatus(chunk) {
  for (const p of STATUS_PATTERNS) {
    if (p.re.test(chunk)) return p.status;
  }
  return 'out';
}

function parseQty(chunk) {
  const m = chunk.match(/(\d+)\s*(?:ชิ้น|แพ็ค|ถุง|ใบ|pack|x|ခု)/i) || chunk.match(/x\s*(\d+)/i);
  if (m) return Math.max(1, parseInt(m[1], 10));
  if (/สอง|two|2\s|နှစ်/.test(chunk)) return 2;
  if (/สาม|three|3\s|သုံး/.test(chunk)) return 3;
  return 1;
}

function findCatalogItem(chunk, matchers) {
  let best = null;
  let bestLen = 0;
  const chunkCompact = chunk.replace(/\s+/g, '').toLowerCase();

  for (const m of matchers) {
    if (m.re.test(chunk) && m.name.length > bestLen) {
      best = m.item;
      bestLen = m.name.length;
    }
    if (m.compact.length >= 3 && chunkCompact.includes(m.compact) && m.compact.length > bestLen) {
      best = m.item;
      bestLen = m.compact.length;
    }
  }
  return best;
}

/**
 * @returns {{ items: { name: string, qty: number, status: string }[], submit: boolean }}
 */
export function parseRestockVoice(rawText, catalog) {
  const submit = hasRestockSubmitCommand(rawText);
  const normalized = normalizeRestockSpeech(rawText);
  if (!normalized.trim()) return { items: [], submit };

  const matchers = buildCatalogMatchers(catalog);
  const segments = normalized
    .split(/(?:แล้วก็|ต่อไป|และ|,\s*|၊\s*)/)
    .map((s) => s.trim())
    .filter(Boolean);
  const chunks = segments.length ? segments : [normalized];

  const items = [];
  const seenKeys = new Set();

  for (const chunk of chunks) {
    if (hasRestockSubmitCommand(chunk)) continue;
    const catItem = findCatalogItem(chunk, matchers);
    if (!catItem) continue;

    const key = catItem.id || catItem.name;
    const qty = parseQty(chunk);
    const status = parseStatus(chunk);

    if (seenKeys.has(key)) {
      const existing = items.find((i) => i.catalogKey === key);
      if (existing) {
        existing.qty += qty;
        existing.status = status;
      }
      continue;
    }
    seenKeys.add(key);
    items.push({
      catalogKey: key,
      name: catItem.name,
      qty,
      status,
    });
  }

  return { items, submit };
}
