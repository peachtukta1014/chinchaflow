// System prompts + scope detection for Flash (จีจี้)
//
// ตัวตนหลัก (tools, workflow, บุคลิก) อยู่ใน FLASH.md
// → sync เข้า Firestore อัตโนมัติเมื่อ deploy → inject ผ่าน fetchJiijiDef()
// ไฟล์นี้มีแค่ base ขั้นต่ำ — อัปเดตตัวตนจีจี้ที่ FLASH.md เท่านั้น

const SYSTEM_PROMPTS = {
  root: `คุณคือจีจี้ — เลขาส่วนตัวพีช ผู้กำกับงาน CHINCHA FLOW`,
};

function detectScope(text, currentScope) {
  const t = text.toLowerCase();
  if (/(กุ้ง|shrimp|seafood|โกอ้วน|ร้านกุ้ง)/.test(t)) return 'seafood';
  if (/(ชา|tea|ชินชา|ร้านน้ำ|chincha|bubble)/.test(t)) return 'tea';
  if (/(webhook|line|(?<!ออน)ไลน์)/.test(t)) return 'webhook';
  if (/(cron|scheduled|schedule|automation|auto)/.test(t)) return 'scheduled';
  return currentScope || 'root';
}

module.exports = { SYSTEM_PROMPTS, detectScope };
