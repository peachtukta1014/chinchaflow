import {
  EmailAuthProvider,
  reauthenticateWithCredential,
  updatePassword,
} from 'firebase/auth';
import { getDownloadURL, ref as stRef, uploadBytes } from 'firebase/storage';
import { auth, storage } from '../firebase';
import { compressImageFile } from '../lib/compressImage';
import { fsPatch } from '../lib/firestoreRest';

function requireAuthUser() {
  const user = auth?.currentUser;
  if (!user) throw new Error('กรุณาเข้าสู่ระบบใหม่');
  return user;
}

export async function uploadTeaMemberPhoto(uid, file) {
  if (!file) throw new Error('เลือกรูปก่อน');
  if (!storage) throw new Error('Storage ยังไม่พร้อม');
  const user = requireAuthUser();
  if (user.uid !== uid) throw new Error('อัปโหลดได้เฉพาะรูปของตัวเอง');

  const compressed = await compressImageFile(file, {
    maxWidth: 800,
    maxHeight: 800,
    quality: 0.85,
  });
  const path = `teaAvatars/${uid}.jpg`;
  const r = stRef(storage, path);
  await uploadBytes(r, compressed, { contentType: 'image/jpeg' });
  const photoUrl = await getDownloadURL(r);
  await fsPatch(`users/${uid}`, {
    photoUrl,
    photoUpdatedAt: new Date().toISOString(),
  });
  return photoUrl;
}

export async function updateTeaMemberProfile(uid, { name, phone }) {
  const user = requireAuthUser();
  if (user.uid !== uid) throw new Error('แก้ได้เฉพาะโปรไฟล์ของตัวเอง');

  const trimmedName = String(name || '').trim();
  if (trimmedName.length < 1) throw new Error('กรุณากรอกชื่อเล่น');
  const phoneDigits = String(phone || '').replace(/\D/g, '');
  if (phone && phoneDigits.length < 9) throw new Error('เบอร์โทรไม่ถูกต้อง');

  await fsPatch(`users/${uid}`, {
    name: trimmedName,
    phone: phoneDigits || '',
    profileUpdatedAt: new Date().toISOString(),
  });
  return { name: trimmedName, phone: phoneDigits };
}

export async function changeTeaMemberPassword({ currentPassword, newPassword }) {
  const user = requireAuthUser();
  const email = user.email;
  if (!email) throw new Error('บัญชีนี้ไม่มีอีเมล');
  if (!currentPassword) throw new Error('กรุณาใส่รหัสผ่านเดิม');
  if (!newPassword || newPassword.length < 6) {
    throw new Error('รหัสผ่านใหม่ต้องมีอย่างน้อย 6 ตัวอักษร');
  }

  const cred = EmailAuthProvider.credential(email, currentPassword);
  await reauthenticateWithCredential(user, cred);
  await updatePassword(user, newPassword);
}
