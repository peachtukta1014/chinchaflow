/**
 * แก้ผูก LINE ซ้ำ + ลบบิลผิดวัน (เคสจ๊ะขียด / ลูกค้าเดิมที่กด「เพิ่มใหม่」แล้ว copy UID เอง)
 *
 * ต้องล็อกอินก่อน:
 *   gcloud auth application-default login --project chincha-eeed6
 *
 *   node scripts/shrimp-fix-customer-line.mjs --dry-run
 *   node scripts/shrimp-fix-customer-line.mjs --confirm --target-id c1
 *   node scripts/shrimp-fix-customer-line.mjs --confirm --target-id c1 --delete-sale-date 2026-06-01
 */

import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const PROJECT_ID = process.env.FIREBASE_PROJECT_ID || 'chincha-eeed6';
const BUILTIN_C1 = 'c1';
const DEFAULT_TARGET = BUILTIN_C1;

const args = new Set(process.argv.slice(2));
const dryRun = args.has('--dry-run');
const confirm = args.has('--confirm');
const targetId = (() => {
  const i = process.argv.indexOf('--target-id');
  return i >= 0 ? process.argv[i + 1] : DEFAULT_TARGET;
})();
const deleteSaleDate = (() => {
  const i = process.argv.indexOf('--delete-sale-date');
  return i >= 0 ? process.argv[i + 1] : '';
})();

function compact(s) {
  return String(s || '').replace(/\s+/g, '').toLowerCase();
}

function normalizeLineUserId(raw) {
  const s = String(raw || '').trim();
  if (!s) return '';
  if (/^U[a-fA-F0-9]{32}$/.test(s)) return s;
  const m = s.match(/U[a-fA-F0-9]{32}/);
  return m ? m[0] : '';
}

function saleDateKey(bill) {
  const dk = bill?.dateKey;
  if (dk && /^\d{4}-\d{2}-\d{2}$/.test(String(dk))) return dk;
  const raw = bill?.createdAt || '';
  if (!raw) return '';
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok' }).format(d);
}

function saleStockKg(sale) {
  let liveKg = 0;
  let deadKg = 0;
  for (const item of sale.items || []) {
    const w = parseFloat(item.weightKg ?? item.weight) || 0;
    if (item.type === 'dead') deadKg += w;
    else liveKg += w;
  }
  return { liveKg, deadKg };
}

function debtKey(customerId, customerName) {
  if (customerId && customerId !== 'general') return customerId;
  const name = (customerName || '').trim();
  if (!name) return null;
  return `cust_${name.replace(/\s+/g, '').toLowerCase()}`;
}

if (!dryRun && !confirm) {
  console.log(`
แก้ผูก LINE + ลบบิลผิดวัน (project: ${PROJECT_ID})

  node scripts/shrimp-fix-customer-line.mjs --dry-run
  node scripts/shrimp-fix-customer-line.mjs --confirm --target-id c1
  node scripts/shrimp-fix-customer-line.mjs --confirm --target-id c1 --delete-sale-date YYYY-MM-DD

--target-id     ร้านหลักที่ต้องการเก็บ UID (default: c1 = จ๊ะขียด)
--delete-sale-date  ลบบิล sales ที่ dateKey ตรงนี้ของลูกค้าในเคส (ถ้าไม่ใส่ แสดงรายการอย่างเดียว)
`);
  process.exit(1);
}

initializeApp({ projectId: PROJECT_ID, credential: applicationDefault() });
const db = getFirestore();

async function loadCustomers() {
  const snap = await db.collection('customers').get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

async function adjustDebt(key, meta, delta) {
  if (!key || !delta) return;
  const ref = db.collection('customerDebts').doc(key);
  const snap = await ref.get();
  const prev = snap.exists ? parseFloat(snap.data().totalDebt) || 0 : 0;
  const next = Math.max(0, prev + delta);
  if (dryRun) {
    console.log(`  ลูกหนี้ ${key}: ${prev} → ${next} (${delta >= 0 ? '+' : ''}${delta})`);
    return;
  }
  if (next <= 0 && snap.exists) {
    await ref.delete();
    return;
  }
  await ref.set({
    customerId: key,
    customerName: meta.customerName || '',
    zone: meta.zone || 'ทั่วไป',
    lastBillNo: meta.lastBillNo || '',
    lastUpdated: new Date().toISOString(),
    totalDebt: next,
  }, { merge: true });
}

async function restoreStock(liveKg, deadKg) {
  if (liveKg <= 0 && deadKg <= 0) return;
  const stockRef = db.collection('config').doc('stock');
  const stockSnap = await stockRef.get();
  const before = stockSnap.exists ? stockSnap.data() : { live: 0, dead: 0 };
  const live = (parseFloat(before.live) || 0) + liveKg;
  const dead = (parseFloat(before.dead) || 0) + deadKg;
  if (dryRun) {
    console.log(`  สต๊อก: live ${before.live}→${live}, dead ${before.dead}→${dead}`);
    return;
  }
  await stockRef.set({ live, dead, updatedAt: new Date().toISOString() }, { merge: true });

  const batchSnap = await db.collection('stockBatches').orderBy('receivedAt', 'desc').limit(1).get();
  if (!batchSnap.empty) {
    const b = batchSnap.docs[0];
    const d = b.data();
    const remLive = (parseFloat(d.remainingLiveKg ?? d.liveKg) || 0) + liveKg;
    const remDead = (parseFloat(d.remainingDeadKg ?? d.deadKg) || 0) + deadKg;
    await b.ref.update({
      remainingLiveKg: remLive,
      remainingDeadKg: remDead,
    });
  }
}

async function deleteSale(sale) {
  const remain = parseFloat(sale.remainingAmount) || 0;
  const { liveKg, deadKg } = saleStockKg(sale);
  const key = debtKey(sale.customerId, sale.customerName);

  console.log(`  ลบบิล ${sale.id} · ${sale.billNo || '—'} · ${sale.customerName} · dateKey=${saleDateKey(sale)} · ค้าง ${remain}`);

  if (dryRun) {
    if (remain > 0) await adjustDebt(key, sale, -remain);
    await restoreStock(liveKg, deadKg);
    return;
  }

  if (remain > 0) await adjustDebt(key, sale, -remain);
  if (liveKg > 0 || deadKg > 0) await restoreStock(liveKg, deadKg);

  if (sale.lineOrderId) {
    await db.collection('lineOrders').doc(sale.lineOrderId).set({
      status: 'pending',
      salesId: '',
      billNo: '',
      completedAt: '',
    }, { merge: true });
  }

  await db.collection('sales').doc(sale.id).delete();
}

async function main() {
  console.log(dryRun ? '=== DRY RUN ===' : '=== CONFIRM ===');
  console.log(`target: customers/${targetId}`);

  const customers = await loadCustomers();
  const target = customers.find((c) => c.id === targetId);
  if (!target) {
    console.error(`ไม่พบ customers/${targetId}`);
    process.exit(1);
  }

  const targetUid = normalizeLineUserId(target.lineUserId);
  const uidOwners = customers.filter((c) => normalizeLineUserId(c.lineUserId) === targetUid && targetUid);
  const duplicates = customers.filter((c) => {
    if (c.id === targetId) return false;
    const uid = normalizeLineUserId(c.lineUserId);
    if (targetUid && uid === targetUid) return true;
    const n = compact(c.name);
    return n && (n.includes('ขียด') || n.includes('เขียน') || compact(target.name).includes(n) || n.includes(compact(target.name)));
  });

  console.log('\n── ลูกค้าเป้าหมาย ──');
  console.log(JSON.stringify({
    id: target.id,
    name: target.name,
    lineUserId: target.lineUserId || '(ว่าง)',
    normalizedUid: targetUid || '(ว่าง)',
  }, null, 2));

  if (uidOwners.length > 1) {
    console.log('\n⚠️  UID ซ้ำในรายการนี้:');
    uidOwners.forEach((c) => console.log(`  - ${c.id}: ${c.name} → ${c.lineUserId}`));
  }

  if (duplicates.length) {
    console.log('\n── รายการที่จะถอด/ลบ (ลูกค้าซ้ำ) ──');
    for (const c of duplicates) {
      const isCx = String(c.id).startsWith('cx_');
      console.log(`  ${isCx ? 'ลบ' : 'ถอด UID'} ${c.id}: ${c.name} (${c.lineUserId || '—'})`);
      if (!dryRun && !confirm) continue;
      if (dryRun) continue;
      if (isCx) {
        await db.collection('customers').doc(c.id).delete();
      } else {
        await db.collection('customers').doc(c.id).set({
          lineUserId: '',
          updatedAt: new Date().toISOString(),
        }, { merge: true });
      }
    }
  }

  if (targetUid && !dryRun && confirm) {
    await db.collection('customers').doc(targetId).set({
      lineUserId: targetUid,
      updatedAt: new Date().toISOString(),
    }, { merge: true });
    console.log(`\n✓ ยืนยัน UID ที่ customers/${targetId}`);
  }

  const relatedIds = new Set([targetId, ...duplicates.map((c) => c.id)]);
  const salesSnap = await db.collection('sales').orderBy('createdAt', 'desc').limit(400).get();
  const relatedSales = salesSnap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((s) => {
      if (relatedIds.has(s.customerId)) return true;
      const n = compact(s.customerName);
      return n && (n.includes('ขียด') || n.includes('เขียน'));
    });

  const tomorrowCandidates = deleteSaleDate
    ? relatedSales.filter((s) => saleDateKey(s) === deleteSaleDate)
    : relatedSales.filter((s) => saleDateKey(s) > new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok' }).format(new Date()));

  console.log('\n── บิลที่เกี่ยวข้อง (ล่าสุด) ──');
  relatedSales.slice(0, 8).forEach((s) => {
    console.log(`  ${s.id} · ${saleDateKey(s)} · ${s.customerId} · ${s.customerName} · ฿${s.total ?? '—'}`);
  });

  if (deleteSaleDate && tomorrowCandidates.length) {
    console.log(`\n── ลบบิลวันที่ ${deleteSaleDate} ──`);
    for (const s of tomorrowCandidates) {
      await deleteSale(s);
    }
  } else if (deleteSaleDate) {
    console.log(`\nไม่พบบิลวันที่ ${deleteSaleDate} สำหรับเคสนี้`);
  } else if (tomorrowCandidates.length) {
    console.log('\n(มีบิลวันในอนาคต — ใส่ --delete-sale-date YYYY-MM-DD เพื่อลบ)');
  }

  console.log('\nเสร็จ');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
