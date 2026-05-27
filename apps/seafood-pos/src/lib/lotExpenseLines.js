/** รายการรายจ่ายย่อยต่อสาย (บ่อ/เป็น · ตลาด/ตาย) */

export function sanitizeExpenseLine(line) {
  return {
    label: String(line?.label ?? '').trim(),
    amount: Math.max(0, parseFloat(line?.amount) || 0),
  };
}

export function sumExpenseLines(lines) {
  return (Array.isArray(lines) ? lines : []).reduce(
    (s, line) => s + sanitizeExpenseLine(line).amount,
    0,
  );
}

/** จาก Firestore หรือยอดเก่า + หมายเหตุเดียว */
export function normalizeExpenseLinesFromDoc(docLines, legacyAmount, legacyNote) {
  const fromArray = (Array.isArray(docLines) ? docLines : [])
    .map(sanitizeExpenseLine)
    .filter((l) => l.label || l.amount > 0);
  if (fromArray.length) return fromArray;

  const legacy = Math.max(0, parseFloat(legacyAmount) || 0);
  if (legacy > 0) {
    const note = String(legacyNote || '').trim();
    return [{ label: note || 'รายจ่าย', amount: legacy }];
  }
  return [];
}

export function emptyExpenseLineForm() {
  return { label: '', amount: '' };
}

/** สำหรับช่องกรอก — อย่างน้อย 1 แถวว่าง */
export function linesToFormState(lines) {
  if (!lines?.length) return [emptyExpenseLineForm()];
  return lines.map((l) => ({
    label: l.label,
    amount: l.amount > 0 ? String(Math.round(l.amount)) : '',
  }));
}

/** จากฟอร์ม → บันทึก (ตัดแถวว่าง) */
export function formStateToLines(formLines) {
  return (Array.isArray(formLines) ? formLines : [])
    .map((row) => sanitizeExpenseLine({ label: row.label, amount: row.amount }))
    .filter((l) => l.label || l.amount > 0);
}
