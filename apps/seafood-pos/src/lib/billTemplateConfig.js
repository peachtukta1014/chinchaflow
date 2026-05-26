/** QR LINE OA บนฟอร์มบิลดิจิทัล */
export const BILL_QR_URL = `${import.meta.env.BASE_URL || '/'}bill-assets/line-oa-qr.png`;

/**
 * บัญชีรับโอนเมื่อบิล「ค้างชำระ」— แสดงบนภาพบิลเท่านั้น (ไม่แสดงเมื่อจ่ายแล้ว)
 * ตั้งใน GitHub Secrets หรือแก้ค่า default ด้านล่าง
 */
export const BILL_TRANSFER_INFO = {
  holder: import.meta.env.VITE_BILL_BANK_HOLDER || 'คุณแม่ (โกอ้วน)',
  bank: import.meta.env.VITE_BILL_BANK_NAME || 'ธ.กสิกรไทย',
  accountNo: import.meta.env.VITE_BILL_BANK_ACCOUNT_NO || '',
  promptPhone: import.meta.env.VITE_BILL_BANK_PROMPT_PHONE || '094-6693628',
};
