/** ค่าเริ่มต้น — ลูกค้าส่วนใหญ่โอนทีหลัง */
export const DEFAULT_PAYMENT_TYPE = 'credit';

/** วิธีชำระเงิน POS */
export const PAY = [
  { id: 'cash', label: 'สด', cls: 'bg-emerald-500' },
  { id: 'transfer', label: 'โอน', cls: 'bg-blue-500' },
  { id: 'credit', label: 'ค้าง', cls: 'bg-orange-500' },
  { id: 'installment', label: 'ผ่อน', cls: 'bg-purple-500' },
];
