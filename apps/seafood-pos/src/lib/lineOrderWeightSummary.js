/** แมปชื่อสินค้าจาก LINE → id ใน POS (เฉพาะสรุปน้ำหนัก) */
function mapLineProductName(product) {
  const p = (product || '').replace(/\s+/g, '');
  if (/ตาย/.test(p)) return 'dead';
  if (/ใหญ่|เกรด\s*เอ|[^ก-๙]a$/i.test(p)) return 'large';
  if (/กลาง|เกรด\s*บี|[^ก-๙]b$/i.test(p)) return 'medium';
  if (/เล็ก|จิ๋ว|เกรด\s*ซี|[^ก-๙]c$/i.test(p)) return 'small';
  return null;
}

/** รวมน้ำหนัก (กก.) จากรายการออเดอร์ LINE แยกไซซ์ A/B/C และกุ้งตาย */
export function summarizeLineOrderItemWeights(items) {
  const totals = { large: 0, medium: 0, small: 0, dead: 0 };
  for (const item of items || []) {
    const productId = mapLineProductName(item.product);
    if (!productId) continue;
    const unit = (item.unit || 'กก').replace(/\./g, '');
    const qty = parseFloat(item.qty) || 0;
    if (qty <= 0) continue;
    if (productId === 'dead') {
      if (unit !== 'บาท') totals.dead += qty;
    } else {
      totals[productId] += qty;
    }
  }
  return totals;
}

/** รวมน้ำหนักจากหลายออเดอร์ — ค่าเริ่มต้นนับเฉพาะ pending (รอจัดส่ง) */
export function summarizeLineOrdersWeights(orders, { pendingOnly = true } = {}) {
  const totals = { large: 0, medium: 0, small: 0, dead: 0 };
  for (const order of orders || []) {
    if (pendingOnly && order.status !== 'pending') continue;
    const row = summarizeLineOrderItemWeights(order.items);
    totals.large += row.large;
    totals.medium += row.medium;
    totals.small += row.small;
    totals.dead += row.dead;
  }
  return totals;
}

/** ข้อความสรุปน้ำหนักสำหรับหัวข้อแท็บ LINE */
export function formatLineOrderWeightSummary(totals) {
  const fmt = (n) => (Number.isFinite(n) && n > 0 ? n.toFixed(1) : '0');
  return `A=${fmt(totals.large)} · B=${fmt(totals.medium)} · C=${fmt(totals.small)} · ตาย=${fmt(totals.dead)} กก.`;
}
