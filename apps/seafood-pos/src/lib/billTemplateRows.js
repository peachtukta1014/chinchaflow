/**
 * แถวคงที่บนฟอร์มใบส่งของ — ชื่อแถวต้องตรงกับ items[].name จาก saleToBillData
 * @see apps/seafood-pos/docs/BILL_TEMPLATE.md
 */

export const TEMPLATE_ROW_NAMES = {
  large: 'กุ้งแม่น้ำ โหญ่ [A] 4-5ตัว/Kg',
  medium: 'กุ้งแม่น้ำ กลาง [B] 6-8ตัว/Kg',
  small: 'กุ้งแม่น้ำ เล็ก [C] 9-13ตัว/Kg',
  dead_large: 'กุ้งแม่น้ำตาย โหญ่ [A] 4-5ตัว/Kg',
  dead_medium: 'กุ้งแม่น้ำตาย กลาง [B] 6-8ตัว/Kg',
  dead_small: 'กุ้งแม่น้ำตาย เล็ก [C] 9-13ตัว/Kg',
};

/** @typedef {'section' | 'spacer' | 'item' | 'extra'} BillRowKind */

/**
 * @typedef {Object} BillTemplateRow
 * @property {string} key
 * @property {BillRowKind} kind
 * @property {string} [label] section header text
 * @property {string} [matchName] item row — ชื่อใน items[]
 */

/** @type {BillTemplateRow[]} */
export const FIXED_TEMPLATE_ROWS = [
  {
    key: 'live-section',
    kind: 'section',
    label: 'ประเภท กุ้งแม่น้ำตัวเป็นๆ [ขึ้นมาจากแม่น้ำถึงมือคุณ]',
  },
  { key: 'live-large', kind: 'item', matchName: TEMPLATE_ROW_NAMES.large },
  { key: 'live-medium', kind: 'item', matchName: TEMPLATE_ROW_NAMES.medium },
  { key: 'live-small', kind: 'item', matchName: TEMPLATE_ROW_NAMES.small },
  { key: 'spacer-before-dead', kind: 'spacer' },
  {
    key: 'dead-section',
    kind: 'section',
    label: 'ประเภท กุ้งแม่น้ำตัวตาย [สดใหม่ทุกวัน]',
  },
  { key: 'dead-large', kind: 'item', matchName: TEMPLATE_ROW_NAMES.dead_large },
  { key: 'dead-medium', kind: 'item', matchName: TEMPLATE_ROW_NAMES.dead_medium },
  { key: 'dead-small', kind: 'item', matchName: TEMPLATE_ROW_NAMES.dead_small },
  { key: 'extra-1', kind: 'extra' },
  { key: 'extra-2', kind: 'extra' },
  { key: 'extra-3', kind: 'extra' },
  { key: 'extra-4', kind: 'extra' },
  { key: 'extra-5', kind: 'extra' },
];
