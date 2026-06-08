import {
  EmailAuthProvider,
  reauthenticateWithCredential,
  updatePassword,
} from 'firebase/auth';
import { getDownloadURL, ref as stRef, uploadBytes } from 'firebase/storage';
import { auth, storage } from '../firebase';
import { compressImageFile } from '../lib/compressImage';
import { appendPhotoCacheBust } from '../lib/memberAvatar';
import { fsPatch } from '../lib/firestoreRest';

function profileError(code) {
  const err = new Error(code);
  err.code = code;
  return err;
}

function requireAuthUser() {
  const user = auth?.currentUser;
  if (!user) throw profileError('profileNotAuthed');
  return user;
}

export async function uploadTeaMemberPhoto(uid, file) {
  if (!file) throw profileError('profilePickPhoto');
  if (!storage) throw profileError('profileStorageNotReady');
  const user = requireAuthUser();
  if (user.uid !== uid) throw profileError('profileUploadOwnOnly');

  const compressed = await compressImageFile(file, {
    maxWidth: 800,
    maxHeight: 800,
    quality: 0.85,
  });
  const path = `teaAvatars/${uid}.jpg`;
  const r = stRef(storage, path);
  await uploadBytes(r, compressed, { contentType: 'image/jpeg' });
  const photoUrl = await getDownloadURL(r);
  const photoUpdatedAt = new Date().toISOString();
  await fsPatch(`users/${uid}`, {
    photoUrl,
    photoUpdatedAt,
  });
  return appendPhotoCacheBust(photoUrl, photoUpdatedAt);
}

export async function updateTeaMemberProfile(uid, { name, phone }) {
  const user = requireAuthUser();
  if (user.uid !== uid) throw profileError('profileUploadOwnOnly');

  const trimmedName = String(name || '').trim();
  if (trimmedName.length < 1) throw profileError('profileNameRequired');
  const phoneDigits = String(phone || '').replace(/\D/g, '');
  if (phone && phoneDigits.length < 9) throw profileError('profilePhoneInvalid');

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
  if (!email) throw profileError('profileNoEmail');
  if (!currentPassword) throw profileError('profileNeedCurrentPassword');
  if (!newPassword || newPassword.length < 6) {
    throw profileError('profileNewPasswordShort');
  }

  const cred = EmailAuthProvider.credential(email, currentPassword);
  await reauthenticateWithCredential(user, cred);
  await updatePassword(user, newPassword);
}
