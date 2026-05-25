import { ref as stRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '../firebase';
import { compressImageFile } from './compressImage';
import { fsPost } from './firestoreRest';

/**
 * อัปโหลดสลิป/ใบสั่งของ (ชา: orderSlips · กุ้งรอบหน้า: stockPurchaseSlips หรือผูก stockBatches)
 */
export async function uploadOrderSlip({ file, dateKey, member, storageFolder = 'orders' }) {
  if (!file) throw new Error('no file');
  if (!storage) throw new Error('storage not ready');

  const compressed = await compressImageFile(file);
  const path = `${storageFolder}/${dateKey}/${member?.uid || 'anon'}_${Date.now()}.jpg`;
  const r = stRef(storage, path);
  await uploadBytes(r, compressed, { contentType: 'image/jpeg' });
  const downloadUrl = await getDownloadURL(r);

  await fsPost('orderSlips', {
    dateKey,
    storagePath: path,
    downloadUrl,
    uploadedBy: member?.name || member?.email || 'staff',
    uid: member?.uid || '',
    createdAt: new Date().toISOString(),
  });

  return { downloadUrl, storagePath: path };
}
