import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { db } from '../firebase';
import { PAY } from '../constants';
import { dateKeyBangkok, formatDateThaiShort, shiftDateKey } from '../lib/date';
import { debtCustomerKey } from '../lib/debtCustomerKey';
import { fsListCollection, fsQuerySales } from '../lib/firestoreRest';
import { billAmount } from '../lib/salesAggregate';
import { clearCustomerDebtAll, updateSalePayment } from '../services/salesService';

function formatViewDate(dateKey) {
  const today = dateKeyBangkok();
  if (dateKey === today) return 'วันนี้';
  if (dateKey === shiftDateKey(today, 1)) return 'พรุ่งนี้';
  if (dateKey === shiftDateKey(today, -1)) return 'เมื่อวาน';
  return formatDateThaiShort(dateKey);
}

export default function CustomerAccountsScreen({ refreshKey = 0 }) {
  const [viewDate, setViewDate] = useState(() => dateKeyBangkok());
  const [customerDebts, setCustomerDebts] = useState([]);
  const [daySales, setDaySales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedKey, setExpandedKey] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [clearingKey, setClearingKey] = useState(null);

  const loadDebtsRest = useCallback(async () => {
    try {
      const rows = await fsListCollection('customerDebts', 200);
      setCustomerDebts(rows.filter((d) => (parseFloat(d.totalDebt) || 0) > 0));
    } catch (e) {
      console.warn('customerDebts', e);
    }
  }, []);

  const loadDaySales = useCallback(async () => {
    setLoading(true);
    try {
      const docs = await fsQuerySales(viewDate);
      setDaySales(docs);
    } catch (e) {
      console.warn('fsQuerySales', e);
      setDaySales([]);
    } finally {
      setLoading(false);
    }
  }, [viewDate, refreshKey]);

  useEffect(() => {
    loadDebtsRest();
    if (!db) return undefined;
    return onSnapshot(collection(db, 'customerDebts'), (snap) => {
      setCustomerDebts(
        snap.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .filter((d) => (parseFloat(d.totalDebt) || 0) > 0),
      );
    }, () => { loadDebtsRest(); });
  }, [loadDebtsRest, refreshKey]);

  useEffect(() => {
    loadDaySales();
    const iv = setInterval(loadDaySales, 25000);
    return () => clearInterval(iv);
  }, [loadDaySales]);

  const totalDebt = customerDebts.reduce((s, c) => s + (parseFloat(c.totalDebt) || 0), 0);

  const dayCreditSales = useMemo(
    () => daySales.filter((s) => (parseFloat(s.remainingAmount) || 0) > 0),
    [daySales],
  );

  const dayByCustomer = useMemo(() => {
    const map = new Map();
    for (const s of dayCreditSales) {
      const key = debtCustomerKey(s.customerId, s.customerName);
      if (!key) continue;
      const prev = map.get(key) || {
        key,
        customerId: s.customerId,
        customerName: s.customerName || 'ลูกค้า',
        zone: s.zone || 'ทั่วไป',
        bills: [],
        dayRemain: 0,
      };
      prev.bills.push(s);
      prev.dayRemain += parseFloat(s.remainingAmount) || 0;
      map.set(key, prev);
    }
    return [...map.values()].sort((a, b) => b.dayRemain - a.dayRemain);
  }, [dayCreditSales]);

  const debtByKey = useMemo(() => {
    const m = new Map();
    customerDebts.forEach((d) => m.set(d.id, d));
    return m;
  }, [customerDebts]);

  const handlePaymentChange = async (tx, newType, customerKey) => {
    if (!tx.id || busyId || tx.paymentType === newType) return;
    setBusyId(tx.id);
    try {
      await updateSalePayment(tx, newType);
      await loadDaySales();
      await loadDebtsRest();
      setExpandedKey(customerKey);
    } catch (e) {
      console.error(e);
      alert('แก้สถานะไม่สำเร็จ ลองอีกครั้งครับ');
    } finally {
      setBusyId(null);
    }
  };

  const handleClearAll = async (row) => {
    const debt = debtByKey.get(row.key);
    const amount = debt?.totalDebt ?? row.dayRemain;
    if (!amount || amount <= 0) {
      alert('ไม่มียอดค้างสำหรับลูกค้านี้');
      return;
    }
    const label = row.customerName || debt?.customerName || 'ลูกค้า';
    if (!window.confirm(`ปิดยอดลูกค้า "${label}" ฿${Number(amount).toLocaleString()}?\n(ตั้งบิลค้างทั้งหมดเป็นโอนแล้ว)`)) {
      return;
    }
    setClearingKey(row.key);
    try {
      const res = await clearCustomerDebtAll(row.customerId, label, 'transfer');
      await loadDaySales();
      await loadDebtsRest();
      alert(`✅ ปิดยอดแล้ว ${res.clearedBills} บิล`);
      setExpandedKey(null);
    } catch (e) {
      console.error(e);
      alert('ปิดยอดไม่สำเร็จ — ลองอีกครั้ง');
    } finally {
      setClearingKey(null);
    }
  };

  return (
    <div className="p-5 space-y-4 pb-8">
      <div className="bg-gradient-to-br from-orange-400 to-amber-500 rounded-[2rem] p-5 text-white">
        <p className="text-orange-100 text-xs font-bold mb-1">ลูกหนี้รวม (AR)</p>
        <p className="text-3xl font-black">฿{totalDebt.toLocaleString()}</p>
        <p className="text-orange-100 text-xs mt-1">{customerDebts.length} ราย · แท็บบัญชีสำหรับฝ่ายบัญชี</p>
      </div>

      <div className="bg-white rounded-2xl p-3 flex items-center justify-between shadow-sm">
        <button
          type="button"
          onClick={() => setViewDate((d) => shiftDateKey(d, -1))}
          className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-600 active:scale-95"
          aria-label="วันก่อนหน้า"
        >
          <ChevronLeft size={20} />
        </button>
        <div className="text-center min-w-0 flex-1 px-2">
          <p className="font-black text-slate-800">{formatViewDate(viewDate)}</p>
          <p className="text-[10px] text-slate-400">{viewDate}</p>
        </div>
        <button
          type="button"
          onClick={() => setViewDate((d) => shiftDateKey(d, 1))}
          disabled={viewDate >= dateKeyBangkok()}
          className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-600 active:scale-95 disabled:opacity-30"
          aria-label="วันถัดไป"
        >
          <ChevronRight size={20} />
        </button>
      </div>

      <div className="bg-white p-5 rounded-[2rem] shadow-sm">
        <h3 className="font-bold text-slate-800 mb-1">บิลค้างตามวันที่เลือก</h3>
        <p className="text-[10px] text-slate-400 mb-4">
          {loading ? 'กำลังโหลด...' : `${dayCreditSales.length} บิล · รวม ฿${dayCreditSales.reduce((s, b) => s + (parseFloat(b.remainingAmount) || 0), 0).toLocaleString()}`}
        </p>
        {dayByCustomer.length === 0 && !loading ? (
          <p className="text-center text-slate-400 py-6 text-sm">ไม่มีบิลค้างในวันนี้</p>
        ) : (
          <div className="space-y-3">
            {dayByCustomer.map((row) => {
              const debt = debtByKey.get(row.key);
              const totalOwed = debt?.totalDebt ?? row.dayRemain;
              const open = expandedKey === row.key;
              return (
                <div key={row.key} className="border border-slate-100 rounded-2xl overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setExpandedKey(open ? null : row.key)}
                    className="w-full flex justify-between items-center p-4 text-left active:bg-slate-50"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-slate-800 truncate">{row.customerName}</p>
                      <p className="text-xs text-slate-400">
                        {row.zone}
                        {' · '}
                        วันนี้ค้าง ฿{row.dayRemain.toLocaleString()}
                        {debt && debt.totalDebt > row.dayRemain ? ` · รวมทั้งหมด ฿${Number(debt.totalDebt).toLocaleString()}` : ''}
                      </p>
                    </div>
                    <p className="font-black text-orange-500 ml-2 shrink-0">฿{Number(totalOwed).toLocaleString()}</p>
                  </button>
                  {open && (
                    <div className="px-4 pb-4 border-t border-slate-100 bg-slate-50/80 space-y-3">
                      {row.bills.map((tx) => (
                        <div key={tx.id} className="bg-white rounded-xl p-3">
                          <div className="flex justify-between text-sm">
                            <span className="font-bold text-slate-700 truncate">{tx.billNo || tx.id}</span>
                            <span className="font-black text-emerald-600 shrink-0 ml-2">฿{billAmount(tx).toLocaleString()}</span>
                          </div>
                          <p className="text-[10px] text-orange-500 font-bold mt-1">
                            ค้าง ฿{Number(tx.remainingAmount || 0).toLocaleString()}
                          </p>
                          <div className="flex gap-1 mt-2 flex-wrap">
                            {PAY.filter((p) => p.id !== 'installment').map((p) => (
                              <button
                                key={p.id}
                                type="button"
                                disabled={busyId === tx.id || !tx.id}
                                onClick={() => handlePaymentChange(tx, p.id, row.key)}
                                className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${
                                  tx.paymentType === p.id ? `${p.cls} text-white` : 'bg-slate-100 text-slate-500'
                                }`}
                              >
                                {p.label}
                              </button>
                            ))}
                          </div>
                        </div>
                      ))}
                      <button
                        type="button"
                        disabled={clearingKey === row.key}
                        onClick={() => handleClearAll(row)}
                        className="w-full py-3 rounded-xl bg-emerald-600 text-white font-bold text-sm active:scale-[0.98] disabled:opacity-50"
                      >
                        {clearingKey === row.key ? 'กำลังปิดยอด...' : 'ปิดยอดลูกค้าทั้งหมด (รับชำระแล้ว)'}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="bg-white p-5 rounded-[2rem] shadow-sm">
        <h3 className="font-bold text-slate-800 mb-1">ลูกหนี้ทั้งหมด (ยอดคงค้าง)</h3>
        <p className="text-[10px] text-slate-400 mb-4">แตะรายการด้านบนเพื่อดูบิลตามวัน · ปิดยอดได้จากรายละเอียดลูกค้า</p>
        {customerDebts.length === 0 ? (
          <p className="text-center text-emerald-500 font-bold py-6">ไม่มีลูกหนี้ 🎉</p>
        ) : (
          <div className="space-y-3">
            {[...customerDebts]
              .sort((a, b) => (b.totalDebt || 0) - (a.totalDebt || 0))
              .map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setExpandedKey(c.id)}
                  className="w-full flex justify-between items-center border-b border-slate-100 pb-3 text-left active:opacity-80"
                >
                  <div>
                    <p className="font-bold text-slate-800">{c.customerName}</p>
                    <p className="text-xs text-slate-400">{c.zone} · บิล {c.lastBillNo || '—'}</p>
                  </div>
                  <p className="font-black text-orange-500 text-lg shrink-0 ml-2">฿{(c.totalDebt || 0).toLocaleString()}</p>
                </button>
              ))}
          </div>
        )}
      </div>
    </div>
  );
}
