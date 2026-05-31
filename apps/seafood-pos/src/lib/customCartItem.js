/** รายการในบิลที่ไม่ใช่กุ้งแม่น้ำ — ไม่ตัดสต๊อก */
export const CUSTOM_PRODUCT_ID = 'custom';
export const MAX_CUSTOM_LINES = 3;

export function emptyCustomLineRow() {
  return { label: '', price: '' };
}

export function buildCustomCartItem({ label, total, note = '' }) {
  const name = String(label || '').trim();
  const amount = Math.max(0, parseFloat(total) || 0);
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    productId: CUSTOM_PRODUCT_ID,
    productName: name,
    type: 'other',
    weight: 0,
    pricePerKg: 0,
    total: amount,
    note: String(note || '').trim(),
  };
}

/** แปลงแถบกรอก (สูงสุด 3) → รายการตะกร้า */
export function customRowsToCartItems(rows) {
  return (rows || [])
    .map((r) => {
      const label = String(r.label || '').trim();
      const price = parseFloat(r.price);
      if (!label || !Number.isFinite(price) || price <= 0) return null;
      return buildCustomCartItem({ label, total: price, note: r.note });
    })
    .filter(Boolean);
}
