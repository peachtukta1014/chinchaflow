import { fsGetDoc } from './firestoreRest.js';
import { normalizeLineDeliveryWindow, setLineDeliveryWindow } from './lineDeliveryWindow.js';

/** โหลดช่วงเวลา「ไม่ระบุวันส่ง」จาก config/shrimpLine (fallback 18:00–15:00) */
export async function syncLineDeliveryWindowFromFirestore() {
  try {
    const doc = await fsGetDoc('config/shrimpLine');
    setLineDeliveryWindow(doc || {});
  } catch (e) {
    console.warn('syncLineDeliveryWindowFromFirestore', e);
    setLineDeliveryWindow({});
  }
}

export { normalizeLineDeliveryWindow };
