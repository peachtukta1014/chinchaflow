import { BILL_QR_URL, getBillTemplateUrl, MEMBER_DISCOUNT_RATE } from './billTemplateConfig';
import { formatDateThaiShort, shiftDateKey } from './date';

const REF_W = 2683;
const VALUE_COLOR = '#b91c1c';
const FONT = '"Sarabun", "Noto Sans Thai", system-ui, sans-serif';

const LAYOUT = {
  billNo: { x: 0.58, y: 0.276, size: 44, weight: '700' },
  date: { x: 0.58, y: 0.300, size: 36 },
  time: { x: 0.78, y: 0.300, size: 36 },
  customer: { x: 0.18, y: 0.332, size: 36, weight: '700' },
  delivery: { x: 0.58, y: 0.332, size: 36 },
  address: { x: 0.18, y: 0.355, size: 32 },
  phone: { x: 0.58, y: 0.355, size: 34 },
  rowStart: 0.403,
  rowHeight: 0.0262,
  colName: 0.09,
  colQty: 0.54,
  colPrice: 0.69,
  colAmount: 0.81,
  subtotalY: 0.866,
  memberY: 0.890,
  deductY: 0.914,
  netY: 0.942,
  amountX: 0.90,
  qr: { x: 0.055, y: 0.198, w: 0.21, h: 0.082 },
};

const MAX_ROWS = 14;

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`โหลดรูปไม่ได้: ${src}`));
    img.src = src;
  });
}

function scale(size, canvasW) {
  return Math.round(size * (canvasW / REF_W));
}

function drawText(ctx, text, x, y, opts = {}) {
  const { size = 32, weight = '600', color = VALUE_COLOR, align = 'left' } = opts;
  const px = scale(size, ctx.canvas.width);
  ctx.fillStyle = color;
  ctx.font = `${weight} ${px}px ${FONT}`;
  ctx.textAlign = align;
  ctx.textBaseline = 'top';
  ctx.fillText(String(text ?? ''), x, y);
}

function formatMoney(n) {
  return (parseFloat(n) || 0).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatTimeLabel(ts) {
  const m = String(ts || '').match(/(\d{1,2}):(\d{2})/);
  return m ? `${m[1].padStart(2, '0')}.${m[2]}` : '';
}

function itemRow(item) {
  if (item.type === 'dead') {
    return { name: item.productName, qty: '', price: '', amount: formatMoney(item.total) };
  }
  const name = item.note ? `${item.productName} ${item.note}` : item.productName;
  return {
    name,
    qty: item.weight != null ? String(item.weight) : '',
    price: item.pricePerKg != null ? String(item.pricePerKg) : '',
    amount: formatMoney(item.total),
  };
}

export async function generateBillImage(bill, customer = {}) {
  const templateUrl = getBillTemplateUrl(bill.paymentType, bill.remainingAmount);
  const [bg, qr] = await Promise.all([
    loadImage(templateUrl),
    loadImage(BILL_QR_URL).catch(() => null),
  ]);

  const canvas = document.createElement('canvas');
  canvas.width = bg.width;
  canvas.height = bg.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas ไม่พร้อม');

  const W = canvas.width;
  const H = canvas.height;
  ctx.drawImage(bg, 0, 0);

  const q = LAYOUT.qr;
  const qx = q.x * W;
  const qy = q.y * H;
  const qw = q.w * W;
  const qh = q.h * H;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(qx - 4, qy - 4, qw + 8, qh + 8);
  if (qr) ctx.drawImage(qr, qx, qy, qw, qh);

  const dateKey = bill.dateKey || '';
  const deliveryKey = bill.deliveryDateKey || shiftDateKey(dateKey, 1);
  const subtotal = parseFloat(bill.total) || 0;
  const memberOff = subtotal * MEMBER_DISCOUNT_RATE;
  const net = subtotal - memberOff;

  const place = (layoutKey, text) => {
    const L = LAYOUT[layoutKey];
    drawText(ctx, text, L.x * W, L.y * H, {
      size: L.size,
      weight: L.weight || '600',
    });
  };

  place('billNo', bill.billNo || '');
  place('date', formatDateThaiShort(dateKey));
  place('time', formatTimeLabel(bill.timestamp));
  place('customer', bill.customerName || '');
  place('delivery', formatDateThaiShort(deliveryKey));
  place('address', customer.zone || bill.zone || '');
  place('phone', customer.phone || '');

  (bill.items || []).slice(0, MAX_ROWS).forEach((item, i) => {
    const row = itemRow(item);
    const y = (LAYOUT.rowStart + i * LAYOUT.rowHeight) * H;
    drawText(ctx, row.name, LAYOUT.colName * W, y, { size: 30 });
    drawText(ctx, row.qty, LAYOUT.colQty * W, y, { size: 30 });
    drawText(ctx, row.price, LAYOUT.colPrice * W, y, { size: 30 });
    drawText(ctx, row.amount, LAYOUT.colAmount * W, y, { size: 30, align: 'right' });
  });

  const ax = LAYOUT.amountX * W;
  drawText(ctx, formatMoney(subtotal), ax, LAYOUT.subtotalY * H, { size: 34, align: 'right' });
  drawText(ctx, formatMoney(memberOff), ax, LAYOUT.memberY * H, { size: 34, align: 'right' });
  drawText(ctx, formatMoney(memberOff), ax, LAYOUT.deductY * H, { size: 34, align: 'right' });
  drawText(ctx, formatMoney(net), ax, LAYOUT.netY * H, { size: 40, weight: '700', align: 'right' });

  const blob = await new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('สร้างภาพไม่สำเร็จ'))),
      'image/jpeg',
      0.88,
    );
  });

  return { blob, objectUrl: URL.createObjectURL(blob) };
}

export function revokeBillImageUrl(objectUrl) {
  if (objectUrl) URL.revokeObjectURL(objectUrl);
}

export function downloadBillImageBlob(blob, billNo = 'bill') {
  const safe = String(billNo).replace(/[^\w.-]+/g, '_');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${safe}.jpg`;
  a.click();
  URL.revokeObjectURL(a.href);
}
