/** นับออเดอร์รอส่งสำหรับ badge / แจ้งเตือน (รวมส่งพรุ่งนี้และข้างหน้าบนบอร์ด) */
export function countPendingLineOrdersForBadge(rows) {
  return rows.filter((o) => o.status === 'pending' || o.status === 'delivering').length;
}
