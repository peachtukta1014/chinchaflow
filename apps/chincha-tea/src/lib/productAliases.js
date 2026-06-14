/** Product aliases are alternate names used for search and voice matching. */
export function parseProductAliases(raw) {
  const values = Array.isArray(raw)
    ? raw
    : String(raw || '').split(/[,，、|\n]/);
  const seen = new Set();
  const out = [];
  values.forEach((value) => {
    const alias = String(value || '').trim();
    const key = alias.toLocaleLowerCase();
    if (!alias || seen.has(key)) return;
    seen.add(key);
    out.push(alias);
  });
  return out;
}

export function productAliasText(item) {
  const aliases = parseProductAliases(item?.aliases);
  return (aliases.length ? aliases : parseProductAliases(item?.voiceAliases)).join(', ');
}

export function formProductAliases(form) {
  const aliases = parseProductAliases(form?.aliases);
  return aliases.length ? aliases : parseProductAliases(form?.voiceAliases);
}

export function productSearchTokens(item, t) {
  return [
    item?.nameTh,
    item?.nameEn,
    item?.nameMy,
    t?.(item?.key),
    item?.key,
    item?.id,
    ...parseProductAliases(item?.aliases),
    ...parseProductAliases(item?.voiceAliases),
  ].filter(Boolean);
}

export function canonicalProductName(item, t) {
  return item?.nameTh || t?.(item?.key) || item?.nameEn || item?.nameMy || item?.key || item?.id || '';
}
