import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Bell } from 'lucide-react';
import { dateKeyBangkok } from '../lib/date';
import { formatDateThaiShort } from '../lib/date';
import { deliveryDateLabel, orderDeliveryDateKey } from '../lib/lineOrderDate';
import { FS_BASE, fsAuthHeaders } from '../lib/firestoreRest';
import { lineItemsToCartItems } from '../lib/lineOrderToSale';
import { PRODUCTS } from '../constants';
import { mergeCustomerLists, subscribeCustomers } from '../services/customerService';
import { findCustomerByLineUserId } from '../services/lineOaCustomerService';
import {
  cancelLineOrder as cancelLineOrderService,
  fetchLineOrdersForBoard,
  markLineOrderDoneOnly,
  saveLineOrderDelivery,
} from '../services/lineOrderService';
import { deductStockForSale, getEffectiveStock } from '../services/stockService';
import { LineDeliveryConfirmSheet } from './LineDeliveryConfirmSheet';
import { useIntervalWhen } from '../lib/useIntervalWhen';

export default function LineOrdersScreen({ user, stock, stockBatches = [], updateMainStock, onSaleRecorded, onOrderDone }) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
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

  const loadOrders = useCallback(async () => {
    const rows = await fetchLineOrdersForBoard();
    setOrders(rows);
    setLoading(false);
  }, []);

  useIntervalWhen(true, loadOrders, 30000);

  const cancelLineOrder = async (order) => {
    if (!order || order.status !== 'pending' || savingId) return;
    const label = order.displayCustomerName || order.customerName
      || (order.rawText ? `"${order.rawText.slice(0, 50)}"` : 'ออเดอร์นี้');
    if (!window.confirm(`ยกเลิกออเดอร์ LINE?\n\n${label}\n\nยังไม่ตัดสต๊อกและยังไม่บันทึกยอดขาย`)) return;

    setSavingId(order.id);
    try {
      await cancelLineOrderService(order.id, user?.name || 'พนักงาน');
      setOrders((prev) => prev.filter((o) => o.id !== order.id));
      onOrderDone?.();
    } catch (err) {
      console.error(err);
      alert('ยกเลิกไม่สำเร็จ ลองอีกครั้งครับ');
    } finally {
      setSavingId(null);
    }
  };

  const openDeliverySheet = (order) => {
    if (!order || order.status !== 'pending' || savingId || deliverySheet) return;
    if (order.salesId) {
      confirmDeliveryLegacyDone(order);
      return;
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
    setOrders((prev) => prev.map((o) => (o.id === order.id ? { ...o, status: 'done' } : o)));
    onOrderDone?.();
  };

  const saveDeliverySale = async ({ cartItems, customer, total, liveKg, deadKg }) => {
    const order = deliverySheet?.order;
    if (!order) return;

    setSavingId(order.id);
    try {
      const avail = getEffectiveStock(stock, stockBatches);
      await deductStockForSale(avail, liveKg, deadKg, updateMainStock, stockBatches);

      const { salesId, billNo } = await saveLineOrderDelivery({
        order,
        cartItems,
        customer,
        total,
        recordedBy: user?.name || 'พนักงาน',
      });

      setOrders((prev) => prev.map((o) => (o.id === order.id
        ? { ...o, status: 'done', salesId, billNo }
        : o)));
      setDeliverySheet(null);
      onSaleRecorded?.();
      onOrderDone?.();
      alert(`บันทึกยอดขายแล้ว\nบิล ${billNo} · ฿${total.toLocaleString()}`);
    } catch (err) {
      console.error(err);
      alert('บันทึกไม่สำเร็จ กรุณาลองอีกครั้งครับ');
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
        displayCustomerName: o.customerName || linked?.name || null,
      };
    }),
    [orders, allCustomers],
  );

  const isPending = (o) => o.status === 'pending';
  const overdue = ordersWithDate.filter((o) => o.effectiveDeliveryDate < today);
  const dueToday = ordersWithDate.filter((o) => o.effectiveDeliveryDate === today);
  const upcoming = ordersWithDate.filter((o) => o.effectiveDeliveryDate > today);
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
            <button
              type="button"
              disabled={savingId === o.id}
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
    const pendingCount = items.filter(isPending).length;
    return (
      <div key={title}>
        <p className={`text-xs font-bold mb-2 uppercase tracking-wide ${accent || 'text-slate-500'}`}>
          {title}
          {' '}
          ·
          {' '}
          {items.length}
          {' '}
          ออเดอร์
          {pendingCount > 0 && (
            <span className="ml-2 bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full">
              {pendingCount}
              {' '}
              รอ
            </span>
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
