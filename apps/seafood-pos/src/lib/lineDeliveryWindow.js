/** ค่าเริ่มต้น: 18:00 เมื่อวาน → 15:00 วันนี้ = ส่งวันนี้ */
export const LINE_DELIVERY_WINDOW_DEFAULTS = { startHour: 18, endHour: 15 };

function clampHour(n, fallback) {
  const v = Number(n);
  if (!Number.isFinite(v) || v < 0 || v > 23) return fallback;
  return Math.floor(v);
}

export function normalizeLineDeliveryWindow(raw) {
  if (!raw || typeof raw !== 'object') return { ...LINE_DELIVERY_WINDOW_DEFAULTS };
  return {
    startHour: clampHour(raw.lineDefaultStartHour, LINE_DELIVERY_WINDOW_DEFAULTS.startHour),
    endHour: clampHour(raw.lineDefaultEndHour, LINE_DELIVERY_WINDOW_DEFAULTS.endHour),
  };
}

let activeWindow = { ...LINE_DELIVERY_WINDOW_DEFAULTS };

export function getLineDeliveryWindow() {
  return { ...activeWindow };
}

export function setLineDeliveryWindow(window) {
  activeWindow = normalizeLineDeliveryWindow(window);
}

export function formatLineDeliveryWindowLabel(window = activeWindow) {
  const { startHour, endHour } = window;
  return `${String(startHour).padStart(2, '0')}:00 เมื่อวาน – ${String(endHour).padStart(2, '0')}:00 วันนี้`;
}
