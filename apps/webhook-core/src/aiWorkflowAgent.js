/**
 * AI Workflow Agent — Cloud Function for CHINCHA FLOW
 *
 * Receives code-action intent from aiChatAgent, uses OpenRouter (deepseek)
 * as the AI brain to analyze + generate code fixes, then creates a PR via
 * GitHub REST API.
 *
 * Flow (v2 — "อ่านก่อนเขียน"):
 *   PWA message → aiChatAgent detects code-action → aiWorkflowAgent
 *     Round 1: ส่ง file tree ของ scope ให้ AI เลือกไฟล์ที่ต้องอ่านจริง (need_files)
 *     Round 2: ดึงเนื้อไฟล์เต็มๆตามที่ AI ขอ แล้วให้ AI สร้างแผนแก้จากของจริง
 *     → apply: ต้องเจอ exact match ของ old/find ในไฟล์จริงเท่านั้น
 *               ห้าม fallback เขียนทับทั้งไฟล์แบบเงียบๆ — ถ้าหา match ไม่เจอ ให้ throw
 *     → GitHub API: create branch + commit + open PR
 *   PR ที่เปิดจะถูกตรวจสอบอัตโนมัติโดย .github/workflows/pr-verify.yml
 *   (smoke test + build) แล้ว comment ผลกลับเข้า PR ก่อนพี่กด merge
 *
 * No Cursor Cloud — uses OpenRouter + GitHub PAT only (low cost).
 * Model: deepseek/deepseek-chat (or DEFAULT_MODEL from env).
 *
 * Deploy note: requires GH_PAT (GitHub Personal Access Token) for PR creation.
 */

const functions = require('firebase-functions/v1');
const ADMIN_EMAIL = 'peachtukta1014@gmail.com';

const OPENROUTER_BASE = 'https://openrouter.ai/api/v1';
const DEFAULT_MODEL = 'deepseek/deepseek-chat';
const GH_API = 'https://api.github.com';
const GH_REPO = 'peachtukta1014/chinchaflow';

// ── Intent detection ────────────────────────────────────────────────────
function isCodeAction(text) {
  if (!text || typeof text !== 'string') return false;
  const t = text.toLowerCase();
  return (
    t.includes('แก้โค้ด') || t.includes('แก้bug') || t.includes('แก้บั๊ก') ||
    t.includes('fix code') || t.includes('fix bug') || t.includes('fix this') ||
    (t.includes('สร้าง') && (t.includes('feature') || t.includes('ฟีเจอร์'))) ||
    t.includes('add feature') || t.includes('add code') ||
    t.includes('refactor') || t.includes('ปรับโครงสร้าง') || t.includes('rewrite') ||
    t.includes('deploy') || t.includes('ดีพลอย') || t.includes('merge') ||
    t.includes('pr') || t.includes('pull request') ||
    t.includes('ช่วยเขียน') || t.includes('implement') ||
    t.includes('อัปเดตโค้ด') || t.includes('update code') ||
    t.includes('ช่วยแก้')
  );
}

// ── Known file tree per scope (relative to repo root) ───────────────────
// ใช้แทนการดึง "ไฟล์ตัวแทน" 1 ไฟล์ — ให้ AI เห็นแผนผังจริงแล้วเลือกเองว่าต้องอ่านอะไร
const SCOPE_FILE_TREE = {
  seafood: {
    label: 'โกอ้วนซีฟู้ด (Shrimp POS) — apps/seafood-pos/src/',
    files: [
      'apps/seafood-pos/src/App.jsx',
      'apps/seafood-pos/src/main.jsx',
      'apps/seafood-pos/src/firebase.js',
      'apps/seafood-pos/src/constants/index.js',
      'apps/seafood-pos/src/constants/config.js',
      'apps/seafood-pos/src/constants/products.js',
      'apps/seafood-pos/src/constants/payments.js',
      'apps/seafood-pos/src/constants/stockLines.js',
      'apps/seafood-pos/src/constants/customers.js',
      'apps/seafood-pos/src/screens/POSMobile.jsx',
      'apps/seafood-pos/src/screens/Dashboard.jsx',
      'apps/seafood-pos/src/screens/SalesHubScreen.jsx',
      'apps/seafood-pos/src/screens/InventoryScreen.jsx',
      'apps/seafood-pos/src/screens/ExpensesScreen.jsx',
      'apps/seafood-pos/src/screens/CustomerAccountsScreen.jsx',
      'apps/seafood-pos/src/screens/LineOrdersScreen.jsx',
      'apps/seafood-pos/src/screens/LotCloseScreen.jsx',
      'apps/seafood-pos/src/screens/MembersScreen.jsx',
      'apps/seafood-pos/src/screens/AdminUsersScreen.jsx',
      'apps/seafood-pos/src/screens/ProductSettingsScreen.jsx',
      'apps/seafood-pos/src/screens/PaymentSlipsScreen.jsx',
      'apps/seafood-pos/src/screens/LoginScreen.jsx',
      'apps/seafood-pos/src/screens/MyProfileScreen.jsx',
      'apps/seafood-pos/src/screens/LineDeliveryConfirmSheet.jsx',
      'apps/seafood-pos/src/services/salesService.js',
      'apps/seafood-pos/src/services/stockService.js',
      'apps/seafood-pos/src/services/debtService.js',
      'apps/seafood-pos/src/services/customerService.js',
      'apps/seafood-pos/src/services/lotCloseService.js',
      'apps/seafood-pos/src/services/lotExpenseService.js',
      'apps/seafood-pos/src/services/paymentSlipService.js',
      'apps/seafood-pos/src/services/lineOrderService.js',
      'apps/seafood-pos/src/services/lineOrderRetentionService.js',
      'apps/seafood-pos/src/services/lineOaCustomerService.js',
      'apps/seafood-pos/src/services/shrimpMemberLineService.js',
      'apps/seafood-pos/src/services/shrimpProfileService.js',
      'apps/seafood-pos/src/lib/salesAggregate.js',
      'apps/seafood-pos/src/lib/saleFifo.js',
      'apps/seafood-pos/src/lib/stockBatchUtils.js',
      'apps/seafood-pos/src/lib/stockDeductionPlan.js',
      'apps/seafood-pos/src/lib/stockCommitConflict.js',
      'apps/seafood-pos/src/lib/stockReceiveCost.js',
      'apps/seafood-pos/src/lib/cartStock.js',
      'apps/seafood-pos/src/lib/billDataFromSale.js',
      'apps/seafood-pos/src/lib/billTemplateRows.js',
      'apps/seafood-pos/src/lib/billTemplateConfig.js',
      'apps/seafood-pos/src/lib/billPaymentDisplay.js',
      'apps/seafood-pos/src/lib/billRowMap.js',
      'apps/seafood-pos/src/lib/buildPreviewBill.js',
      'apps/seafood-pos/src/lib/generateBillImage.js',
      'apps/seafood-pos/src/lib/customCartItem.js',
      'apps/seafood-pos/src/lib/customerAliases.js',
      'apps/seafood-pos/src/lib/customerNameMatch.js',
      'apps/seafood-pos/src/lib/customerBillAddress.js',
      'apps/seafood-pos/src/lib/debtCustomerKey.js',
      'apps/seafood-pos/src/lib/date.js',
      'apps/seafood-pos/src/lib/lineOrderBadge.js',
      'apps/seafood-pos/src/lib/lineOrderBoard.js',
      'apps/seafood-pos/src/lib/lineOrderDate.js',
      'apps/seafood-pos/src/lib/lineOrderRetention.js',
      'apps/seafood-pos/src/lib/lineOrderToSale.js',
      'apps/seafood-pos/src/lib/lineOrderWeightSummary.js',
      'apps/seafood-pos/src/lib/lineOrdersFeed.js',
      'apps/seafood-pos/src/lib/lineDeliveryWindow.js',
      'apps/seafood-pos/src/lib/lineCustomerContacts.js',
      'apps/seafood-pos/src/lib/lineCustomerResolve.js',
      'apps/seafood-pos/src/lib/lineOaContactModel.js',
      'apps/seafood-pos/src/lib/lineOaLinkGroups.js',
      'apps/seafood-pos/src/lib/lineUserId.js',
      'apps/seafood-pos/src/lib/lineIds.js',
      'apps/seafood-pos/src/lib/linePushBill.js',
      'apps/seafood-pos/src/lib/lineBillPaymentNote.js',
      'apps/seafood-pos/src/lib/resolveLineUserId.js',
      'apps/seafood-pos/src/lib/resolveLineUserIdPick.js',
      'apps/seafood-pos/src/lib/resolveBillCustomer.js',
      'apps/seafood-pos/src/lib/shrimpBillApi.js',
      'apps/seafood-pos/src/lib/shrimpMember.js',
      'apps/seafood-pos/src/lib/shrimpRoles.js',
      'apps/seafood-pos/src/lib/lotCostSplit.js',
      'apps/seafood-pos/src/lib/lotExpenseLines.js',
      'apps/seafood-pos/src/lib/lotPortfolioStats.js',
      'apps/seafood-pos/src/lib/lotReport.js',
      'apps/seafood-pos/src/lib/offlineDb.js',
      'apps/seafood-pos/src/lib/offlineQueueUtils.js',
      'apps/seafood-pos/src/lib/offlineSaleQueue.js',
      'apps/seafood-pos/src/lib/networkStatus.js',
      'apps/seafood-pos/src/lib/firestoreRest.js',
      'apps/seafood-pos/src/lib/syncLineDeliveryWindow.js',
      'apps/seafood-pos/src/lib/voiceParse.js',
      'apps/seafood-pos/src/hooks/useVoice.js',
      'apps/seafood-pos/src/hooks/useLineOrdersFeed.js',
      'apps/seafood-pos/src/hooks/useSaleDeleteHandlers.js',
      'apps/seafood-pos/src/liff/LineOrderLiffApp.jsx',
      'apps/seafood-pos/src/liff/LineSlipLiffApp.jsx',
      'apps/seafood-pos/src/liff/liffOrderApi.js',
      'apps/seafood-pos/src/liff/liffSlipApi.js',
      'apps/seafood-pos/scripts/smoke-test.mjs',
    ],
  },
  tea: {
    label: 'ร้านชินชา (Tea POS) — apps/chincha-tea/src/',
    files: [
      'apps/chincha-tea/src/App.jsx',
      'apps/chincha-tea/src/main.jsx',
      'apps/chincha-tea/src/firebase.js',
      'apps/chincha-tea/src/lib/constants.js',
      'apps/chincha-tea/src/screens/OrderTab.jsx',
      'apps/chincha-tea/src/screens/DashboardTab.jsx',
      'apps/chincha-tea/src/screens/StockTab.jsx',
      'apps/chincha-tea/src/screens/RestockTab.jsx',
      'apps/chincha-tea/src/screens/CupsTab.jsx',
      'apps/chincha-tea/src/screens/ExpensesTab.jsx',
      'apps/chincha-tea/src/screens/HistoryScreen.jsx',
      'apps/chincha-tea/src/screens/PayrollTab.jsx',
      'apps/chincha-tea/src/screens/ProfitTab.jsx',
      'apps/chincha-tea/src/screens/SummaryTab.jsx',
      'apps/chincha-tea/src/screens/OpsTab.jsx',
      'apps/chincha-tea/src/screens/AdminPanel.jsx',
      'apps/chincha-tea/src/screens/LoginScreen.jsx',
      'apps/chincha-tea/src/screens/MyProfileScreen.jsx',
      'apps/chincha-tea/src/components/CartSheet.jsx',
      'apps/chincha-tea/src/components/MenuCard.jsx',
      'apps/chincha-tea/src/components/CustomizeModal.jsx',
      'apps/chincha-tea/src/components/AppHeader.jsx',
      'apps/chincha-tea/src/components/TeaAppHeaderMenu.jsx',
      'apps/chincha-tea/src/components/TabNav.jsx',
      'apps/chincha-tea/src/components/VoiceCommandBar.jsx',
      'apps/chincha-tea/src/components/StaffAttendancePanel.jsx',
      'apps/chincha-tea/src/components/StaffAttendanceCleanupPanel.jsx',
      'apps/chincha-tea/src/components/StaffGuidePanel.jsx',
      'apps/chincha-tea/src/components/StaffLangNudge.jsx',
      'apps/chincha-tea/src/components/StockItemSettingsSheet.jsx',
      'apps/chincha-tea/src/components/ToppingSaleSettings.jsx',
      'apps/chincha-tea/src/components/DailySummaryStickyBar.jsx',
      'apps/chincha-tea/src/services/teaProfileService.js',
      'apps/chincha-tea/src/lib/orderService.js',
      'apps/chincha-tea/src/lib/orderSlipService.js',
      'apps/chincha-tea/src/lib/inventoryService.js',
      'apps/chincha-tea/src/lib/inventoryMath.js',
      'apps/chincha-tea/src/lib/restockService.js',
      'apps/chincha-tea/src/lib/restockCatalogService.js',
      'apps/chincha-tea/src/lib/restockDisplay.js',
      'apps/chincha-tea/src/lib/restockLexicon.js',
      'apps/chincha-tea/src/lib/restockNotifyService.js',
      'apps/chincha-tea/src/lib/dailyLedger.js',
      'apps/chincha-tea/src/lib/dailySummaryService.js',
      'apps/chincha-tea/src/lib/bulkEntryService.js',
      'apps/chincha-tea/src/lib/historyLogService.js',
      'apps/chincha-tea/src/lib/payrollPeriod.js',
      'apps/chincha-tea/src/lib/staffAttendanceService.js',
      'apps/chincha-tea/src/lib/staffWage.js',
      'apps/chincha-tea/src/lib/teaRoles.js',
      'apps/chincha-tea/src/lib/teaUserService.js',
      'apps/chincha-tea/src/lib/lineNotify.js',
      'apps/chincha-tea/src/lib/lineIds.js',
      'apps/chincha-tea/src/lib/voiceOrder.js',
      'apps/chincha-tea/src/lib/voiceRestock.js',
      'apps/chincha-tea/src/lib/voiceAliases.js',
      'apps/chincha-tea/src/lib/voiceTabCommands.js',
      'apps/chincha-tea/src/lib/speechSupport.js',
      'apps/chincha-tea/src/lib/burmeseToThai.js',
      'apps/chincha-tea/src/lib/burmeseLexicon.js',
      'apps/chincha-tea/src/lib/i18n.js',
      'apps/chincha-tea/src/lib/displayNames.js',
      'apps/chincha-tea/src/lib/smartPriceOrder.js',
      'apps/chincha-tea/src/lib/firestoreRest.js',
      'apps/chincha-tea/src/lib/fetchCache.js',
      'apps/chincha-tea/src/lib/navConfig.js',
      'apps/chincha-tea/src/lib/useCatalog.js',
      'apps/chincha-tea/src/lib/useAppShellChrome.js',
      'apps/chincha-tea/src/lib/productService.js',
      'apps/chincha-tea/src/lib/localeFormat.js',
    ],
  },
  webhook: {
    label: 'LINE Bot / Webhook — apps/webhook-core/src/',
    files: [
      'apps/webhook-core/src/index.js',
      'apps/webhook-core/src/notify.js',
      'apps/webhook-core/src/webhookDedup.js',
      'apps/webhook-core/src/shrimpDirectLineWebhook.js',
      'apps/webhook-core/src/shrimpGroupLineWebhook.js',
      'apps/webhook-core/src/shrimpLineWebhookRouter.js',
      'apps/webhook-core/src/shrimpLineIntent.js',
      'apps/webhook-core/src/shrimpLineReply.js',
      'apps/webhook-core/src/shrimpLinePush.js',
      'apps/webhook-core/src/shrimpLineConfig.js',
      'apps/webhook-core/src/shrimpLineOrderHandler.js',
      'apps/webhook-core/src/shrimpLineCustomerLink.js',
      'apps/webhook-core/src/shrimpLineCustomerProfile.js',
      'apps/webhook-core/src/shrimpLinePendingLink.js',
      'apps/webhook-core/src/shrimpGroupKeyboard.js',
      'apps/webhook-core/src/shrimpLiffMessaging.js',
      'apps/webhook-core/src/shrimpLiffOrderSubmit.js',
      'apps/webhook-core/src/shrimpLiffSlip.js',
      'apps/webhook-core/src/shrimpPaymentSlip.js',
      'apps/webhook-core/src/shrimpBillRender.js',
      'apps/webhook-core/src/shrimpBillPreRender.js',
      'apps/webhook-core/src/shrimpBillTemplateRows.js',
      'apps/webhook-core/src/shrimpBuiltinCustomers.js',
      'apps/webhook-core/src/shrimpDailySummary.js',
      'apps/webhook-core/src/shrimpTodayOrdersSummary.js',
      'apps/webhook-core/src/shrimpStaffLineUids.js',
      'apps/webhook-core/src/parseLineOrder.js',
      'apps/webhook-core/src/parseDeliveryDate.js',
      'apps/webhook-core/src/prepareOrderInput.js',
      'apps/webhook-core/src/saveShrimpLineOrders.js',
      'apps/webhook-core/src/orderWeight.js',
      'apps/webhook-core/src/orderMessageLang.js',
      'apps/webhook-core/src/translateOrderText.js',
      'apps/webhook-core/src/seafoodLexicon.js',
      'apps/webhook-core/src/customerNameAliases.js',
      'apps/webhook-core/src/customerRiverDefault.js',
      'apps/webhook-core/src/customerZone.js',
      'apps/webhook-core/src/lineCustomerContacts.js',
      'apps/webhook-core/src/lineOrderCustomerName.js',
      'apps/webhook-core/src/lineOrderSession.js',
      'apps/webhook-core/src/lineUserId.js',
      'apps/webhook-core/src/instantLineNotify.js',
      'apps/webhook-core/src/verifyLineLiffToken.js',
      'apps/webhook-core/src/provisionShrimpLiff.js',
      'apps/webhook-core/src/teaDailySummary.js',
      'apps/webhook-core/src/aiChatAgent.js',
      'apps/webhook-core/src/aiWorkflowAgent.js',
    ],
  },
  scheduled: {
    label: 'Cron / Automation — apps/webhook-core/src/ + apps/webhook-core-scheduled/',
    files: [
      'apps/webhook-core/src/teaDailySummary.js',
      'apps/webhook-core/src/shrimpDailySummary.js',
      'apps/webhook-core/src/shrimpTodayOrdersSummary.js',
      'apps/webhook-core/src/index.js',
    ],
  },
};
SCOPE_FILE_TREE.root = {
  label: 'ทั้งระบบ (seafood + tea + webhook)',
  files: [
    ...SCOPE_FILE_TREE.seafood.files.slice(0, 10),
    ...SCOPE_FILE_TREE.tea.files.slice(0, 10),
    ...SCOPE_FILE_TREE.webhook.files.slice(0, 10),
  ],
};

// ── Call OpenRouter ──────────────────────────────────────────────────────
async function callOpenRouter(apiKey, messages, maxTokens) {
  const res = await fetch(`${OPENROUTER_BASE}/chat/completions`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://chincha-flow.web.app',
      'X-Title': 'CHINCHA FLOW AI Workflow',
    },
    body: JSON.stringify({
      model: process.env.DEFAULT_MODEL || DEFAULT_MODEL,
      messages,
      temperature: 0.2,
      max_tokens: maxTokens || 4096,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`OpenRouter ${res.status}: ${err?.error?.message || 'Unknown'}`);
  }

  const data = await res.json();
  return data?.choices?.[0]?.message?.content || '';
}

function extractJson(aiResponse) {
  const jsonMatch = aiResponse.match(/```json\s*([\s\S]*?)\s*```/) || aiResponse.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('AI ไม่ได้ตอบ JSON ที่ใช้ได้: ' + aiResponse.slice(0, 200));
  }
  return JSON.parse(jsonMatch[1] || jsonMatch[0]);
}

// ── Fetch agent guidelines from repo ─────────────────────────────────────
// เจ้าของเขียนกฎการทำงานไว้ใน repo — AI ต้องอ่านก่อนทุก session
async function fetchAgentDocs(ghPat) {
  const docs = [
    { path: 'AGENTS.md', label: 'กฎ monorepo (AGENTS.md)', maxLen: 4000 },
    { path: 'docs/PEACH_WORKING_STYLE_TH.md', label: 'วิธีสื่อสารกับพี่ (PEACH_WORKING_STYLE_TH.md)', maxLen: 3000 },
    { path: 'docs/AGENT_HANDBOOK_TH.md', label: 'คู่มือเอเจนต์ (AGENT_HANDBOOK_TH.md)', maxLen: 2000 },
  ];
  let result = '';
  for (const d of docs) {
    try {
      const file = await fetchRepoFile(ghPat, d.path, 'main');
      if (file?.content) result += `\n\n=== ${d.label} ===\n${file.content.slice(0, d.maxLen)}\n`;
    } catch { /* skip if unavailable */ }
  }
  return result;
}

// ── Round 1 prompt: ให้ AI เลือกไฟล์ที่ต้องอ่านจริง (ไม่ใช่เดาจาก snippet) ──
function buildFileSelectionPrompt(scopeInfo, message, agentDocs) {
  return `คุณคือเด๊ฟ (Dev) — Senior Full-stack Developer ของ CHINCHA FLOW monorepo
ก่อนจะแก้โค้ดทุกครั้ง คุณต้อง "อ่านโค้ดจริงก่อน" ห้ามเดาเนื้อไฟล์เด็ดขาด

Scope ปัจจุบัน: ${scopeInfo.label}

รายชื่อไฟล์ทั้งหมดที่มีอยู่ใน scope นี้:
${scopeInfo.files.map((f) => `- ${f}`).join('\n')}

คำสั่งจากพี่ (เจ้าของร้าน): "${message}"

หน้าที่ของคุณตอนนี้: เลือกไฟล์จากรายชื่อด้านบนที่ "จำเป็นต้องอ่านเนื้อจริง" ก่อนจะวางแผนแก้ไข
- เลือกเท่าที่จำเป็น แต่ต้องครบ — ถ้าบั๊กเกี่ยวกับ UI ให้รวมไฟล์ screen/component ที่เกี่ยวด้วย ไม่ใช่แค่ไฟล์ lib
- ถ้าไม่แน่ใจว่าไฟล์ไหนเกี่ยวข้อง ให้เลือกมาดูก่อนดีกว่าพลาด (สูงสุด 8 ไฟล์)
- ห้ามเลือกไฟล์ที่ไม่อยู่ในรายชื่อด้านบน
${agentDocs ? '\n=== กฎและแนวทางการทำงาน (เจ้าของเขียน — อ่านด้วย) ===\n' + agentDocs : ''}
ตอบ JSON เท่านั้น รูปแบบนี้:
\`\`\`json
{
  "need_files": ["path1", "path2"],
  "reasoning": "อธิบายสั้นๆว่าทำไมต้องอ่านไฟล์เหล่านี้"
}
\`\`\`
`;
}

// ── Round 2 prompt: ให้แผนแก้ไขจากเนื้อไฟล์จริงที่อ่านแล้ว ────────────────
function buildFixPlanPrompt(scopeInfo, message, fileContents, agentDocs) {
  const filesBlock = Object.entries(fileContents)
    .filter(([p]) => p !== 'docs/AGENT_CHANGELOG_TH.md') // จัดการ changelog แยก
    .map(([p, content]) => `--- FILE: ${p} ---\n${content === null ? '(ไฟล์นี้ยังไม่มีอยู่ — เป็นไฟล์ใหม่)' : content}\n--- END FILE ---`)
    .join('\n\n');

  return `คุณคือเด๊ฟ (Dev) — Senior Full-stack Developer ของ CHINCHA FLOW monorepo
คุณกำลังแก้โค้ดตามคำสั่งของพี่ (เจ้าของร้าน) — Scope: ${scopeInfo.label}

นี่คือเนื้อไฟล์จริงทั้งหมดที่คุณขออ่าน (ใช้ของจริงนี้เท่านั้น ห้ามเดา):

${filesBlock}

${agentDocs ? '=== กฎและแนวทางการทำงาน (เจ้าของเขียน — ต้องปฏิบัติตาม) ===\n' + agentDocs + '\n' : ''}
กฎสำคัญ — ฝ่าฝืนไม่ได้:
1. diff เล็กที่สุด — แก้เฉพาะส่วนที่เกี่ยวกับคำสั่ง ห้ามแตะส่วนอื่นของไฟล์ที่ไม่เกี่ยว
2. "old" และ "find" ต้องเป็นข้อความที่ copy มาจากไฟล์จริงด้านบน "เป๊ะตัวต่อตัว" (รวม whitespace/indent) — ถ้าไม่ตรงเป๊ะ ระบบจะปฏิเสธการแก้ไขนี้ทันที
3. ห้ามใช้ action "replace" แบบเขียนทั้งไฟล์ใหม่ทั้งหมด นอกจากไฟล์นั้นสั้นมาก (ไม่เกิน ~30 บรรทัด) หรือพี่ขอ rewrite ทั้งไฟล์ตรงๆ — กรณีอื่นให้ใช้ "patch" แก้เฉพาะส่วน
4. ใช้ convention เดิม (อย่าเปลี่ยน style ถ้าไม่จำเป็น)
5. ห้าม expose secret, key, token ในโค้ด
6. ถ้าคำสั่งของพี่กำกวมหรือไฟล์ที่อ่านมาไม่พอจะแก้ได้แน่ใจ ให้ตอบ "need_more_info" แทนแผนแก้ พร้อมอธิบายว่าขาดอะไร

ตอบกลับในรูปแบบนี้เท่านั้น (JSON ใน code block):

\`\`\`json
{
  "branch": "dev/ชื่อสั้น-อธิบายงาน",
  "commit": "feat/fix: อธิบายสั้น (สูงสุด 72 ตัวอักษร)",
  "changes": [
    {
      "path": "apps/seafood-pos/src/lib/example.js",
      "action": "patch",
      "find": "ข้อความที่ copy เป๊ะจากไฟล์จริงด้านบน ใช้บอกตำแหน่งที่จะแทรกโค้ดใหม่ต่อจากนี้",
      "insert": "โค้ดใหม่ที่จะแทรกเข้าไปทันทีหลัง find"
    },
    {
      "path": "apps/chincha-tea/src/App.jsx",
      "action": "patch_replace",
      "find": "บรรทัดเดิมที่ copy เป๊ะจากไฟล์จริงด้านบน ที่จะถูกแทนที่",
      "replace_with": "โค้ดใหม่ที่จะแทนที่ find"
    }
  ],
  "pr_title": "ชื่อ PR",
  "pr_body": "อธิบายว่าแก้ไขอะไร ทำไม",
  "changelog_entry": "สรุปสั้นๆภาษาไทย 1 บรรทัด — จะถูก prepend เข้า docs/AGENT_CHANGELOG_TH.md อัตโนมัติ"
}
\`\`\`

ถ้าข้อมูลไม่พอ ตอบแบบนี้แทน:
\`\`\`json
{ "need_more_info": "อธิบายว่าขาดอะไร หรือคำสั่งกำกวมตรงไหน" }
\`\`\`
`;
}

// ── Apply code changes via GitHub API (strict — no silent full-file overwrite) ──
async function applyCodeChanges(pat, changePlan) {
  const branchName = changePlan.branch || 'dev/ai-fix-' + Date.now().toString(36);
  const commitMsg = changePlan.commit || 'fix: AI fix';
  const changes = changePlan.changes || [];

  if (changes.length === 0) throw new Error('ไม่มีไฟล์ที่จะแก้');

  // Step 1: Get main SHA
  const mainRefRes = await fetch(`${GH_API}/repos/${GH_REPO}/git/refs/heads/main`, {
    headers: { 'Authorization': `token ${pat}`, 'Accept': 'application/vnd.github.v3+json', 'User-Agent': 'CF-AI' },
  });
  if (!mainRefRes.ok) throw new Error(`GitHub ref fetch ${mainRefRes.status}`);
  const mainRef = await mainRefRes.json();
  const mainSha = mainRef.object.sha;

  // Step 2: Create branch from main (skip if exists)
  let branchCreated = false;
  try {
    const branchRes = await fetch(`${GH_API}/repos/${GH_REPO}/git/refs`, {
      method: 'POST',
      headers: { 'Authorization': `token ${pat}`, 'Accept': 'application/vnd.github.v3+json', 'Content-Type': 'application/json', 'User-Agent': 'CF-AI' },
      body: JSON.stringify({ ref: `refs/heads/${branchName}`, sha: mainSha }),
    });
    if (branchRes.status === 201) {
      branchCreated = true;
    } else if (branchRes.status === 422 && (await branchRes.text()).includes('already exists')) {
      await fetch(`${GH_API}/repos/${GH_REPO}/git/refs/heads/${branchName}`, {
        method: 'PATCH',
        headers: { 'Authorization': `token ${pat}`, 'Accept': 'application/vnd.github.v3+json', 'Content-Type': 'application/json', 'User-Agent': 'CF-AI' },
        body: JSON.stringify({ sha: mainSha, force: true }),
      });
    } else {
      throw new Error(`GitHub branch create failed ${branchRes.status}`);
    }
  } catch (e) {
    if (branchCreated) throw e;
    try {
      await fetch(`${GH_API}/repos/${GH_REPO}/git/refs/heads/${branchName}`, {
        method: 'PATCH',
        headers: { 'Authorization': `token ${pat}`, 'Accept': 'application/vnd.github.v3+json', 'Content-Type': 'application/json', 'User-Agent': 'CF-AI' },
        body: JSON.stringify({ sha: mainSha, force: true }),
      });
    } catch { /* fine if it fails */ }
  }

  // Step 3: Read current file contents from the NEW branch (not main)
  const fileContents = {};
  for (const change of changes) {
    if (!change.path) continue;
    const file = await fetchRepoFile(pat, change.path, branchName);
    if (file) {
      fileContents[change.path] = file;
    } else if (change.action === 'create') {
      fileContents[change.path] = null; // new file, no sha
    }
  }

  // Step 4: Apply changes — STRICT exact-match only, no silent full-file fallback
  for (const change of changes) {
    const file = fileContents[change.path];
    let newContent;

    if (change.action === 'create') {
      newContent = change.content || change.new || '';
    } else if (change.action === 'patch') {
      // แทรกโค้ดใหม่ "ต่อจาก" find — ต้องเจอ exact match เท่านั้น
      if (!file) throw new Error(`ไม่พบไฟล์ ${change.path} ใน repo — ไม่สามารถ patch ได้`);
      if (!change.find || file.content.indexOf(change.find) === -1) {
        throw new Error(
          `หาตำแหน่งที่จะแก้ใน ${change.path} ไม่เจอ (find ไม่ตรงกับไฟล์จริง) — ` +
          `AI อาจอ่านไฟล์ผิดเวอร์ชันหรือเดาโค้ด ไม่ดำเนินการต่อเพื่อป้องกันโค้ดพัง`
        );
      }
      const idx = file.content.indexOf(change.find) + change.find.length;
      newContent = file.content.slice(0, idx) + '\n' + (change.insert || '') + file.content.slice(idx);
    } else if (change.action === 'patch_replace') {
      // แทนที่ข้อความเฉพาะส่วน — ต้องเจอ exact match เท่านั้น ห้าม fallback เป็นทั้งไฟล์
      if (!file) throw new Error(`ไม่พบไฟล์ ${change.path} ใน repo — ไม่สามารถแก้ได้`);
      if (!change.find || file.content.indexOf(change.find) === -1) {
        throw new Error(
          `หาข้อความที่จะแทนที่ใน ${change.path} ไม่เจอ (find ไม่ตรงกับไฟล์จริงเป๊ะตัวต่อตัว) — ` +
          `AI อาจอ่านไฟล์ผิดเวอร์ชันหรือเดาโค้ด ไม่ดำเนินการต่อเพื่อป้องกันโค้ดพัง`
        );
      }
      newContent = file.content.replace(change.find, change.replace_with || '');
    } else if (change.action === 'replace') {
      // เขียนทับทั้งไฟล์ — อนุญาตเฉพาะไฟล์ใหม่ หรือไฟล์สั้นมาก (กันเคส full-file overwrite ที่ทำให้ App.jsx เหลือบรรทัดเดียว)
      if (!file) throw new Error(`ไม่พบไฟล์ ${change.path} ใน repo`);
      const currentLineCount = file.content.split('\n').length;
      if (currentLineCount > 40 && !change.confirmed_full_rewrite) {
        throw new Error(
          `${change.path} มี ${currentLineCount} บรรทัด — ปฏิเสธการเขียนทับทั้งไฟล์เพื่อความปลอดภัย ` +
          `(ต้องใช้ action "patch" หรือ "patch_replace" แทน เพื่อแก้เฉพาะส่วนที่เกี่ยว)`
        );
      }
      newContent = change.new || change.content;
      if (!newContent) throw new Error(`${change.path}: action replace ต้องมี "new" หรือ "content"`);
    } else {
      throw new Error(`ไม่รู้จัก action "${change.action}" สำหรับ ${change.path}`);
    }

    // Step 5: Commit the file via GitHub Contents API
    const commitBody = {
      message: commitMsg,
      content: Buffer.from(newContent).toString('base64'),
      branch: branchName,
      committer: { name: 'เด๊ฟ (AI)', email: ADMIN_EMAIL },
    };
    if (file && file.sha) commitBody.sha = file.sha;

    const commitRes = await fetch(`${GH_API}/repos/${GH_REPO}/contents/${change.path}`, {
      method: 'PUT',
      headers: {
        'Authorization': `token ${pat}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
        'User-Agent': 'CF-AI',
      },
      body: JSON.stringify(commitBody),
    });
    if (!commitRes.ok) {
      const err = await commitRes.json().catch(() => ({}));
      const detail = err.message || `HTTP ${commitRes.status}`;
      throw new Error(`GitHub commit ${change.path} failed: ${detail}`);
    }
  }

  return branchName;
}

// ── Fetch file from GitHub repo ─────────────────────────────────────────
async function fetchRepoFile(pat, filePath, ref) {
  const url = `${GH_API}/repos/${GH_REPO}/contents/${filePath}${ref ? '?ref=' + encodeURIComponent(ref) : ''}`;
  const res = await fetch(url, {
    headers: {
      'Authorization': `token ${pat}`,
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'CHINCHA-FLOW-AI',
    },
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`GitHub fetch ${res.status} for ${filePath}`);
  const data = await res.json();
  return {
    content: Buffer.from(data.content, 'base64').toString('utf-8'),
    sha: data.sha,
    path: filePath,
  };
}

// ── Open a PR ────────────────────────────────────────────────────────────
// PR ที่เปิดจาก main จะถูกตรวจสอบอัตโนมัติโดย .github/workflows/pr-verify.yml
// (smoke test + build ตามแอปที่ถูกแก้) แล้ว comment ผลกลับเข้า PR นี้
async function openPR(pat, branchName, prTitle, prBody) {
  const res = await fetch(`${GH_API}/repos/${GH_REPO}/pulls`, {
    method: 'POST',
    headers: {
      'Authorization': `token ${pat}`,
      'Accept': 'application/vnd.github.v3+json',
      'Content-Type': 'application/json',
      'User-Agent': 'CF-AI',
    },
    body: JSON.stringify({
      title: prTitle || `AI Fix: ${branchName}`,
      head: branchName,
      base: 'main',
      body: (prBody || `Auto-generated by เด๊ฟ (AI Workflow Agent)\n\nBranch: ${branchName}`) +
        '\n\n---\n_⏳ การตรวจสอบ smoke test / build อัตโนมัติกำลังรัน — ดูผลที่ comment ถัดไปก่อน merge_',
      draft: false,
    }),
  });

  if (!res.ok) {
    const existing = await fetch(`${GH_API}/repos/${GH_REPO}/pulls?head=peachtukta1014:${branchName}&state=open`, {
      headers: { 'Authorization': `token ${pat}`, 'Accept': 'application/vnd.github.v3+json', 'User-Agent': 'CF-AI' },
    });
    if (existing.ok) {
      const prs = await existing.json();
      if (prs.length > 0) return prs[0].html_url;
    }
    const err = await res.json().catch(() => ({}));
    throw new Error(`GitHub PR create failed: ${res.status} ${err.message || ''}`);
  }

  const pr = await res.json();
  return pr.html_url;
}

// ── Main handler (v2: 2-round "อ่านก่อนเขียน" + อ่านกฎเจ้าของก่อนทุกรอบ) ─────
async function executeCodeAction(openRouterKey, ghPat, { message, history, scope }) {
  const scopeInfo = SCOPE_FILE_TREE[scope] || SCOPE_FILE_TREE.root;

  // ── อ่านกฎการทำงานที่เจ้าของเขียนไว้ใน repo ──────────────────────────────
  const agentDocs = await fetchAgentDocs(ghPat);

  // ── Round 1: AI เลือกไฟล์ที่ต้องอ่านจริงจาก file tree ──────────────────
  const round1Messages = [
    { role: 'system', content: buildFileSelectionPrompt(scopeInfo, message, agentDocs) },
    ...(history || []).slice(-5),
    { role: 'user', content: `คำสั่ง: ${message}\n\nเลือกไฟล์ที่ต้องอ่านก่อนวางแผนแก้ไข` },
  ];
  const round1Response = await callOpenRouter(openRouterKey, round1Messages, 1024);
  const round1Json = extractJson(round1Response);

  let needFiles = Array.isArray(round1Json.need_files) ? round1Json.need_files : [];
  // กรองให้เหลือเฉพาะไฟล์ที่อยู่ใน scope จริง (กัน AI หลอนชื่อไฟล์ที่ไม่มีอยู่)
  needFiles = needFiles.filter((f) => scopeInfo.files.includes(f)).slice(0, 8);
  if (needFiles.length === 0) {
    needFiles = scopeInfo.files.slice(0, 1);
  }

  // ── ดึงเนื้อไฟล์เต็มๆตามที่ AI ขอ + CHANGELOG เสมอ (สำหรับ prepend entry) ─
  const allFilesToFetch = [...new Set([...needFiles, 'docs/AGENT_CHANGELOG_TH.md'])];
  const fileContents = {};
  for (const filePath of allFilesToFetch) {
    try {
      const file = await fetchRepoFile(ghPat, filePath, 'main');
      fileContents[filePath] = file ? file.content : null;
    } catch {
      fileContents[filePath] = null;
    }
  }

  // ── Round 2: AI สร้างแผนแก้จากเนื้อไฟล์จริง ───────────────────────────
  const round2Messages = [
    { role: 'system', content: buildFixPlanPrompt(scopeInfo, message, fileContents, agentDocs) },
    { role: 'user', content: `คำสั่ง: ${message}\nScope: ${scope}\n\nสร้างแผนแก้ไขจากไฟล์จริงด้านบนตามรูปแบบ JSON ที่กำหนด` },
  ];
  const round2Response = await callOpenRouter(openRouterKey, round2Messages, 4096);
  const changePlan = extractJson(round2Response);

  if (changePlan.need_more_info) {
    const err = new Error(changePlan.need_more_info);
    err.needMoreInfo = true;
    throw err;
  }

  // ── Auto-inject CHANGELOG entry (บังคับบันทึกทุก PR) ────────────────────
  if (changePlan.changelog_entry && !changePlan.changes.some(c => c.path === 'docs/AGENT_CHANGELOG_TH.md')) {
    const changelogContent = fileContents['docs/AGENT_CHANGELOG_TH.md'];
    const today = new Date().toISOString().slice(0, 10);
    const changedPaths = (changePlan.changes || []).map(c => c.path).join(', ');
    const newEntry = `## ${today} — ${changePlan.changelog_entry}\n- Scope: ${scopeInfo.label}\n- ไฟล์ที่แก้: ${changedPaths}\n- ถ้าพังอีกให้เช็ก: ${changedPaths}`;

    if (changelogContent) {
      const firstEntryLine = changelogContent.split('\n').find(l => l.startsWith('## '));
      if (firstEntryLine) {
        changePlan.changes.push({
          path: 'docs/AGENT_CHANGELOG_TH.md',
          action: 'patch_replace',
          find: firstEntryLine,
          replace_with: newEntry + '\n\n' + firstEntryLine,
        });
      }
    } else {
      changePlan.changes.push({
        path: 'docs/AGENT_CHANGELOG_TH.md',
        action: 'create',
        content: newEntry + '\n',
      });
    }
  }

  // ── Apply changes via GitHub API (strict exact-match) ─────────────────
  const branchName = await applyCodeChanges(ghPat, changePlan);

  // ── Open PR — pr-verify.yml จะรันตรวจสอบ + comment ผลอัตโนมัติ ────────
  const prUrl = await openPR(ghPat, branchName, changePlan.pr_title, changePlan.pr_body);

  return { branchName, prUrl, changePlan, filesRead: needFiles };
}

// ── Direct handler for aiChatAgent.js ────────────────────────────────────
async function handleCodeAction({ message, history, scope }) {
  if (!isCodeAction(message)) {
    return {
      statusCode: 200,
      body: {
        reply: 'คำสั่งนี้ดูไม่ใช่การแก้โค้ด — ลองพิมพ์ให้ชัดขึ้น เช่น "เด๊ฟ ช่วยแก้บั๊ก..." หรือ "เด๊ฟ ช่วยสร้าง feature..."',
        scope: scope || 'root',
        intent: 'chat',
      },
    };
  }

  const openRouterKey = process.env.OPENROUTER_API_KEY;
  if (!openRouterKey) {
    return {
      statusCode: 500,
      body: {
        reply: 'OPENROUTER_API_KEY ไม่ได้ตั้งค่า',
        scope: scope || 'root',
        intent: 'code-action',
        status: 'config_error',
      },
    };
  }

  const ghPat = process.env.GH_PAT || process.env.GITHUB_TOKEN;
  if (!ghPat) {
    return {
      statusCode: 500,
      body: {
        reply: 'GH_PAT ไม่ได้ตั้งค่า — ต้องมี GitHub Personal Access Token เพื่อสร้าง PR',
        scope: scope || 'root',
        intent: 'code-action',
        status: 'config_error',
      },
    };
  }

  const currentScope = scope || 'root';

  try {
    const result = await executeCodeAction(openRouterKey, ghPat, {
      message,
      history: history || [],
      scope: currentScope,
    });

    return {
      statusCode: 200,
      body: {
        reply: `PR แล้วครับ! ${result.prUrl}\n\nBranch: ${result.branchName}\nไฟล์ที่อ่านก่อนแก้: ${result.filesRead.join(', ')}\n\n` +
          `AI (deepseek) อ่านโค้ดจริง → วิเคราะห์ → แก้เฉพาะส่วนที่เกี่ยว → เปิด PR\n\n` +
          `⏳ รอ smoke test + build อัตโนมัติ (pr-verify.yml) คอมเมนต์ผลกลับเข้า PR ก่อนนะครับ — ถ้าเขียวค่อย merge`,
        scope: currentScope,
        intent: 'code-action',
        status: 'completed',
        prUrl: result.prUrl,
        branchName: result.branchName,
      },
    };
  } catch (err) {
    console.error('handleCodeAction error:', err);
    const isNeedMoreInfo = err.needMoreInfo === true;
    return {
      statusCode: isNeedMoreInfo ? 200 : 500,
      body: {
        reply: isNeedMoreInfo
          ? `ขอข้อมูลเพิ่มก่อนแก้ครับ: ${err.message}`
          : 'เกิดข้อผิดพลาด: ' + (err.message || 'unknown') +
            '\n\nไม่มีการแก้โค้ดเกิดขึ้น (ระบบป้องกันการเขียนทับแบบเดา) — ลองอธิบายให้ชัดขึ้นหรือระบุไฟล์ที่ต้องการแก้',
        scope: currentScope,
        intent: 'code-action',
        status: isNeedMoreInfo ? 'need_more_info' : 'error',
        error: err.message || 'unknown',
      },
    };
  }
}

// ── V1 onRequest — HTTP endpoint ─────────────────────────────────────────
exports.aiWorkflowAgentHttp = functions
  .runWith({ memory: '512MB', timeoutSeconds: 120 })
  .region('asia-southeast1')
  .https.onRequest(async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') { res.status(204).send(''); return; }

    const result = await handleCodeAction(req.body || {});
    res.status(result.statusCode).json(result.body);
  });

exports.handleCodeAction = handleCodeAction;
