/**
 * chainLockService.js — บันทึก chain locks รายวัน แยก scope
 *
 * Firestore schema:
 *   chainLocks/{scope}/daily/{YYYY-MM-DD}
 *   {
 *     carryOver: { ... } | null,   ← entry สุดท้ายของเมื่อวาน (ส่งไม้ต่อ)
 *     entries: [ { ts, station, action, requestId, summary, pr, status } ],
 *     updatedAt: number
 *   }
 *
 * - วันใหม่ = document ใหม่ (ไม่หนัก)
 * - carryOver ถูกเติมอัตโนมัติจาก entry สุดท้ายของเมื่อวาน
 * - Agent อ่านเฉพาะวันนี้ — เจอ carryOver ก็รู้ว่าเมื่อวานจบตรงไหน
 *
 * station: 'flash' | 'pro'
 * action:  'classify' | 'analyze' | 'dispatch' | 'patch' | 'commit' | 'pr' | 'complete' | 'error'
 */

let _admin = null;
let _db = null;

function getDb() {
  if (!_db) {
    if (!_admin) {
      _admin = require('firebase-admin');
      if (!_admin.apps.length) _admin.initializeApp();
    }
    const { getFirestore } = require('firebase-admin/firestore');
    _db = getFirestore();
  }
  return _db;
}

// วันที่ไทย (UTC+7) — ธุรกิจพีชอยู่ไทย ตัดวันตามเวลาไทย
function todayKey() {
  const d = new Date(Date.now() + 7 * 60 * 60 * 1000);
  return d.toISOString().slice(0, 10); // YYYY-MM-DD
}

function yesterdayKey() {
  const d = new Date(Date.now() + 7 * 60 * 60 * 1000 - 24 * 60 * 60 * 1000);
  return d.toISOString().slice(0, 10);
}

function dailyDocRef(scope, dateKey) {
  return getDb().doc(`chainLocks/${scope}/daily/${dateKey}`);
}

/**
 * ดึง carryOver จาก entry สุดท้ายของเมื่อวาน (ถ้ามี)
 */
async function buildCarryOver(scope) {
  try {
    const yDoc = await dailyDocRef(scope, yesterdayKey()).get();
    if (!yDoc.exists) return null;
    const data = yDoc.data();
    const entries = data?.entries || [];
    if (entries.length === 0) return null;
    const last = entries[entries.length - 1];
    return {
      date: yesterdayKey(),
      station: last.station || null,
      action: last.action || null,
      summary: last.summary || null,
      pr: last.pr || null,
      status: last.status || null,
      requestId: last.requestId || null,
      ts: last.ts || null,
    };
  } catch (err) {
    console.warn('[ChainLock] buildCarryOver failed:', err.message);
    return null;
  }
}

/**
 * เพิ่ม entry ใหม่ลง chain ของวันนี้
 * ถ้าเป็น entry แรกของวัน → สร้าง document ใหม่พร้อม carryOver จากเมื่อวาน
 *
 * @param {string} scope — seafood | tea | webhook | root
 * @param {object} entry — { station, action, requestId, summary, pr?, status? }
 */
async function appendChainEntry(scope, entry) {
  if (!scope || !entry) return;
  const dateKey = todayKey();
  const ref = dailyDocRef(scope, dateKey);

  const newEntry = {
    ts: Date.now(),
    station: entry.station || 'flash',
    action: entry.action || 'unknown',
    requestId: entry.requestId || null,
    summary: (entry.summary || '').slice(0, 500),
    pr: entry.pr || null,
    status: entry.status || 'pending',
  };

  try {
    const { FieldValue } = require('firebase-admin/firestore');
    const doc = await ref.get();

    if (!doc.exists) {
      const carryOver = await buildCarryOver(scope);
      await ref.set({
        carryOver,
        entries: [newEntry],
        updatedAt: Date.now(),
      });
    } else {
      await ref.update({
        entries: FieldValue.arrayUnion(newEntry),
        updatedAt: Date.now(),
      });
    }
  } catch (err) {
    console.warn(`[ChainLock] appendChainEntry failed for ${scope}/${dateKey}:`, err.message);
  }
}

/**
 * อ่าน chain ของวันนี้ — agent ใช้ดูบริบทก่อนวิเคราะห์
 * @param {string} scope
 * @returns {Promise<{ carryOver: object|null, entries: object[] } | null>}
 */
async function loadTodayChain(scope) {
  if (!scope) return null;
  try {
    const doc = await dailyDocRef(scope, todayKey()).get();
    if (!doc.exists) return null;
    return doc.data();
  } catch (err) {
    console.warn('[ChainLock] loadTodayChain failed:', err.message);
    return null;
  }
}

/**
 * สร้างข้อความสรุป chain สำหรับ inject เข้า system prompt ของ Flash
 * @param {string} scope
 * @returns {Promise<string>}
 */
async function formatChainForPrompt(scope) {
  const chain = await loadTodayChain(scope);
  if (!chain) return '';

  const parts = [];
  if (chain.carryOver) {
    const co = chain.carryOver;
    parts.push(`📎 เมื่อวาน (${co.date}): ${co.station} ${co.action} — ${co.summary || '(ไม่มีรายละเอียด)'}${co.pr ? ` [${co.pr}]` : ''} (${co.status || '?'})`);
  }

  const entries = chain.entries || [];
  if (entries.length > 0) {
    parts.push(`📋 วันนี้ (${todayKey()}): ${entries.length} งาน`);
    // แสดง 5 รายการล่าสุด
    const recent = entries.slice(-5);
    for (const e of recent) {
      const time = new Date(e.ts + 7 * 60 * 60 * 1000).toISOString().slice(11, 16);
      parts.push(`  ${time} ${e.station} ${e.action}: ${e.summary || '-'}${e.pr ? ` [${e.pr}]` : ''} (${e.status})`);
    }
    if (entries.length > 5) {
      parts.push(`  ... อีก ${entries.length - 5} รายการก่อนหน้า`);
    }
  }

  return parts.length > 0 ? `\n⛓️ Chain Lock (${scope}):\n${parts.join('\n')}` : '';
}

module.exports = { appendChainEntry, loadTodayChain, formatChainForPrompt, todayKey };
