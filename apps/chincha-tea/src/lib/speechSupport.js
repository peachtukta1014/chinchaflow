/** ตรวจว่าเบราว์เซอร์รองรับสั่งด้วยเสียง (Web Speech API) หรือไม่ */

export function isIOS() {
  if (typeof navigator === 'undefined') return false;
  return /iPad|iPhone|iPod/i.test(navigator.userAgent)
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

export function hasSpeechRecognition() {
  if (typeof window === 'undefined') return false;
  return !!(window.SpeechRecognition || window.webkitSpeechRecognition);
}

/** iPhone/iPad ยังใช้สั่งด้วยเสียงในเว็บแอปไม่ได้จริง — ใช้กดเมนูแทน */
export function canUseVoiceOrder() {
  if (isIOS()) return false;
  return hasSpeechRecognition();
}
