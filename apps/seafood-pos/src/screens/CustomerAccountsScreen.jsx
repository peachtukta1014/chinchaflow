import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Trash2 } from 'lucide-react';
import { PAY } from '../constants';
import { dateKeyBangkok, formatDateThaiShort, formatViewDateLabel } from '../lib/date';
import DateNavBar from '../components/DateNavBar';
import BillImageSheet from '../components/BillImageSheet';
import { debtCustomerKey } from '../lib/debtCustomerKey';
import { openSalesForCustomer, paymentTypeLabel } from '../lib/saleFifo';
import { coalesceFirestoreRows } from '../lib/coalesceFirestoreRows';
import { fsListCollection, fsQueryOpenSales, fsQuerySales } from '../lib/firestoreRest';
import { billAmount } from '../lib/salesAggregate';
import { useIntervalWhen } from '../lib/useIntervalWhen';
import {
  applyFifoCustomerPayment,
  clearCustomerDebtAll,
  deleteSaleBill,
  fetchCustomerOpenSales,
  updateSalePayment,
} from '../services/salesService';

function CustomerFifoPanel({
  row,
  debtByKey,
  onRefresh,
  expandedKey,
  setExpandedKey,
}) {
  const [payInput, setPayInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [billBusy, setBillBusy] = useState(null);
  const [fifoBills, setFifoBills] = useState([]);
  const [billsLoading, setBillsLoading] = useState(false);
  const open = expandedKey === row.key;

  useEffect(() => {
    if (!open) {
      setFifoBills([]);
      return undefined;
    }
    let cancelled = false;
    setBillsLoading(true);
    fetchCustomerOpenSales(row.customerId, row.customerName)
      .then((bills) => {
        if (!cancelled) setFifoBills(bills);
      })
      .catch((e) => {
        console.warn('fetchCustomerOpenSales', e);
        if (!cancelled) setFifoBills([]);
      })
      .finally(() => {
        if (!cancelled) setBillsLoading(false);
      });
    return () => { cancelled = true; };
  }, [open, row.customerId, row.customerName, onRefresh]);

  const debt = debtByKey.get(row.key);
  const totalOwed = debt?.totalDebt ?? fifoBills.reduce((s, b) => s + (parseFloat(b.remainingAmount) || 0), 0);

  const handleFifoPay = async () => {
    const amt = parseFloat(payInput);
    if (!amt || amt <= 0) {
      alert('ใส่ยอดที่รับชำระ');
      return;
    }
    if (!window.confirm(`รับชำระ ฿${amt.toLocaleString()} จาก "${row.customerName}"\nหักบิลเก่าก่อน (FIFO)?`)) {
      return;
    }
    setBusy(true);
    try {
      const res = await applyFifoCustomerPayment(row.customerId, row.customerName, amt, fifoBills);
      await onRefresh();
      setPayInput('');
      const lines = res.allocations.map((a, i) => (
        `${i + 1}. ${a.billNo} (${formatDateThaiShort(a.dateKey)}) ฿${a.applied.toLocaleString()}${a.closed ? ' ✓ปิดบิล' : ''}`
      )).join('\n');
      alert(
        `✅ รับชำระ ฿${res.applied.toLocaleString()}\n${lines || '—'}${res.unallocated > 0 ? `\nเหลือไม่ได้หัก ฿${res.unallocated.toLocaleString()}` : ''}`,
      );
    } catch (e) {
      console.error(e);
      alert(e.message || 'บันทึกไม่สำเร็จ');
    } finally {
      setBusy(false);
    }
  };

  const handleClearAll = async () => {
    if (!totalOwed || totalOwed <= 0) {
      alert('ไม่มียอดค้าง');
      return;
    }
    if (!window.confirm(`ปิดยอดทั้งหมด "${row.customerName}" ฿${Number(totalOwed).toLocaleString()}?\n(หักตาม FIFO จนครบ)`)) {
      return;
    }
    setBusy(true);
    try {
      const res = await clearCustomerDebtAll(row.customerId, row.customerName, 'transfer');
      await onRefresh();
      alert(`✅ ปิดยอดแล้ว ${res.clearedBills} บิล`);
      setExpandedKey(null);
    } catch (e) {
      console.error(e);
      alert('ปิดยอดไม่สำเร็จ');
    } finally {
      setBusy(false);
    }
  };

  const handlePaymentChange = async (tx, newType) => {
    if (!tx.id || billBusy || tx.paymentType === newType) return;
    setBillBusy(tx.id);
    try {
      await updateSalePayment(tx, newType);
      await onRefresh();
    } catch (e) {
      console.error(e);
      alert('แก้สถานะไม่สำเร็จ');
    } finally {
      setBillBusy(null);
    }
  };

  return (
    <div className="border border-slate-100 rounded-2xl overflow-hidden">
      <button
        type="button"
        onClick={() => setExpandedKey(open ? null : row.key)}
        className="w-full flex justify-between items-center p-4 text-left active:bg-slate-50"
      >
        <div className="min-w-0 flex-1">
          <p className="font-bold text-slate-800 truncate">{row.customerName}</p>
          <p className="text-xs text-slate-400">
            {row.zone}
            {open && !billsLoading ? ` · ${fifoBills.length} บิลค้าง (FIFO)` : ' · แตะดูบิลค้าง'}
          </p>
        </div>
        <p className="font-black text-orange-500 ml-2 shrink-0">฿{Number(totalOwed).toLocaleString()}</p>
      </button>
      {open && (
        <div className="px-4 pb-4 border-t border-slate-100 bg-slate-50/80 space-y-3">
          <p className="text-[10px] text-purple-700 font-bold pt-2">
            รับชำระผ่อนแบบ FIFO — หักบิลเก่าสุดก่อนเสมอ
          </p>
          <div className="flex gap-2">
            <input
              type="number"
              inputMode="decimal"
              value={payInput}
              onChange={(e) => setPayInput(e.target.value)}
              placeholder="ยอดที่รับวันนี้ (฿)"
              className="flex-1 p-3 bg-white border border-purple-200 rounded-xl text-base font-bold outline-none"
            />
            <button
              type="button"
              disabled={busy}
              onClick={handleFifoPay}
              className="px-4 py-3 rounded-xl bg-purple-600 text-white font-bold text-sm shrink-0 disabled:opacity-50"
            >
              {busy ? '...' : 'บันทึก'}
            </button>
          </div>

          {billsLoading ? (
            <p className="text-center text-slate-400 text-sm py-4">กำลังโหลดบิลค้าง...</p>
          ) : fifoBills.length === 0 ? (
            <p className="text-center text-slate-400 text-sm py-4">ไม่มีบิลค้าง</p>
          ) : (
            fifoBills.map((tx, idx) => {
              const total = billAmount(tx);
              const paid = parseFloat(tx.paidAmount) || 0;
              const remain = parseFloat(tx.remainingAmount) || 0;
              const isOldest = idx === 0;
              return (
                <div
                  key={tx.id}
                  className={`bg-white rounded-xl p-3 border-l-4 ${isOldest ? 'border-amber-400' : 'border-slate-200'}`}
                >
                  <div className="flex justify-between items-start gap-2">
                    <div className="min-w-0">
                      <p className="text-[10px] font-bold text-amber-600">
                        FIFO #{idx + 1}
                        {isOldest ? ' · เก่าสุด' : ''}
                        {' · '}
                        {formatDateThaiShort(tx.dateKey)}
                      </p>
                      <p className="font-bold text-sm text-slate-700 truncate">{tx.billNo || tx.id}</p>
                    </div>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${
                      tx.paymentType === 'installment' ? 'bg-purple-100 text-purple-700' : 'bg-orange-100 text-orange-700'
                    }`}
                    >
                      {paymentTypeLabel(tx)}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    ยอดบิล ฿{total.toLocaleString()}
                    {paid > 0 ? ` · จ่ายแล้ว ฿${paid.toLocaleString()}` : ''}
                  </p>
                  <p className="text-[10px] text-orange-500 font-bold">ค้าง ฿{remain.toLocaleString()}</p>
                  <div className="flex gap-1 mt-2 flex-wrap">
                    {PAY.filter((p) => p.id !== 'installment').map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        disabled={billBusy === tx.id || !tx.id}
                        onClick={() => handlePaymentChange(tx, p.id)}
                        className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${
                          tx.paymentType === p.id ? `${p.cls} text-white` : 'bg-slate-100 text-slate-500'
                        }`}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })
          )}

          <button
            type="button"
            disabled={busy}
            onClick={handleClearAll}
            className="w-full py-3 rounded-xl bg-emerald-600 text-white font-bold text-sm disabled:opacity-50"
          >
            ปิดยอดทั้งหมด (รับชำระครบ)
          </button>
        </div>
      )}
    </div>
  );
}

export default function CustomerAccountsScreen({
  refreshKey = 0,
  isAdmin = false,
  stock = null,
  stockBatches = [],
  updateMainStock,
  onSaleDeleted,
}) {
  const [viewDate, setViewDate] = useState(() => dateKeyBangkok());
  const [customerDebts, setCustomerDebts] = useState([]);
  const [openSalesIndex, setOpenSalesIndex] = useState([]);
  const [daySales, setDaySales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedKey, setExpandedKey] = useState(null);
  const [payUpdatingId, setPayUpdatingId] = useState(null);
  const [deleteBusyId, setDeleteBusyId] = useState(null);
  const [billSheet, setBillSheet] = useState(null);

  const loadDebtsRest = useCallback(async () => {
    try {
      const rows = await fsListCollection('customerDebts', 200);
      setCustomerDebts(rows.filter((d) => (parseFloat(d.totalDebt) || 0) > 0));
    } catch (e) {
      console.warn('customerDebts', e);
    }
  }, []);

  const loadOpenSalesIndex = useCallback(async ({ background = false } = {}) => {
    try {
      setOpenSalesIndex(await fsQueryOpenSales(120));
    } catch (e) {
      console.warn('fsQueryOpenSales', e);
      if (!background) setOpenSalesIndex((prev) => prev);
    }
  }, [refreshKey]);

  const loadDaySales = useCallback(async ({ background = false } = {}) => {
    if (!background) setLoading(true);
    try {
      setDaySales(await fsQuerySales(viewDate));
    } catch (e) {
      console.warn('fsQuerySales', e);
      if (!background) setDaySales((prev) => prev);
    } finally {
      if (!background) setLoading(false);
    }
  }, [viewDate, refreshKey]);

  useEffect(() => {
    loadDebtsRest();
  }, [loadDebtsRest, refreshKey]);

  const refreshAll = useCallback(async () => {
    await Promise.all([loadDebtsRest(), loadOpenSalesIndex(), loadDaySales()]);
  }, [loadDebtsRest, loadOpenSalesIndex, loadDaySales]);

  useEffect(() => {
    loadOpenSalesIndex();
  }, [loadOpenSalesIndex]);

  useEffect(() => {
    loadDaySales();
  }, [loadDaySales]);

  useIntervalWhen(true, () => {
    loadDebtsRest();
    loadOpenSalesIndex();
    loadDaySales({ background: true });
  }, 45000);

  const totalDebt = customerDebts.reduce((s, c) => s + (parseFloat(c.totalDebt) || 0), 0);

  const sortedDaySales = useMemo(
    () => [...daySales].sort((a, b) => String(b.timestamp || b.billNo || '').localeCompare(String(a.timestamp || a.billNo || ''))),
    [daySales],
  );

  const dayTotal = useMemo(
    () => sortedDaySales.reduce((s, tx) => s + billAmount(tx), 0),
    [sortedDaySales],
  );

  const dayPayBreakdown = useMemo(
    () => PAY.map((pt) => ({
      ...pt,
      count: sortedDaySales.filter((s) => s.paymentType === pt.id).length,
      amount: sortedDaySales.filter((s) => s.paymentType === pt.id).reduce((s, t) => s + billAmount(t), 0),
    })),
    [sortedDaySales],
  );

  const handleDayBillPayment = async (tx, newType) => {
    if (!tx.id || payUpdatingId || tx.paymentType === newType) return;
    if (newType === 'installment') {
      alert('ผ่อนชำระ — แก้จากหน้าขายของตอนบันทึกบิลครับ');
      return;
    }
    setPayUpdatingId(tx.id);
    try {
      await updateSalePayment(tx, newType);
      await refreshAll();
    } catch (e) {
      console.error(e);
      alert('แก้สถานะไม่สำเร็จ');
    } finally {
      setPayUpdatingId(null);
    }
  };

  const handleDeleteSale = async (tx) => {
    if (!isAdmin || !tx.id || deleteBusyId) return;
    const label = `${tx.billNo || tx.id} · ${tx.customerName} · ฿${billAmount(tx).toLocaleString()}`;
    if (!window.confirm(
      `ลบบิลนี้ออกจากระบบ?\n\n${label}\n\n` +
        '· คืนยอดค้าง (ถ้ามี)\n· คืนสต๊อกกุ้ง\n· ออเดอร์ LINE กลับเป็นรอส่ง (ถ้ามี)\n\nกู้คืนไม่ได้',
    )) return;
    setDeleteBusyId(tx.id);
    try {
      await deleteSaleBill(tx, { stock, stockBatches, updateMainStock });
      await refreshAll();
      onSaleDeleted?.();
      alert('✅ ลบบิลแล้ว — บันทึกใหม่ได้ที่ออเดอร์ LINE หรือขายของ');
    } catch (e) {
      alert(e?.message || 'ลบบิลไม่สำเร็จ');
    } finally {
      setDeleteBusyId(null);
    }
  };

  const debtByKey = useMemo(() => {
    const m = new Map();
    customerDebts.forEach((d) => m.set(d.id, d));
    return m;
  }, [customerDebts]);

  const customerRows = useMemo(() => {
    const map = new Map();
    for (const d of customerDebts) {
      map.set(d.id, {
        key: d.id,
        customerId: d.customerId || d.id,
        customerName: d.customerName || 'ลูกค้า',
        zone: d.zone || 'ทั่วไป',
        totalDebt: d.totalDebt || 0,
      });
    }
    for (const s of openSalesIndex) {
      if ((parseFloat(s.remainingAmount) || 0) <= 0) continue;
      const key = debtCustomerKey(s.customerId, s.customerName);
      if (!key || map.has(key)) continue;
      map.set(key, {
        key,
        customerId: s.customerId,
        customerName: s.customerName || 'ลูกค้า',
        zone: s.zone || 'ทั่วไป',
        totalDebt: parseFloat(s.remainingAmount) || 0,
      });
    }
    return [...map.values()].sort((a, b) => (b.totalDebt || 0) - (a.totalDebt || 0));
  }, [customerDebts, openSalesIndex]);

  return (
    <div className="p-5 space-y-4 pb-8">
      {billSheet && (
        <BillImageSheet
          bill={billSheet.bill}
          customer={billSheet.customer}
          staffName={billSheet.staffName}
          onClose={() => setBillSheet(null)}
        />
      )}
      <div className="bg-gradient-to-br from-orange-400 to-amber-500 rounded-[2rem] p-5 text-white">
        <p className="text-orange-100 text-xs font-bold mb-1">ลูกหนี้รวม (AR)</p>
        <p className="text-3xl font-black">฿{totalDebt.toLocaleString()}</p>
        <p className="text-orange-100 text-xs mt-1">
          {customerDebts.length} ราย · รับชำระผ่อนแบบ FIFO
        </p>
      </div>

      <DateNavBar
        dateKey={viewDate}
        onDateChange={setViewDate}
        subtitle={
          loading
            ? 'โหลด...'
            : `${sortedDaySales.length} บิล · ฿${dayTotal.toLocaleString()}`
        }
      />

      <div className="bg-white p-5 rounded-[2rem] shadow-sm">
        <h3 className="font-bold text-slate-800 mb-1">บิลทั้งหมด</h3>
        <p className="text-[10px] text-slate-400 mb-3">
          สด · โอน · ค้าง · ผ่อน — เลื่อนวันดูประวัติย้อนหลัง
        </p>
        {sortedDaySales.length > 0 && (
          <div className="grid grid-cols-2 gap-2 mb-4 text-[10px]">
            {dayPayBreakdown.filter((p) => p.count > 0).map((p) => (
              <div key={p.id} className="bg-slate-50 rounded-xl px-2 py-1.5 flex justify-between gap-1">
                <span className="font-bold text-slate-700">{p.label}</span>
                <span className="text-slate-600 shrink-0">{p.count} · ฿{p.amount.toLocaleString()}</span>
              </div>
            ))}
          </div>
        )}
        {loading ? (
          <p className="text-center text-slate-400 py-8 text-sm">กำลังโหลด...</p>
        ) : sortedDaySales.length === 0 ? (
          <p className="text-center text-slate-400 py-8 text-sm">
            ไม่มีบิล
            {' '}
            {formatViewDateLabel(viewDate)}
          </p>
        ) : (
          <div className="space-y-3 max-h-[42vh] overflow-y-auto pr-1">
            {sortedDaySales.map((tx, i) => {
              const busy = payUpdatingId === tx.id;
              const deleting = deleteBusyId === tx.id;
              const pt = PAY.find((p) => p.id === tx.paymentType);
              const itemCount = tx.items?.length ?? 0;
              return (
                <div key={tx.id || i} className="border border-slate-100 rounded-xl p-3">
                  <div className="flex justify-between items-start gap-2">
                    <div className="min-w-0">
                      <p className="font-bold text-sm text-slate-800 truncate">{tx.customerName}</p>
                      <p className="text-[10px] text-slate-400 truncate">
                        {tx.billNo || '—'}
                        {tx.timestamp ? ` · ${tx.timestamp}` : ''}
                        {tx.zone ? ` · ${tx.zone}` : ''}
                        {itemCount ? ` · ${itemCount} รายการ` : ''}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-black text-emerald-600">฿{billAmount(tx).toLocaleString()}</p>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${pt?.cls || 'bg-slate-200'} text-white`}>
                        {paymentTypeLabel(tx)}
                      </span>
                    </div>
                  </div>
                  {(tx.remainingAmount || 0) > 0 && (
                    <p className="text-[10px] text-orange-500 font-bold mt-1">
                      ค้างจ่าย ฿{Number(tx.remainingAmount).toLocaleString()}
                    </p>
                  )}
                  <div className="flex gap-1 mt-2 flex-wrap">
                    {PAY.filter((p) => p.id !== 'installment').map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        disabled={busy || !tx.id}
                        onClick={() => handleDayBillPayment(tx, p.id)}
                        className={`text-[10px] font-bold px-2.5 py-1 rounded-full transition-all ${
                          tx.paymentType === p.id ? `${p.cls} text-white` : 'bg-slate-100 text-slate-500'
                        } ${busy ? 'opacity-50' : 'active:scale-95'}`}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                  <div className="mt-2 flex gap-2">
                    <button
                      type="button"
                      onClick={() => setBillSheet({
                        bill: tx,
                        customer: {
                          name: tx.customerName,
                          zone: tx.zone,
                          phone: tx.phone,
                          lineUserId: tx.customerLineUserId || tx.lineUserId || '',
                        },
                        staffName: tx.recordedBy,
                      })}
                      className="flex-1 py-2 rounded-xl bg-slate-100 text-slate-700 text-xs font-bold"
                    >
                      ดูภาพบิล / แชร์ LINE
                    </button>
                    {isAdmin && tx.id && (
                      <button
                        type="button"
                        disabled={deleting || busy}
                        onClick={() => handleDeleteSale(tx)}
                        className="shrink-0 px-3 py-2 rounded-xl border border-red-200 text-red-600 text-xs font-bold flex items-center gap-1 disabled:opacity-50"
                        title="ลบบิล (แอดมิน)"
                      >
                        <Trash2 size={14} />
                        {deleting ? '…' : 'ลบ'}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="bg-white p-5 rounded-[2rem] shadow-sm">
        <h3 className="font-bold text-slate-800 mb-1">ลูกหนี้ — รับชำระผ่อน (FIFO)</h3>
        <p className="text-[10px] text-slate-400 mb-4">
          แตะลูกค้า → ใส่ยอดที่รับ → ระบบหักบิลเก่าสุดก่อน (ค้าง/ผ่อน)
        </p>
        {customerRows.length === 0 ? (
          <p className="text-center text-emerald-500 font-bold py-8">ไม่มีลูกหนี้ 🎉</p>
        ) : (
          <div className="space-y-3">
            {customerRows.map((row) => (
              <CustomerFifoPanel
                key={row.key}
                row={row}
                debtByKey={debtByKey}
                onRefresh={refreshAll}
                expandedKey={expandedKey}
                setExpandedKey={setExpandedKey}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
