/** รายการในบิลที่ไม่ใช่กุ้งแม่น้ำ — ไม่ตัดสต๊อก */
export const CUSTOM_PRODUCT_ID = 'custom';
export const MAX_CUSTOM_LINES = 3;

export function emptyCustomLineRow() {
  return { label: '', weight: '', pricePerKg: '' };
}

export function buildCustomCartItem({ label, weightKg, pricePerKg, note = '' }) {
  const name = String(label || '').trim();
  const weight = Math.max(0, parseFloat(weightKg) || 0);
  const ppk = Math.max(0, parseFloat(pricePerKg) || 0);
  const total = Math.round(weight * ppk * 100) / 100;
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    productId: CUSTOM_PRODUCT_ID,
    productName: name,
    type: 'other',
    weight,
    pricePerKg: ppk,
    total,
    note: String(note || '').trim(),
  };
}

/** แปลงแถบกรอก (สูงสุด 3) → รายการตะกร้า */
export function customRowsToCartItems(rows) {
  return (rows || [])
    .map((r) => {
      const label = String(r.label || '').trim();
      const weight = parseFloat(r.weight);
      const pricePerKg = parseFloat(r.pricePerKg);
      if (!label || !Number.isFinite(weight) || weight <= 0) return null;
      if (!Number.isFinite(pricePerKg) || pricePerKg <= 0) return null;
      return buildCustomCartItem({ label, weightKg: weight, pricePerKg, note: r.note });
    })
    .filter(Boolean);
}

export function previewCustomLineTotal(row) {
  const w = parseFloat(row.weight);
  const p = parseFloat(row.pricePerKg);
  if (!Number.isFinite(w) || !Number.isFinite(p) || w <= 0 || p <= 0) return 0;
  return Math.round(w * p * 100) / 100;
}
