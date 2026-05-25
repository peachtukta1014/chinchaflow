/** พื้นหลังบิลเปล่าเท่านั้น — ไม่ใช้ภาพตัวอย่างที่มีชื่อลูกค้า/รายการค้าง */
export function getBillTemplateUrl() {
  const base = import.meta.env.BASE_URL || '/';
  return `${base}bill-assets/template-empty.jpg`;
}

export const BILL_QR_URL = `${import.meta.env.BASE_URL || '/'}bill-assets/line-oa-qr.png`;

/** ไม่หักส่วนลดสมาชิกในภาพบิล */
export const MEMBER_DISCOUNT_RATE = 0;
