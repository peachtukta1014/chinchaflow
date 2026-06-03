/** คำนวณต้นทุนรับเข้า — รวมไซซ์ vs แยก A/B/C ราคาต่างกัน */

export function sizeLineCost(kg, pricePerKg) {
  const w = parseFloat(kg) || 0;
  const p = parseFloat(pricePerKg) || 0;
  if (w <= 0 || p <= 0) return 0;
  return w * p;
}

/** ยอดซื้อกุ้งรวม (ไม่รวมค่ารถ) เมื่อแยกไซซ์ */
export function calcBySizeShrimpCost({ A, B, C, priceA, priceB, priceC }) {
  return (
    sizeLineCost(A, priceA) +
    sizeLineCost(B, priceB) +
    sizeLineCost(C, priceC)
  );
}

/** @param {{ A: number, B: number, C: number, priceA: number, priceB: number, priceC: number }} p */
export function buildBySizeBreakdown({ A, B, C, priceA, priceB, priceC }) {
  const aKg = parseFloat(A) || 0;
  const bKg = parseFloat(B) || 0;
  const cKg = parseFloat(C) || 0;
  const pA = parseFloat(priceA) || 0;
  const pB = parseFloat(priceB) || 0;
  const pC = parseFloat(priceC) || 0;
  return {
    mode: 'by_size',
    A: aKg,
    B: bKg,
    C: cKg,
    priceA: pA,
    priceB: pB,
    priceC: pC,
    lineA: sizeLineCost(aKg, pA),
    lineB: sizeLineCost(bKg, pB),
    lineC: sizeLineCost(cKg, pC),
  };
}

export function shrimpCostFromSizeBreakdown(sizeBreakdown) {
  if (!sizeBreakdown || sizeBreakdown.mode !== 'by_size') return null;
  const lineA =
    parseFloat(sizeBreakdown.lineA) ||
    sizeLineCost(sizeBreakdown.A, sizeBreakdown.priceA);
  const lineB =
    parseFloat(sizeBreakdown.lineB) ||
    sizeLineCost(sizeBreakdown.B, sizeBreakdown.priceB);
  const lineC =
    parseFloat(sizeBreakdown.lineC) ||
    sizeLineCost(sizeBreakdown.C, sizeBreakdown.priceC);
  const total = lineA + lineB + lineC;
  return total > 0 ? total : null;
}

/** ตรวจว่ามีน้ำหนักแต่ยังไม่ใส่ราคา */
export function missingSizePriceLabel({ A, B, C, priceA, priceB, priceC }) {
  const rows = [
    { kg: parseFloat(A) || 0, price: parseFloat(priceA) || 0, label: 'A ใหญ่' },
    { kg: parseFloat(B) || 0, price: parseFloat(priceB) || 0, label: 'B กลาง' },
    { kg: parseFloat(C) || 0, price: parseFloat(priceC) || 0, label: 'C เล็ก' },
  ];
  const missing = rows.find((r) => r.kg > 0 && r.price <= 0);
  return missing ? missing.label : '';
}
