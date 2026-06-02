/** ตรวจว่าเบราว์เซอร์รองรับสั่งด้วยเสียง (Web Speech API) หรือไม่ */

export function isIOS() {
  if (typeof navigator === 'undefined') return false;
  return /iPad|iPhone|iPod/i.test(navigator.userAgent)
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

/** Safari หรือ Chrome บน iPhone — ทั้งคู่ใช้ WebKit + webkitSpeechRecognition */
export function isChromeOnIOS() {
  if (!isIOS()) return false;
  return /CriOS/i.test(navigator.userAgent);
}

export function isSafariOnIOS() {
  if (!isIOS()) return false;
  return /Safari/i.test(navigator.userAgent) && !/CriOS|FxiOS|EdgiOS/i.test(navigator.userAgent);
}

/** เปิดเป็น PWA / Add to Home Screen */
export function isStandalonePWA() {
  if (typeof window === 'undefined') return false;
  return window.matchMedia?.('(display-mode: standalone)')?.matches === true
    || window.navigator.standalone === true;
}

export function hasSpeechRecognition() {
  if (typeof window === 'undefined') return false;
  return !!(window.SpeechRecognition || window.webkitSpeechRecognition);
}

/**
 * เปิดใช้เมื่อมี API — รวม iPhone/iPad ที่เปิดผ่าน Safari หรือ Chrome
 */
export function canUseVoiceOrder() {
  return hasSpeechRecognition();
}

/** iOS ทุกเบราว์เซอร์ใช้ WebKit — ต้องตั้งค่า recognition แบบ push-to-talk */
export function needsIOSVoiceMode() {
  return isIOS() && hasSpeechRecognition();
}

let micWarmed = false;

/** ลดอาการรอบแรกไม่จับเสียงบน iOS */
export async function warmUpMicrophone() {
  if (micWarmed || typeof navigator === 'undefined') return;
  if (!navigator.mediaDevices?.getUserMedia) return;
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach((t) => t.stop());
    micWarmed = true;
  } catch {
    /* ปฏิเสธไมค์ — SpeechRecognition จะถามอีกที */
  }
}
