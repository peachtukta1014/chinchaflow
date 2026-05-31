import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { STOCK_LINE } from '../constants/stockLines';
import StockLineSwitcher from './StockLineSwitcher';
import { dateKeyBangkok } from '../lib/date';
import {
  emptyExpenseLineForm,
  formStateToLines,
  linesToFormState,
  sumExpenseLines,
} from '../lib/lotExpenseLines';
import {
  formatLotDayOptionLabel,
  formatReceiveDayLabel,
  groupBatchesByReceiveDay,
  newestLotDateKey,
  pickDefaultLotDateKey,
} from '../lib/stockBatchUtils';
import {
  fetchLotExpenses,
  saveLotExpenses,
  sumLotTransport,
  totalMiscExpenses,
} from '../services/lotExpenseService';

function fmtBaht(n) {
  return `฿${Math.round(parseFloat(n) || 0).toLocaleString()}`;
}

function ExpenseLineBlock({
  title,
  accent,
  hintItems,
  formLines,
  onChangeLines,
}) {
  const subtotal = useMemo(
    () => sumExpenseLines(formStateToLines(formLines)),
    [formLines],
  );

  const updateRow = (index, field, value) => {
    onChangeLines(
      formLines.map((row, i) => (i === index ? { ...row, [field]: value } : row)),
    );
  };

  const addRow = () => {
    onChangeLines([...formLines, emptyExpenseLineForm()]);
  };

  const removeRow = (index) => {
    if (formLines.length <= 1) {
      onChangeLines([emptyExpenseLineForm()]);
      return;
    }
    onChangeLines(formLines.filter((_, i) => i !== index));
  };

  return (
    <div className={`rounded-2xl border p-4 space-y-3 ${accent}`}>
      {title && <p className="text-xs font-bold text-slate-800">{title}</p>}
      <div className="text-[11px] font-bold text-amber-900 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5 space-y-1">
        <p>เพิ่มทีละรายการ — ระบบรวมยอดให้ (คล้ายบิล)</p>
        <ul className="list-disc list-inside font-semibold text-amber-800 space-y-0.5">
          {hintItems.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </div>

      <div className="space-y-2">
        {formLines.map((row, index) => (
          <div key={`line-${index}`} className="flex gap-2 items-start">
            <input
              type="text"
              value={row.label}
              onChange={(e) => updateRow(index, 'label', e.target.value)}
              placeholder="รายการ เช่น ค่าน้ำมัน"
              className="flex-1 min-w-0 p-3 bg-white rounded-xl text-sm text-slate-800 outline-none border border-slate-100 placeholder:text-slate-400"
            />
            <input
              type="number"
              min="0"
              step="1"
              value={row.amount}
              onChange={(e) => updateRow(index, 'amount', e.target.value)}
              placeholder="฿"
              className="w-24 shrink-0 p-3 bg-white rounded-xl font-bold text-slate-800 outline-none border border-slate-100 text-right"
            />
            <button
              type="button"
              onClick={() => removeRow(index)}
              className="shrink-0 w-10 h-12 rounded-xl text-red-500 font-bold text-lg bg-white border border-slate-100"
              aria-label="ลบรายการ"
            >
              ×
            </button>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={addRow}
        className="w-full py-2.5 rounded-xl border-2 border-dashed border-slate-300 text-slate-600 text-xs font-bold"
      >
        + เพิ่มรายการ
      </button>

      <div className="flex justify-between items-center pt-1 border-t border-slate-200/80">
        <span className="text-xs font-bold text-slate-600">รวมสายนี้</span>
        <span className="text-lg font-black text-slate-800">{fmtBaht(subtotal)}</span>
      </div>
    </div>
  );
}

/**
 * รายจ่ายล็อต — แยกแผงตลาดกับบ่อ/ส่งของเป็น · รายการย่อยรวมยอด
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
  const newestKey = useMemo(() => newestLotDateKey(lotDays), [lotDays]);
  const defaultLotKey = useMemo(() => pickDefaultLotDateKey(lotDays), [lotDays]);

  const [internalLotKey, setInternalLotKey] = useState(() => defaultLotKey);
  const lotDateKey = controlledLotKey ?? internalLotKey;
  const setLotDateKey = onLotDateKeyChange ?? setInternalLotKey;

  const [marketForm, setMarketForm] = useState([emptyExpenseLineForm()]);
  const [pondForm, setPondForm] = useState([emptyExpenseLineForm()]);
  const [expenseLine, setExpenseLine] = useState('live');
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (lotDays.some((d) => d.dateKey === lotDateKey)) return;
    if (defaultLotKey) setLotDateKey(defaultLotKey);
  }, [lotDays, lotDateKey, defaultLotKey, setLotDateKey]);

  const expensesFromForm = useMemo(() => {
    const marketLines = formStateToLines(marketForm);
    const pondLines = formStateToLines(pondForm);
    const marketExpenses = sumExpenseLines(marketLines);
    const pondExpenses = sumExpenseLines(pondLines);
    return {
      marketExpenses,
      marketLines,
      marketNote: marketLines.map((l) => `${l.label} ${l.amount}`).join(' \u00b7 '),
      pondExpenses,
      pondLines,
      pondNote: pondLines.map((l) => `${l.label} ${l.amount}`).join(' \u00b7 '),
    };
  }, [marketForm, pondForm]);

  const load = useCallback(async () => {
    if (!lotDateKey) return;
    setLoaded(false);
    try {
      const exp = await fetchLotExpenses(lotDateKey);
      setMarketForm(linesToFormState(exp.marketLines));
      setPondForm(linesToFormState(exp.pondLines));
      onExpensesChange?.(exp);
    } catch (e) {
      console.warn('fetchLotExpenses', e);
      onExpensesChange?.({
        marketExpenses: 0,
        marketLines: [],
        marketNote: '',
        pondExpenses: 0,
        pondLines: [],
        pondNote: '',
      });
    } finally {
      setLoaded(true);
    }
  }, [lotDateKey, onExpensesChange]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!loaded) return;
    onExpensesChange?.(expensesFromForm);
  }, [expensesFromForm, loaded, onExpensesChange]);

  const transportTotal = sumLotTransport(stockBatches, lotDateKey);
  const miscTotal = totalMiscExpenses(expensesFromForm);

  const handleSave = async () => {
    setSaving(true);
    try {
      const saved = await saveLotExpenses(lotDateKey, {
        marketLines: formStateToLines(marketForm),
        pondLines: formStateToLines(pondForm),
      });
      alert('✅ บันทึกรายจ่ายล็อตแล้ว');
      setMarketForm(linesToFormState(saved.marketLines));
      setPondForm(linesToFormState(saved.pondLines));
      onExpensesChange?.(saved);
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
            แยกสาย {STOCK_LINE.live.tag} / {STOCK_LINE.dead.tag} ด้านล่าง · กรอกทีละรายการแล้วกดบันทึก · ค่ารถใส่ตอนรับเข้า
          </p>
          <StockLineSwitcher line={expenseLine} onChange={setExpenseLine} />
          <label className="text-xs font-bold text-slate-500 block">ล็อต (วันรับรถ)</label>
          <p className="text-[10px] text-slate-400 mb-1">ค่าเริ่มต้น = ล็อตล่าสุด (ตรงหน้าสรุปแอดมิน)</p>
          <select
            value={lotDateKey}
            onChange={(e) => setLotDateKey(e.target.value)}
            className="w-full p-3 bg-slate-50 rounded-2xl font-bold text-slate-800 outline-none"
          >
            {lotDays.length === 0 ? (
              <option value={todayKey}>ยังไม่มีรับเข้า</option>
            ) : (
              lotDays.map((d) => (
                <option key={d.dateKey} value={d.dateKey}>
                  {formatLotDayOptionLabel(d, { newestKey })}
                </option>
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

      {(!standalone || expenseLine === 'live') && (
        <ExpenseLineBlock
          title={standalone ? STOCK_LINE.live.full : `บ่อ / ${STOCK_LINE.live.full}`}
          hintItems={['ค่าจ้าง', 'ค่าน้ำมัน', 'ค่าน้ำแข็ง', 'อื่นๆ']}
          formLines={pondForm}
          onChangeLines={setPondForm}
          accent="border-blue-200 bg-blue-50/80"
        />
      )}

      {(!standalone || expenseLine === 'dead') && (
        <ExpenseLineBlock
          title={standalone ? STOCK_LINE.dead.full : `ตลาดนัด — ${STOCK_LINE.dead.full}`}
          hintItems={['ค่าจ้าง', 'ค่าน้ำแข็ง', 'อื่นๆ']}
          formLines={marketForm}
          onChangeLines={setMarketForm}
          accent="border-orange-200 bg-orange-50/80"
        />
      )}

      {standalone && (
        <p className="text-[10px] text-center text-slate-400">
          สลับแถบด้านบนเพื่อกรอกสายอีกฝั่ง · บันทึกครั้งเดียวรวมทั้งสองสาย
        </p>
      )}

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
