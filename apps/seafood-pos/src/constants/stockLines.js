/** ชื่อสายสต๊อก/ขายใน UI — กุ้งแม่น้ำ */
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
