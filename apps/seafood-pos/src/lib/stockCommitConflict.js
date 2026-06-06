/** ตรวจ conflict จาก optimistic lock — แยกไฟล์เพื่อ smoke test ไม่ต้อง import firebase */
export function isFirestoreConflictError(err) {
  const msg = String(err?.message || err || '');
  return /FAILED_PRECONDITION|fsAtomicStockBatchCommit conflict/i.test(msg);
}
