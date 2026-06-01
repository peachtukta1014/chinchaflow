import React, { useMemo } from 'react';
import { dateKeyBangkok, formatViewDateLabel } from '../lib/date';
import { batchLineMetrics } from '../lib/lotCostSplit';
import { groupBatchesByReceiveDayForLine } from '../lib/stockBatchUtils';
import { STOCK_LINE } from '../constants/stockLines';
import DateNavBar from './DateNavBar';

function formatBatchPurchaseDate(value) {
  if (!value) return '—';
  if (typeof value?.toDate === 'function') {
    return value.toDate().toLocaleDateString('th-TH', {
      day: 'numeric',
      month: 'short',
      year: '2-digit',
    });
  }
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('th-TH', {
    day: 'numeric',
    month: 'short',
    year: '2-digit',
  });
}

function formatTime(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '—';
  }
}

function sumPondToDeadKg(adjustments = []) {
  return adjustments.reduce((s, adj) => {
    const kg = (adj.allocations || []).reduce(
      (a, al) => a + (parseFloat(al.deadAdded ?? al.liveTaken) || 0),
      0,
    );
    return s + kg;
  }, 0);
}

export default function StockLotTimeline({
  stockBatches = [],
  stockLine = 'live',
  viewDate,
  onViewDateChange,
  pondTransfers = [],
}) {
  const lineMeta = STOCK_LINE[stockLine] ?? STOCK_LINE.live;
  const lotDays = useMemo(
    () => groupBatchesByReceiveDayForLine(stockBatches, stockLine),
    [stockBatches, stockLine],
  );
  const day = lotDays.find((d) => d.dateKey === viewDate);
  const todayKey = dateKeyBangkok();
  const receiveCount = day?.itemCount ?? 0;
  const lineCostBaht = day?.lineCostBaht ?? 0;
  const pondKg = sumPondToDeadKg(pondTransfers);

  const borderCls = stockLine === 'live' ? 'border-blue-400' : 'border-red-400';
  const accentCls = stockLine === 'live' ? 'text-blue-700' : 'text-red-700';
  const cardAccentCls = stockLine === 'live' ? 'text-blue-600' : 'text-red-600';

  return (
    <div className="space-y-4">
      <DateNavBar
        dateKey={viewDate}
        onDateChange={onViewDateChange}
        subtitle={loadingSubtitle(receiveCount, lineCostBaht, lineMeta.label)}
      />

      <p className="text-[11px] text-slate-500 px-1 leading-relaxed">
        ล็อตรับเข้า ·
        {' '}
        <strong>{lineMeta.full}</strong>
        {' '}
        · 1 วัน = 1 ล็อต · ขายออกวันเก่าก่อน (FIFO)
      </p>

      {stockLine === 'live' && (
        <p className="text-[10px] text-blue-800 bg-blue-50 border border-blue-100 rounded-xl px-3 py-2 leading-relaxed">
          ต้นทุนรับเข้าตัดที่สาย
          {' '}
          <strong>{STOCK_LINE.live.label}</strong>
          {' '}
          — เมื่อย้ายไป
          {' '}
          {STOCK_LINE.dead.label}
          {' '}
          ในบ่อ ทุนไม่เพิ่มซ้ำ (ใช้ทุนเป็น) · สรุป P&amp;L รวมสองสายที่แอดมิน「สรุปล็อต」
        </p>
      )}

      {stockLine === 'dead' && (
        <p className="text-[10px] text-red-800 bg-red-50 border border-red-100 rounded-xl px-3 py-2 leading-relaxed">
          แสดงเฉพาะ
          {' '}
          <strong>รับตายตรง</strong>
          {' '}
          ในล็อตวันนี้ · ยอดจากบ่อ → ตาย (ทุนตัดที่
          {' '}
          {STOCK_LINE.live.label}
          {' '}
          แล้ว) ดูด้านล่างหรือแท็บ「ในบ่อ」
        </p>
      )}

      {!day || day.items.length === 0 ? (
        <div className="bg-white p-8 rounded-[2rem] shadow-sm text-center text-slate-400">
          <p className="font-bold">
            ไม่มีรับเข้า
            {' '}
            {lineMeta.label}
            {' '}
            {formatViewDateLabel(viewDate)}
          </p>
          <p className="text-xs mt-1">เลื่อนวันก่อนหน้า หรือแตะปฏิทิน</p>
          {stockLine === 'dead' && pondKg > 0.001 && (
            <p className="text-xs mt-3 text-red-600 font-medium">
              วันนี้มีย้ายจากบ่อ
              {' '}
              {pondKg.toFixed(1)}
              {' '}
              กก. (ไม่นับเป็นรับตายตรง)
            </p>
          )}
        </div>
      ) : (
        <div
          className={`bg-white p-5 rounded-[2rem] shadow-sm border-l-4 ${
            viewDate === todayKey ? 'border-emerald-400' : borderCls
          }`}
        >
          <div className="flex justify-between items-start mb-3">
            <div>
              <p className="font-black text-slate-800">
                {viewDate === todayKey ? '📅 วันนี้' : '📅'}
                {' '}
                {day.label}
              </p>
              <p className="text-xs text-slate-500 mt-0.5">
                {day.itemCount}
                {' '}
                รายการ ·
                {' '}
                {lineMeta.label}
              </p>
            </div>
            <div className="text-right">
              <p className="text-[10px] text-slate-400">คงเหลือสายนี้</p>
              <p className={`font-black text-sm ${accentCls}`}>
                {day.remainingKg.toFixed(1)}
                {' '}
                กก.
              </p>
            </div>
          </div>

          <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-1">
            {day.items.map((b, idx) => {
              const m = batchLineMetrics(b, stockLine);
              return (
                <div key={b.id} className="rounded-2xl border border-slate-100 bg-slate-50/80 p-3">
                  <div className="flex justify-between items-start gap-2">
                    <p className="text-xs font-bold text-slate-600">
                      รายการที่
                      {' '}
                      {idx + 1}
                      {b.note ? ` · ${b.note}` : ''}
                    </p>
                    <p className={`text-xs font-black shrink-0 ${cardAccentCls}`}>
                      ฿{m.costPerKg.toFixed(2)}/กก.
                    </p>
                  </div>
                  <div className="flex gap-3 mt-1.5 text-[11px] text-slate-600 flex-wrap">
                    <span>
                      {lineMeta.tag}
                      {' '}
                      {m.remainingKg.toFixed(1)}
                      {' '}
                      กก. คงเหลือ
                    </span>
                    <span className="text-slate-400">
                      รับ
                      {' '}
                      {m.receivedKg.toFixed(1)}
                      {' '}
                      กก.
                    </span>
                    <span className="text-slate-400">รับ {formatBatchPurchaseDate(b.purchaseDate)}</span>
                  </div>
                  {b.sizeBreakdown && b.sizeBreakdown.mode === 'by_size' && stockLine === 'live' && (
                    <p className="text-[10px] text-indigo-500 mt-1">
                      ไซต์: A
                      {' '}
                      {(b.sizeBreakdown.A || 0).toFixed(2)}
                      {' · '}
                      B
                      {' '}
                      {(b.sizeBreakdown.B || 0).toFixed(2)}
                      {' · '}
                      C
                      {' '}
                      {(b.sizeBreakdown.C || 0).toFixed(2)}
                      {' '}
                      กก.
                    </p>
                  )}
                  {b.sizeBreakdown && b.sizeBreakdown.mode === 'mixed' && stockLine === 'live' && (
                    <p className="text-[10px] text-slate-400 mt-0.5">ไซต์: รวมไซต์</p>
                  )}
                  <p className="text-[10px] text-slate-400 mt-1">
                    ซื้อ ฿{m.purchaseCostPerKg.toLocaleString()}/กก.
                    {m.transport > 0 && ` · ค่ารถ (รวมในล็อต) ฿${Number(m.transport).toLocaleString()}`}
                    {' · '}
                    ต้นทุนสายนี้ ฿{Math.round(m.lineReceivedCostBaht).toLocaleString()}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {stockLine === 'dead' && pondTransfers.length > 0 && (
        <div className="bg-orange-50 border border-orange-200 rounded-[1.5rem] p-4 space-y-2">
          <p className="text-xs font-black text-orange-900">
            ย้ายจากบ่อ →
            {' '}
            {STOCK_LINE.dead.label}
            {' '}
            (วันนี้)
          </p>
          <p className="text-[10px] text-orange-800 leading-relaxed">
            ทุนตัดที่
            {' '}
            {STOCK_LINE.live.label}
            {' '}
            แล้ว — ไม่เพิ่มต้นทุนรับเข้าตายซ้ำ · ขายตายเพื่อคืนทุน/ลดขาดทุน
          </p>
          <p className="text-sm font-black text-orange-900">
            รวม
            {' '}
            {pondKg.toFixed(1)}
            {' '}
            กก.
          </p>
          <ul className="space-y-1.5 max-h-32 overflow-y-auto">
            {pondTransfers.map((adj) => {
              const kg = (adj.allocations || []).reduce(
                (a, al) => a + (parseFloat(al.deadAdded ?? al.liveTaken) || 0),
                0,
              );
              if (kg <= 0.001) return null;
              return (
                <li
                  key={adj.id || `${adj.recordedAt}-${kg}`}
                  className="text-[11px] text-slate-700 bg-white/80 rounded-xl px-3 py-2 flex justify-between gap-2"
                >
                  <span>
                    {kg.toFixed(1)}
                    {' '}
                    กก.
                    {adj.note ? ` · ${adj.note}` : ''}
                  </span>
                  <span className="text-slate-400 shrink-0">{formatTime(adj.recordedAt)}</span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

function loadingSubtitle(count, totalCost, lineLabel) {
  if (!count) return `0 รายการรับเข้า · ${lineLabel}`;
  return `${count} รายการ · ${lineLabel} · ฿${Number(totalCost).toLocaleString()}`;
}
