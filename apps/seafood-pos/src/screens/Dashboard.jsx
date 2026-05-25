import React, { useCallback, useEffect, useState } from 'react';
import { collection, limit, onSnapshot, orderBy, query, where } from 'firebase/firestore';
import { db } from '../firebase';
import { dateKeyBangkok } from '../lib/date';
import { fsQuerySales, fsQueryStockBatches } from '../lib/firestoreRest';
import {
  aggregateDailySales,
  billAmount,
  billMatchesDateKey,
  mergeSalesDocs,
} from '../lib/salesAggregate';
import { PAY } from '../constants';

function formatBatchPurchaseDate(value) {
  if (!value) return '—';
  if (typeof value?.toDate === 'function') {
    return value.toDate().toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' });
  }
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' });
}

export default function Dashboard({ stock, localBills = [], refreshKey = 0, stockRefreshKey = 0, active = true }) {
  const [dashTab, setDashTab] = useState('today');
  const [firestoreSales, setFirestoreSales] = useState([]);
  const [customerDebts, setCustomerDebts] = useState([]);
  const [stockBatches, setStockBatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [salesLoadError, setSalesLoadError] = useState(false);
  const [salesRetry, setSalesRetry] = useState(0);
  const todayKey = dateKeyBangkok();

  const loadSalesRest = useCallback(async () => {
    if (!import.meta.env.VITE_FIREBASE_PROJECT_ID) {
      setLoading(false);
      return;
    }
    try {
      const docs = await fsQuerySales(todayKey);
      setFirestoreSales(docs);
      setSalesLoadError(false);
    } catch (e) {
      console.warn('fsQuerySales', e);
      setSalesLoadError(true);
    } finally {
      setLoading(false);
    }
  }, [todayKey, refreshKey, salesRetry]);

  useEffect(() => {
    if (!active) return undefined;
    setLoading(true);
    loadSalesRest();
    const iv = setInterval(loadSalesRest, 25000);
    return () => clearInterval(iv);
  }, [loadSalesRest, active]);

  useEffect(() => {
    if (!db || !active) return undefined;
    const salesQ = query(collection(db, 'sales'), where('dateKey', '==', todayKey));
    return onSnapshot(
      salesQ,
      (snap) => {
        const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setFirestoreSales((prev) => (docs.length > 0 ? mergeSalesDocs(docs, prev) : prev));
        setSalesLoadError(false);
        setLoading(false);
      },
      () => {
        setSalesLoadError(true);
        setLoading(false);
        if (salesRetry < 3) {
          setTimeout(() => setSalesRetry((c) => c + 1), 5000);
        }
      },
    );
  }, [todayKey, refreshKey, salesRetry, active]);

  const loadStockBatches = useCallback(async () => {
    if (!import.meta.env.VITE_FIREBASE_PROJECT_ID) return;
    try {
      const rows = await fsQueryStockBatches(30);
      setStockBatches(rows);
    } catch (e) {
      console.warn('fsQueryStockBatches', e);
    }
  }, []);

  useEffect(() => {
    if (!db) { return undefined; }
    const unsubs = [];

    unsubs.push(onSnapshot(collection(db, 'customerDebts'), snap => {
      setCustomerDebts(snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(d => (d.totalDebt || 0) > 0));
    }, () => {}));

    const batchQ = query(collection(db, 'stockBatches'), orderBy('purchaseDate', 'desc'), limit(30));
    unsubs.push(onSnapshot(batchQ, snap => {
      setStockBatches(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, () => {
      loadStockBatches();
    }));

    return () => { unsubs.forEach(u => u()); };
  }, [loadStockBatches]);

  useEffect(() => {
    if (!active) return undefined;
    loadStockBatches();
    const iv = setInterval(loadStockBatches, 20000);
    return () => clearInterval(iv);
  }, [active, stockRefreshKey, loadStockBatches]);

  const displayStock = (() => {
    const live = Number(stock?.live) || 0;
    const dead = Number(stock?.dead) || 0;
    if (live > 0 || dead > 0) return { live, dead };
    return stockBatches.reduce((acc, b) => ({
      live: acc.live + (parseFloat(b.remainingLiveKg ?? b.liveKg) || 0),
      dead: acc.dead + (parseFloat(b.remainingDeadKg ?? b.deadKg) || 0),
    }), { live: 0, dead: 0 });
  })();

  const localToday = localBills.filter((b) => billMatchesDateKey(b, todayKey));
  const todaySales = mergeSalesDocs(firestoreSales, localToday);
  const salesSummary = aggregateDailySales(todaySales);

  const todayTotal  = salesSummary.revenueTotal;
  const todayCash   = todaySales.filter(s => s.paymentType === 'cash').reduce((s, t) => s + t.total, 0);
  const todayTransfer = todaySales.filter(s => s.paymentType === 'transfer').reduce((s, t) => s + t.total, 0);
  const todayCredit = todaySales.filter(s => s.paymentType === 'credit').reduce((s, t) => s + t.total, 0);
  const todayInstall = todaySales.filter(s => s.paymentType === 'installment').reduce((s, t) => s + t.total, 0);
  const totalDebt   = customerDebts.reduce((s, c) => s + (c.totalDebt || 0), 0);

  const payBreakdown = [
    { ...PAY[0], amount: todayCash,     count: todaySales.filter(s => s.paymentType === 'cash').length },
    { ...PAY[1], amount: todayTransfer, count: todaySales.filter(s => s.paymentType === 'transfer').length },
    { ...PAY[2], amount: todayCredit,   count: todaySales.filter(s => s.paymentType === 'credit').length },
    { ...PAY[3], amount: todayInstall,  count: todaySales.filter(s => s.paymentType === 'installment').length },
  ];

  return (
    <div className="p-5 space-y-5">
      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-[2rem] p-5 text-white col-span-2">
          <p className="text-slate-400 text-xs font-bold mb-1">ยอดขายวันนี้</p>
          <p className="text-4xl font-black">฿{todayTotal.toLocaleString()}</p>
          <p className="text-slate-400 text-xs mt-1">{todaySales.length} บิล{loading && ' · กำลังโหลด...'}</p>
        </div>
        <div className="bg-gradient-to-br from-blue-500 to-blue-700 rounded-[2rem] p-5 text-white">
          <p className="text-blue-200 text-xs font-bold mb-1">กุ้งเป็น</p>
          <p className="text-2xl font-black">{displayStock.live.toFixed(1)}<span className="text-sm font-normal"> กก.</span></p>
        </div>
        <div className="bg-gradient-to-br from-red-400 to-orange-500 rounded-[2rem] p-5 text-white">
          <p className="text-red-100 text-xs font-bold mb-1">กุ้งตาย</p>
          <p className="text-2xl font-black">{displayStock.dead.toFixed(1)}<span className="text-sm font-normal"> กก.</span></p>
        </div>
        <div className="bg-gradient-to-br from-orange-400 to-amber-500 rounded-[2rem] p-5 text-white col-span-2">
          <p className="text-orange-100 text-xs font-bold mb-1">ลูกหนี้รวม (AR)</p>
          <p className="text-3xl font-black">฿{totalDebt.toLocaleString()}</p>
          <p className="text-orange-100 text-xs mt-1">{customerDebts.length} ราย</p>
        </div>
      </div>

      {/* Sub-tabs */}
      <div className="flex bg-slate-200 p-1 rounded-2xl gap-1">
        {[['today', 'วันนี้'], ['debts', 'ลูกหนี้'], ['fifo', 'สต๊อก FIFO']].map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setDashTab(id)}
            className={`flex-1 min-w-0 py-2.5 font-bold text-xs rounded-xl transition-all ${
              dashTab === id ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Today tab */}
      {dashTab === 'today' && (
        <>
          <div className="bg-white p-5 rounded-[2rem] shadow-sm">
            <h3 className="font-bold text-slate-800 mb-3">น้ำหนักขายวันนี้ (กุ้งเป็น)</h3>
            <div className="grid grid-cols-4 gap-2 text-center text-xs">
              {[['large', 'A'], ['medium', 'B'], ['small', 'C']].map(([id, label]) => (
                <div key={id} className="bg-blue-50 rounded-xl p-2">
                  <p className="text-slate-500 font-bold">{label}</p>
                  <p className="font-black text-blue-700 text-sm">{(salesSummary.gradeKg[id] || 0).toFixed(1)}</p>
                  <p className="text-[10px] text-slate-400">กก.</p>
                </div>
              ))}
              <div className="bg-slate-100 rounded-xl p-2">
                <p className="text-slate-500 font-bold">รวม</p>
                <p className="font-black text-slate-800 text-sm">{salesSummary.gradeTotalKg.toFixed(1)}</p>
                <p className="text-[10px] text-slate-400">กก.</p>
              </div>
            </div>
            <div className="mt-3 pt-3 border-t border-slate-100 grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-slate-500 text-xs">ยอดขายกุ้งเป็น</p>
                <p className="font-black text-emerald-600">฿{salesSummary.liveRevenue.toLocaleString()}</p>
                <p className="text-[10px] text-slate-400">{salesSummary.liveKg.toFixed(1)} กก.</p>
              </div>
              <div>
                <p className="text-slate-500 text-xs">ยอดขายกุ้งตาย</p>
                <p className="font-black text-orange-600">฿{salesSummary.deadRevenue.toLocaleString()}</p>
                <p className="text-[10px] text-slate-400">{salesSummary.deadKg.toFixed(1)} กก.</p>
              </div>
            </div>
          </div>
          <div className="bg-white p-5 rounded-[2rem] shadow-sm">
            <h3 className="font-bold text-slate-800 mb-4">แยกตามการชำระ</h3>
            {payBreakdown.map(pt => (
              <div key={pt.id} className="mb-3 last:mb-0">
                <div className="flex justify-between text-sm mb-1.5">
                  <span className="font-bold text-slate-700">{pt.label} ({pt.count} บิล)</span>
                  <span className="font-black text-slate-800">฿{pt.amount.toLocaleString()}</span>
                </div>
                <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
                  <div className={`h-full ${pt.cls} rounded-full transition-all duration-500`}
                    style={{ width: todayTotal > 0 ? `${Math.max(2, pt.amount / todayTotal * 100).toFixed(1)}%` : '0%' }} />
                </div>
              </div>
            ))}
          </div>

          <div className="bg-white p-5 rounded-[2rem] shadow-sm">
            <h3 className="font-bold text-slate-800 mb-4">บิลล่าสุดวันนี้</h3>
            {todaySales.length === 0
              ? <p className="text-center text-slate-400 py-6">ยังไม่มีรายการวันนี้</p>
              : (
                <div className="space-y-3">
                  {todaySales.slice(0, 15).map((tx, i) => {
                    const pt = PAY.find(p => p.id === tx.paymentType);
                    return (
                      <div key={tx.id || i} className="flex justify-between items-start border-b border-slate-100 pb-3">
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-sm text-slate-700 truncate">{tx.customerName}</p>
                          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                            <span className={`text-[10px] font-bold text-white px-2 py-0.5 rounded-full shrink-0 ${pt?.cls || 'bg-slate-400'}`}>
                              {pt?.label || tx.paymentType}
                            </span>
                            {(tx.remainingAmount || 0) > 0 && (
                              <span className="text-[10px] text-orange-500 font-bold">
                                ค้าง ฿{tx.remainingAmount.toLocaleString()}
                              </span>
                            )}
                          </div>
                        </div>
                        <p className="font-black text-emerald-600 ml-2 shrink-0">฿{billAmount(tx).toLocaleString()}</p>
                      </div>
                    );
                  })}
                </div>
              )}
          </div>
        </>
      )}

      {/* Debts (AR) tab */}
      {dashTab === 'debts' && (
        <div className="bg-white p-5 rounded-[2rem] shadow-sm">
          <h3 className="font-bold text-slate-800 mb-1">ลูกหนี้ทั้งหมด</h3>
          <p className="text-sm text-slate-500 mb-5">รวม ฿{totalDebt.toLocaleString()} ({customerDebts.length} ราย)</p>
          {customerDebts.length === 0
            ? <p className="text-center text-emerald-500 font-bold py-8">ไม่มีลูกหนี้ 🎉</p>
            : (
              <div className="space-y-3">
                {[...customerDebts].sort((a, b) => (b.totalDebt || 0) - (a.totalDebt || 0)).map(c => (
                  <div key={c.id} className="flex justify-between items-center border-b border-slate-100 pb-3">
                    <div>
                      <p className="font-bold text-slate-800">{c.customerName}</p>
                      <p className="text-xs text-slate-400">{c.zone} • บิล {c.lastBillNo || '—'}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-black text-orange-500 text-lg">฿{(c.totalDebt || 0).toLocaleString()}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
        </div>
      )}

      {/* FIFO Stock tab */}
      {dashTab === 'fifo' && (
        <div className="space-y-4">
          {stockBatches.length === 0
            ? (
              <div className="bg-white p-8 rounded-[2rem] shadow-sm text-center text-slate-400">
                <p className="font-bold">ยังไม่มีข้อมูล FIFO</p>
                <p className="text-xs mt-1">รับกุ้งเข้าเพื่อสร้างล็อตแรก</p>
              </div>
            )
            : stockBatches.map((b, i) => (
              <div key={b.id}
                className={`bg-white p-5 rounded-[2rem] shadow-sm border-l-4 ${i === stockBatches.length - 1 ? 'border-amber-400' : 'border-blue-400'}`}>
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <p className="font-black text-slate-800 text-sm">
                      {i === stockBatches.length - 1 ? '🟡 ล็อตเก่าสุด (ขายออกก่อน)' : i === 0 ? '🔵 ล็อตล่าสุด' : `ล็อต #${stockBatches.length - i}`}
                    </p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {formatBatchPurchaseDate(b.purchaseDate)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-black text-blue-600 text-lg">฿{(b.effectiveCostPerKg || 0).toFixed(2)}/กก.</p>
                    <p className="text-xs text-slate-400">ต้นทุน ฿{(b.totalCost || 0).toLocaleString()}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-blue-50 rounded-2xl p-3 text-center">
                    <p className="text-[10px] text-blue-500 font-bold">กุ้งสด</p>
                    <p className="font-black text-blue-700 text-lg">
                      {(parseFloat(b.remainingLiveKg ?? b.liveKg) || 0).toFixed(1)}
                      <span className="text-xs font-normal"> กก.</span>
                    </p>
                  </div>
                  <div className="bg-red-50 rounded-2xl p-3 text-center">
                    <p className="text-[10px] text-red-500 font-bold">กุ้งตาย</p>
                    <p className="font-black text-red-700 text-lg">
                      {(parseFloat(b.remainingDeadKg ?? b.deadKg) || 0).toFixed(1)}
                      <span className="text-xs font-normal"> กก.</span>
                    </p>
                  </div>
                </div>
                {b.note && <p className="text-xs text-slate-500 mt-2">📝 {b.note}</p>}
              </div>
            ))
          }
        </div>
      )}
    </div>
  );
}
