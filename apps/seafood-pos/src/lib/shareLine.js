/**
 * แชร์บิลไป LINE — ใช้ Web Share API (เลือก LINE ได้) หรือเปิด line.me สำหรับข้อความ
 */
export async function shareToLine({ blob, text, title = 'บิลโกอ้วน' }) {
  if (blob) {
    const file = new File([blob], 'bill.jpg', { type: 'image/jpeg' });
    if (navigator.share && navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], title });
      return { ok: true, method: 'native-share' };
    }
  }

  const msg = text || (blob ? 'บิลจากโกอ้วน คลังซีฟู้ด' : '');
  if (msg) {
    const url = `https://line.me/R/msg/text/?${encodeURIComponent(msg)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
    return { ok: true, method: 'line-text' };
  }

  return { ok: false, message: 'เครื่องนี้แชร์รูปตรงๆ ไม่ได้ — บันทึกรูปแล้วส่งใน LINE เอง' };
}
