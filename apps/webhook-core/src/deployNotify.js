/**
 * deployNotify.js — รับสถานะ deploy จาก GitHub Actions แล้วเขียนลง Firestore
 * aiChatAgentHttp?action=deploy_status อ่านกลับให้ ai-chat แสดง banner
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

async function writeDeployStatus(appName, status, { workflow, runId, sha } = {}) {
  const admin = require('firebase-admin');
  await getDb().collection('system').doc('deploy_status').set({
    [appName]: {
      status,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      workflow: workflow || null,
      runId: runId ? String(runId) : null,
      sha: sha ? String(sha).slice(0, 7) : null,
    },
  }, { merge: true });
}

async function readDeployStatus() {
  const snap = await getDb().collection('system').doc('deploy_status').get();
  if (!snap.exists) return {};
  const data = snap.data();
  const result = {};
  for (const [key, val] of Object.entries(data)) {
    if (val && typeof val === 'object') {
      result[key] = {
        ...val,
        updatedAt: val.updatedAt?.toDate?.().toISOString() ?? null,
      };
    }
  }
  return result;
}

module.exports = { writeDeployStatus, readDeployStatus };
