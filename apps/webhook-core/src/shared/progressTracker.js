/**
 * progressTracker.js — เขียนสถานะงาน code-action ลง Firestore
 * ให้ frontend poll ผ่าน GET /aiChatAgentHttp?action=progress&requestId=xxx
 * เอกสาร aiProgress/{requestId} จะถูกลบหลังงานเสร็จ (TTL ~5 นาที)
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

/**
 * เขียน step ล่าสุดลง Firestore
 * @param {string|null} requestId
 * @param {string} step  — ข้อความแสดงผลให้ผู้ใช้เห็น
 */
async function writeProgress(requestId, step) {
  if (!requestId) return;
  try {
    await getDb().doc(`aiProgress/${requestId}`).set({ step, ts: Date.now() });
  } catch { /* non-critical — ไม่ให้ progress พัง flow หลัก */ }
}

/**
 * ลบเอกสารหลังงานเสร็จ (cleanup)
 * @param {string|null} requestId
 */
async function clearProgress(requestId) {
  if (!requestId) return;
  try {
    await getDb().doc(`aiProgress/${requestId}`).delete();
  } catch { /* ignore */ }
}

/**
 * อ่าน step ปัจจุบัน (ใช้ใน polling endpoint)
 * @param {string} requestId
 * @returns {Promise<{step: string|null, ts: number|null}>}
 */
async function readProgress(requestId) {
  try {
    const doc = await getDb().doc(`aiProgress/${requestId}`).get();
    return doc.exists ? doc.data() : { step: null, ts: null };
  } catch {
    return { step: null, ts: null };
  }
}

/**
 * เขียนผลลัพธ์สุดท้ายลง Firestore (เผื่อ client disconnect ระหว่างรัน)
 * TTL 30 นาที — client จะลบเองเมื่ออ่านแล้ว
 * @param {string|null} requestId
 * @param {object} data  — { reply, scope, ... }
 */
async function writeResult(requestId, data) {
  if (!requestId) return;
  try {
    const expiresAt = Date.now() + 30 * 60 * 1000;
    await getDb().doc(`aiResults/${requestId}`).set({ ...data, ts: Date.now(), expiresAt });
  } catch { /* non-critical */ }
}

/**
 * อ่านผลลัพธ์ (ใช้ใน recovery endpoint)
 * @param {string} requestId
 * @returns {Promise<object|null>}
 */
async function readResult(requestId) {
  try {
    const doc = await getDb().doc(`aiResults/${requestId}`).get();
    if (!doc.exists) return null;
    const data = doc.data();
    if (data.expiresAt && Date.now() > data.expiresAt) {
      await getDb().doc(`aiResults/${requestId}`).delete();
      return null;
    }
    return data;
  } catch { return null; }
}

/**
 * ลบผลลัพธ์หลัง client อ่านแล้ว
 * @param {string|null} requestId
 */
async function clearResult(requestId) {
  if (!requestId) return;
  try { await getDb().doc(`aiResults/${requestId}`).delete(); } catch { /* ignore */ }
}

module.exports = { writeProgress, clearProgress, readProgress, writeResult, readResult, clearResult };
