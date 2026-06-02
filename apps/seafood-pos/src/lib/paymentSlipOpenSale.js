/** บิลยังมียอดค้าง — ใช้จับคู่สลิปกับบิล */
export function saleRemainingAmount(sale) {
  const remain = parseFloat(sale?.remainingAmount);
  if (Number.isFinite(remain) && remain > 0) return remain;
  if (sale?.paymentType === 'credit') return parseFloat(sale?.total) || 0;
  return 0;
}

export function isOpenSaleForSlip(sale) {
  return saleRemainingAmount(sale) > 0;
}
