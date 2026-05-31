/** ชื่อสายสต๊อก/ขายใน UI — ใช้ชุดคำนี้ทั้งแอป */
export const STOCK_LINE = {
  live: {
    id: 'live',
    label: 'กุ้งแม่น้ำเป็น',
    tag: 'Live',
    full: 'กุ้งแม่น้ำเป็น (Live)',
  },
  dead: {
    id: 'dead',
    label: 'กุ้งแม่น้ำตาย',
    tag: 'Dead',
    full: 'กุ้งแม่น้ำตาย (Dead)',
  },
};

export function stockLineFull(line) {
  return STOCK_LINE[line]?.full ?? line;
}

export function stockLineLabel(line) {
  return STOCK_LINE[line]?.label ?? line;
}

export function stockLineTag(line) {
  return STOCK_LINE[line]?.tag ?? line;
}

/** ยอดคู่ เป็น + ตาย เช่น "กุ้งแม่น้ำเป็น (Live) 12.0 · กุ้งแม่น้ำตาย (Dead) 3.5 กก." */
export function formatStockPairKg(liveKg, deadKg, { decimals = 1 } = {}) {
  const f = (n) => Number(n).toFixed(decimals);
  return `${STOCK_LINE.live.full} ${f(liveKg)} · ${STOCK_LINE.dead.full} ${f(deadKg)} กก.`;
}

export function formatStockPairShort(liveKg, deadKg, { decimals = 2 } = {}) {
  const f = (n) => Number(n).toFixed(decimals);
  return `${STOCK_LINE.live.label} ${f(liveKg)} · ${STOCK_LINE.dead.label} ${f(deadKg)} กก.`;
}
