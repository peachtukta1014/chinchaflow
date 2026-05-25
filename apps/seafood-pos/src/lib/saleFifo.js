import { debtCustomerKey } from './debtCustomerKey';

/** คีย์เรียงบิลเก่า → ใหม่ (FIFO รับชำระ) */
export function saleFifoSortKey(sale) {
  const dateKey = sale?.dateKey || '';
  const created = typeof sale?.createdAt === 'string' ? sale.createdAt : '';
  const billNo = sale?.billNo || sale?.id || '';
  return `${dateKey}|${created}|${billNo}`;
}

export function sortSalesFifoAsc(sales = []) {
  return [...sales].sort((a, b) => saleFifoSortKey(a).localeCompare(saleFifoSortKey(b)));
}

export function openSalesForCustomer(allSales, customerId, customerName) {
  const key = debtCustomerKey(customerId, customerName);
  if (!key) return [];
  return sortSalesFifoAsc(
    allSales.filter((s) => {
      if ((parseFloat(s.remainingAmount) || 0) <= 0) return false;
      return debtCustomerKey(s.customerId, s.customerName) === key;
    }),
  );
}

export function paymentTypeLabel(sale) {
  if (sale?.paymentType === 'installment') return 'ผ่อน';
  if (sale?.paymentType === 'credit') return 'ค้าง';
  return 'ค้าง';
}
