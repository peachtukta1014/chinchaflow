function kg(n) {
  return Math.max(0, parseFloat(n) || 0);
}

function baht(n) {
  return Math.max(0, parseFloat(n) || 0);
}

/**
 * แยกต้นทุนล็อตเป็น กุ้งเป็น / กุ้งตาย (ตามน้ำหนักรับเข้า + แบ่งค่ารถตามสัดส่วน)
 * ไม่ใช้เฉลี่ยรวมเดียว
 */
export function computeLotCostTotals(lotBatches = []) {
  let receivedLive = 0;
  let receivedDead = 0;
  let liveCostBaht = 0;
  let deadCostBaht = 0;
  let transportTotal = 0;
  let totalCost = 0;

  for (const b of lotBatches) {
    const live = kg(b.liveKg);
    const dead = kg(b.deadKg);
    const total = live + dead;
    const cost = baht(b.totalCost);
    const transport = baht(b.transport);

    receivedLive += live;
    receivedDead += dead;
    totalCost += cost;
    transportTotal += transport;

    if (total <= 0 || cost <= 0) continue;
    liveCostBaht += cost * (live / total);
    deadCostBaht += cost * (dead / total);
  }

  const liveCostPerKg = receivedLive > 0 ? liveCostBaht / receivedLive : 0;
  const deadCostPerKg = receivedDead > 0 ? deadCostBaht / receivedDead : 0;

  /** ขายตายแต่ไม่มีตายตอนรับ (ย้ายจากบ่อ) → ใช้ทุนเป็น */
  const deadCostPerKgForCogs = deadCostPerKg > 0 ? deadCostPerKg : liveCostPerKg;

  return {
    receivedLive,
    receivedDead,
    liveCostBaht,
    deadCostBaht,
    liveCostPerKg,
    deadCostPerKg,
    deadCostPerKgForCogs,
    transportTotal,
    totalCost,
    shrimpPurchaseCost: Math.max(0, totalCost - transportTotal),
  };
}
