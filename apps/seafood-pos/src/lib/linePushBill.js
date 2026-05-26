import { auth } from '../firebase';

const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID;
const region = import.meta.env.VITE_FUNCTIONS_REGION || 'asia-southeast1';

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

const ERROR_HINTS = {
  invalid_line_user_id: 'ยังไม่มี LINE User ID — ไปแท็บลูกค้า กดดึงจากออเดอร์ หรือวาง U...',
  line_push_failed: 'ส่งไม่สำเร็จ — ลูกค้าต้องแอด LINE OA เป็นเพื่อนก่อน',
  forbidden: 'บัญชีนี้ยังไม่ได้รับอนุมัติส่งบิล',
  line_token_missing: 'เซิร์ฟเวอร์ยังไม่ได้ตั้งค่า LINE Bot',
};

export async function pushBillToLineCustomer({
  lineUserId,
  blob,
  billNo,
  customerName,
  paymentType,
  remainingAmount,
  total,
}) {
  if (!projectId) throw new Error('VITE_FIREBASE_PROJECT_ID ไม่ได้ตั้งค่า');
  const user = auth?.currentUser;
  if (!user) throw new Error('กรุณาเข้าสู่ระบบ');

  const imageBase64 = await blobToBase64(blob);
  const idToken = await user.getIdToken();
  const url = `https://${region}-${projectId}.cloudfunctions.net/shrimpPushBill`;
  const r = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${idToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      lineUserId,
      imageBase64,
      billNo,
      customerName,
      paymentType,
      remainingAmount,
      total,
    }),
  });

  const json = await r.json().catch(() => ({}));
  if (!r.ok) {
    const hint = ERROR_HINTS[json.error] || json.hint || json.error || `HTTP ${r.status}`;
    throw new Error(hint);
  }
  return json;
}
