#!/usr/bin/env node
'use strict';

// รันใน CI (ai-workflow-trigger.yml) — สร้าง project tree แล้วเขียนเข้า Firestore โดยตรง
// ให้ Flash (aiChatAgent) โหลดโครงสร้างโปรเจกต์แบบ real-time ผ่าน loadProjectTree()
// ต้องการ GOOGLE_APPLICATION_CREDENTIALS=/tmp/firebase-sa.json

const path = require('path');
const fs = require('fs');

const admin = require(path.join(__dirname, '../node_modules/firebase-admin'));
if (!admin.apps.length) admin.initializeApp();

const db = admin.firestore();
const repoRoot = path.join(__dirname, '../../..'); // scripts/ → webhook-core/ → apps/ → root

const SKIP_DIRS = new Set([
  'node_modules', '.git', 'dist', 'build', '.firebase',
  'coverage', '.nyc_output', '.cache', '__pycache__',
]);
const SKIP_NAMES = new Set(['.DS_Store', 'Thumbs.db']);

function buildTree(dirPath, prefix = '', depth = 0) {
  if (depth > 6) return '';
  let entries;
  try {
    entries = fs.readdirSync(dirPath, { withFileTypes: true });
  } catch {
    return '';
  }

  // ไฟล์ที่มองเห็น — ไม่เอา hidden files ยกเว้น dotfiles สำคัญ
  const visible = entries.filter(e => {
    if (SKIP_NAMES.has(e.name)) return false;
    if (e.isDirectory() && SKIP_DIRS.has(e.name)) return false;
    return true;
  }).sort((a, b) => {
    // โฟลเดอร์ขึ้นก่อน
    if (a.isDirectory() !== b.isDirectory()) return a.isDirectory() ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  const lines = [];
  visible.forEach((entry, idx) => {
    const isLast = idx === visible.length - 1;
    const connector = isLast ? '└── ' : '├── ';
    const childPrefix = prefix + (isLast ? '    ' : '│   ');

    if (entry.isDirectory()) {
      lines.push(prefix + connector + entry.name + '/');
      lines.push(buildTree(path.join(dirPath, entry.name), childPrefix, depth + 1));
    } else {
      lines.push(prefix + connector + entry.name);
    }
  });

  return lines.join('\n');
}

const tree = buildTree(repoRoot).slice(0, 50000);
const sha = process.env.GITHUB_SHA || '';

console.log(`📂 tree size: ${tree.length} chars`);

db.collection('systemConfig').doc('projectTree')
  .set({
    tree,
    sha,
    updatedAt: new Date().toISOString(),
    syncedAt: admin.firestore.FieldValue.serverTimestamp(),
  })
  .then(() => {
    console.log('✅ sync project tree → Firestore projectTree สำเร็จ!');
    process.exit(0);
  })
  .catch((err) => {
    console.error('❌ Firestore write ล้มเหลว:', err.message);
    process.exit(1);
  });
