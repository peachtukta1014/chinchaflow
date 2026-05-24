import { fsIncrementDebt } from '../lib/firestoreRest';

/** เพิ่ม/ลดยอดลูกหนี้ (REST wrapper) */
export async function incrementCustomerDebt(customerId, meta, delta) {
  return fsIncrementDebt(customerId, meta, delta);
}
