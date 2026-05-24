import { useCallback, useEffect, useState } from 'react';
import { collection, limit, onSnapshot, orderBy, query, where } from 'firebase/firestore';
import { db } from '../firebase';
import { PAY } from '../constants';
import { dateKeyBangkok } from '../lib/date';
import { fsIncrementDebt, fsListCollection, fsPatch, fsQuerySales, fsRunQuery } from '../lib/firestoreRest';
import { aggregateDailySales, billMatchesDateKey, mergeSalesDocs } from '../lib/salesAggregate';

// ─── Dashboard ────────────────────────────────────────────────────────────────

export const Dashboard = ({ stock, updateMainStock, localBills = [], refreshKey = 0, active = true }) => {
  const [dashTab, setDashTab]       = useState('today');
  const [firestoreSales, setFirestoreSales] = useState([]);
  const [debtBills, setDebtBills] = useState([]);
  const [debtSavingId, setDebtSavingId] = useState(null);
  const [stockAdjusting, setStockAdjusting] = useState(null);
  const [stockBatches, setStockBatches]     = useState([]);
  const [loading, setLoading]       = useState(true);
  const todayKey = dateKeyBangkok();

  const loadSalesRest = useCallback(async () => {
    if (!import.meta.env.VITE_FIREBASE_PROJECT_ID) {
      setLoading(false);
      return;
    }
    try {
      const docs = await fsQuerySales(todayKey);
      setFirestoreSales(docs);
    } catch (e) {
      console.warn('fsQuerySales', e);
    } finally {
      setLoading(false);
    }
  }, [todayKey, refreshKey]);

  useEffect(() => {
    if (!active) return undefined;
    setLoading(true);
    loadSalesRest();
    const iv = setInterval(loadSalesRest, 25000);
    return () => clearInterval(iv);
  }, [loadSalesRest, active]);

  useEffect(() => {
    if (!db) return undefined;
    const salesQ = query(collection(db, 'sales'), where('dateKey', '==', todayKey));
    return onSnapshot(
      salesQ,
      (snap) => {
        const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        if (docs.length > 0) setFirestoreSales((prev) => mergeSalesDocs(docs, prev));
      },
      () => {},
    );
  }, [todayKey, refreshKey]);

  const loadDebtBills = useCallback(async () => {
    if (!import.meta.env.VITE_FIREBASE_PROJECT_ID) return;
    try {
      const rows = await fsListCollection('sales', 300);
      const openBills = rows
        .filter((b) => (Number(b.remainingAmount) || 0) > 0)
        .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
      setDebtBills(openBills);
    } catch (e) {
      console.warn('loadDebtBills', e);
    }
  }, [refreshKey]);

  useEffect(() => {
    if (!active) return undefined;
    loadDebtBills();
    const iv = setInterval(loadDebtBills, 30000);
    return () => clearInterval(iv);
  }, [active, loadDebtBills]);

  useEffect(() => {
    if (!db) { return undefined; }
    const unsubs = [];

    const batchQ = query(collection(db, 'stockBatches'), orderBy('purchaseDate', 'desc'), limit(30));
    unsubs.push(onSnapshot(batchQ, snap => {
      setStockBatches(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, () => {
      fsRunQuery({
        from: [{ collectionId: 'stockBatches' }],
        orderBy: [{ field: { fieldPath: 'purchaseDate' }, direction: 'DESCENDING' }],
        limit: 30,
      }).then((rows) => setStockBatches(rows)).catch(() => {});
    }));

    return () => { unsubs.forEach(u => u()); };
  }, []);

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
  const openDebtBills = mergeSalesDocs(debtBills, localBills)
    .filter((b) => (Number(b.remainingAmount) || 0) > 0)
    .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
  const salesSummary = aggregateDailySales(todaySales);

  const todayTotal  = salesSummary.revenueTotal;
  const todayCash   = todaySales.filter(s => s.paymentType === 'cash').reduce((s, t) => s + t.total, 0);
  const todayTransfer = todaySales.filter(s => s.paymentType === 'transfer').reduce((s, t) => s + t.total, 0);
  const todayCredit = todaySales.filter(s => s.paymentType === 'credit').reduce((s, t) => s + t.total, 0);
  const todayInstall = todaySales.filter(s => s.paymentType === 'installment').reduce((s, t) => s + t.total, 0);
  const totalDebt   = openDebtBills.reduce((s, c) => s + (Number(c.remainingAmount) || 0), 0);
  const debtorCount = new Set(openDebtBills.map((b) => b.customerId || b.customerName).filter(Boolean)).size;

  const payBreakdown = [
    { ...PAY[0], amount: todayCash,     count: todaySales.filter(s => s.paymentType === 'cash').length },
    { ...PAY[1], amount: todayTransfer, count: todaySales.filter(s => s.paymentType === 'transfer').length },
    { ...PAY[2], amount: todayCredit,   count: todaySales.filter(s => s.paymentType === 'credit').length },
    { ...PAY[3], amount: todayInstall,  count: todaySales.filter(s => s.paymentType === 'installment').length },
  ];

  const applyDebtPayment = async (bill, amount) => {
    const billId = bill.id;
    if (!billId) {
      alert('บิลนี้ยังไม่ซิงก์ขึ้น Firebase กรุณารอสักครู่แล้วลองใหม่ครับ');
      return;
    }

    const remaining = Number(bill.remainingAmount) || 0;
    const payAmount = Math.min(Math.max(Number(amount) || 0, 0), remaining);
    if (payAmount <= 0) return;

    const nextRemaining = Math.max(0, remaining - payAmount);
    const nextPaid = (Number(bill.paidAmount) || 0) + payAmount;
    const now = new Date().toISOString();
    setDebtSavingId(billId);
    try {
      await fsPatch(`sales/${billId}`, {
        paidAmount: nextPaid,
        remainingAmount: nextRemaining,
        debtStatus: nextRemaining > 0 ? 'partial' : 'paid',
        lastDebtPaymentAmount: payAmount,
        lastDebtPaymentAt: now,
      });
      if (bill.customerId) {
        await fsIncrementDebt(bill.customerId, {
          customerId: bill.customerId,
          customerName: bill.customerName || '',
          zone: bill.zone || '',
          lastBillNo: bill.billNo || billId,
          lastUpdated: now,
        }, -payAmount).catch(() => {});
      }
      setDebtBills((prev) => prev
        .map((b) => (b.id === billId ? { ...b, paidAmount: nextPaid, remainingAmount: nextRemaining, debtStatus: nextRemaining > 0 ? 'partial' : 'paid' } : b))
        .filter((b) => (Number(b.remainingAmount) || 0) > 0));
      setFirestoreSales((prev) => prev.map((b) => (b.id === billId ? { ...b, paidAmount: nextPaid, remainingAmount: nextRemaining } : b)));
    } catch (e) {
      console.error(e);
      alert('⚠️ รับชำระไม่สำเร็จ กรุณาลองอีกครั้งครับ');
    } finally {
      setDebtSavingId(null);
    }
  };

  const promptDebtPayment = (bill) => {
    const remaining = Number(bill.remainingAmount) || 0;
    const raw = window.prompt(`รับชำระจาก ${bill.customerName || 'ลูกค้า'}\nยอดค้าง ฿${remaining.toLocaleString()}\nกรอกยอดที่รับชำระ`, String(remaining));
    if (raw === null) return;
    applyDebtPayment(bill, parseFloat(raw));
  };

  const promptStockAdjust = async (kind, direction) => {
    if (!updateMainStock) {
      alert('ยังไม่พร้อมปรับสต๊อก กรุณาลองใหม่ครับ');
      return;
    }

    const label = kind === 'live' ? 'กุ้งเป็น' : 'กุ้งตาย';
    const current = Number(displayStock[kind]) || 0;
    const action = direction > 0 ? 'เพิ่ม' : 'ลด';
    const raw = window.prompt(`${action}${label}\nยอดปัจจุบัน ${current.toFixed(1)} กก.\nกรอกจำนวนกิโลที่จะ${action}`, '');
    if (raw === null) return;

    const amount = parseFloat(raw);
    if (!Number.isFinite(amount) || amount <= 0) {
      alert('กรุณากรอกจำนวนกิโลมากกว่า 0');
      return;
    }

    const nextValue = Math.max(0, current + direction * amount);
    const nextLive = kind === 'live' ? nextValue : (Number(displayStock.live) || 0);
    const nextDead = kind === 'dead' ? nextValue : (Number(displayStock.dead) || 0);
    setStockAdjusting(`${kind}-${direction}`);
    try {
      await updateMainStock(nextLive, nextDead);
    } catch (e) {
      console.error(e);
      alert('⚠️ ปรับสต๊อกไม่สำเร็จ กรุณาลองอีกครั้งครับ');
    } finally {
      setStockAdjusting(null);
    }
  };

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
          <p className="text-orange-100 text-xs mt-1">{openDebtBills.length} บิล · {debtorCount} ราย</p>
        </div>
      </div>

      {/* Sub-tabs */}
      <div className="flex bg-slate-200 p-1.5 rounded-2xl">
        {[['today','วันนี้'],['debts','บิลค้าง'],['stock','ประวัติสต๊อก']].map(([id, label]) => (
          <button key={id} onClick={() => setDashTab(id)}
            className={`flex-1 py-2.5 font-bold text-xs rounded-xl transition-all ${dashTab === id ? 'bg-white text-blue-600' : 'text-slate-500'}`}>
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
                        <p className="font-black text-emerald-600 ml-2 shrink-0">฿{(tx.total || 0).toLocaleString()}</p>
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
          <div className="flex items-start justify-between gap-3 mb-5">
            <div>
              <h3 className="font-bold text-slate-800 mb-1">บิลค้าง / ลูกหนี้</h3>
              <p className="text-sm text-slate-500">รวม ฿{totalDebt.toLocaleString()} ({openDebtBills.length} บิล · {debtorCount} ราย)</p>
            </div>
            <button type="button" onClick={loadDebtBills}
              className="px-3 py-1.5 rounded-xl bg-slate-100 text-slate-600 text-xs font-bold shrink-0">
              รีเฟรช
            </button>
          </div>
          {openDebtBills.length === 0
            ? <p className="text-center text-emerald-500 font-bold py-8">ไม่มีลูกหนี้ 🎉</p>
            : (
              <div className="space-y-3">
                {openDebtBills.map((bill) => {
                  const remaining = Number(bill.remainingAmount) || 0;
                  const savingThis = debtSavingId === bill.id;
                  const dateLabel = bill.dateKey || String(bill.createdAt || '').slice(0, 10) || '—';
                  return (
                  <div key={bill.id || bill.billNo} className="border-b border-slate-100 pb-4 last:border-b-0">
                    <div className="flex justify-between items-start gap-3">
                      <div className="min-w-0">
                        <p className="font-bold text-slate-800 truncate">{bill.customerName || 'ลูกค้า'}</p>
                        <p className="text-xs text-slate-400">{bill.zone || '—'} • {dateLabel} • บิล {bill.billNo || bill.id || '—'}</p>
                        <p className="text-[11px] text-slate-400 mt-0.5">ยอดบิล ฿{(Number(bill.total) || 0).toLocaleString()} · จ่ายแล้ว ฿{(Number(bill.paidAmount) || 0).toLocaleString()}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="font-black text-orange-500 text-lg">฿{remaining.toLocaleString()}</p>
                        <p className="text-[10px] text-orange-400 font-bold">ยอดค้าง</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 mt-3">
                      <button type="button" disabled={savingThis}
                        onClick={() => promptDebtPayment(bill)}
                        className="py-2 rounded-xl bg-blue-50 text-blue-600 text-xs font-bold disabled:opacity-50">
                        รับชำระ
                      </button>
                      <button type="button" disabled={savingThis}
                        onClick={() => window.confirm(`ปิดบิลค้าง ฿${remaining.toLocaleString()} ของ ${bill.customerName || 'ลูกค้า'}?`) && applyDebtPayment(bill, remaining)}
                        className="py-2 rounded-xl bg-emerald-500 text-white text-xs font-bold disabled:opacity-50">
                        ปิดบิล
                      </button>
                    </div>
                  </div>
                  );
                })}
              </div>
            )}
        </div>
      )}

      {/* Stock history tab */}
      {dashTab === 'stock' && (
        <div className="space-y-4">
          <div className="bg-white p-5 rounded-[2rem] shadow-sm">
            <h3 className="font-bold text-slate-800 mb-3">สต๊อกคงเหลือปัจจุบัน</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-blue-50 rounded-2xl p-4 text-center">
                <p className="text-xs text-blue-500 font-bold">กุ้งเป็น</p>
                <p className="font-black text-blue-700 text-2xl">{displayStock.live.toFixed(1)} <span className="text-sm font-normal">กก.</span></p>
                <div className="grid grid-cols-2 gap-1.5 mt-3">
                  <button type="button" disabled={Boolean(stockAdjusting)}
                    onClick={() => promptStockAdjust('live', -1)}
                    className="py-1.5 rounded-xl bg-white text-blue-600 text-xs font-black border border-blue-100 disabled:opacity-50">
                    - ลด
                  </button>
                  <button type="button" disabled={Boolean(stockAdjusting)}
                    onClick={() => promptStockAdjust('live', 1)}
                    className="py-1.5 rounded-xl bg-blue-600 text-white text-xs font-black disabled:opacity-50">
                    + เพิ่ม
                  </button>
                </div>
              </div>
              <div className="bg-red-50 rounded-2xl p-4 text-center">
                <p className="text-xs text-red-500 font-bold">กุ้งตาย</p>
                <p className="font-black text-red-700 text-2xl">{displayStock.dead.toFixed(1)} <span className="text-sm font-normal">กก.</span></p>
                <div className="grid grid-cols-2 gap-1.5 mt-3">
                  <button type="button" disabled={Boolean(stockAdjusting)}
                    onClick={() => promptStockAdjust('dead', -1)}
                    className="py-1.5 rounded-xl bg-white text-red-600 text-xs font-black border border-red-100 disabled:opacity-50">
                    - ลด
                  </button>
                  <button type="button" disabled={Boolean(stockAdjusting)}
                    onClick={() => promptStockAdjust('dead', 1)}
                    className="py-1.5 rounded-xl bg-red-500 text-white text-xs font-black disabled:opacity-50">
                    + เพิ่ม
                  </button>
                </div>
              </div>
            </div>
            <p className="text-[11px] text-slate-400 mt-3 leading-relaxed">
              ใช้ปุ่มเพิ่ม/ลดเพื่อปรับยอดคงเหลือจริงใน config/stock เมื่อมีการลงผิดหรือยอดหน้างานไม่ตรง
            </p>
          </div>
          {stockBatches.length === 0
            ? (
              <div className="bg-white p-8 rounded-[2rem] shadow-sm text-center text-slate-400">
                <p className="font-bold">ยังไม่มีประวัติรับสต๊อก</p>
                <p className="text-xs mt-1">รับกุ้งเข้าเพื่อสร้างรายการแรก</p>
              </div>
            )
            : stockBatches.map((b, i) => {
              const purchaseLabel = typeof b.purchaseDate === 'string'
                ? b.purchaseDate.slice(0, 10)
                : b.purchaseDate?.toDate?.()?.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' }) || '—';
              return (
              <div key={b.id}
                className={`bg-white p-5 rounded-[2rem] shadow-sm border-l-4 ${i === 0 ? 'border-blue-400' : 'border-slate-200'}`}>
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <p className="font-black text-slate-800 text-sm">
                      {i === 0 ? '🔵 รับเข้าล่าสุด' : `รายการรับเข้า #${stockBatches.length - i}`}
                    </p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {purchaseLabel}
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
                    <p className="font-black text-blue-700 text-lg">{b.liveKg || 0} <span className="text-xs font-normal">กก.</span></p>
                  </div>
                  <div className="bg-red-50 rounded-2xl p-3 text-center">
                    <p className="text-[10px] text-red-500 font-bold">กุ้งตาย</p>
                    <p className="font-black text-red-700 text-lg">{b.deadKg || 0} <span className="text-xs font-normal">กก.</span></p>
                  </div>
                </div>
                {b.note && <p className="text-xs text-slate-500 mt-2">📝 {b.note}</p>}
              </div>
              );
            })
          }
        </div>
      )}
    </div>
  );
};
