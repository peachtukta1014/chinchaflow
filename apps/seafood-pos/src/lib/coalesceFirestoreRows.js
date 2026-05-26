/**
 * กัน onSnapshot ส่ง [] ทับข้อมูลที่โหลดจาก REST แล้ว (พบบ่อยบนมือถือ)
 */
export function coalesceFirestoreRows(nextRows = [], previousRows = []) {
  const next = nextRows || [];
  if (next.length > 0) return next;
  return previousRows.length > 0 ? previousRows : [];
}
