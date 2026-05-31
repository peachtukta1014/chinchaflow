import { isValidLineUserId, normalizeLineUserId } from './lineUserId.js';

/** เลือก UID สำหรับ push บิล — โปรไฟล์ลูกค้าชนะ UID ในบิลเก่า */
export function pickLineUidForBillPush({
  profileUid = '',
  nameMatchUid = '',
  billUid = '',
  orderUid = '',
  historyUid = '',
}) {
  const profile = normalizeLineUserId(profileUid);
  if (isValidLineUserId(profile)) {
    return { uid: profile, profileUid: profile, billUid: normalizeLineUserId(billUid), source: 'profile' };
  }
  const byName = normalizeLineUserId(nameMatchUid);
  if (isValidLineUserId(byName)) {
    return { uid: byName, profileUid: byName, billUid: normalizeLineUserId(billUid), source: 'profile-name' };
  }
  const bill = normalizeLineUserId(billUid);
  if (isValidLineUserId(bill)) {
    return { uid: bill, profileUid: '', billUid: bill, source: 'bill' };
  }
  const order = normalizeLineUserId(orderUid);
  if (isValidLineUserId(order)) {
    return { uid: order, profileUid: '', billUid: order, source: 'line-order' };
  }
  const hist = normalizeLineUserId(historyUid);
  if (isValidLineUserId(hist)) {
    return { uid: hist, profileUid: '', billUid: bill, source: 'line-order-history' };
  }
  return { uid: '', profileUid: '', billUid: bill, source: 'none' };
}
