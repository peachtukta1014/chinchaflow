import React, { useEffect, useMemo, useState } from 'react';
import { X } from 'lucide-react';
import {
  actualQtyOf,
  applyActualToCartItem,
  applyPriceToCartItem,
  applySizeToCartItem,
  cartStockKg,
  hasAnyQtyMismatch,
  lineCustomerNeedsManualPick,
  LIVE_PRODUCTS,
  qtyDiffersFromOrder,
  resolveLineCustomer,
  suggestCustomersForLineName,
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
  const [draftPrice, setDraftPrice] = useState({});
  const [ackMismatch, setAckMismatch] = useState(false);
  const [selectedCustomerId, setSelectedCustomerId] = useState('');

  const autoCustomer = useMemo(
    () => resolveLineCustomer(
      order.customerName,
      allCustomers,
      order.lineUserId,
      order.lineGroupId,
    ),
    [order.customerName, order.lineUserId, order.lineGroupId, allCustomers],
  );

  const suggestions = useMemo(
    () => suggestCustomersForLineName(order.customerName, allCustomers),
    [order.customerName, allCustomers],
  );

  useEffect(() => {
    setLines(initialCart);
    setDraftQty({});
    setDraftPrice({});
    setAckMismatch(false);
    const initialId = lineCustomerNeedsManualPick(autoCustomer) && suggestions[0]
      ? suggestions[0].customer.id
      : autoCustomer.id;
    setSelectedCustomerId(initialId || autoCustomer.id || '');
  }, [initialCart, order?.id, autoCustomer.id, suggestions]);

  const customer = useMemo(() => {
    const hit = allCustomers.find((c) => c.id === selectedCustomerId);
    if (hit) return hit;
    return autoCustomer;
  }, [allCustomers, selectedCustomerId, autoCustomer]);

  const needsPick = lineCustomerNeedsManualPick(customer)
    || (suggestions.length > 1 && lineCustomerNeedsManualPick(autoCustomer));
  const avail = getEffectiveStock(stock, stockBatches);
  const { liveKg, deadKg, total } = cartStockKg(lines);
  const mismatch = hasAnyQtyMismatch(lines);

  const displayQty = (row) => (
    draftQty[row.lineKey] !== undefined ? draftQty[row.lineKey] : String(actualQtyOf(row))
  );

  const displayPrice = (row) => (
    draftPrice[row.lineKey] !== undefined ? draftPrice[row.lineKey] : String(row.pricePerKg ?? '')
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

  const setPricePerKg = (lineKey, raw) => {
    setDraftPrice((prev) => ({ ...prev, [lineKey]: raw }));
    const n = parseInt(raw, 10);
    if (!Number.isFinite(n)) return;
    setLines((prev) => prev.map((row) => (
      row.lineKey === lineKey ? applyPriceToCartItem(row, raw) : row
    )));
  };

  const changeSize = (lineKey, productId) => {
    setLines((prev) => prev.map((row) => {
      if (row.lineKey !== lineKey) return row;
      const updated = applySizeToCartItem(row, productId, priceOf);
      setDraftPrice((dp) => ({ ...dp, [lineKey]: String(updated.pricePerKg) }));
      return updated;
    }));
  };

  const handleConfirm = () => {
    if (lineCustomerNeedsManualPick(customer)) {
      alert('กรุณาเลือกลูกค้าในรายชื่อก่อนบันทึก\n(ถ้าไม่เลือก ยอดจะไปลูกหนี้คนละก้อนกับเดิม)');
      return;
    }
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
      <div className="bg-white rounded-t-3xl max-h-[92vh] flex flex-col shadow-2xl">
        <div className="px-4 pt-4 pb-2 border-b border-slate-100 shrink-0">
          <div className="flex justify-between items-start gap-2">
            <div className="min-w-0">
              <p className="text-sm font-black text-slate-800">ยืนยันน้ำหนักและราคาส่งจริง</p>
              <p className="text-xs text-slate-500 mt-0.5 truncate">
                {order.customerName && order.customerName !== customer.name
                  ? `LINE: "${order.customerName}" → ${customer.name}`
                  : customer.name}
              </p>
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
          {(needsPick || order.lineGroupId) && (
            <div className={`mt-2 rounded-xl p-2.5 border ${needsPick ? 'border-amber-300 bg-amber-50' : 'border-slate-200 bg-slate-50'}`}>
              <label className="text-[10px] font-bold text-slate-600 block mb-1">
                ลูกค้าในระบบ (ยอดไปลูกหนี้รายนี้)
              </label>
              <select
                value={selectedCustomerId}
                onChange={(e) => setSelectedCustomerId(e.target.value)}
                className="w-full text-sm font-bold border-2 border-slate-200 rounded-xl px-3 py-2 bg-white"
              >
                <option value="general" disabled={!needsPick}>
                  — เลือกลูกค้า —
                </option>
                {suggestions.length > 0 && (
                  <optgroup label="แนะนำจากชื่อใน LINE">
                    {suggestions.map(({ customer: c, reason }) => (
                      <option key={`s-${c.id}`} value={c.id}>
                        {c.name} ({reason})
                      </option>
                    ))}
                  </optgroup>
                )}
                {[...new Map(allCustomers.filter((c) => c.id !== 'general').map((c) => [c.id, c])).values()]
                  .sort((a, b) => (a.zone || '').localeCompare(b.zone || '') || a.name.localeCompare(b.name, 'th'))
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.zone ? `${c.zone} · ` : ''}{c.name}
                    </option>
                  ))}
              </select>
              {needsPick && (
                <p className="text-[10px] text-amber-800 mt-1.5 leading-snug">
                  ชื่อในกลุ่ม LINE ไม่ตรงรายชื่อ — เลือกร้านที่ถูกก่อนกดบันทึก มิฉะนั้นจะสร้างลูกหนี้ใหม่แยกจากยอดค้างเดิม
                </p>
              )}
              {order.lineGroupId && !needsPick && (
                <p className="text-[10px] text-slate-500 mt-1">
                  ออเดอร์จากกลุ่ม LINE — ตรวจชื่อลูกค้าอีกครั้งก่อนบันทึก
                </p>
              )}
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
          <p className="text-[11px] text-slate-500 leading-relaxed">
            ชั่ง/นับน้ำหนักจริงก่อนบันทึก — แก้ไซซ์ ราคา หรือน้ำหนักได้ถ้าต่างจากที่สั่ง
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

                {/* ── ไซซ์กุ้ง (live เท่านั้น) ── */}
                {row.type === 'live' && (
                  <div className="flex gap-1.5 mt-2">
                    {LIVE_PRODUCTS.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => changeSize(row.lineKey, p.id)}
                        className={`flex-1 py-1 rounded-xl text-xs font-bold border transition-colors ${
                          row.productId === p.id
                            ? 'bg-blue-600 text-white border-blue-600'
                            : 'bg-white text-slate-500 border-slate-200 active:bg-slate-100'
                        }`}
                      >
                        {p.id === 'large' ? 'ใหญ่' : p.id === 'medium' ? 'กลาง' : 'เล็ก'}
                      </button>
                    ))}
                  </div>
                )}

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

                {/* ── น้ำหนัก/ยอดส่งจริง ── */}
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

                {/* ── ราคา/กก. (live เท่านั้น) ── */}
                {row.type === 'live' && (
                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-xs font-bold text-orange-600 shrink-0">ราคา</span>
                    <input
                      type="number"
                      inputMode="numeric"
                      step="1"
                      min="0"
                      value={displayPrice(row)}
                      onChange={(e) => setPricePerKg(row.lineKey, e.target.value)}
                      className="flex-1 bg-white border-2 border-orange-200 rounded-xl px-3 py-2 text-base font-black text-slate-800 text-center"
                    />
                    <span className="text-xs text-slate-500 shrink-0">฿/กก.</span>
                  </div>
                )}

                {row.type === 'live' && (
                  <p className="text-[10px] text-slate-400 mt-1.5 text-right font-medium">
                    ยอด ฿{(row.total || 0).toLocaleString()}
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
