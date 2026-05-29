/** สรุปยอดขายรายวัน — ร้านกุ้ง (จาก collection sales) */

function formatMoney(n) {
  return `฿${Math.round(n || 0).toLocaleString('th-TH')}`;
}

function normalizeBillItems(bill) {
  return (bill.items || []).map((i) => ({
    productId: i.productId,
    type: i.type || (i.productId === 'dead' ? 'dead' : 'live'),
    weightKg: parseFloat(i.weightKg ?? i.weight ?? 0) || 0,
    lineTotal: parseFloat(i.lineTotal ?? i.total ?? 0) || 0,
  }));
}

function aggregateDailySales(bills) {
  const gradeKg = { large: 0, medium: 0, small: 0 };
  let liveKg = 0;
  let liveRevenue = 0;
  let deadKg = 0;
  let deadRevenue = 0;

  for (const bill of bills) {
    for (const item of normalizeBillItems(bill)) {
      if (item.type === 'dead') {
        deadKg += item.weightKg;
        deadRevenue += item.lineTotal;
      } else {
        liveKg += item.weightKg;
        liveRevenue += item.lineTotal;
        if (item.productId in gradeKg) gradeKg[item.productId] += item.weightKg;
      }
    }
  }

  const pay = { cash: 0, transfer: 0, credit: 0, installment: 0 };
  for (const bill of bills) {
    const t = bill.paymentType || 'cash';
    const total = parseFloat(bill.total) || 0;
    if (pay[t] !== undefined) pay[t] += total;
    else pay.cash += total;
  }

  return {
    billCount: bills.length,
    revenueTotal: bills.reduce((s, b) => s + (parseFloat(b.total) || 0), 0),
    liveKg,
    liveRevenue,
    deadKg,
    deadRevenue,
    gradeKg,
    gradeTotalKg: gradeKg.large + gradeKg.medium + gradeKg.small,
    pay,
  };
}

async function buildShrimpSummaryForDate(db, dateKey) {
  const snap = await db.collection('sales').where('dateKey', '==', dateKey).get();
  const bills = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const s = aggregateDailySales(bills);

  const lines = [
    '📊 สรุปยอดขายวันนี้ — โกอ้วน คลังซีฟู้ด',
    `📅 ${dateKey}`,
    '',
    `💰 ยอดขายรวม: ${formatMoney(s.revenueTotal)}`,
    `🧾 ${s.billCount} บิล`,
    '',
    `🦐 กุ้งเป็น: ${s.liveKg.toFixed(1)} กก. (${formatMoney(s.liveRevenue)})`,
    `   A ใหญ่ ${(s.gradeKg.large || 0).toFixed(1)} · B กลาง ${(s.gradeKg.medium || 0).toFixed(1)} · C เล็ก ${(s.gradeKg.small || 0).toFixed(1)} กก.`,
    `🦐 กุ้งตาย: ${s.deadKg.toFixed(1)} กก. (${formatMoney(s.deadRevenue)})`,
    '',
    '💵 ชำระเงิน',
    `   สด ${formatMoney(s.pay.cash)} · โอน ${formatMoney(s.pay.transfer)}`,
    `   เครดิต ${formatMoney(s.pay.credit)} · ผ่อน ${formatMoney(s.pay.installment)}`,
    '',
    '— จากบิลในแอป POS',
  ];

  if (s.billCount === 0) {
    return [
      '📊 สรุปยอดขายวันนี้ — โกอ้วน คลังซีฟู้ด',
      `📅 ${dateKey}`,
      '',
      'ยังไม่มีบิลขายวันนี้ในระบบ',
      'บันทึกขายในแอปแท็บ "ขายของ"',
    ].join('\n');
  }

  return lines.join('\n');
}

function isShrimpSummaryCommand(text) {
  const t = String(text || '').trim();
  if (/^(สรุป|สรุปวันนี้|ยอดขาย|ยอดขายวันนี้|ปิดวัน|summary|daily|รายงาน)(\s|$)/i.test(t)) return true;
  if (/ยอดขาย.*(วันนี้|สรุป)|(สรุป|ปิดวัน).*ยอดขาย/i.test(t)) return true;
  return false;
}

const SHRIMP_SUMMARY_CMD = { test: (t) => isShrimpSummaryCommand(t) };
const SHRIMP_HELP_CMD = /^(help|ช่วยเหลือ|ช่วย|คำสั่ง|menu|วิธี)(\s|$)/i;

const SHRIMP_HELP_TEXT = [
  '🤖 บอทร้านกุ้ง — โกอ้วน คลังซีฟู้ด',
  '',
  'คำสั่ง:',
  '• สรุปออเดอร์ / สรุปรายการวันนี้ → รายการออเดอร์ LINE ที่ต้องส่งวันนี้',
  '• สรุป / ยอดขายวันนี้ → สรุปยอดขายจากแอป POS',
  '• ยกเลิก → ยกเลิกออเดอร์ล่าสุดของคุณ (ก่อนส่งของ)',
  '• help → แสดงคำสั่งนี้',
  '',
  'สั่งออเดอร์ (แยกวันส่ง):',
  '• ออเดอร์ 25/5/69 หรือ 25/5/69 → ตั้งวันส่ง',
  '• พรุ่งนี้ / วันนี้ ในข้อความได้ (เช่น ออเดอร์พรุ่งนี้ตาจุ้ย กุ้งเล็ก 2 กก)',
  '• ปุ้ย 2 แล้วพิมพ์ กลาง (หรือ ปุ้ย กลาง 2)',
  '• กุ้งใหญ่ 2 กก · ตาจุ้ย กุ้งเล็ก 1 โล',
  '• กุ้งแม่น้ำ 4 โล → บอทถามขนาด (เล็ก 850 / กลาง 1,100 / ใหญ่ 1,450)',
  '• แชท 1:1 ลูกค้าใหม่ — ขอชื่อ เบอร์ เพิ่มเติมก่อนยืนยันออเดอร์',
  '',
  'ไม่ระบุวัน = วันนี้ (เวลาไทย) · แชททั่วไป — บอทไม่ตอบ',
].join('\n');

module.exports = {
  buildShrimpSummaryForDate,
  isShrimpSummaryCommand,
  SHRIMP_HELP_CMD,
  SHRIMP_HELP_TEXT,
};
