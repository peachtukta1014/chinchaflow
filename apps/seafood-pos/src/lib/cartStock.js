/** น้ำหนักกุ้งแม่น้ำในตะกร้า (ไม่รวมรายการอื่น) */
export function sumCartStockKg(cartItems) {
  const liveKg = cartItems.reduce(
    (s, i) => (i.type !== 'dead' && i.type !== 'other' ? s + (parseFloat(i.weight) || 0) : s),
    0,
  );
  const deadKg = cartItems.reduce(
    (s, i) => (i.type === 'dead' ? s + (parseFloat(i.weight) || 0) : s),
    0,
  );
  return { liveKg, deadKg };
}
