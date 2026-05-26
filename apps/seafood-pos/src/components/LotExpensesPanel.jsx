import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { dateKeyBangkok } from '../lib/date';
import { formatReceiveDayLabel, groupBatchesByReceiveDay } from '../lib/stockBatchUtils';
import {
  fetchLotExpenses,
  saveLotExpenses,
  sumLotTransport,
  totalMiscExpenses,
} from '../services/lotExpenseService';

function fmtBaht(n) {
  return `฿${Math.round(parseFloat(n) || 0).toLocaleString()}`;
}

function ExpenseBlock({ title, amountLabel, amount, note, onAmount, onNote, noteHint, notePlaceholder, accent }) {
  return (
    <div className={`rounded-2xl border p-4 space-y-3 ${accent}`}>
      {title && <p className="text-xs font-bold text-slate-800">{title}</p>}
      <div>
        <label className="text-xs font-bold text-slate-700 mb-1 block">{amountLabel}</label>
        <input
          type="number"
          min="0"
          step="1"
          value={amount}
          onChange={(e) => onAmount(e.target.value)}
          placeholder="0"
          className="w-full p-3 bg-white rounded-xl font-bold text-slate-800 outline-none border border-slate-100"
        />
      </div>
      <div>
        <label className="text-xs font-bold text-slate-700 mb-1 block">หมายเหตุ</label>
        {noteHint && (
          <p className="text-[10px] font-bold text-amber-800 bg-amber-50 border border-amber-100 rounded-lg px-2.5 py-2 mb-2 leading-relaxed">
            {noteHint}
          </p>
        )}
        <input
          type="text"
          value={note}
          onChange={(e) => onNote(e.target.value)}
          placeholder={notePlaceholder}
          className="w-full p-3 bg-white rounded-xl text-sm text-slate-800 outline-none border border-slate-100 placeholder:text-slate-400"
        />
      </div>
    </div>
  );
}

/**
 * รายจ่ายล็อต — แยกแผงตลาดกับบ่อ/ส่งของเป็น · ค่ารถอยู่ตอนรับเข้า
 */
export default function LotExpensesPanel({
  stockBatches = [],
  lotDateKey: controlledLotKey,
  onLotDateKeyChange,
  onExpensesChange,
  standalone = false,
}) {
  const todayKey = dateKeyBangkok();
  const lotDays = useMemo(() => groupBatchesByReceiveDay(stockBatches), [stockBatches]);
  const defaultLotKey = lotDays.length ? lotDays[lotDays.length - 1].dateKey : todayKey;

  const [internalLotKey, setInternalLotKey] = useState(defaultLotKey);
  const lotDateKey = controlledLotKey ?? internalLotKey;
  const setLotDateKey = onLotDateKeyChange ?? setInternalLotKey;

  const [marketAmt, setMarketAmt] = useState('');
  const [marketNote, setMarketNote] = useState('');
  const [pondAmt, setPondAmt] = useState('');
  const [pondNote, setPondNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (lotDays.some((d) => d.dateKey === lotDateKey)) return;
    if (defaultLotKey) setLotDateKey(defaultLotKey);
  }, [lotDays, lotDateKey, defaultLotKey, setLotDateKey]);

  const load = useCallback(async () => {
    if (!lotDateKey) return;
    setLoaded(false);
    try {
      const exp = await fetchLotExpenses(lotDateKey);
      setMarketAmt(exp.marketExpenses > 0 ? String(exp.marketExpenses) : '');
      setMarketNote(exp.marketNote);
      setPondAmt(exp.pondExpenses > 0 ? String(exp.pondExpenses) : '');
      setPondNote(exp.pondNote);
      onExpensesChange?.(exp);
    } catch (e) {
      console.warn('fetchLotExpenses', e);
      onExpensesChange?.({
        marketExpenses: 0,
        marketNote: '',
        pondExpenses: 0,
        pondNote: '',
      });
    } finally {
      setLoaded(true);
    }
  }, [lotDateKey, onExpensesChange]);

  useEffect(() => {
    load();
  }, [load]);

  const expenses = useMemo(() => ({
    marketExpenses: parseFloat(marketAmt) || 0,
    marketNote: marketNote.trim(),
    pondExpenses: parseFloat(pondAmt) || 0,
    pondNote: pondNote.trim(),
  }), [marketAmt, marketNote, pondAmt, pondNote]);

  useEffect(() => {
    if (!loaded) return;
    onExpensesChange?.(expenses);
  }, [expenses, loaded, onExpensesChange]);

  const transportTotal = sumLotTransport(stockBatches, lotDateKey);
  const miscTotal = totalMiscExpenses(expenses);

  const handleSave = async () => {
    setSaving(true);
    try {
      await saveLotExpenses(lotDateKey, expenses);
      alert('✅ บันทึกรายจ่ายล็อตแล้ว');
      await load();
    } catch (e) {
      console.error(e);
      alert(e?.message || 'บันทึกไม่สำเร็จ');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      {standalone && (
        <div className="bg-white p-5 rounded-[2rem] shadow-sm space-y-3">
          <h2 className="font-black text-slate-800 text-lg">รายจ่ายล็อต</h2>
          <p className="text-xs text-slate-500 leading-relaxed">
            แยกฝั่งแผงตลาด (ขายกุ้งตาย) กับฝั่งบ่อ/ส่งของเป็น · ค่ารถใส่ตอนรับเข้า
            แอปไม่เดาให้ — ใส่ยอดและหมายเหตุเอง
          </p>
          <label className="text-xs font-bold text-slate-500 block">ล็อต (วันรับเข้า)</label>
          <select
            value={lotDateKey}
            onChange={(e) => setLotDateKey(e.target.value)}
            className="w-full p-3 bg-slate-50 rounded-2xl font-bold text-slate-800 outline-none"
          >
            {lotDays.length === 0 ? (
              <option value={todayKey}>ยังไม่มีรับเข้า</option>
            ) : (
              lotDays.map((d) => (
                <option key={d.dateKey} value={d.dateKey}>{d.label}</option>
              ))
            )}
          </select>
        </div>
      )}

      <div className="bg-slate-100 border border-slate-200 p-4 rounded-2xl">
        <p className="text-xs font-bold text-slate-700">ค่าขนส่ง / ค่ารถ</p>
        <p className="text-[10px] text-slate-500 mt-1 leading-relaxed">
          ใส่ตอนแท็บ「รับกุ้งเข้า」ช่องค่ารถ — รวมในต้นทุนล็อตแล้ว (ไม่ใส่ซ้ำที่นี่)
        </p>
        <p className="text-lg font-black text-slate-800 mt-2">
          {transportTotal > 0 ? fmtBaht(transportTotal) : '—'}
          {transportTotal > 0 && (
            <span className="text-xs font-normal text-slate-500 ml-2">
              ล็อต
              {formatReceiveDayLabel(lotDateKey)}
            </span>
          )}
        </p>
      </div>

      <ExpenseBlock
        title="บ่อ / ส่งของเป็น"
        amountLabel="จ่ายรายวันกุ้งเป็น (฿)"
        amount={pondAmt}
        note={pondNote}
        onAmount={setPondAmt}
        onNote={setPondNote}
        noteHint="**** กรุณาระบุให้ชัดเจน จ่ายค่าจ้าง · ค่าน้ำมัน · ค่าลูกน้ำ · อื่นๆ ****"
        notePlaceholder="เช่น จ้าง 600 น้ำมัน 400 ลูกน้ำ 2 ก้อน"
        accent="border-blue-200 bg-blue-50/80"
      />

      <ExpenseBlock
        title="ตลาดนัด — ขายกุ้งตาย"
        amountLabel="จ่ายรายวันกุ้งตาย (ตลาดนัด) (฿)"
        amount={marketAmt}
        note={marketNote}
        onAmount={setMarketAmt}
        onNote={setMarketNote}
        noteHint="**** กรุณาระบุให้ชัดเจน จ่ายค่าจ้าง · ค่าลูกน้ำ · อื่นๆ ****"
        notePlaceholder="เช่น จ้างแผง 500 ลูกน้ำ 3 ก้อน"
        accent="border-orange-200 bg-orange-50/80"
      />

      <div className="bg-white p-4 rounded-2xl border border-slate-200 flex justify-between items-center">
        <span className="text-xs font-bold text-slate-600">รวมรายจ่ายจิปาถะ (แผง + บ่อ)</span>
        <span className="text-lg font-black text-slate-800">{fmtBaht(miscTotal)}</span>
      </div>

      <button
        type="button"
        onClick={handleSave}
        disabled={saving || !loaded}
        className="w-full py-3 rounded-2xl bg-purple-600 text-white font-bold text-sm disabled:opacity-60"
      >
        {saving ? 'กำลังบันทึก...' : 'บันทึกรายจ่ายล็อต'}
      </button>
    </div>
  );
}
