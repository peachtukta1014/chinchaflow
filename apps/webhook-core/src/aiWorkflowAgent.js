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
const { writeProgress, clearProgress, writeResult, writeTokenLog } = require('./shared/progressTracker');
const { runAgentLoop } = require('./shared/agentTools');
const ADMIN_EMAIL = 'peachtukta1014@gmail.com';

const OPENROUTER_BASE = 'https://openrouter.ai/api/v1';
// model เลือกใน agentTools.js (AGENT_MODEL = deepseek-v4-pro) — loop ใช้ pro ตัวเดียว
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
      'apps/chincha-tea/src/lib/authSession.js',
      'apps/chincha-tea/src/lib/appBadge.js',
      'apps/chincha-tea/src/lib/appBuildInfo.js',
      'apps/chincha-tea/src/lib/reloadApp.js',
      'apps/chincha-tea/src/lib/webNotify.js',
      'apps/chincha-tea/src/lib/viteEnv.js',
      'apps/chincha-tea/src/lib/memberAvatar.js',
      'apps/chincha-tea/src/lib/compressImage.js',
      'apps/chincha-tea/src/components/MemberAvatar.jsx',
      'apps/chincha-tea/src/components/TeaHeaderQuickLinks.jsx',
    ],
  },
  webhook: {
    label: 'LINE Bot / Webhook — apps/webhook-core/src/',
    files: [
      'apps/webhook-core/src/index.js',
      'apps/webhook-core/src/aiChatAgent.js',
      'apps/webhook-core/src/aiWorkflowAgent.js',
      'apps/webhook-core/src/shared/agentTools.js',
      'apps/webhook-core/src/shared/toolDefinitions.js',
      'apps/webhook-core/src/shared/toolExecutors.js',
      'apps/webhook-core/src/shared/progressTracker.js',
      'apps/webhook-core/src/shared/lineUtils.js',
      'apps/webhook-core/src/shared/webhookDedup.js',
      'apps/webhook-core/src/seafood-oa/shrimpLineWebhookRouter.js',
      'apps/webhook-core/src/seafood-oa/shrimpDirectLineWebhook.js',
      'apps/webhook-core/src/seafood-oa/shrimpGroupLineWebhook.js',
      'apps/webhook-core/src/seafood-oa/shrimpLineIntent.js',
      'apps/webhook-core/src/seafood-oa/shrimpLineReply.js',
      'apps/webhook-core/src/seafood-oa/shrimpLineConfig.js',
      'apps/webhook-core/src/seafood-oa/shrimpLineOrderHandler.js',
      'apps/webhook-core/src/seafood-oa/shrimpLineCustomerLink.js',
      'apps/webhook-core/src/seafood-oa/shrimpLineCustomerProfile.js',
      'apps/webhook-core/src/seafood-oa/shrimpLinePendingLink.js',
      'apps/webhook-core/src/seafood-oa/shrimpGroupKeyboard.js',
      'apps/webhook-core/src/seafood-oa/shrimpLiffMessaging.js',
      'apps/webhook-core/src/seafood-oa/shrimpLiffOrderSubmit.js',
      'apps/webhook-core/src/seafood-oa/shrimpLiffSlip.js',
      'apps/webhook-core/src/seafood-oa/shrimpPaymentSlip.js',
      'apps/webhook-core/src/seafood-oa/shrimpBuiltinCustomers.js',
      'apps/webhook-core/src/seafood-oa/shrimpDailySummary.js',
      'apps/webhook-core/src/seafood-oa/shrimpTodayOrdersSummary.js',
      'apps/webhook-core/src/seafood-oa/shrimpStaffLineUids.js',
      'apps/webhook-core/src/seafood-oa/parseLineOrder.js',
      'apps/webhook-core/src/seafood-oa/parseDeliveryDate.js',
      'apps/webhook-core/src/seafood-oa/prepareOrderInput.js',
      'apps/webhook-core/src/seafood-oa/saveShrimpLineOrders.js',
      'apps/webhook-core/src/seafood-oa/orderWeight.js',
      'apps/webhook-core/src/seafood-oa/orderMessageLang.js',
      'apps/webhook-core/src/seafood-oa/translateOrderText.js',
      'apps/webhook-core/src/seafood-oa/seafoodLexicon.js',
      'apps/webhook-core/src/seafood-oa/customerNameAliases.js',
      'apps/webhook-core/src/seafood-oa/customerRiverDefault.js',
      'apps/webhook-core/src/seafood-oa/customerZone.js',
      'apps/webhook-core/src/seafood-oa/lineCustomerContacts.js',
      'apps/webhook-core/src/seafood-oa/lineOrderCustomerName.js',
      'apps/webhook-core/src/seafood-oa/lineOrderSession.js',
      'apps/webhook-core/src/seafood-oa/lineUserId.js',
      'apps/webhook-core/src/seafood-oa/verifyLineLiffToken.js',
      'apps/webhook-core/src/seafood-oa/provisionShrimpLiff.js',
      'apps/webhook-core/src/seafood-notify/instantLineNotify.js',
      'apps/webhook-core/src/seafood-notify/shrimpLinePush.js',
      'apps/webhook-core/src/seafood-notify/shrimpBillRender.js',
      'apps/webhook-core/src/seafood-notify/shrimpBillPreRender.js',
      'apps/webhook-core/src/seafood-notify/shrimpBillTemplateRows.js',
      'apps/webhook-core/src/tea/teaDailySummary.js',
      'apps/webhook-core/src/tea/teaWebhook.js',
    ],
  },
  scheduled: {
    label: 'Cron / Automation — apps/webhook-core/src/ + apps/webhook-core-scheduled/',
    files: [
      'apps/webhook-core/src/tea/teaDailySummary.js',
      'apps/webhook-core/src/seafood-oa/shrimpDailySummary.js',
      'apps/webhook-core/src/seafood-oa/shrimpTodayOrdersSummary.js',
      'apps/webhook-core/src/index.js',
    ],
  },
};
SCOPE_FILE_TREE.root = {
  label: 'ทั้งระบบ (seafood + tea + webhook)',
  files: [
    ...SCOPE_FILE_TREE.seafood.files,
    ...SCOPE_FILE_TREE.tea.files,
    ...SCOPE_FILE_TREE.webhook.files,
  ],
};

// ── Fetch agent guidelines from repo ─────────────────────────────────────
// เจ้าของเขียนกฎการทำงานไว้ใน repo — AI ต้องอ่านก่อนทุก session
// scope-specific AGENTS.md โหลดเพิ่มตาม scope เพื่อให้ Pro สวมหมวกถูกแอป
async function fetchAgentDocs(ghPat, scope) {
  const scopeAgentsMap = {
    seafood:  'apps/seafood-pos/AGENTS.md',
    tea:      'apps/chincha-tea/AGENTS.md',
    webhook:  'apps/webhook-core/AGENTS.md',
    root:     'apps/webhook-core/AGENTS.md',
    scheduled:'apps/webhook-core/AGENTS.md',
  };

  const docs = [
    { path: '.jiiji/PRO_AGENT.md', label: 'ตัวตน Pro Agent (.jiiji/PRO_AGENT.md)', maxLen: 4000 },
    { path: 'AGENTS.md', label: 'กฎ monorepo (AGENTS.md)', maxLen: 6000 },
    { path: 'docs/PEACH_WORKING_STYLE_TH.md', label: 'วิธีสื่อสารกับพี่ (PEACH_WORKING_STYLE_TH.md)', maxLen: 5000 },
    { path: 'docs/AGENT_HANDBOOK_TH.md', label: 'คู่มือเอเจนต์ (AGENT_HANDBOOK_TH.md)', maxLen: 5000 },
  ];

  // เพิ่ม scope-specific AGENTS.md ถ้ามี
  const scopePath = scopeAgentsMap[scope];
  if (scopePath) {
    docs.push({ path: scopePath, label: `กฎ scope "${scope}" (${scopePath})`, maxLen: 3000 });
  }

  let result = '';
  for (const d of docs) {
    try {
      const file = await fetchRepoFile(ghPat, d.path, 'main');
      if (file?.content) result += `\n\n=== ${d.label} ===\n${file.content.slice(0, d.maxLen)}\n`;
    } catch { /* skip if unavailable */ }
  }
  return result;
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

// ── Build system prompt for agentic loop ─────────────────────────────────
function buildAgentSystemPrompt(scopeInfo, agentDocs) {
  const fileList = scopeInfo.files.slice(0, 25).join('\n');
  const overflow = scopeInfo.files.length > 25
    ? `\n... (และอีก ${scopeInfo.files.length - 25} ไฟล์ — เรียก list_files เพื่อดูทั้งหมด)`
    : '';

  return `คุณคือ "จีจี้" — AI Developer สำหรับ CHINCHA FLOW monorepo ของพี่พีช
ทำงานแบบ agentic loop: เรียก tool ต่อเนื่องทีละขั้น จนงานเสร็จจริง

## ⚡ กฎเหล็ก — ห้ามฝ่าฝืน
1. **ใช้ tool ทันที** — ห้ามตอบด้วยข้อความล้วนจนกว่างานจะเสร็จ ห้ามถามยืนยัน ห้ามสรุปก่อนลงมือ
2. ถ้าไม่รู้ว่าต้องแก้ไฟล์ไหน → เรียก list_files หรือ read_file ก่อน แล้วตัดสินใจเอง
3. **patch_file**: "find" ต้อง copy มาจากผล read_file เป๊ะตัวต่อตัว (รวม whitespace/indent)
4. ถ้า find ไม่เจอ → read_file ไฟล์นั้นอีกครั้ง แล้วตรวจ ห้ามเดา
5. diff เล็กที่สุด — แก้เฉพาะส่วนที่เกี่ยว ไม่แตะส่วนอื่น
6. ห้าม expose API key / token / secret ในโค้ด
7. **commit_and_pr เป็นขั้นตอนสุดท้ายเสมอ** (หลัง stage ครบทุกไฟล์แล้ว)

## ลำดับการทำงาน
ขั้น 1 → list_files (ถ้าไม่รู้ว่าไฟล์ไหนเกี่ยว)
ขั้น 2 → read_file (อ่านโค้ดจริงก่อนแก้ทุกครั้ง)
ขั้น 3 → patch_file หรือ write_file
ขั้น 4 → ถ้าแก้หลายไฟล์ ทำซ้ำขั้น 2-3 จนครบ
ขั้น 5 → commit_and_pr (commit ทุกไฟล์ + เปิด PR ทีเดียว)
ขั้น 6 → trigger_deploy (ถ้าพี่ขอ)

## Scope ปัจจุบัน: ${scopeInfo.label}
ไฟล์ที่มีอยู่:
${fileList}${overflow}
${agentDocs ? '\n## กฎจากเจ้าของ repo\n' + agentDocs : ''}`;
}

// ── V2 handler: agentic loop (tool calling) ───────────────────────────────
// แทน 2-round fixed pipeline ด้วย loop จริง — จีจี้เลือก tool เองจนงานเสร็จ
async function handleCodeActionV2({ message, history, scope, force = false, requestId = null, isHighRisk = true }) {
  if (!force && !isCodeAction(message)) {
    return {
      statusCode: 200,
      body: {
        reply: 'คำสั่งนี้ดูไม่ใช่การแก้โค้ด — ลองพิมพ์ให้ชัดขึ้น เช่น "จีจี้ ช่วยแก้บั๊ก..." หรือ "จีจี้ ช่วยสร้าง feature..."',
        scope: scope || 'root',
        intent: 'chat',
      },
    };
  }

  const openRouterKey = process.env.OPENROUTER_API_KEY_PRO || process.env.OPENROUTER_API_KEY;
  const ghPat = process.env.GH_PAT || process.env.GITHUB_TOKEN;

  if (!openRouterKey) {
    return { statusCode: 500, body: { reply: 'OPENROUTER_API_KEY ไม่ได้ตั้งค่า', scope: scope || 'root', intent: 'code-action', status: 'config_error' } };
  }
  if (!ghPat) {
    return { statusCode: 500, body: { reply: 'GH_PAT ไม่ได้ตั้งค่า — ต้องมี GitHub Personal Access Token', scope: scope || 'root', intent: 'code-action', status: 'config_error' } };
  }

  const currentScope = scope || 'root';
  const scopeInfo = SCOPE_FILE_TREE[currentScope] || SCOPE_FILE_TREE.root;

  try {
    // โหลด context: กฎ repo
    await writeProgress(requestId, 'กำลังโหลดบริบทระบบ...');
    const agentDocs = await fetchAgentDocs(ghPat, currentScope);

    const systemPrompt = buildAgentSystemPrompt(scopeInfo, agentDocs);

    // รัน agentic loop — จีจี้เลือก tool เองจนงานเสร็จ
    const result = await runAgentLoop(openRouterKey, ghPat, {
      message,
      history: history || [],
      requestId,
      scopeFileTree: SCOPE_FILE_TREE,
      systemPrompt,
      isHighRisk,
    });

    await clearProgress(requestId);

    // บันทึก Pro token usage
    if (result.proUsage) {
      await writeTokenLog(requestId, { pro: result.proUsage }).catch(() => {});
    }

    // Pro Agent รัน GitHub Actions — ไม่มี HTTP response ให้ client โดยตรง
    // เขียนผลลัพธ์ลง Firestore ให้ frontend poll ได้
    await writeResult(requestId, {
      reply: result.reply,
      scope: currentScope,
      intent: 'code-action',
      status: 'completed',
    });

    return {
      statusCode: 200,
      body: {
        reply: result.reply,
        scope: currentScope,
        intent: 'code-action',
        status: 'completed',
        iterations: result.iterations,
        stagedFiles: result.stagedFiles,
      },
    };
  } catch (err) {
    console.error('handleCodeActionV2 error:', err);
    await clearProgress(requestId);

    const isReasoningContentError = /reasoning_content.*thinking mode/i.test(err.message || '');
    const isTransient = !isReasoningContentError && /GitHub \d{3}|OpenRouter \d{3}|fetch failed|ECONNRESET|ETIMEDOUT/.test(err.message || '');
    const isMaxIter = err.message?.includes('MAX_ITERATIONS');

    let userMsg;
    if (isMaxIter) {
      userMsg = `งานนี้ซับซ้อนเกินไปหรือจีจี้วนซ้ำครับพี่ 🙏\n\nลองอธิบายคำสั่งให้ชัดขึ้น หรือแบ่งงานเป็นขั้นตอนย่อยแทนนะคะ`;
    } else if (isTransient) {
      userMsg = `เชื่อมต่อ GitHub หรือ OpenRouter ไม่สำเร็จชั่วคราวครับพี่ 🙏\n\nลองสั่งงานเดิมอีกครั้งได้เลย ปกติจะหายเองถ้าเป็นปัญหาเครือข่ายชั่วคราว\n\nรายละเอียด: ${err.message}`;
    } else {
      userMsg = `จีจี้เจอปัญหาครับพี่: ${err.message}\n\nไม่มีการแก้โค้ดเกิดขึ้น (ไม่มีการเขียนทับแบบเดา) ลองอธิบายคำสั่งให้ชัดขึ้น หรือระบุไฟล์ที่ต้องการแก้`;
    }

    // ✨ สั่งเขียนผลลัพธ์ลง Firestore ทันทีเมื่อเกิด Error เพื่อปลดล็อกให้หน้าจอแชทเลิกค้างเลิกหมุน
    try {
      const { writeResult } = require('./shared/progressTracker');
      await writeResult(requestId, { 
        reply: userMsg, 
        scope: currentScope || 'root',
        status: 'error'
      });
    } catch (writeErr) {
      console.error('Failed to write error result to Firestore:', writeErr);
    }

    // โครงสร้างเดิมของระบบ ส่ง Payload กลับไปตามปกติ
    return {
      statusCode: 500,
      body: {
        reply: userMsg,
        scope: currentScope,
        intent: 'code-action',
        status: 'error',
        error: err.message,
      },
    };
  }
}

exports.handleCodeActionV2 = handleCodeActionV2;
