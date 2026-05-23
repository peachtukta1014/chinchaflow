/**
 * เคลียร์ข้อมูลร้านชาใน Firestore แล้ว seed เมนูเริ่มต้น (ไม่แตะกุ้ง / users)
 *
 * ต้องล็อกอิน Firebase ก่อน:
 *   firebase login
 *   gcloud auth application-default login --project chincha-eeed6
 *
 * ใช้งาน:
 *   node scripts/tea-db-reset.mjs --dry-run
 *   node scripts/tea-db-reset.mjs --confirm
 *   node scripts/tea-db-reset.mjs --confirm --chincha-db
 *   node scripts/tea-db-reset.mjs --confirm --no-seed
 */

import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const PROJECT_ID = process.env.FIREBASE_PROJECT_ID || 'chincha-eeed6';

/** คอลเลกชันร้านชาเท่านั้น — ไม่ลบ sales, shrimp_users, customers ฯลฯ */
const TEA_COLLECTIONS = [
  'teaOrders',
  'dailyExpenses',
  'products',
  'toppings',
  'restocks',
  'orderSlips',
  'restock_requests', // ชื่อเก่า
];

const args = new Set(process.argv.slice(2));
const dryRun = args.has('--dry-run');
const confirm = args.has('--confirm');
const wipeChinchaDb = args.has('--chincha-db');
const seed = !args.has('--no-seed');

if (!dryRun && !confirm) {
  console.log(`
เคลียร์ข้อมูลร้านชา (project: ${PROJECT_ID})

  node scripts/tea-db-reset.mjs --dry-run          ดูว่าจะลบอะไร
  node scripts/tea-db-reset.mjs --confirm          ลบ + seed เมนูใน (default)
  node scripts/tea-db-reset.mjs --confirm --chincha-db   ลบใน DB ชื่อ chincha ด้วย
  node scripts/tea-db-reset.mjs --confirm --no-seed      ลบอย่างเดียว ไม่ใส่เมนูเริ่มต้น

เก็บไว้: users, config, ข้อมูลกุ้งทั้งหมด
`);
  process.exit(1);
}

initializeApp({ projectId: PROJECT_ID, credential: applicationDefault() });

async function countCollection(db, name) {
  const snap = await db.collection(name).count().get();
  return snap.data().count;
}

async function deleteCollection(db, name, { dry: isDry }) {
  const colRef = db.collection(name);
  let total = 0;
  while (true) {
    const snap = await colRef.limit(400).get();
    if (snap.empty) break;
    if (!isDry) {
      const batch = db.batch();
      snap.docs.forEach((d) => batch.delete(d.ref));
      await batch.commit();
    }
    total += snap.size;
    if (isDry) break; // dry-run: นับแค่ batch แรกแล้วประมาณ
  }
  return total;
}

async function wipeDatabase(databaseId, { dry: isDry }) {
  const db = databaseId === '(default)' ? getFirestore() : getFirestore(databaseId);
  console.log(`\n── Database: ${databaseId} ${isDry ? '(dry-run)' : ''} ──`);

  for (const col of TEA_COLLECTIONS) {
    try {
      const count = await countCollection(db, col);
      if (count === 0) {
        console.log(`  ${col}: ว่าง`);
        continue;
      }
      if (isDry) {
        console.log(`  ${col}: ~${count} เอกสาร (จะลบ)`);
        continue;
      }
      const deleted = await deleteCollection(db, col, { dry: false });
      console.log(`  ${col}: ลบแล้ว ${deleted} เอกสาร`);
    } catch (e) {
      console.warn(`  ${col}: ข้าม (${e.message})`);
    }
  }
}

async function seedCatalog(db, { dry: isDry }) {
  const { DEFAULT_MENU, DEFAULT_TOPPINGS } = await import(
    '../apps/chincha-tea/src/lib/constants.js'
  );
  if (isDry) {
    console.log(`\n  seed: จะใส่ products ${DEFAULT_MENU.length} + toppings ${DEFAULT_TOPPINGS.length}`);
    return;
  }
  const now = new Date().toISOString();
  const batch = db.batch();
  for (const item of DEFAULT_MENU) {
    batch.set(db.collection('products').doc(item.id), { ...item, updatedAt: now });
  }
  for (const top of DEFAULT_TOPPINGS) {
    batch.set(db.collection('toppings').doc(top.id), { ...top, updatedAt: now });
  }
  await batch.commit();
  console.log(`\n  seed: products ${DEFAULT_MENU.length}, toppings ${DEFAULT_TOPPINGS.length}`);
}

async function main() {
  console.log(`Project: ${PROJECT_ID}`);
  const defaultDb = getFirestore();

  await wipeDatabase('(default)', { dry: dryRun });
  if (wipeChinchaDb) await wipeDatabase('chincha', { dry: dryRun });

  if (seed) await seedCatalog(defaultDb, { dry: dryRun });

  if (dryRun) {
    console.log('\n✓ dry-run เสร็จ — รันใหม่ด้วย --confirm เพื่อลบจริง');
  } else {
    console.log('\n✓ เคลียร์เสร็จ — deploy rules + แอพชา แล้วลองบันทึกขายใหม่');
    console.log('  ตรวจ users/{uid} ว่า approved: true และ role admin/staff');
  }
}

main().catch((e) => {
  console.error('\nล้มเหลว:', e.message);
  console.error('ลอง: firebase login && gcloud auth application-default login');
  process.exit(1);
});
