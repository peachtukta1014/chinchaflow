const NAME_SPLIT_RE = /[,，、]/;

function compact(s) {
  return String(s || '').replace(/\s+/g, '').toLowerCase();
}

function canonicalCustomerNameKey(s) {
  return compact(s)
    .replace(/เขียด/g, 'ขียด')
    .replace(/เขียน/g, 'ขียด')
    .replace(/^จะ/, 'จ๊ะ')
    .replace(/เจ๊/g, 'จ๊ะ');
}

function exactCustomerNameMatch(a, b) {
  return canonicalCustomerNameKey(a) === canonicalCustomerNameKey(b);
}

function splitLegacyCommaName(raw) {
  const parts = String(raw || '')
    .split(NAME_SPLIT_RE)
    .map((s) => s.trim())
    .filter(Boolean);
  if (parts.length <= 1) return { name: parts[0] || '', legacyAliases: [] };
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

function collectCustomerSearchNames(data) {
  const legacy = splitLegacyCommaName(data?.name || '');
  const primary = legacy.name || String(data?.name || '').trim();
  const extras = [
    ...legacy.legacyAliases,
    ...(Array.isArray(data?.aliases) ? data.aliases : []),
    data?.nickname,
    data?.shortName,
  ];
  return dedupeAliasLabels(primary, extras);
}

function customerMatchesName(data, want) {
  const target = String(want || '').trim();
  if (!target) return false;
  return collectCustomerSearchNames(data).some((label) => exactCustomerNameMatch(label, target));
}

module.exports = {
  collectCustomerSearchNames,
  customerMatchesName,
  exactCustomerNameMatch,
  canonicalCustomerNameKey,
};
