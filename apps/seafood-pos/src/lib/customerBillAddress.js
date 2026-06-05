/** ที่อยู่บนฟอร์มบิล = บ้านเลขที่ตามทะเบียน (ไม่ใช่โซน) */
export function customerBillAddress(customer = {}, bill = {}) {
  return String(
    customer.address
    || bill.address
    || bill.deliveryAddress
    || '',
  ).trim();
}
