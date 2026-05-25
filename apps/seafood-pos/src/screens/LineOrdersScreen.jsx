import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Bell } from 'lucide-react';
import { dateKeyBangkok, tomorrowDateKeyBangkok } from '../lib/date';
import { FS_BASE, fsAuthHeaders } from '../lib/firestoreRest';
import { lineItemsToCartItems } from '../lib/lineOrderToSale';
import { PRODUCTS } from '../constants';
import { mergeCustomerLists, subscribeCustomers } from '../services/customerService';
import {
  cancelLineOrder as cancelLineOrderService,
  fetchLineOrdersFromToday,
  markLineOrderDoneOnly,
  saveLineOrderDelivery,
} from '../services/lineOrderService';
import { deductStockForSale } from '../services/stockService';
import { LineDeliveryConfirmSheet } from './LineDeliveryConfirmSheet';

export default function LineOrdersScreen({ user, stock, updateMainStock, onSaleRecorded, onOrderDone }) {
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
    const rows = await fetchLineOrdersFromToday();
    setOrders(rows);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadOrders();
    const t = setInterval(loadOrders, 20000);
    return () => clearInterval(t);
  }, [loadOrders]);

  const cancelLineOrder = async (order) => {
    if (!order || order.status !== 'pending' || savingId) return;
    const label = order.customerName || (order.rawText ? `"${order.rawText.slice(0, 50)}"` : 'ออเดอร์นี้');
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
      const { salesId, billNo } = await saveLineOrderDelivery({
        order,
        cartItems,
        customer,
        total,
        recordedBy: user?.name || 'พนักงาน',
      });

      await deductStockForSale(stock, liveKg, deadKg, updateMainStock);

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

  const today    = todayBKK();
  const tomorrow = tomorrowDateKeyBangkok();
  const dateLabel = (k) => k === today ? 'วันนี้' : k === tomorrow ? 'พรุ่งนี้' : k;

  // Group by deliveryDate — ซ่อนออเดอร์ที่ยกเลิกแล้ว
  const upcoming = orders.filter((o) => (o.deliveryDate || '') >= today && o.status !== 'cancelled');
  const isPending = (o) => o.status === 'pending';
  const grouped  = upcoming.reduce((acc, o) => {
    const k = o.deliveryDate || 'ไม่ระบุ';
    (acc[k] = acc[k] || []).push(o);
    return acc;
  }, {});

  if (loading) return <div className="flex items-center justify-center h-40 text-slate-400 text-sm">กำลังโหลด...</div>;

  if (upcoming.length === 0) return (
    <div className="flex flex-col items-center justify-center h-60 text-slate-300">
      <Bell size={48} strokeWidth={1} className="mb-3" />
      <p className="font-bold text-sm">ยังไม่มีออเดอร์</p>
      <p className="text-xs mt-1 text-center px-4">ออเดอร์จาก LINE จะขึ้นที่นี่</p>
      <p className="text-[10px] mt-2 text-slate-400 text-center px-6 leading-relaxed">
        ตัวอย่าง LINE: &quot;25/5/69&quot; แล้ว &quot;ปุ้ย 2&quot; + &quot;กลาง&quot; · หรือ &quot;กุ้งใหญ่ 2 กก&quot;
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
          priceOf={priceOf}
          allCustomers={allCustomers}
          saving={savingId === deliverySheet.order.id}
          onClose={() => !savingId && setDeliverySheet(null)}
          onConfirm={saveDeliverySale}
        />
      )}
    <div className="px-4 pt-4 pb-6 space-y-5">
      {Object.entries(grouped).sort().map(([date, items]) => (
        <div key={date}>
          <p className="text-xs font-bold text-slate-500 mb-2 uppercase tracking-wide">
            📅 ส่ง{dateLabel(date)} · {items.length} ออเดอร์
            {items.filter(isPending).length > 0 && (
              <span className="ml-2 bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full">
                {items.filter(isPending).length} รอ
              </span>
            )}
          </p>
          <div className="space-y-2">
            {items.map(o => (
              <div key={o.id}
                className={`bg-white rounded-2xl p-4 shadow-sm border transition-all ${o.status === 'done' ? 'border-green-200 opacity-50' : 'border-slate-200'}`}>
                <div className="flex justify-between items-start mb-2">
                  <div className="flex-1 min-w-0 mr-2">
                    {o.customerName && (
                      <p className="text-xs font-bold text-slate-700">{o.customerName}</p>
                    )}
                    <p className="text-[11px] text-slate-400">LINE · {o.lineUserId?.slice(-6) || '—'}</p>
                    <p className="text-xs text-slate-500 mt-0.5 truncate italic">"{o.rawText}"</p>
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
                      {item.customerName && item.customerName !== o.customerName && (
                        <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">{item.customerName}</span>
                      )}
                      <p className="text-sm font-bold text-slate-700">{item.product}</p>
                      <p className="text-sm text-slate-500 ml-auto">{item.qty} {item.unit}</p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
    </>
  );
}
