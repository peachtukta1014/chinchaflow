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

/**
 * ต้นทุน/น้ำหนักต่อสาย ต่อ 1 batch — แบ่ง totalCost ตามสัดส่วนรับเข้า (ตรง computeLotCostTotals)
 *
 * กุ้งย้ายจากบ่อ → ตาย: ต้นทุนตัดที่สายเป็นแล้วตอนรับ/ตัด FIFO
 * ฝั่งตายขายได้ใช้ deadCostPerKgForCogs (ถ้าไม่มีรับตายตรง → ทุนเป็น) — ไม่เพิ่มต้นทุนรับเข้าซ้ำ
 */
export function batchLineMetrics(batch, line) {
  const isLive = line === 'live';
  const receivedLive = kg(batch?.liveKg);
  const receivedDead = kg(batch?.deadKg);
  const receivedTotal = receivedLive + receivedDead;
  const remainingLive = kg(batch?.remainingLiveKg ?? batch?.liveKg);
  const remainingDead = kg(batch?.remainingDeadKg ?? batch?.deadKg);
  const totalCost = baht(batch?.totalCost);

  const receivedKg = isLive ? receivedLive : receivedDead;
  const remainingKg = isLive ? remainingLive : remainingDead;

  let lineReceivedCostBaht = 0;
  if (receivedTotal > 0.001 && totalCost > 0) {
    const share = isLive ? receivedLive / receivedTotal : receivedDead / receivedTotal;
    lineReceivedCostBaht = totalCost * share;
  } else if (receivedKg > 0.001) {
    lineReceivedCostBaht = totalCost;
  }

  const costPerKg = receivedKg > 0.001 ? lineReceivedCostBaht / receivedKg : 0;

  return {
    line,
    receivedKg,
    remainingKg,
    lineReceivedCostBaht,
    costPerKg,
    transport: baht(batch?.transport),
    purchaseCostPerKg: Math.max(0, parseFloat(batch?.costPerKg) || 0),
  };
}

/** แสดงใน timeline สายนั้นเมื่อเคยรับหรือยังคงเหลือในสาย */
export function batchVisibleOnStockLine(batch, line) {
  const m = batchLineMetrics(batch, line);
  return m.receivedKg > 0.001 || m.remainingKg > 0.001;
}
