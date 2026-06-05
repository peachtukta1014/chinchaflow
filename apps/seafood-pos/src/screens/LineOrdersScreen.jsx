import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Bell } from 'lucide-react';
import { dateKeyBangkok } from '../lib/date';
import { formatDateThaiShort } from '../lib/date';
import { deliveryDateLabel, orderDeliveryDateKey } from '../lib/lineOrderDate';
import { FS_BASE, formatFirestoreSaveError, fsAuthHeaders } from '../lib/firestoreRest';
import {
  formatLineOrderWeightSummary,
  summarizeLineOrdersWeights,
} from '../lib/lineOrderWeightSummary';
import { lineItemsToCartItems } from '../lib/lineOrderToSale';
import { PRODUCTS } from '../constants';
import { mergeCustomerLists, refreshCustomersMap, subscribeCustomers } from '../services/customerService';
import { findCustomerByLineUserId } from '../services/lineOaCustomerService';
import { fsGetDoc } from '../lib/firestoreRest';
import {
  cancelLineOrder as cancelLineOrderService,
  beginLineOrderDelivery,
  markLineOrderDoneOnly,
  releaseLineOrderDelivery,
  saveLineOrderDelivery,
} from '../services/lineOrderService';
import {
  computeStockAfterSaleDeduction,
  deductStockForSale,
  getEffectiveStock,
  restoreStockForSale,
} from '../services/stockService';
import { LineDeliveryConfirmSheet } from './LineDeliveryConfirmSheet';
import { useLineOrdersFeed } from '../hooks/useLineOrdersFeed';

export default function LineOrdersScreen({ user, stock, stockBatches = [], updateMainStock, onSaleRecorded, onOrderDone }) {
  const { orders, loading } = useLineOrdersFeed(true);
  const [savingId, setSavingId] = useState(null);
  const [deliverySheet, setDeliverySheet] = useState(null);
  const [loadedPrices, setLoadedPrices] = useState({});
  const [fsCustomers, setFsCustomers] = useState({});

  const todayBKK = dateKeyBangkok;

  const allCustomers = useMemo(() => mergeCustomerLists(fsCustomers), [fsCustomers]);

  const priceOf = useCallback(
    (productId) => loadedPrices[productId] ?? PRODUCTS.find((p) => p.id === productId)?.price ?? 0,
    [loadedPrices],
  );

  useEffect(() => subscribeCustomers(setFsCustomers, () => {}), []);

  useEffect(() => {
    fsAuthHeaders().then((h) => fetch(`${FS_BASE}/productSettings/shrimp`, { headers: h }))
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (!j?.fields) return;
        const p = {};
        ['large', 'medium', 'small'].forEach((k) => {
          const v = j.fields[k];
          if (v) p[k] = parseInt(v.integerValue ?? v.doubleValue ?? 0, 10);
        });
        setLoadedPrices(p);
      })
      .catch(() => {});
  }, []);

  const cancelLineOrder = async (order) => {
    if (!order || order.status !== 'pending' || savingId) return;
    const label = order.displayCustomerName || order.customerName
      || (order.rawText ? `"${order.rawText.slice(0, 50)}"` : 'ออเดอร์นี้');
    if (!window.confirm(`ยกเลิกออเดอร์ LINE?\n\n${label}\n\nยังไม่ตัดสต๊อกและยังไม่บันทึกยอดขาย`)) return;

    setSavingId(order.id);
    try {
      await cancelLineOrderService(order.id, user?.name || 'พนักงาน');
      onOrderDone?.();
    } catch (err) {
      console.error(err);
      alert('ยกเลิกไม่สำเร็จ ลองอีกครั้งครับ');
    } finally {
      setSavingId(null);
    }
  };

  const openDeliverySheet = async (order) => {
    if (!order || order.status !== 'pending' || savingId || deliverySheet) return;
    if (order.salesId) {
      const ok = window.confirm(
        'ออเดอร์นี้มีบิลแล้ว\n\nกดตกลง = ปิดสถานะเป็น「ส่งแล้ว」โดยไม่ตัดสต๊อก/ไม่สร้างบิลซ้ำ',
      );
      if (ok) confirmDeliveryLegacyDone(order);
      return;
    }

    try {
      const map = await refreshCustomersMap();
      setFsCustomers(map);
    } catch {
      /* ใช้ cache เดิม */
    }

    const { cartItems, unknownProducts } = lineItemsToCartItems(order.items, priceOf);
    if (cartItems.length === 0) {
      alert(unknownProducts.length
        ? `ไม่รู้จักสินค้า: ${unknownProducts.join(', ')}\nกรุณาบันทึกบิลที่หน้าขายของ`
        : 'ไม่มีรายการสินค้าในออเดอร์นี้');
      return;
    }
    if (unknownProducts.length) {
      const ok = window.confirm(
        `มีบางรายการแปลงไม่ได้: ${unknownProducts.join(', ')}\nบันทึกเฉพาะรายการที่รู้จัก (${cartItems.length} รายการ)?`,
      );
      if (!ok) return;
    }
    setDeliverySheet({ order, cartItems, unknownProducts });
  };

  const confirmDeliveryLegacyDone = async (order) => {
    await markLineOrderDoneOnly(order.id);
    onOrderDone?.();
  };

  const saveDeliverySale = async ({ cartItems, customer, total, liveKg, deadKg }) => {
    const order = deliverySheet?.order;
    if (!order) return;

    setSavingId(order.id);

    let freshOrder;
    try {
      freshOrder = await fsGetDoc(`lineOrders/${order.id}`);
    } catch {
      freshOrder = order;
    }
    if (freshOrder?.status === 'done' && freshOrder?.salesId) {
      alert(`ออเดอร์นี้ส่งแล้ว\nบิล ${freshOrder.billNo || freshOrder.salesId}`);
      setDeliverySheet(null);
      setSavingId(null);
      return;
    }

    const recordedBy = user?.name || 'พนักงาน';
    try {
      await beginLineOrderDelivery(order.id, recordedBy);
    } catch (lockErr) {
      alert(lockErr.message || 'มีคนกำลังบันทึกออเดอร์นี้อยู่');
      setSavingId(null);
      return;
    }

    const avail = getEffectiveStock(stock, stockBatches);
    let stockDeducted = false;
    let postDeduction = null;
    try {
      postDeduction = computeStockAfterSaleDeduction(avail, liveKg, deadKg, stockBatches);
      await deductStockForSale(avail, liveKg, deadKg, updateMainStock, stockBatches);
      stockDeducted = true;

      const { salesId, billNo, recovered } = await saveLineOrderDelivery({
        order,
        cartItems,
        customer,
        total,
        recordedBy,
      });

      setDeliverySheet(null);
      onSaleRecorded?.();
      onOrderDone?.();
      const note = recovered ? '\n(ซิงก์สถานะออเดอร์จากบิลเดิม)' : '';
      alert(`บันทึกยอดขายแล้ว\nบิล ${billNo} · ฿${total.toLocaleString()}${note}`);
    } catch (err) {
      console.error(err);
      if (stockDeducted && postDeduction) {
        try {
          await restoreStockForSale(
            postDeduction.stock,
            liveKg,
            deadKg,
            updateMainStock,
            postDeduction.batches,
          );
        } catch (restoreErr) {
          console.error('restore stock after LINE save failed', restoreErr);
          await releaseLineOrderDelivery(order.id).catch(() => {});
          alert(
            `${formatFirestoreSaveError(err)}\n\n⚠️ คืนสต๊อกอัตโนมัติไม่สำเร็จ — แจ้งแอดมินตรวจยอดคลัง`,
          );
          return;
        }
      }
      await releaseLineOrderDelivery(order.id).catch(() => {});
      alert(formatFirestoreSaveError(err));
    } finally {
      setSavingId(null);
    }
  };

  const today = todayBKK();

  const ordersWithDate = useMemo(
    () => orders.map((o) => {
      const linked = findCustomerByLineUserId(allCustomers, o.lineUserId);
      return {
        ...o,
        effectiveDeliveryDate: orderDeliveryDateKey(o),
        displayCustomerName: linked?.name || o.customerName || null,
      };
    }),
    [orders, allCustomers],
  );

  const isPending = (o) => o.status === 'pending' || o.status === 'delivering';
  const pendingOnly = (o) => isPending(o);
  const overdue = ordersWithDate.filter((o) => pendingOnly(o) && o.effectiveDeliveryDate < today);
  const dueToday = ordersWithDate.filter((o) => pendingOnly(o) && o.effectiveDeliveryDate === today);
  const upcoming = ordersWithDate.filter((o) => pendingOnly(o) && o.effectiveDeliveryDate > today);
  const groupedFuture = upcoming.reduce((acc, o) => {
    const k = o.effectiveDeliveryDate || 'ไม่ระบุ';
    (acc[k] = acc[k] || []).push(o);
    return acc;
  }, {});

  const renderOrderCard = (o) => (
    <div
      key={o.id}
      className={`bg-white rounded-2xl p-4 shadow-sm border transition-all ${o.status === 'done' ? 'border-green-200 opacity-50' : 'border-slate-200'}`}
    >
      <div className="flex justify-between items-start mb-2">
        <div className="flex-1 min-w-0 mr-2">
          {o.displayCustomerName && (
            <p className="text-xs font-bold text-slate-700">{o.displayCustomerName}</p>
          )}
          <p className="text-[10px] font-bold text-blue-700 bg-blue-50 inline-block px-2 py-0.5 rounded-lg mt-0.5">
            ส่ง
            {' '}
            {deliveryDateLabel(o.effectiveDeliveryDate)}
            {' '}
            (
            {formatDateThaiShort(o.effectiveDeliveryDate)}
            )
          </p>
          <p className="text-[11px] text-slate-400 mt-0.5">LINE · {o.lineUserId?.slice(-6) || '—'}</p>
          <p className="text-xs text-slate-500 mt-0.5 truncate italic">&quot;{o.rawText}&quot;</p>
        </div>
        {o.status === 'done' ? (
          <span className="text-xs bg-green-100 text-green-600 font-bold px-2 py-1 rounded-xl shrink-0">
            ✓ ส่งแล้ว{o.billNo ? ` · ${o.billNo}` : ''}
          </span>
        ) : isPending(o) ? (
          <div className="flex flex-col gap-1 shrink-0">
            {o.status === 'delivering' && (
              <span className="text-[10px] text-amber-700 bg-amber-50 px-2 py-0.5 rounded-lg text-center">
                กำลังบันทึก…
              </span>
            )}
            <button
              type="button"
              disabled={savingId === o.id || o.status === 'delivering'}
              onClick={() => openDeliverySheet(o)}
              className="text-xs bg-green-500 text-white font-bold px-3 py-1.5 rounded-xl active:scale-95 disabled:opacity-50"
            >
              {savingId === o.id ? 'กำลังบันทึก...' : 'ส่งเรียบร้อย'}
            </button>
            <button
              type="button"
              disabled={savingId === o.id}
              onClick={() => cancelLineOrder(o)}
              className="text-[10px] font-bold text-red-600 bg-red-50 border border-red-200 px-2 py-1 rounded-lg active:scale-95 disabled:opacity-50"
            >
              ยกเลิก
            </button>
          </div>
        ) : null}
      </div>
      <div className="space-y-1">
        {(o.items || []).map((item, i) => (
          <div key={i} className="flex items-center gap-2 flex-wrap">
            <span className="w-2 h-2 rounded-full bg-blue-400 shrink-0" />
            {item.customerName && item.customerName !== o.displayCustomerName && item.customerName !== o.customerName && (
              <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">{item.customerName}</span>
            )}
            <p className="text-sm font-bold text-slate-700">{item.product}</p>
            <p className="text-sm text-slate-500 ml-auto">{item.qty} {item.unit}</p>
          </div>
        ))}
      </div>
    </div>
  );

  const renderSection = (title, items, accent = '') => {
    if (items.length === 0) return null;
    const pendingCount = items.filter(pendingOnly).length;
    const weightSummary = formatLineOrderWeightSummary(summarizeLineOrdersWeights(items));
    return (
      <div key={title}>
        <p className={`text-xs font-bold mb-2 uppercase tracking-wide flex flex-wrap items-center gap-x-1.5 gap-y-0.5 ${accent || 'text-slate-500'}`}>
          <span>
            {title}
            {' '}
            ·
            {' '}
            {items.length}
            {' '}
            ออเดอร์
          </span>
          {pendingCount > 0 && (
            <>
              <span className="bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full normal-case tracking-normal">
                {pendingCount}
                {' '}
                รอ
              </span>
              <span className="text-[10px] font-medium normal-case tracking-normal text-slate-500">
                {weightSummary}
              </span>
            </>
          )}
        </p>
        <div className="space-y-2">{items.map(renderOrderCard)}</div>
      </div>
    );
  };

  if (loading) return <div className="flex items-center justify-center h-40 text-slate-400 text-sm">กำลังโหลด...</div>;

  if (ordersWithDate.length === 0) return (
    <div className="flex flex-col items-center justify-center h-60 text-slate-300">
      <Bell size={48} strokeWidth={1} className="mb-3" />
      <p className="font-bold text-sm">ยังไม่มีออเดอร์</p>
      <p className="text-xs mt-1 text-center px-4">ออเดอร์จาก LINE จะขึ้นที่นี่</p>
      <p className="text-[10px] mt-2 text-slate-400 text-center px-6 leading-relaxed">
        ไม่ระบุวันส่ง: 18:00 เมื่อวาน–15:00 วันนี้ = ส่งวันนี้ · หลัง 15:00 = พรุ่งนี้
      </p>
    </div>
  );

  return (
    <>
      {deliverySheet && (
        <LineDeliveryConfirmSheet
          order={deliverySheet.order}
          cartItems={deliverySheet.cartItems}
          unknownProducts={deliverySheet.unknownProducts}
          stock={stock}
          stockBatches={stockBatches}
          priceOf={priceOf}
          allCustomers={allCustomers}
          saving={savingId === deliverySheet.order.id}
          onClose={() => !savingId && setDeliverySheet(null)}
          onConfirm={saveDeliverySale}
        />
      )}
    <div className="px-4 pt-4 pb-6 space-y-5">
      {renderSection('⚠️ ค้างส่ง (เลยวันแล้ว)', overdue, 'text-red-600')}
      {renderSection(`🚚 ส่งวันนี้ · ${deliveryDateLabel(today)}`, dueToday, 'text-emerald-700')}
      {Object.entries(groupedFuture).sort().map(([date, items]) => (
        renderSection(
          `📅 ส่ง ${deliveryDateLabel(date)} (${formatDateThaiShort(date)})`,
          items,
        )
      ))}
    </div>
    </>
  );
}
