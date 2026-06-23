#!/usr/bin/env node
/**
 * รัน Pro agentic loop ใน GitHub Actions environment
 * รับ payload จาก AGENT_TASK_PAYLOAD env var (ส่งมาจาก Flash CF ผ่าน repository_dispatch)
 * ผลลัพธ์ถูก writeResult → Firestore โดย handleCodeActionV2 โดยตรง (ผ่าน firebase-admin)
 */

import { createRequire } from 'module';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

// โหลด .env ถ้ามี (local dev)
try {
  const dotenv = require('dotenv');
  dotenv.config({ path: join(__dirname, '../.env') });
} catch {}

// Firebase admin init — ใช้ GOOGLE_APPLICATION_CREDENTIALS (service account ใน GH Actions)
const admin = require('firebase-admin');
if (!admin.apps.length) admin.initializeApp();

const { handleCodeActionV2 } = require('../src/aiWorkflowAgent.js');

const raw = process.env.AGENT_TASK_PAYLOAD || '{}';
let payload;
try {
  payload = JSON.parse(raw);
} catch (e) {
  console.error('Invalid AGENT_TASK_PAYLOAD:', raw.slice(0, 200));
  process.exit(1);
}

const { requestId, message, scope, history, isHighRisk, confirmation } = payload;

if (!requestId || !message) {
  console.error('Missing requestId or message in payload');
  process.exit(1);
}

console.log(`[Pro Agent] starting — requestId: ${requestId}, scope: ${scope}`);

try {
  const result = await handleCodeActionV2({
    message,
    history: Array.isArray(history) ? history : [],
    scope: scope || 'root',
    force: true,
    requestId,
    isHighRisk: isHighRisk !== false,
  });
  console.log(`[Pro Agent] done — requestId: ${requestId}, status: ${result.statusCode}`);
  process.exit(0);
} catch (err) {
  console.error(`[Pro Agent] failed — requestId: ${requestId}:`, err.message);
  // handleCodeActionV2 เขียน error result ลง Firestore ให้เองแล้ว
  process.exit(1);
}
