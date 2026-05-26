function compact(s) {
  return String(s || '').replace(/\s+/g, '').toLowerCase();
}

/** จับคู่ชื่อแบบหลวม (แสดงรายการ / ค้นหา) */
export function compactNameMatch(a, b) {
  const ca = compact(a);
  const cb = compact(b);
  if (!ca || !cb) return false;
  return ca === cb || ca.includes(cb) || cb.includes(ca);
}

/** จับคู่ชื่อแบบเข้ม — ใช้กับ LINE UID เท่านั้น (กันผูกผิดคน เช่น สุปาสัก vs สุปาสักทะเลสด) */
export function exactCustomerNameMatch(a, b) {
  return compact(a) === compact(b);
}
