import { canonicalCustomerNameKey, exactCustomerNameMatch, uidCustomerNameMatch } from './customerNameMatch.js';

const ALIAS_SPLIT_RE = /[,，、]/;

/** แยกชื่อเรียกอื่นจากช่อง aliases (คั่นด้วย comma เท่านั้น) */
export function parseAliasesInput(raw) {
  return String(raw || '')
    .split(ALIAS_SPLIT_RE)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** ข้อมูลเก่าที่เคยใส่ comma ในช่องชื่อเดียว — แยกตอนโหลดฟอร์ม */
export function splitLegacyCommaName(raw) {
  const parts = String(raw || '')
    .split(ALIAS_SPLIT_RE)
    .map((s) => s.trim())
    .filter(Boolean);
  if (parts.length <= 1) {
    return { name: parts[0] || '', legacyAliases: [] };
  }
  const [name, ...legacyAliases] = parts;
  return { name, legacyAliases };
}

function dedupeAliasLabels(primary, extras) {
  const seen = new Set();
  const out = [];
  const primaryTrim = String(primary || '').trim();
  if (primaryTrim) {
    const pk = canonicalCustomerNameKey(primaryTrim);
    if (pk) seen.add(pk);
    out.push(primaryTrim);
  }
  for (const label of extras) {
    const s = String(label || '').trim();
    if (!s) continue;
    const key = canonicalCustomerNameKey(s);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(s);
  }
  return out;
}

function normalizeAliasList(name, aliasesInput) {
  const list = Array.isArray(aliasesInput)
    ? aliasesInput
    : parseAliasesInput(aliasesInput);
  const primary = String(name || '').trim();
  const merged = dedupeAliasLabels(primary, list);
  return merged.length > 1 ? merged.slice(1) : [];
}

/** ทุกชื่อที่ใช้จับคู่ออเดอร์ LINE / เสียง / บอท (ไม่รวมในบิล) */
export function collectCustomerSearchNames(customer) {
  const legacy = splitLegacyCommaName(customer?.name || '');
  const primary = legacy.name || String(customer?.name || '').trim();
  const extras = [
    ...legacy.legacyAliases,
    ...(Array.isArray(customer?.aliases) ? customer.aliases : []),
    customer?.nickname,
    customer?.shortName,
  ];
  return dedupeAliasLabels(primary, extras);
}

/** ชื่อเรียกอื่น → ข้อความในช่องฟอร์ม */
export function formatAliasesForEdit(customer) {
  const labels = collectCustomerSearchNames(customer);
  if (labels.length <= 1) return '';
  return labels.slice(1).join(', ');
}

/** โหลดลูกค้า → ค่าในฟอร์ม 2 ช่อง */
export function customerToFormFields(customer) {
  const legacy = splitLegacyCommaName(customer?.name || '');
  const billName = legacy.name || String(customer?.name || '').trim();
  const stored = Array.isArray(customer?.aliases) ? customer.aliases : [];
  const aliasOnly = normalizeAliasList(billName, [...legacy.legacyAliases, ...stored]);
  return {
    name: billName,
    aliasesText: aliasOnly.join(', '),
    zone: customer?.zone || '',
    phone: customer?.phone || '',
    lineUserId: customer?.lineUserId || '',
  };
}

/** ฟอร์ม → เก็บ Firestore */
export function customerFieldsFromForm({ name, aliasesText, aliases }) {
  const billName = String(name || '').trim();
  const aliasOnly = normalizeAliasList(billName, aliases ?? aliasesText);
  return {
    name: billName,
    aliases: aliasOnly,
  };
}

export function customerMatchesLabel(customer, want) {
  const target = String(want || '').trim();
  if (!target) return false;
  return collectCustomerSearchNames(customer).some(
    (label) => exactCustomerNameMatch(label, target) || uidCustomerNameMatch(label, target),
  );
}

/** รายการชื่อสำหรับจับออเดอร์ LINE จากฟอร์ม */
export function labelsFromCustomerForm({ name, aliasesText, aliases }) {
  const { name: billName, aliases: list } = customerFieldsFromForm({ name, aliasesText, aliases });
  return dedupeAliasLabels(billName, list);
}
