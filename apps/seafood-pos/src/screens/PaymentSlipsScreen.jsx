import React, { useCallback, useEffect, useState } from 'react';
import { Check, ImageOff, RefreshCw, X } from 'lucide-react';
import { billAmount } from '../lib/salesAggregate';
import { saleRemainingAmount } from '../lib/paymentSlipOpenSale';
import {
  confirmPaymentSlip,
  fetchPendingPaymentSlips,
  loadOpenBillsForSlip,
  loadSaleForSlip,
  rejectPaymentSlip,
} from '../services/paymentSlipService';

function formatSlipTime(createdAt) {
  if (!createdAt) return '—';
  if (typeof createdAt === 'string') {
    try {
      return new Date(createdAt).toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' });
    } catch {
      return createdAt;
    }
  }
  return '—';
}

function SlipCard({ slip, member, onDone }) {
  const [sale, setSale] = useState(null);
  const [openBills, setOpenBills] = useState([]);
  const [selectedSaleId, setSelectedSaleId] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const s = await loadSaleForSlip(slip);
        const open = await loadOpenBillsForSlip(slip, s);
        if (cancelled) return;
        setSale(s);
        setOpenBills(open);
        const preferred = s?.id || slip.suggestedSaleId || open[0]?.id || '';
        setSelectedSaleId(preferred);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [slip]);

  const selectedSale = openBills.find((b) => b.id === selectedSaleId) || sale;
  const remain = selectedSale ? saleRemainingAmount(selectedSale) : parseFloat(slip.remainingAmount) || 0;

  const handleConfirm = async () => {
    if (!selectedSale?.id) {
      alert('เลือกบิลที่จะปิดก่อน');
      return;
    }
    const billLabel = selectedSale.billNo || selectedSale.id;
    const ok = window.confirm(
      `ยืนยันรับโอนแล้ว?\n\n` +
        `บิล ${billLabel}\n` +
        `ลูกค้า ${selectedSale.customerName || slip.customerName || '—'}\n` +
        `ยอดค้าง ฿${remain.toLocaleString()}\n\n` +
        `กด OK เมื่อตรวจแอปธนาคารแล้วว่าเงินเข้าบัญชีแม่/พีชจริง\n` +
        `(หลังยืนยันจะปิดบิลและส่งใบ「จ่ายแล้ว · โอน」ให้ลูกค้าใน LINE)`,
    );
    if (!ok) return;
    setBusy(true);
    try {
      await confirmPaymentSlip({
        slip,
        sale: selectedSale,
        staffMember: member,
        pushPaidBill: true,
      });
      alert(`✅ ปิดบิล ${billLabel} แล้ว · กำลังส่งใบจ่ายแล้วให้ลูกค้าใน LINE`);
      onDone();
    } catch (e) {
      console.error(e);
      alert(e.message || 'ยืนยันไม่สำเร็จ');
    } finally {
      setBusy(false);
    }
  };

  const handleReject = async () => {
    const reason = window.prompt('เหตุผลปฏิเสธ (ถ้ามี)', 'สลิปไม่ตรงบิล/ยอด');
    if (reason === null) return;
    setBusy(true);
    try {
      await rejectPaymentSlip(slip, member, reason);
      onDone();
    } catch (e) {
      alert(e.message || 'บันทึกไม่สำเร็จ');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="p-3 border-b border-slate-100 flex justify-between items-start gap-2">
        <div className="min-w-0">
          <p className="font-black text-slate-800 truncate">
            {slip.customerName || 'ลูกค้า LINE'}
          </p>
          <p className="text-[10px] text-slate-400 mt-0.5">
            รับสลิป {formatSlipTime(slip.createdAt)}
          </p>
        </div>
        {remain > 0 && (
          <span className="shrink-0 text-xs font-black text-red-600 bg-red-50 px-2 py-1 rounded-lg">
            ค้าง ฿{remain.toLocaleString()}
          </span>
        )}
      </div>

      {slip.imageUrl ? (
        <a href={slip.imageUrl} target="_blank" rel="noreferrer" className="block bg-slate-100">
          <img
            src={slip.imageUrl}
            alt="สลิปโอน"
            className="w-full max-h-72 object-contain"
          />
        </a>
      ) : (
        <div className="flex items-center justify-center gap-2 py-12 text-slate-400 bg-slate-50">
          <ImageOff size={20} />
          <span className="text-sm">ไม่มีรูป</span>
        </div>
      )}

      <div className="p-3 space-y-3">
        {loading ? (
          <p className="text-sm text-slate-400 text-center py-2">กำลังโหลดบิล...</p>
        ) : (
          <>
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">
                ปิดบิลเลขที่
              </label>
              {openBills.length > 1 ? (
                <select
                  value={selectedSaleId}
                  onChange={(e) => setSelectedSaleId(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold text-slate-800"
                >
                  {openBills.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.billNo || b.id}
                      {' · ค้าง ฿'}
                      {saleRemainingAmount(b).toLocaleString()}
                      {' · '}
                      {b.customerName}
                    </option>
                  ))}
                </select>
              ) : (
                <p className="mt-1 text-sm font-black text-slate-800">
                  {selectedSale?.billNo || slip.suggestedBillNo || '—'}
                  {selectedSale && (
                    <span className="text-slate-500 font-semibold">
                      {' '}
                      · ฿{billAmount(selectedSale).toLocaleString()}
                    </span>
                  )}
                </p>
              )}
            </div>
            {!selectedSale && (
              <p className="text-xs text-amber-700 bg-amber-50 rounded-lg px-2 py-2">
                ไม่พบบิลค้าง — เลือกบิลจากแท็บลูกหนี้หรือปฏิเสธสลิป
              </p>
            )}
            <p className="text-[10px] text-slate-500 leading-snug">
              ตรวจแอปธนาคารว่ายอดและบัญชีปลายทาง (แม่/พีช) ตรงก่อนกดยืนยัน
            </p>
          </>
        )}

        <div className="flex gap-2">
          <button
            type="button"
            disabled={busy || loading || !selectedSale}
            onClick={handleConfirm}
            className="flex-1 flex items-center justify-center gap-1.5 py-3 rounded-xl bg-green-600 text-white text-sm font-black disabled:opacity-40"
          >
            <Check size={18} />
            ยืนยันรับโอน
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={handleReject}
            className="px-4 py-3 rounded-xl bg-slate-100 text-slate-600 text-sm font-bold"
            title="ปฏิเสธ"
          >
            <X size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}

export default function PaymentSlipsScreen({ member, active, onPendingCountChange }) {
  const [slips, setSlips] = useState([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await fetchPendingPaymentSlips();
      setSlips(rows);
      onPendingCountChange?.(rows.length);
    } catch (e) {
      console.error(e);
      setSlips([]);
      onPendingCountChange?.(0);
    } finally {
      setLoading(false);
    }
  }, [onPendingCountChange]);

  useEffect(() => {
    if (!active) return undefined;
    reload();
    const t = setInterval(reload, 45000);
    return () => clearInterval(t);
  }, [active, reload]);

  return (
    <div className="px-4 pb-8">
      <div className="flex items-center justify-between py-3">
        <div>
          <h2 className="font-black text-slate-800">สลิปรอตรวจ</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            ลูกค้าส่งในแชต LINE 1:1 · ยืนยันหลังเช็คธนาคาร
          </p>
        </div>
        <button
          type="button"
          onClick={reload}
          disabled={loading}
          className="p-2 rounded-xl bg-slate-100 text-slate-600"
          aria-label="รีเฟรช"
        >
          <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {loading && slips.length === 0 ? (
        <p className="text-center text-slate-400 text-sm py-12">กำลังโหลด...</p>
      ) : slips.length === 0 ? (
        <p className="text-center text-slate-400 text-sm py-12 bg-white rounded-2xl border border-dashed border-slate-200">
          ไม่มีสลิปรอตรวจ
        </p>
      ) : (
        <div className="space-y-4">
          {slips.map((slip) => (
            <SlipCard
              key={slip.id}
              slip={slip}
              member={member}
              onDone={reload}
            />
          ))}
        </div>
      )}
    </div>
  );
}
