import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { formatViewDateLabel } from '../lib/date';
import {
  computePortfolioOverview,
  formatMonthLabel,
  formatYearLabel,
} from '../lib/lotPortfolioStats';
import { fetchLotSummaries } from '../services/lotCloseService';

function fmtBaht(n) {
  return `฿${Math.round(parseFloat(n) || 0).toLocaleString()}`;
}

function fmtKg(n) {
  return `${(parseFloat(n) || 0).toFixed(1)} กก.`;
}

function NetValue({ value, size = 'lg', onDark = false }) {
  const v = parseFloat(value) || 0;
  const sizeClass = size === 'xl' ? 'text-3xl' : size === 'lg' ? 'text-xl' : 'text-base';
  const tone = onDark
    ? v >= 0
      ? 'text-emerald-400'
      : 'text-red-400'
    : v >= 0
      ? 'text-emerald-600'
      : 'text-red-600';
  return (
    <span className={`font-black tabular-nums ${sizeClass} ${tone}`}>
      {v >= 0 ? '+' : ''}
      {fmtBaht(v)}
    </span>
  );
}

function PeriodChip({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-1.5 rounded-full text-[11px] font-bold ${
        active ? 'bg-purple-600 text-white' : 'bg-slate-100 text-slate-600'
      }`}
    >
      {children}
    </button>
  );
}

function BucketTable({ title, rows, labelFn }) {
  if (!rows.length) {
    return (
      <div className="bg-white rounded-2xl p-4 border border-slate-200">
        <h3 className="font-bold text-slate-800 text-sm mb-2">{title}</h3>
        <p className="text-xs text-slate-400">ยังไม่มีข้อมูลในช่วงที่เลือก</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl p-4 border border-slate-200 overflow-hidden">
      <h3 className="font-bold text-slate-800 text-sm mb-3">{title}</h3>
      <div className="space-y-2">
        {rows.map((row) => (
          <div
            key={row.key}
            className="flex items-center justify-between gap-2 text-xs border-b border-slate-50 pb-2 last:border-0 last:pb-0"
          >
            <div className="min-w-0">
              <p className="font-bold text-slate-800">{labelFn(row.key)}</p>
              <p className="text-[10px] text-slate-500">
                {row.lotCount} ล็อต · ทุน {fmtBaht(row.totalCost)} · ขาย {fmtBaht(row.revenue)}
              </p>
            </div>
            <NetValue value={row.netProfit} size="sm" />
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * ภาพรวมลงทุนล็อต — กำไรสะสม · ทุนคงคลัง · สถิติรายเดือน/ปี
 */
export default function LotPortfolioPanel({ stockBatches = [], closedLotKeys = new Set() }) {
  const [summaries, setSummaries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [period, setPeriod] = useState('all');
  const [statsView, setStatsView] = useState('month');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await fetchLotSummaries(120);
      setSummaries(rows);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const overview = useMemo(
    () =>
      computePortfolioOverview({
        closedSummaries: summaries,
        stockBatches,
        closedLotKeys,
        period,
      }),
    [summaries, stockBatches, closedLotKeys, period],
  );

  const { closed, inventory, openLotCount, avgNetPerLot, roiPct } = overview;

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-black text-slate-800 text-lg">ภาพรวมลงทุนล็อต</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            สะสมจากล็อตที่ปิดแล้ว + ทุนคงคลังปัจจุบัน (ตามต้นทุนรับเข้า)
          </p>
        </div>
        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="text-xs font-bold text-purple-600 bg-purple-50 px-3 py-2 rounded-xl disabled:opacity-50 shrink-0"
        >
          {loading ? 'โหลด...' : 'รีเฟรช'}
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        <PeriodChip active={period === 'all'} onClick={() => setPeriod('all')}>
          ทั้งหมด
        </PeriodChip>
        <PeriodChip active={period === 'year'} onClick={() => setPeriod('year')}>
          ปีนี้
        </PeriodChip>
        <PeriodChip active={period === 'month'} onClick={() => setPeriod('month')}>
          เดือนนี้
        </PeriodChip>
      </div>

      <div className="bg-gradient-to-br from-slate-900 via-purple-950 to-slate-900 rounded-[1.75rem] p-5 text-white space-y-4">
        <div>
          <p className="text-purple-200/80 text-xs font-bold mb-1">กำไรสุทธิสะสม (ล็อตปิดแล้ว)</p>
          <NetValue value={closed.netProfit} size="xl" onDark />
          <p className="text-slate-400 text-[11px] mt-1">
            {closed.count} ล็อตปิดแล้ว
            {closed.count > 0 && (
              <>
                {' '}
                · เฉลี่ย {fmtBaht(avgNetPerLot)}/ล็อต
                {roiPct !== 0 && (
                  <>
                    {' '}
                    · ROI {roiPct >= 0 ? '+' : ''}
                    {roiPct.toFixed(1)}%
                  </>
                )}
              </>
            )}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white/10 rounded-xl p-3">
            <p className="text-slate-400 text-[10px] font-bold mb-1">ทุนคงคลัง (ประเมินต้นทุน)</p>
            <p className="text-lg font-black text-cyan-300">{fmtBaht(inventory.baht)}</p>
            <p className="text-[10px] text-slate-400 mt-0.5">{fmtKg(inventory.totalKg)} คงเหลือ</p>
          </div>
          <div className="bg-white/10 rounded-xl p-3">
            <p className="text-slate-400 text-[10px] font-bold mb-1">ลงทุนสะสม (ล็อตปิด)</p>
            <p className="text-lg font-black text-amber-200">{fmtBaht(closed.totalCost)}</p>
            <p className="text-[10px] text-slate-400 mt-0.5">รับเข้า {fmtKg(closed.receivedKg)}</p>
          </div>
        </div>

        {openLotCount > 0 && (
          <p className="text-[11px] text-amber-200/90 bg-amber-500/10 border border-amber-400/20 rounded-xl px-3 py-2">
            มี {openLotCount} ล็อตยังเปิดอยู่ (ยังไม่ปิดบัญชี) — กำไรสุทธิจะครบเมื่อปิดล็อตที่แท็บ「สรุป + ชั่งปิด」
          </p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="bg-white rounded-xl p-3 border border-slate-200">
          <p className="text-slate-500 mb-1">รายได้รวม (ปิดแล้ว)</p>
          <p className="font-black text-emerald-700 text-base">{fmtBaht(closed.revenue)}</p>
        </div>
        <div className="bg-white rounded-xl p-3 border border-slate-200">
          <p className="text-slate-500 mb-1">กำไรขั้นต้น</p>
          <p
            className={`font-black text-base ${
              closed.grossProfit >= 0 ? 'text-emerald-700' : 'text-red-600'
            }`}
          >
            {fmtBaht(closed.grossProfit)}
          </p>
        </div>
        <div className="bg-white rounded-xl p-3 border border-slate-200 col-span-2">
          <p className="text-slate-500 mb-1">มูลค่าสูญเสียรวม (ล็อตปิด)</p>
          <p className="font-black text-red-600 text-base">{fmtBaht(closed.shrinkageBaht)}</p>
        </div>
      </div>

      <div className="flex bg-slate-100 p-1 rounded-xl gap-1">
        <button
          type="button"
          onClick={() => setStatsView('month')}
          className={`flex-1 py-2 font-bold text-[11px] rounded-lg ${
            statsView === 'month' ? 'bg-white text-purple-700 shadow-sm' : 'text-slate-500'
          }`}
        >
          รายเดือน
        </button>
        <button
          type="button"
          onClick={() => setStatsView('year')}
          className={`flex-1 py-2 font-bold text-[11px] rounded-lg ${
            statsView === 'year' ? 'bg-white text-purple-700 shadow-sm' : 'text-slate-500'
          }`}
        >
          รายปี
        </button>
      </div>

      {statsView === 'month' ? (
        <BucketTable
          title="สรุปต่อเดือน (วันรับรถ)"
          rows={overview.byMonth}
          labelFn={formatMonthLabel}
        />
      ) : (
        <BucketTable
          title="สรุปต่อปี (วันรับรถ)"
          rows={overview.byYear}
          labelFn={formatYearLabel}
        />
      )}

      {overview.recentLots.length > 0 && (
        <div className="bg-white rounded-2xl p-4 border border-slate-200">
          <h3 className="font-bold text-slate-800 text-sm mb-3">ล็อตล่าสุด (ในช่วงที่เลือก)</h3>
          <div className="space-y-2">
            {overview.recentLots.map((s) => (
              <div
                key={s.lotDateKey || s.id}
                className="flex justify-between items-center text-xs gap-2"
              >
                <div>
                  <p className="font-bold text-slate-800">{formatViewDateLabel(s.lotDateKey)}</p>
                  <p className="text-[10px] text-slate-500">ทุน {fmtBaht(s.totalCost)}</p>
                </div>
                <NetValue value={s.netLotProfit} size="sm" />
              </div>
            ))}
          </div>
        </div>
      )}

      <p className="text-[10px] text-slate-400 leading-relaxed px-1">
        ตัวเลขกำไรมาจาก snapshot ตอนปิดล็อต · ทุนคงคลัง = ต้นทุนตาม batch ที่เหลือ (ยังไม่รวมกำไรจากการขายในอนาคต)
        · ใช้วางแผนรอบล็อต / เดือน / ปีได้จากแถบด้านบน
      </p>
    </div>
  );
}
