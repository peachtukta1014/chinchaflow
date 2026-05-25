/** คีย์เอกสาร customerDebts — รองรับลูกค้าที่ยังเป็น general แต่มีชื่อจริง */
export function debtCustomerKey(customerId, customerName) {
  if (customerId && customerId !== 'general') return customerId;
  const name = (customerName || '').trim();
  if (!name) return null;
  const slug = name.replace(/\s+/g, '').toLowerCase();
  return `cust_${slug}`;
}
