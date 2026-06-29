#!/usr/bin/env node
'use strict';

// รันใน ai-workflow-trigger.yml — เขียน agentProgress/{requestId} โดยตรง
// ไม่ผ่าน deployNotifyHttp เพื่อเลี่ยงปัญหา auth/token
// ต้องการ GOOGLE_APPLICATION_CREDENTIALS=/tmp/firebase-sa.json และ REQUEST_ID

const path = require('path');
const admin = require(path.join(__dirname, '../node_modules/firebase-admin'));
if (!admin.apps.length) admin.initializeApp();

const db = admin.firestore();
const requestId = process.env.REQUEST_ID;

if (!requestId) {
  console.log('ไม่มี REQUEST_ID ข้าม ACK');
  process.exit(0);
}

db.collection('aiProgress').doc(requestId)
  .set({
    step: 'Pro ได้รับงานแล้ว กำลังเริ่มทำ...',
    status: 'received_by_pro',
    scope: process.env.SCOPE || 'root',
    runId: process.env.GITHUB_RUN_ID || null,
    ackedAt: admin.firestore.FieldValue.serverTimestamp(),
  }, { merge: true })
  .then(() => {
    console.log(`✅ ACK เขียน Firestore aiProgress/${requestId} สำเร็จ`);
    process.exit(0);
  })
  .catch((err) => {
    console.error('ACK Firestore ล้มเหลว (non-fatal):', err.message);
    process.exit(0);
  });
