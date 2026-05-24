/**
 * รีเซ็ตสต๊อกกุ้งก่อนเริ่มวันใหม่ (ไม่ลบยอดขาย / ลูกค้า / ผู้ใช้)
 *
 * ต้องล็อกอินก่อน:
 *   gcloud auth application-default login --project chincha-eeed6
 *
 *   node scripts/shrimp-stock-reset.mjs --dry-run
 *   node scripts/shrimp-stock-reset.mjs --confirm
 *   node scripts/shrimp-stock-reset.mjs --confirm --clear-batches
 *   node scripts/shrimp-stock-reset.mjs --confirm --clear-line-orders
 */

import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const PROJECT_ID = process.env.FIREBASE_PROJECT_ID || 'chincha-eeed6';

const args = new Set(process.argv.slice(2));
const dryRun = args.has('--dry-run');
const confirm = args.has('--confirm');
const clearBatches = args.has('--clear-batches');
const clearLineOrders = args.has('--clear-line-orders');

if (!dryRun && !confirm) {
  console.log(`
รีเซ็ตสต๊อกกุ้ง (project: ${PROJECT_ID})

  node scripts/shrimp-stock-reset.mjs --dry-run
  node scripts/shrimp-stock-reset.mjs --confirm
  node scripts/shrimp-stock-reset.mjs --confirm --clear-batches
  node scripts/shrimp-stock-reset.mjs --confirm --clear-line-orders

ค่าเริ่มต้น: ตั้ง config/stock เป็น กุ้งเป็น 0 / กุ้งตาย 0
ไม่แตะ: sales, customers, shrimp_users, customerDebts
`);
  process.exit(1);
}

initializeApp({ projectId: PROJECT_ID, credential: applicationDefault() });
const db = getFirestore();

async function deleteCollection(name) {
  const colRef = db.collection(name);
  let total = 0;
  while (true) {
    const snap = await colRef.limit(400).get();
    if (snap.empty) break;
    if (!dryRun) {
      const batch = db.batch();
      snap.docs.forEach((d) => batch.delete(d.ref));
      await batch.commit();
    }
    total += snap.size;
  }
  return total;
}

async function main() {
  console.log(dryRun ? '=== DRY RUN ===' : '=== RESET STOCK ===');

  const stockRef = db.collection('config').doc('stock');
  const stockSnap = await stockRef.get();
  const before = stockSnap.exists ? stockSnap.data() : null;
  console.log('config/stock ก่อน:', before ?? '(ไม่มีเอกสาร)');

  if (!dryRun) {
    await stockRef.set(
      {
        live: 0,
        dead: 0,
        updatedAt: new Date().toISOString(),
        resetNote: 'shrimp-stock-reset',
      },
      { merge: true },
    );
  }
  console.log('config/stock หลัง: { live: 0, dead: 0 }');

  if (clearBatches) {
    const n = await deleteCollection('stockBatches');
    console.log(`stockBatches: ลบ ${n} เอกสาร${dryRun ? ' (จำลอง)' : ''}`);
  }

  if (clearLineOrders) {
    const n = await deleteCollection('lineOrders');
    console.log(`lineOrders: ลบ ${n} เอกสาร${dryRun ? ' (จำลอง)' : ''}`);
  }

  console.log('\nเสร็จ — พรุ่งนี้รับกุ้งเข้าใหม่จากแท็บ "รับสต๊อก" ในแอป');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
