#!/usr/bin/env node
'use strict';

// รันใน CI (deploy-functions.yml) — เขียน agentDocs เข้า Firestore โดยตรง
// ไม่ผ่าน deployNotifyHttp เพื่อเลี่ยงปัญหา token/propagation
// ต้องการ GOOGLE_APPLICATION_CREDENTIALS=/tmp/sa.json (เขียนไว้แล้วในขั้น deploy)

const path = require('path');
const fs = require('fs');

const admin = require(path.join(__dirname, '../node_modules/firebase-admin'));
if (!admin.apps.length) admin.initializeApp();

const db = admin.firestore();
const repoRoot = path.join(__dirname, '../../..'); // scripts/ → webhook-core/ → apps/ → root

const readFile = (relPath) => {
  try {
    return fs.readFileSync(path.join(repoRoot, relPath), 'utf8').slice(0, 20000);
  } catch {
    return '';
  }
};

const files = {
  'JIIJI.md': readFile('JIIJI.md'),
  'AGENTS.md': readFile('AGENTS.md'),
  'docs/PROJECT_STRUCTURE.md': readFile('docs/PROJECT_STRUCTURE.md'),
  'docs/AGENT_CHANGELOG_TH.md': readFile('docs/AGENT_CHANGELOG_TH.md'),
  'docs/PEACH_WORKING_STYLE_TH.md': readFile('docs/PEACH_WORKING_STYLE_TH.md'),
  'docs/AGENT_HANDBOOK_TH.md': readFile('docs/AGENT_HANDBOOK_TH.md'),
  'docs/CODE_METRICS.md': readFile('docs/CODE_METRICS.md'),
};

const trimmed = Object.fromEntries(Object.entries(files).filter(([, v]) => v));
console.log(`📢 ไฟล์ที่พบ ${Object.keys(trimmed).length} ไฟล์: ${Object.keys(trimmed).join(', ')}`);

const sha = process.env.GITHUB_SHA || '';
const updatedAt = new Date().toISOString();

Promise.all([
  db.collection('systemConfig').doc('agentDocs').set({
    files: trimmed,
    sha,
    updatedAt,
    syncedAt: admin.firestore.FieldValue.serverTimestamp(),
  }),
  db.collection('systemConfig').doc('projectTree').set({
    tree: files['docs/PROJECT_STRUCTURE.md'] || '',
    sha,
    updatedAt,
    syncedAt: admin.firestore.FieldValue.serverTimestamp(),
  }),
])
  .then(() => {
    console.log('✅ ซิงค์ agentDocs + projectTree เข้า Firestore สำเร็จ!');
    process.exit(0);
  })
  .catch((err) => {
    console.error('❌ Firestore write ล้มเหลว:', err.message);
    process.exit(1);
  });
