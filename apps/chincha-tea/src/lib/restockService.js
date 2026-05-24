import { fsDelete, fsPatch } from './firestoreRest';

/** พนักงานลบรายการที่ตัวเองส่งได้ · แอดมินลบได้ทุกรายการ */
export function canManageRestock(req, member) {
  if (!member?.uid) return false;
  if (member.role === 'admin') return true;
  return Boolean(req?.uid && req.uid === member.uid);
}

export async function deleteRestockRequest(id) {
  await fsDelete(`restocks/${id}`);
}

/** ลบบรรทัดเดียวในรายการสั่งของ — ถ้าไม่เหลือรายการจะลบเอกสารทั้งใบ */
export async function removeRestockLine(req, lineIndex) {
  const items = [...(req.items || [])];
  items.splice(lineIndex, 1);
  if (items.length === 0) {
    await fsDelete(`restocks/${req.id}`);
    return null;
  }
  await fsPatch(`restocks/${req.id}`, { items });
  return { ...req, items };
}
