#!/usr/bin/env node
'use strict';

// รันใน ai-workflow-trigger.yml เมื่อ job fail (if: failure())
// เขียน error result → Firestore aiResults/{requestId} + clear aiProgress
// ป้องกัน frontend ค้างรอ result ตลอดกาลเมื่อ Pro crash/timeout

const path = require('path');
const admin = require(path.join(__dirname, '../node_modules/firebase-admin'));
if (!admin.apps.length) admin.initializeApp();

const db = admin.firestore();
const requestId = process.env.REQUEST_ID;

if (!requestId) {
  console.log('ไม่มี REQUEST_ID ข้าม fail-cleanup');
  process.exit(0);
}

const scope = process.env.SCOPE || 'root';
const runId = process.env.GITHUB_RUN_ID || null;

// pointer งานล่าสุดของ scope นี้ — ไม่มี taskMessage ต้นฉบับในเคส crash กลางคัน (script นี้ไม่ได้รับ message)
Promise.all([
  db.collection('aiResults').doc(requestId).set({
    reply: `V4-Pro หยุดทำงานกลางคันครับพี่ 🙏\n\n` +
      `อาจเกิดจาก timeout (เกิน 30 นาที), crash, หรือ GitHub Actions ขัดข้อง\n` +
      `Run ID: ${runId || 'N/A'}\n\n` +
      `ลองส่งคำสั่งเดิมใหม่ได้เลยครับ`,
    scope,
    status: 'error',
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  }, { merge: true }),
  db.collection('aiProgress').doc(requestId).delete().catch(() => {}),
  db.collection('systemConfig').doc('lastRunByScope').set({
    [scope]: {
      lastRequestId: requestId,
      status: 'error',
      taskMessage: '',
      errorSummary: `Pro หยุดทำงานกลางคัน (timeout/crash) — Run ID: ${runId || 'N/A'}`,
      updatedAt: Date.now(),
    },
  }, { merge: true }).catch(() => {}),
]).then(() => {
  console.log(`✅ fail-cleanup เขียน error result + clear progress สำหรับ ${requestId}`);
  process.exit(0);
}).catch((err) => {
  console.error('fail-cleanup Firestore ล้มเหลว (non-fatal):', err.message);
  process.exit(0);
});
