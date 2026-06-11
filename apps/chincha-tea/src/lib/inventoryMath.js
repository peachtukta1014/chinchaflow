export const DEFAULT_PURCHASE_UNIT = 'ชิ้น';
export const DEFAULT_BASE_UNIT = 'ชิ้น';

export function positiveInt(value, fallback = 1) {
  const n = Math.round(Number(value));
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export function nonNegativeInt(value, fallback = 0) {
  const n = Math.round(Number(value));
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

export function normalizeInventoryFields(item = {}) {
  const unit = (item.unit || item.purchaseUnit || DEFAULT_PURCHASE_UNIT).trim();
  const baseUnit = (item.base_unit || item.baseUnit || item.baseUnitLabel || unit || DEFAULT_BASE_UNIT).trim();
  const conversionRate = positiveInt(item.conversion_rate ?? item.conversionRate, 1);
  const stockBaseQty = nonNegativeInt(item.stock_base_qty ?? item.stockBaseQty, 0);

  return {
    unit,
    base_unit: baseUnit,
    conversion_rate: conversionRate,
    stock_base_qty: stockBaseQty,
  };
}

export function receivedBaseQtyForLine(line = {}) {
  const qty = positiveInt(line.qty, 1);
  const { conversion_rate: conversionRate } = normalizeInventoryFields(line);
  return qty * conversionRate;
}

export function deductBaseQty(currentStockBaseQty, baseQtyToDeduct) {
  return Math.max(0, nonNegativeInt(currentStockBaseQty, 0) - nonNegativeInt(baseQtyToDeduct, 0));
}

export function cartBaseQtyToDeduct(cart = []) {
  return (cart || []).reduce((sum, item) => sum + positiveInt(item?.qty, 1), 0);
}

export function buildInventoryReceivePreview(line = {}, previous = {}) {
  const merged = normalizeInventoryFields({ ...previous, ...line });
  const receivedBaseQty = receivedBaseQtyForLine({ ...line, conversion_rate: merged.conversion_rate });
  return {
    ...merged,
    stock_base_qty: nonNegativeInt(previous?.stock_base_qty, 0) + receivedBaseQty,
    received_base_qty: receivedBaseQty,
  };
}
