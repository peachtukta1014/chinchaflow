/** QR LINE OA บนฟอร์มบิลดิจิทัล */
export const BILL_QR_URL = `${import.meta.env.BASE_URL || '/'}bill-assets/line-oa-qr.png`;

/**
 * บัญชีรับโอนเมื่อบิล「ค้างชำระ」— แสดงบนภาพบิลเท่านั้น
 * @type {{ label: string; holder: string; bank: string; accountNo: string }[]}
 */
export const BILL_TRANSFER_ACCOUNTS = [
  {
    label: 'คุณวิไลรัตน์ (แม่)',
    holder: 'วิไลรัตน์',
    bank: 'ธ.กสิกรไทย',
    accountNo: '538-203-8136',
  },
  {
    label: 'พีช',
    holder: 'อภินันท์',
    bank: 'ธ.กสิกรไทย',
    accountNo: '033-3318-237',
  },
];
