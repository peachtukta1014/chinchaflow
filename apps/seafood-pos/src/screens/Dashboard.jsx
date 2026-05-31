import React, { useCallback, useEffect, useState } from 'react';
import { FileImage, Trash2 } from 'lucide-react';
import { dateKeyBangkok, formatViewDateLabel } from '../lib/date';
import { fsQuerySales } from '../lib/firestoreRest';
import {
  aggregateDailySales,
  billAmount,
  billMatchesDateKey,
  mergeSalesDocs,
} from '../lib/salesAggregate';
import { useIntervalWhen } from '../lib/useIntervalWhen';
import { PAY } from '../constants';
import { deleteSaleBill, updateSalePayment } from '../services/salesService';
import DateNavBar from '../components/DateNavBar';
import BillImageSheet from '../components/BillImageSheet';
import { STOCK_LINE } from '../constants/stockLines';

export default function Dashboard({
  localBills = [],
  refreshKey = 0,
  active = true,
  isAdmin = false,
  stock = null,
  stockBatches = [],
  updateMainStock,
  onSaleDeleted,
}) {
  const [viewDate, setViewDate] = useState(() => dateKeyBangkok());
  const [firestoreSales, setFirestoreSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [salesLoadError, setSalesLoadError] = useState(false);
  const [payUpdatingId, setPayUpdatingId] = useState(null);
  const [deleteBusyId, setDeleteBusyId] = useState(null);
  const [billSheet, setBillSheet] = useState(null);

  const loadSalesRest = useCallback(async ({ background = false } = {}) => {
    if (!import.meta.env.VITE_FIREBASE_PROJECT_ID) {
      setLoading(false);
      return;
    }
    if (!background) setLoading(true);
    try {
      const docs = await fsQuerySales(viewDate);
      setFirestoreSales(docs);
      setSalesLoadError(false);
    } catch (e) {
      console.warn('fsQuerySales', e);
      setSalesLoadError(true);
      if (!background) {
        setFirestoreSales((prev) => prev);
      }
    } finally {
      if (!background) setLoading(false);
    }
  }, [viewDate, refreshKey]);

  useEffect(() => {
    if (!active) return undefined;
    loadSalesRest();
    return undefined;
  }, [viewDate, refreshKey, active, loadSalesRest]);

  useIntervalWhen(active, () => loadSalesRest({ background: true }), 45000);

  const localForDay = localBills.filter((b) => billMatchesDateKey(b, viewDate));
  const daySales = mergeSalesDocs(firestoreSales, localForDay);
  const salesSummary = aggregateDailySales(daySales);
  const dayTotal = salesSummary.revenueTotal;

  const payBreakdown = PAY.map((pt) => ({
    ...pt,
    amount: daySales.filter((s) => s.paymentType === pt.id).reduce((s, t) => s + billAmount(t), 0),
    count: daySales.filter((s) => s.paymentType === pt.id).length,
  }));

  const handlePaymentChange = async (tx, newType) => {
    if (!tx.id || payUpdatingId || tx.paymentType === newType) return;
    if (newType === 'installment') {
      alert('ผ่อนชำระ — แก้จากหน้าขายของตอนบันทึกบิลครับ');
      return;
    }
    setPayUpdatingId(tx.id);
    try {
      const next = await updateSalePayment(tx, newType);
      setFirestoreSales((prev) => prev.map((b) => (b.id === tx.id ? { ...b, ...next } : b)));
    } catch (e) {
      console.error(e);
      alert('แก้สถานะไม่สำเร็จ ลองอีกครั้งครับ');
      loadSalesRest({ background: true });
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
      setFirestoreSales((prev) => prev.filter((b) => b.id !== tx.id));
      onSaleDeleted?.();
      alert('✅ ลบบิลแล้ว — บันทึกใหม่ได้ที่ออเดอร์ LINE หรือขายของ');
    } catch (e) {
      alert(e?.message || 'ลบบิลไม่สำเร็จ');
      loadSalesRest({ background: true });
    } finally {
      setDeleteBusyId(null);
    }
  };

  const sortedSales = [...daySales].sort((a, b) =>
    String(b.timestamp || b.billNo || '').localeCompare(String(a.timestamp || a.billNo || '')),
  );

  return (
    <div className="p-5 space-y-5">
      {billSheet && (
        <BillImageSheet
          bill={billSheet.bill}
          customer={billSheet.customer}
          staffName={billSheet.staffName}
          onClose={() => setBillSheet(null)}
        />
      )}

      <DateNavBar
        dateKey={viewDate}
        onDateChange={setViewDate}
        subtitle={
          loading
            ? 'โหลด...'
            : `${sortedSales.length} บิล · ฿${dayTotal.toLocaleString()}${salesLoadError ? ' · โหลดไม่ครบ' : ''}`
        }
      />

      <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-[2rem] p-5 text-white">
        <p className="text-slate-400 text-xs font-bold mb-1">
          ยอดขาย — {formatViewDateLabel(viewDate)}
        </p>
        <p className="text-4xl font-black">฿{dayTotal.toLocaleString()}</p>
        <p className="text-slate-400 text-xs mt-1">{sortedSales.length} บิล</p>
      </div>

      <div className="bg-white p-5 rounded-[2rem] shadow-sm">
        <h3 className="font-bold text-slate-800 mb-3">น้ำหนักขาย ({STOCK_LINE.live.full})</h3>
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
            <p className="text-slate-500 text-xs">ยอดขาย {STOCK_LINE.live.full}</p>
            <p className="font-black text-emerald-600">฿{salesSummary.liveRevenue.toLocaleString()}</p>
            <p className="text-[10px] text-slate-400">{salesSummary.liveKg.toFixed(1)} กก.</p>
          </div>
          <div>
            <p className="text-slate-500 text-xs">ยอดขาย {STOCK_LINE.dead.full}</p>
            <p className="font-black text-orange-600">฿{salesSummary.deadRevenue.toLocaleString()}</p>
            <p className="text-[10px] text-slate-400">{salesSummary.deadKg.toFixed(1)} กก.</p>
          </div>
        </div>
      </div>

      <div className="bg-white p-5 rounded-[2rem] shadow-sm">
        <h3 className="font-bold text-slate-800 mb-4">แยกตามการชำระ</h3>
        {payBreakdown.map((pt) => (
          <div key={pt.id} className="mb-3 last:mb-0">
            <div className="flex justify-between text-sm mb-1.5">
              <span className="font-bold text-slate-700">{pt.label} ({pt.count} บิล)</span>
              <span className="font-black text-slate-800">฿{pt.amount.toLocaleString()}</span>
            </div>
            <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
              <div
                className={`h-full ${pt.cls} rounded-full transition-all duration-500`}
                style={{ width: dayTotal > 0 ? `${Math.max(2, (pt.amount / dayTotal) * 100).toFixed(1)}%` : '0%' }}
              />
            </div>
          </div>
        ))}
      </div>

      <div className="bg-white p-5 rounded-[2rem] shadow-sm">
        <h3 className="font-bold text-slate-800 mb-1">บิลทั้งหมด — {formatViewDateLabel(viewDate)}</h3>
        <p className="text-[10px] text-slate-400 mb-3">สด · โอน · ค้าง · ผ่อน · แตะดูภาพบิล / แชร์ LINE</p>
        {sortedSales.length === 0 ? (
          <p className="text-center text-slate-400 py-6">
            ไม่มีบิล
            {' '}
            {formatViewDateLabel(viewDate)}
          </p>
        ) : (
          <div className="space-y-3">
            {sortedSales.map((tx, i) => {
              const busy = payUpdatingId === tx.id;
              const deleting = deleteBusyId === tx.id;
              const pt = PAY.find((p) => p.id === tx.paymentType);
              return (
                <div key={tx.id || i} className="border border-slate-100 rounded-xl p-3">
                  <div className="flex justify-between items-start gap-2">
                    <div className="min-w-0">
                      <p className="font-bold text-sm text-slate-700 truncate">{tx.customerName}</p>
                      <p className="text-[10px] text-slate-400">{tx.billNo || '—'}</p>
                    </div>
                    <p className="font-black text-emerald-600 shrink-0">฿{billAmount(tx).toLocaleString()}</p>
                  </div>
                  <span className={`inline-block mt-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${pt?.cls || 'bg-slate-200'} text-white`}>
                    {pt?.label || tx.paymentType}
                  </span>
                  {(tx.remainingAmount || 0) > 0 && (
                    <p className="text-[10px] text-orange-500 font-bold mt-1">
                      ค้าง ฿{Number(tx.remainingAmount).toLocaleString()}
                    </p>
                  )}
                  <div className="flex gap-1 mt-2 flex-wrap">
                    {PAY.filter((p) => p.id !== 'installment').map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        disabled={busy || !tx.id}
                        onClick={() => handlePaymentChange(tx, p.id)}
                        className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${
                          tx.paymentType === p.id ? `${p.cls} text-white` : 'bg-slate-100 text-slate-500'
                        }`}
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
                          id: tx.customerId,
                          name: tx.customerName,
                          zone: tx.zone,
                          phone: tx.phone,
                        },
                        staffName: tx.recordedBy,
                      })}
                      className="flex-1 py-2 rounded-xl bg-slate-100 text-slate-700 text-xs font-bold flex items-center justify-center gap-1"
                    >
                      <FileImage size={14} />
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
    </div>
  );
}
