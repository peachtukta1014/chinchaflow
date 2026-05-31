import React, { useCallback, useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { STOCK_LINE } from '../constants/stockLines';
import { formatReceiveDayLabel } from '../lib/stockBatchUtils';
import { fetchLotExpenses, totalMiscExpenses } from '../services/lotExpenseService';

function fmtBaht(n) {
  return `฿${Math.round(parseFloat(n) || 0).toLocaleString()}`;
}

function ReadOnlyExpenseBlock({ title, accent, lines, total }) {
  const hasLines = lines?.length > 0;
  return (
    <div className={`rounded-2xl border p-4 space-y-2 ${accent}`}>
      <div className="flex justify-between items-center gap-2">
        <p className="text-xs font-bold text-slate-800">{title}</p>
        <span className="text-sm font-black text-slate-800">{fmtBaht(total)}</span>
      </div>
      {hasLines ? (
        <ul className="text-[11px] text-slate-600 space-y-1">
          {lines.map((row) => (
            <li key={`${row.label}-${row.amount}`} className="flex justify-between gap-2">
              <span className="truncate">{row.label}</span>
              <span className="shrink-0 font-bold tabular-nums">{fmtBaht(row.amount)}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-[11px] text-slate-400">ยังไม่มีรายการ — บันทึกที่แท็บ「รายจ่าย」</p>
      )}
    </div>
  );
}

/**
 * แสดงรายจ่ายล็อตจาก Firestore (อ่านอย่างเดียว) — หน้าสรุปแอดมิน
 */
export default function LotExpensesSyncPanel({
  lotDateKey,
  onExpensesLoaded,
  refreshRef,
}) {
  const [expenses, setExpenses] = useState(null);
  const [loading, setLoading] = useState(false);

  const reload = useCallback(async () => {
    if (!lotDateKey) return null;
    setLoading(true);
    try {
      const exp = await fetchLotExpenses(lotDateKey);
      setExpenses(exp);
      onExpensesLoaded?.(exp);
      return exp;
    } catch (e) {
      console.warn('LotExpensesSyncPanel', e);
      const empty = {
        marketExpenses: 0,
        marketLines: [],
        marketNote: '',
        pondExpenses: 0,
        pondLines: [],
        pondNote: '',
      };
      setExpenses(empty);
      onExpensesLoaded?.(empty);
      return empty;
    } finally {
      setLoading(false);
    }
  }, [lotDateKey, onExpensesLoaded]);

  useEffect(() => {
    reload();
  }, [reload]);

  useEffect(() => {
    if (refreshRef) refreshRef.current = reload;
  }, [refreshRef, reload]);

  const miscTotal = expenses ? totalMiscExpenses(expenses) : 0;

  return (
    <div className="bg-white p-5 rounded-[2rem] shadow-sm border border-purple-100 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="font-black text-slate-800 text-sm">รายจ่ายล็อต (ซิงค์จากแท็บรายจ่าย)</h3>
          <p className="text-[10px] text-slate-500 mt-1 leading-relaxed">
            ล็อต
            {' '}
            {formatReceiveDayLabel(lotDateKey)}
            {' '}
            · กรอก/แก้ที่แท็บ「รายจ่าย」เท่านั้น — หน้านี้ดึงยอดมาแสดงและรวมในสรุป
          </p>
        </div>
        <button
          type="button"
          onClick={() => reload()}
          disabled={loading}
          className="shrink-0 p-2 rounded-xl bg-slate-100 text-slate-600 disabled:opacity-50"
          aria-label="รีเฟรชรายจ่าย"
        >
          <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      <ReadOnlyExpenseBlock
        title={`บ่อ / ${STOCK_LINE.live.full}`}
        accent="border-blue-200 bg-blue-50/60"
        lines={expenses?.pondLines}
        total={expenses?.pondExpenses ?? 0}
      />
      <ReadOnlyExpenseBlock
        title={`ตลาดนัด — ${STOCK_LINE.dead.full}`}
        accent="border-orange-200 bg-orange-50/60"
        lines={expenses?.marketLines}
        total={expenses?.marketExpenses ?? 0}
      />

      <div className="flex justify-between items-center pt-2 border-t border-slate-100">
        <span className="text-xs font-bold text-slate-600">รวมรายจ่ายจิปาถะ (เป็น + ตาย)</span>
        <span className="text-lg font-black text-slate-800">
          {loading && !expenses ? '…' : fmtBaht(miscTotal)}
        </span>
      </div>
    </div>
  );
}
