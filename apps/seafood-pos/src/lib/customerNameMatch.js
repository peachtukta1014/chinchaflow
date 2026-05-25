function compact(s) {
  return String(s || '').replace(/\s+/g, '').toLowerCase();
}

export function compactNameMatch(a, b) {
  const ca = compact(a);
  const cb = compact(b);
  if (!ca || !cb) return false;
  return ca === cb || ca.includes(cb) || cb.includes(ca);
}
