#!/usr/bin/env node
/**
 * Mock test harness สำหรับ Flash analysis loop
 * ทดสอบ logic flow โดยไม่ต้องใช้ Firebase, OpenRouter, GitHub API จริง
 *
 * Mock strategy:
 * - firebase-admin → in-memory store
 * - fetch (OpenRouter + GitHub API) → deterministic responses
 * - ตรวจว่า multi-block ทำงานถูกต้อง, อ่านไฟล์เต็ม, checkpoint ระหว่าง block
 */

// ── Mock firebase-admin ก่อน require อะไรจาก src ──
const firestoreData = {};

const mockFirestore = {
  doc(path) {
    return {
      get: async () => ({
        exists: !!firestoreData[path],
        data: () => firestoreData[path] || null,
      }),
      set: async (data, opts) => {
        if (opts?.merge) {
          firestoreData[path] = { ...(firestoreData[path] || {}), ...data };
        } else {
          firestoreData[path] = data;
        }
      },
      update: async (data) => {
        firestoreData[path] = { ...(firestoreData[path] || {}), ...data };
      },
      delete: async () => { delete firestoreData[path]; },
    };
  },
  collection(path) {
    return {
      doc(id) { return mockFirestore.doc(`${path}/${id}`); },
      add: async (data) => { firestoreData[`${path}/${Date.now()}`] = data; },
    };
  },
};

const mockAdmin = {
  apps: [{ name: 'mock' }],
  initializeApp() {},
};

// Override require สำหรับ firebase modules
const Module = require('module');
const originalResolveFilename = Module._resolveFilename;
const mockModules = {
  'firebase-admin': mockAdmin,
  'firebase-admin/firestore': {
    getFirestore: () => mockFirestore,
    FieldValue: {
      arrayUnion: (...items) => items,
    },
    Timestamp: {
      fromMillis: (ms) => ({ toMillis: () => ms }),
    },
  },
};

Module._resolveFilename = function (request, parent, isMain, options) {
  if (mockModules[request]) return request;
  return originalResolveFilename.call(this, request, parent, isMain, options);
};

const originalLoad = Module._load;
Module._load = function (request, parent, isMain) {
  if (mockModules[request]) return mockModules[request];
  return originalLoad.call(this, request, parent, isMain);
};

// ── Mock fetch (OpenRouter + GitHub API) ──
let fetchCallLog = [];
let mockOpenRouterResponses = [];
let mockGitHubFiles = {};
let openRouterCallCount = 0;

global.fetch = async (url, opts) => {
  const body = opts?.body ? JSON.parse(opts.body) : {};
  fetchCallLog.push({ url, method: opts?.method, body });

  // GitHub Contents API
  if (url.includes('api.github.com/repos') && url.includes('/contents/')) {
    const pathMatch = url.match(/\/contents\/(.+)$/);
    const filePath = pathMatch ? decodeURIComponent(pathMatch[1]) : '';
    const content = mockGitHubFiles[filePath];
    if (content) {
      return { ok: true, text: async () => content, json: async () => ({}) };
    }
    return { ok: false, status: 404, text: async () => 'Not found', json: async () => ({}) };
  }

  // OpenRouter API
  if (url.includes('openrouter.ai')) {
    openRouterCallCount++;
    const responseIdx = openRouterCallCount - 1;
    const mockResponse = mockOpenRouterResponses[responseIdx];
    if (!mockResponse) {
      return {
        ok: true,
        json: async () => ({
          choices: [{
            message: { content: 'No more mock responses', tool_calls: [] },
          }],
        }),
      };
    }
    return {
      ok: true,
      json: async () => ({
        choices: [{ message: mockResponse }],
      }),
    };
  }

  return { ok: false, status: 500, json: async () => ({}) };
};

// ── Test helpers ──
let passed = 0;
let failed = 0;

function assert(cond, msg) {
  if (!cond) {
    console.error(`  FAIL: ${msg}`);
    failed++;
  } else {
    console.log(`  ok: ${msg}`);
    passed++;
  }
}

function resetMocks() {
  fetchCallLog = [];
  mockOpenRouterResponses = [];
  mockGitHubFiles = {};
  openRouterCallCount = 0;
  Object.keys(firestoreData).forEach(k => delete firestoreData[k]);
}

function makeToolCall(name, args) {
  return {
    id: `call_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    type: 'function',
    function: { name, arguments: JSON.stringify(args) },
  };
}

// ── Import modules under test ──
const { runFlashAnalysisLoop, ROUNDS_PER_BLOCK, MAX_BLOCKS } = require('../src/flash/flashAnalysisLoop');

// ── Test 1: Flash finalize ใน block แรก (อ่าน 2 ไฟล์แล้ว finalize) ──
async function testFinalizeInFirstBlock() {
  console.log('\n=== Test 1: finalize ใน block แรก ===');
  resetMocks();

  mockGitHubFiles = {
    'apps/seafood-pos/src/App.jsx': 'export default function App() { return <div>Hello</div>; }',
    'apps/seafood-pos/src/utils/pricing.js': 'function calcPrice(weight, pricePerKg) { return weight * pricePerKg; }\nmodule.exports = { calcPrice };',
  };

  // รอบ 1-3 (explore): list_files, read_file x2
  mockOpenRouterResponses = [
    // round 1: list_files
    { content: null, tool_calls: [makeToolCall('list_files', { dir: 'seafood-pos' })] },
    // round 2: read_file App.jsx
    { content: null, tool_calls: [makeToolCall('read_file', { path: 'apps/seafood-pos/src/App.jsx' })] },
    // round 3: read_file pricing.js
    { content: null, tool_calls: [makeToolCall('read_file', { path: 'apps/seafood-pos/src/utils/pricing.js' })] },
    // round 4: finalize (phase 2)
    { content: null, tool_calls: [makeToolCall('finalize_task_brief', {
      description: 'แก้ calcPrice ให้รองรับส่วนลด',
      target_behavior: 'ราคาต้องคำนวณส่วนลดถูกต้อง',
      files_hint: [{ path: 'apps/seafood-pos/src/utils/pricing.js', fn: 'calcPrice' }],
      isHighRisk: true,
      risk_reason: 'กระทบราคา',
    })] },
  ];

  const result = await runFlashAnalysisLoop('mock-api-key', 'mock-gh-pat', {
    message: 'แก้ราคากุ้งให้รองรับส่วนลด',
    history: [],
    scope: 'seafood',
    initialTaskSpec: {},
    projectTree: 'apps/seafood-pos/src/App.jsx\napps/seafood-pos/src/utils/pricing.js',
    requestId: 'test-req-1',
  });

  assert(result !== null, 'ต้อง return result (ไม่ใช่ null)');
  assert(result?.taskSpec?.description?.includes('calcPrice'), 'taskSpec.description ต้องมี calcPrice');
  assert(result?.iterations === 4, `iterations ต้องเป็น 4 (ได้ ${result?.iterations})`);
  assert(result?.taskSpec?.isHighRisk === true, 'isHighRisk ต้องเป็น true');
}

// ── Test 2: Multi-block — block 1 ไม่ finalize → ต่อ block 2 ──
async function testMultiBlock() {
  console.log('\n=== Test 2: multi-block (block 1 → checkpoint → block 2) ===');
  resetMocks();

  mockGitHubFiles = {
    'apps/webhook-core/src/aiChatAgent.js': 'const ai = require("./flash/flashModels");\n// main agent code\nmodule.exports = {};',
    'apps/webhook-core/src/flash/flashAnalysisLoop.js': 'const { fetchRepoFiles } = require("./flashContext");\n// loop code',
    'apps/webhook-core/src/flash/flashContext.js': 'async function fetchRepoFiles() {}\nmodule.exports = { fetchRepoFiles };',
    'apps/webhook-core/src/shared/chainLockService.js': 'async function appendChainEntry() {}\nmodule.exports = { appendChainEntry };',
  };

  const responses = [];

  // Block 1: 8 rounds — อ่านไฟล์ตลอด ไม่ finalize
  // round 1: list_files
  responses.push({ content: null, tool_calls: [makeToolCall('list_files', { dir: 'webhook-core' })] });
  // round 2: read_file
  responses.push({ content: null, tool_calls: [makeToolCall('read_file', { path: 'apps/webhook-core/src/aiChatAgent.js' })] });
  // round 3: read_file
  responses.push({ content: null, tool_calls: [makeToolCall('read_file', { path: 'apps/webhook-core/src/flash/flashAnalysisLoop.js' })] });
  // round 4-8: search + read
  responses.push({ content: null, tool_calls: [makeToolCall('search_code', { pattern: 'fetchRepoFiles', files: ['apps/webhook-core/src/flash/flashContext.js'] })] });
  responses.push({ content: null, tool_calls: [makeToolCall('read_file', { path: 'apps/webhook-core/src/flash/flashContext.js' })] });
  responses.push({ content: null, tool_calls: [makeToolCall('search_code', { pattern: 'appendChainEntry', files: ['apps/webhook-core/src/shared/chainLockService.js'] })] });
  responses.push({ content: null, tool_calls: [makeToolCall('list_files', { dir: 'shared' })] });
  responses.push({ content: null, tool_calls: [makeToolCall('read_file', { path: 'apps/webhook-core/src/shared/chainLockService.js' })] });

  // Block 2 round 1 (round 9 total): finalize
  responses.push({ content: null, tool_calls: [makeToolCall('finalize_task_brief', {
    description: 'refactor chainLockService ให้รองรับ multi-scope',
    target_behavior: 'chain lock ต้องแยก scope ได้',
    files_hint: [
      { path: 'apps/webhook-core/src/shared/chainLockService.js', fn: 'appendChainEntry' },
      { path: 'apps/webhook-core/src/aiChatAgent.js', fn: 'caller' },
    ],
    isHighRisk: false,
  })] },
  );

  mockOpenRouterResponses = responses;

  const result = await runFlashAnalysisLoop('mock-api-key', 'mock-gh-pat', {
    message: 'แก้ chain lock ให้รองรับหลาย scope',
    history: [],
    scope: 'webhook',
    initialTaskSpec: {},
    projectTree: 'apps/webhook-core/src/aiChatAgent.js\napps/webhook-core/src/flash/flashAnalysisLoop.js\napps/webhook-core/src/flash/flashContext.js\napps/webhook-core/src/shared/chainLockService.js',
    requestId: 'test-req-2',
  });

  assert(result !== null, 'ต้อง return result');
  assert(result?.iterations === 9, `iterations ต้องเป็น 9 (block 1: 8 + block 2: 1) — ได้ ${result?.iterations}`);
  assert(result?.taskSpec?.description?.includes('chainLockService'), 'taskSpec ต้องมี chainLockService');
}

// ── Test 3: Force finalize เมื่อครบทุก block ──
async function testForceFinalize() {
  console.log('\n=== Test 3: force finalize เมื่อครบทุก block ===');
  resetMocks();

  mockGitHubFiles = {
    'apps/seafood-pos/src/App.jsx': 'export default function App() {}',
    'apps/seafood-pos/src/utils/pricing.js': 'function calcPrice() {}',
  };

  const totalRounds = ROUNDS_PER_BLOCK * MAX_BLOCKS;
  const responses = [];

  // round 1: read_file
  responses.push({ content: null, tool_calls: [makeToolCall('read_file', { path: 'apps/seafood-pos/src/App.jsx' })] });
  // round 2: read_file
  responses.push({ content: null, tool_calls: [makeToolCall('read_file', { path: 'apps/seafood-pos/src/utils/pricing.js' })] });

  // round 3 ถึง totalRounds: list_files วนซ้ำ (จำลองว่า Flash ไม่ยอม finalize)
  for (let i = 2; i < totalRounds; i++) {
    responses.push({ content: null, tool_calls: [makeToolCall('list_files', { dir: 'seafood-pos' })] });
  }

  // force finalize response (round totalRounds + 1)
  responses.push({ content: null, tool_calls: [makeToolCall('finalize_task_brief', {
    description: 'forced finalize หลังครบรอบ',
    target_behavior: 'ราคาต้องถูกต้อง',
    files_hint: [{ path: 'apps/seafood-pos/src/utils/pricing.js' }],
    isHighRisk: false,
  })] });

  mockOpenRouterResponses = responses;

  const result = await runFlashAnalysisLoop('mock-api-key', 'mock-gh-pat', {
    message: 'ตรวจราคา',
    history: [],
    scope: 'seafood',
    initialTaskSpec: {},
    projectTree: 'apps/seafood-pos/src/App.jsx\napps/seafood-pos/src/utils/pricing.js',
    requestId: 'test-req-3',
  });

  assert(result !== null, 'ต้อง return result (force finalize)');
  assert(result?.forcedFinalize === true, 'ต้องมี forcedFinalize: true');
  assert(result?.iterations === totalRounds + 1, `iterations ต้องเป็น ${totalRounds + 1} — ได้ ${result?.iterations}`);
}

// ── Test 4: ไม่มี ghPatRead → return null ──
async function testNoGhPat() {
  console.log('\n=== Test 4: ไม่มี ghPatRead → null ===');
  resetMocks();

  const result = await runFlashAnalysisLoop('mock-api-key', '', {
    message: 'test',
    history: [],
    scope: 'seafood',
    initialTaskSpec: {},
    projectTree: '',
    requestId: 'test-req-4',
  });

  assert(result === null, 'ไม่มี ghPatRead ต้อง return null');
}

// ── Test 5: Full file read (ไม่ตัดที่ 3000 ตัวอักษร) ──
async function testFullFileRead() {
  console.log('\n=== Test 5: อ่านไฟล์เต็ม (ไม่ตัด 3000 ตัวอักษร) ===');
  resetMocks();

  const longContent = 'x'.repeat(10000);
  mockGitHubFiles = {
    'apps/test/big-file.js': longContent,
    'apps/test/small-file.js': 'small',
  };

  let capturedToolResult = '';

  mockOpenRouterResponses = [
    // round 1: read big file
    { content: null, tool_calls: [makeToolCall('read_file', { path: 'apps/test/big-file.js' })] },
    // round 2: read small file
    { content: null, tool_calls: [makeToolCall('read_file', { path: 'apps/test/small-file.js' })] },
    // round 3: list
    { content: null, tool_calls: [makeToolCall('list_files', { dir: 'test' })] },
    // round 4: finalize
    { content: null, tool_calls: [makeToolCall('finalize_task_brief', {
      description: 'test full read',
      target_behavior: 'test',
      files_hint: [{ path: 'apps/test/big-file.js' }],
      isHighRisk: false,
    })] },
  ];

  // Intercept fetch to capture tool result messages
  const origFetch = global.fetch;
  global.fetch = async (url, opts) => {
    const res = await origFetch(url, opts);
    if (url.includes('openrouter.ai') && opts?.body) {
      const body = JSON.parse(opts.body);
      const toolMsgs = (body.messages || []).filter(m => m.role === 'tool');
      for (const tm of toolMsgs) {
        if (tm.content?.includes('=== apps/test/big-file.js ===')) {
          capturedToolResult = tm.content;
        }
      }
    }
    return res;
  };

  const result = await runFlashAnalysisLoop('mock-api-key', 'mock-gh-pat', {
    message: 'test big file',
    history: [],
    scope: 'root',
    initialTaskSpec: {},
    projectTree: 'apps/test/big-file.js\napps/test/small-file.js',
    requestId: 'test-req-5',
  });

  global.fetch = origFetch;

  assert(result !== null, 'ต้อง return result');

  // ตรวจว่า GitHub API ถูกเรียกและไม่ตัดที่ 3000
  const ghCalls = fetchCallLog.filter(c => c.url.includes('api.github.com'));
  assert(ghCalls.length > 0, 'ต้องเรียก GitHub API');

  // ตรวจว่า fetchRepoFiles ส่งคืนเนื้อหาเต็ม (ไม่ตัด)
  // เนื่องจาก mock fetch คืน text เต็ม และเราลบ FETCH_FILE_MAX_CHARS แล้ว
  // ตรวจจาก capturedToolResult ที่ส่งกลับไปให้ OpenRouter
  if (capturedToolResult) {
    const contentPart = capturedToolResult.replace('=== apps/test/big-file.js ===\n', '');
    assert(contentPart.length === 10000, `ไฟล์ต้องอ่านเต็ม 10000 ตัวอักษร (ได้ ${contentPart.length})`);
  } else {
    assert(false, 'ไม่เจอ tool result ของ big-file.js ใน messages');
  }
}

// ── Test 6: MIN_FILES_BEFORE_FINALIZE guard ──
async function testMinFilesGuard() {
  console.log('\n=== Test 6: ป้องกัน finalize ก่อนอ่านครบ MIN_FILES ===');
  resetMocks();

  mockGitHubFiles = {
    'apps/test/a.js': 'const a = 1;',
    'apps/test/b.js': 'const b = 2;',
  };

  mockOpenRouterResponses = [
    // round 1: list
    { content: null, tool_calls: [makeToolCall('list_files', { dir: 'test' })] },
    // round 2: read 1 file
    { content: null, tool_calls: [makeToolCall('read_file', { path: 'apps/test/a.js' })] },
    // round 3: list (still explore phase)
    { content: null, tool_calls: [makeToolCall('list_files', { dir: 'test' })] },
    // round 4: try finalize with only 1 file → should be rejected
    { content: null, tool_calls: [makeToolCall('finalize_task_brief', {
      description: 'premature finalize',
      target_behavior: 'test',
      files_hint: [{ path: 'apps/test/a.js' }],
      isHighRisk: false,
    })] },
    // round 5: read 2nd file
    { content: null, tool_calls: [makeToolCall('read_file', { path: 'apps/test/b.js' })] },
    // round 6: finalize with 2 files → should work
    { content: null, tool_calls: [makeToolCall('finalize_task_brief', {
      description: 'proper finalize after 2 files',
      target_behavior: 'test',
      files_hint: [{ path: 'apps/test/a.js' }, { path: 'apps/test/b.js' }],
      isHighRisk: false,
    })] },
  ];

  const result = await runFlashAnalysisLoop('mock-api-key', 'mock-gh-pat', {
    message: 'test min files',
    history: [],
    scope: 'root',
    initialTaskSpec: {},
    projectTree: 'apps/test/a.js\napps/test/b.js',
    requestId: 'test-req-6',
  });

  assert(result !== null, 'ต้อง return result');
  assert(result?.taskSpec?.description?.includes('proper finalize'), 'ต้อง finalize ครั้งที่ 2 (หลังอ่าน 2 ไฟล์)');
  assert(result?.iterations === 6, `iterations ต้องเป็น 6 (ได้ ${result?.iterations})`);
}

// ── Run all tests ──
async function main() {
  console.log('🧪 Flash Analysis Loop — Mock Test Harness\n');
  console.log(`Config: ROUNDS_PER_BLOCK=${ROUNDS_PER_BLOCK}, MAX_BLOCKS=${MAX_BLOCKS}`);

  await testFinalizeInFirstBlock();
  await testMultiBlock();
  await testForceFinalize();
  await testNoGhPat();
  await testFullFileRead();
  await testMinFilesGuard();

  console.log(`\n${'='.repeat(50)}`);
  console.log(`Results: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
  console.log('✅ All tests passed!');
}

main().catch(err => {
  console.error('Test runner crashed:', err);
  process.exit(1);
});
