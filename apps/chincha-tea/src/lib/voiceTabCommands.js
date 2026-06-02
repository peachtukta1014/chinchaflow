/** คำสั่งเสียงสั้น ๆ ต่อแท็บ (ไม่ใช่สั่งเมนูขาย) */

const LINE_SUMMARY_RE = /(ส่งสรุป(?:ปิดวัน)?(?:ไป)?\s*line|ส่ง\s*line|line\s*สรุป|แจ้งสรุป|push\s*line|send\s*(?:daily\s*)?summary|line\s*summary|စာရင်းအကျဉ်းပို့|line\s*သို့\s*ပို့)/i;

const RESTOCK_SUBMIT_RE = /(ส่ง(?:รายการ)?สั่งของ|ส่งสั่งของ|บันทึกสั่งของ|submit\s*restock|ပစ္စည်းမှာမည်\s*ပို့|ပို့မည်)/i;

export function hasLineSummaryCommand(text) {
  return LINE_SUMMARY_RE.test(text || '');
}

export function hasRestockSubmitCommand(text) {
  return RESTOCK_SUBMIT_RE.test(text || '');
}
