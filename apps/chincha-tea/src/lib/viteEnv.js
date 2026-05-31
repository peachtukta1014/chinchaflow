/** อ่าน env จาก Vite แล้ว trim — กัน secret/ไฟล์ .env ที่มี newline ทำให้ Firestore commit 400 */
export function viteEnv(name) {
  const v = import.meta.env[name];
  if (typeof v !== 'string') return v;
  return v.trim();
}

export const FIREBASE_PROJECT_ID = viteEnv('VITE_FIREBASE_PROJECT_ID') || '';
