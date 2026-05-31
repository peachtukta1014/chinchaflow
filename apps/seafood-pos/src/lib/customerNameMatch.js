function compact(s) {
  return String(s || '').replace(/\s+/g, '').toLowerCase();
}

/** รวมสะกดที่พบบ่อย (LINE/เสียง) — จ๊ะเขียด vs จ๊ะขียด */
export function canonicalCustomerNameKey(s) {
  return compact(s)
    .replace(/เขียด/g, 'ขียด')
    .replace(/เขียน/g, 'ขียด')
    .replace(/^จะ/, 'จ๊ะ')
    .replace(/เจ๊/g, 'จ๊ะ');
}

/** จับคู่ชื่อแบบหลวม (แสดงรายการ / ค้นหา) */
export function compactNameMatch(a, b) {
  const ca = compact(a);
  const cb = compact(b);
  if (!ca || !cb) return false;
  return ca === cb || ca.includes(cb) || cb.includes(ca);
}

/** จับคู่ชื่อแบบเข้ม — ใช้กับ LINE UID (รวมสะกดผันที่รู้จัก) */
export function exactCustomerNameMatch(a, b) {
  return canonicalCustomerNameKey(a) === canonicalCustomerNameKey(b);
}

/** จับคู่ชื่อสำหรับผูก LINE UID — exact แบบ canonical หรือหลวมเมื่อชื่อยาวพอ */
export function uidCustomerNameMatch(a, b) {
  if (exactCustomerNameMatch(a, b)) return true;
  const ca = canonicalCustomerNameKey(a);
  const cb = canonicalCustomerNameKey(b);
  if (!ca || !cb || ca.length < 4 || cb.length < 4) return false;
  return ca.includes(cb) || cb.includes(ca);
}
