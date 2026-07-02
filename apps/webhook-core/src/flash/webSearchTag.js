// จับ/ลบแท็ก [WEB_SEARCH: query] จาก reply ของ Flash
// DeepSeek ชอบเกริ่นข้อความก่อนค่อยใส่แท็ก — ต้องจับทุกตำแหน่ง (ห้าม anchor ^)
// ไม่งั้นแท็กหลุดโชว์ดิบๆ ให้พีชเห็นและไม่ถูกค้นจริง (เจอจริง 2026-07-02)

const WEB_SEARCH_RE = /\[WEB_SEARCH:\s*([^\]]+)\]/i;

/** คืน query ในแท็กแรกที่เจอ หรือ null ถ้าไม่มีแท็ก */
function matchWebSearchQuery(text) {
  const m = String(text || '').match(WEB_SEARCH_RE);
  return m ? m[1].trim() : null;
}

/** ลบแท็กทั้งหมดออกจากข้อความ + ยุบบรรทัดว่างซ้อน */
function stripWebSearchTags(text) {
  return String(text || '')
    .replace(/\[WEB_SEARCH:[^\]]*\]/gi, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

module.exports = { WEB_SEARCH_RE, matchWebSearchQuery, stripWebSearchTags };
