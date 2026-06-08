/**
 * ลบออเดอร์ LINE ปิดเก่า — เก็บล่าสุด 100 รายการ (done/cancelled)
 * ไม่แตะ pending/delivering · บิลใน sales ไม่ถูกลบ
 *
 * ต้องล็อกอินก่อน:
 *   gcloud auth application-default login --project chincha-eeed6
 *
 *   node scripts/shrimp-line-orders-prune.mjs --dry-run
 *   node scripts/shrimp-line-orders-prune.mjs --confirm
 *   node scripts/shrimp-line-orders-prune.mjs --confirm --keep=200
 */

import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import {
  LINE_ORDER_RETENTION_KEEP,
  selectLineOrdersToPrune,
} from '../apps/seafood-pos/src/lib/lineOrderRetention.js';

const PROJECT_ID = process.env.FIREBASE_PROJECT_ID || 'chincha-eeed6';

const args = process.argv.slice(2);
const argSet = new Set(args);
const dryRun = argSet.has('--dry-run');
const confirm = argSet.has('--confirm');
const keepArg = args.find((a) => a.startsWith('--keep='));
const keepCount = keepArg
  ? Math.max(1, parseInt(keepArg.split('=')[1], 10) || LINE_ORDER_RETENTION_KEEP)
  : LINE_ORDER_RETENTION_KEEP;

if (!dryRun && !confirm) {
  console.log(`
ลบออเดอร์ LINE ปิดเก่า (project: ${PROJECT_ID})

  node scripts/shrimp-line-orders-prune.mjs --dry-run
  node scripts/shrimp-line-orders-prune.mjs --confirm
  node scripts/shrimp-line-orders-prune.mjs --confirm --keep=200

นโยบาย: เก็บออเดอร์ปิดล่าสุด ${LINE_ORDER_RETENTION_KEEP} รายการ (default)
· ไม่ลบ pending / delivering
· done ต้องมี salesId หรือ billNo ก่อนลบ
· cancelled ลบได้
`);
  process.exit(1);
}

initializeApp({ projectId: PROJECT_ID, credential: applicationDefault() });
const db = getFirestore();

async function listAllLineOrders() {
  const orders = [];
  let last = null;
  while (true) {
    let q = db.collection('lineOrders').orderBy('createdAt', 'desc').limit(500);
    if (last) q = q.startAfter(last);
    const snap = await q.get();
    if (snap.empty) break;
    snap.docs.forEach((d) => orders.push({ id: d.id, ...d.data() }));
    last = snap.docs[snap.docs.length - 1];
    if (snap.size < 500) break;
  }
  return orders;
}

async function main() {
  console.log(dryRun ? '=== DRY RUN ===' : '=== PRUNE LINE ORDERS ===');
  console.log(`keep closed: ${keepCount}`);

  const orders = await listAllLineOrders();
  const summary = selectLineOrdersToPrune(orders, keepCount);

  console.log(`ทั้งหมด: ${summary.total} · รอส่ง/กำลังส่ง: ${summary.activeCount} · ปิดแล้ว: ${summary.closedCount}`);
  console.log(`จะลบ: ${summary.deleteCandidates.length} · ข้าม (done ไม่มีบิล): ${summary.skippedUnsafe.length}`);

  if (summary.deleteCandidates.length === 0) {
    console.log('\nไม่มีอะไรต้องลบ');
    return;
  }

  if (dryRun) {
    const sample = summary.deleteCandidates.slice(0, 5).map((o) => `${o.id} (${o.status})`);
    console.log('\nตัวอย่างที่จะลบ:', sample.join(', '), summary.deleteCandidates.length > 5 ? '...' : '');
    return;
  }

  let deleted = 0;
  const batchSize = 400;
  for (let i = 0; i < summary.deleteCandidates.length; i += batchSize) {
    const chunk = summary.deleteCandidates.slice(i, i + batchSize);
    const batch = db.batch();
    chunk.forEach((o) => batch.delete(db.collection('lineOrders').doc(o.id)));
    await batch.commit();
    deleted += chunk.length;
    console.log(`ลบแล้ว ${deleted}/${summary.deleteCandidates.length}`);
  }

  console.log(`\nเสร็จ — ลบ ${deleted} ออเดอร์ · เก็บออเดอร์ปิดล่าสุด ${keepCount} รายการ`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
