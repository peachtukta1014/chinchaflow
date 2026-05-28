import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import {
  actualQtyOf,
  applyActualToCartItem,
  cartStockKg,
  hasAnyQtyMismatch,
  qtyDiffersFromOrder,
  resolveLineCustomer,
} from '../lib/lineOrderToSale';
import { getEffectiveStock } from '../services/stockService';

export function LineDeliveryConfirmSheet({
  order,
  cartItems: initialCart,
  unknownProducts,
  stock,
  stockBatches = [],
  priceOf,
  allCustomers,
  saving,
  onClose,
  onConfirm,
}) {
  const [lines, setLines] = useState(initialCart);
  const [draftQty, setDraftQty] = useState({});
  const [ackMismatch, setAckMismatch] = useState(false);

  useEffect(() => {
    setLines(initialCart);
    setDraftQty({});
    setAckMismatch(false);
  }, [initialCart, order?.id]);

  const customer = resolveLineCustomer(order.customerName, allCustomers, order.lineUserId);
  const avail = getEffectiveStock(stock, stockBatches);
  const { liveKg, deadKg, total } = cartStockKg(lines);
  const mismatch = hasAnyQtyMismatch(lines);

  const displayQty = (row) => (
    draftQty[row.lineKey] !== undefined ? draftQty[row.lineKey] : String(actualQtyOf(row))
  );

  const setActual = (lineKey, raw) => {
    setDraftQty((prev) => ({ ...prev, [lineKey]: raw }));
    const n = parseFloat(raw);
    if (!Number.isFinite(n)) return;
    setLines((prev) => prev.map((row) => (
      row.lineKey === lineKey ? applyActualToCartItem(row, raw, priceOf) : row
    )));
    setAckMismatch(false);
  };

  const handleConfirm = () => {
    const invalid = lines.some((row) => {
      const a = actualQtyOf(row);
      return !Number.isFinite(a) || a <= 0;
    });
    if (invalid) {
      alert('กรุณาใส่น้ำหนัก/ยอดส่งจริงทุกรายการ (มากกว่า 0)');
      return;
    }
    if (mismatch && !ackMismatch) {
      alert('น้ำหนักส่งจริงไม่ตรงกับที่สั่ง — กรุณาติ๊กยืนยันด้านล่างก่อนบันทึก');
      return;
    }
    if (liveKg > avail.live) {
      alert(`กุ้งเป็นในสต๊อกมีแค่ ${avail.live} กก.\nขายเกินสต๊อกไม่ได้ครับ`);
      return;
    }
    if (deadKg > avail.dead) {
      alert(`กุ้งตายในสต๊อกมีแค่ ${avail.dead} กก.\nขายเกินสต๊อกไม่ได้ครับ`);
      return;
    }
    onConfirm({ cartItems: lines, customer, total, liveKg, deadKg });
  };

  return (
    <div className="fixed inset-0 z-[60] flex flex-col justify-end bg-black/50" role="dialog" aria-modal="true">
      <div className="bg-white rounded-t-3xl max-h-[88vh] flex flex-col shadow-2xl">
        <div className="px-4 pt-4 pb-2 border-b border-slate-100 shrink-0">
          <div className="flex justify-between items-start gap-2">
            <div className="min-w-0">
              <p className="text-sm font-black text-slate-800">ยืนยันน้ำหนักส่งจริง</p>
              <p className="text-xs text-slate-500 mt-0.5 truncate">{customer.name}</p>
              {order.rawText && (
                <p className="text-[10px] text-slate-400 mt-1 italic truncate">&quot;{order.rawText}&quot;</p>
              )}
            </div>
            <button type="button" onClick={onClose} className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center shrink-0">
              <X size={18} className="text-slate-500" />
            </button>
          </div>
          {unknownProducts.length > 0 && (
            <p className="text-[10px] text-amber-700 bg-amber-50 rounded-lg px-2 py-1 mt-2">
              ข้ามรายการที่แปลงไม่ได้: {unknownProducts.join(', ')}
            </p>
          )}
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
          <p className="text-[11px] text-slate-500 leading-relaxed">
            ชั่ง/นับน้ำหนักจริงก่อนบันทึก — ถ้าไม่ตรงกับที่สั่งใน LINE ให้แก้ช่อง &quot;ส่งจริง&quot;
          </p>
          {lines.map((row) => {
            const soldByBaht = row.type === 'dead' && row.orderedUnit === 'บาท';
            const unitLabel = soldByBaht ? 'บาท' : 'กก.';
            const actual = actualQtyOf(row);
            const differs = qtyDiffersFromOrder(row, actual) && Number.isFinite(actual);
            return (
              <div
                key={row.lineKey}
                className={`rounded-2xl border p-3 ${differs ? 'border-amber-300 bg-amber-50/50' : 'border-slate-200 bg-slate-50'}`}
              >
                <p className="text-sm font-bold text-slate-800">{row.productName}</p>
                <div className="flex items-center gap-2 mt-2 text-xs">
                  <span className="text-slate-500 shrink-0">สั่งมา</span>
                  <span className="font-bold text-slate-600">
                    {row.orderedQty} {row.orderedUnit || unitLabel}
                  </span>
                  {differs && (
                    <span className="text-[10px] font-bold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded ml-auto">
                      ไม่ตรง
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-xs font-bold text-green-700 shrink-0">ส่งจริง</span>
                  <input
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    min="0"
                    value={displayQty(row)}
                    onChange={(e) => setActual(row.lineKey, e.target.value)}
                    className="flex-1 bg-white border-2 border-green-200 rounded-xl px-3 py-2 text-lg font-black text-slate-800 text-center"
                  />
                  <span className="text-xs text-slate-500 w-8 shrink-0">{unitLabel}</span>
                </div>
                {!soldByBaht && row.type !== 'dead' && (
                  <p className="text-[10px] text-slate-400 mt-1 text-right">
                    ฿{(row.total || 0).toLocaleString()} @ {row.pricePerKg}/กก.
                  </p>
                )}
                {soldByBaht && (
                  <p className="text-[10px] text-slate-400 mt-1 text-right">
                    ยอดเหมา ฿{(row.total || 0).toLocaleString()}
                  </p>
                )}
              </div>
            );
          })}
        </div>

        <div className="px-4 pb-6 pt-2 border-t border-slate-100 shrink-0 space-y-3"
          style={{ paddingBottom: 'max(1.25rem, env(safe-area-inset-bottom))' }}>
          <div className="flex justify-between text-sm">
            <span className="text-slate-500">ยอดรวม</span>
            <span className="font-black text-lg text-slate-800">฿{total.toLocaleString()}</span>
          </div>
          <p className="text-[10px] text-slate-400 text-center">
            ตัดสต๊อก เป็น {liveKg} กก. · ตาย {deadKg} กก.
          </p>
          {mismatch && (
            <label className="flex items-start gap-2 text-xs text-amber-800 bg-amber-50 rounded-xl p-3 cursor-pointer">
              <input
                type="checkbox"
                checked={ackMismatch}
                onChange={(e) => setAckMismatch(e.target.checked)}
                className="mt-0.5 shrink-0"
              />
              <span>ยืนยันแล้วว่าน้ำหนักส่งจริงถูกต้อง (ต่างจากที่สั่งใน LINE)</span>
            </label>
          )}
          <button
            type="button"
            disabled={saving}
            onClick={handleConfirm}
            className="w-full bg-green-600 text-white font-bold py-3.5 rounded-2xl active:scale-[0.98] disabled:opacity-50"
          >
            {saving ? 'กำลังบันทึก...' : 'บันทึกยอดขาย'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── LINE Orders Screen ───────────────────────────────────────────────────────
