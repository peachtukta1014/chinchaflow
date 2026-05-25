/**
 * รีเซ็ตข้อมูลร้านกุ้ง (สต๊อก + บิลขาย + ออเดอร์ LINE ฯลฯ)
 * ไม่ลบ: customers, shrimp_users, productSettings
 *
 * ต้องล็อกอินก่อน:
 *   gcloud auth application-default login --project chincha-eeed6
 *
 *   node scripts/shrimp-stock-reset.mjs --dry-run
 *   node scripts/shrimp-stock-reset.mjs --confirm
 *   node scripts/shrimp-stock-reset.mjs --confirm --clear-batches --clear-line-orders
 *   node scripts/shrimp-stock-reset.mjs --confirm --full
 */

import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const PROJECT_ID = process.env.FIREBASE_PROJECT_ID || 'chincha-eeed6';

const args = new Set(process.argv.slice(2));
const dryRun = args.has('--dry-run');
const confirm = args.has('--confirm');
const fullReset = args.has('--full');
const clearBatches = fullReset || args.has('--clear-batches');
const clearLineOrders = fullReset || args.has('--clear-line-orders');
const clearSales = fullReset || args.has('--clear-sales');
const clearDebts = fullReset || args.has('--clear-debts');

if (!dryRun && !confirm) {
  console.log(`
รีเซ็ตข้อมูลร้านกุ้ง (project: ${PROJECT_ID})

  node scripts/shrimp-stock-reset.mjs --dry-run
  node scripts/shrimp-stock-reset.mjs --confirm
  node scripts/shrimp-stock-reset.mjs --confirm --clear-batches
  node scripts/shrimp-stock-reset.mjs --confirm --clear-line-orders
  node scripts/shrimp-stock-reset.mjs --confirm --clear-sales
  node scripts/shrimp-stock-reset.mjs --confirm --clear-debts
  node scripts/shrimp-stock-reset.mjs --confirm --full

--full = ลบ sales + customerDebts + stockBatches + lineOrders + ตั้งสต๊อก 0

เก็บไว้: customers, shrimp_users, productSettings, config อื่นๆ (ชา)
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

async function wipeOptional(name, enabled) {
  if (!enabled) return;
  const n = await deleteCollection(name);
  console.log(`${name}: ลบ ${n} เอกสาร${dryRun ? ' (จำลอง)' : ''}`);
}

async function main() {
  console.log(dryRun ? '=== DRY RUN ===' : fullReset ? '=== FULL SHRIMP RESET ===' : '=== RESET STOCK ===');

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
        resetNote: fullReset ? 'shrimp-full-reset' : 'shrimp-stock-reset',
      },
      { merge: true },
    );
  }
  console.log('config/stock หลัง: { live: 0, dead: 0 }');

  await wipeOptional('sales', clearSales);
  await wipeOptional('customerDebts', clearDebts);
  await wipeOptional('stockBatches', clearBatches);
  await wipeOptional('lineOrders', clearLineOrders);

  console.log('\nเสร็จ — รับกุ้งเข้าใหม่จากแท็บ "รับสต๊อก" · ออเดอร์ LINE เริ่มใหม่ได้');
  if (!clearSales && !fullReset) {
    console.log('(ยอดขายวันเก่ายังอยู่ — ใช้ --full ถ้าต้องการลบบิลทั้งหมด)');
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
