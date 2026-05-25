import React, { useMemo } from 'react';
import { dateKeyBangkok } from '../lib/date';
import { groupBatchesByReceiveDay } from '../lib/stockBatchUtils';
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

export default function StockLotTimeline({ stockBatches = [], viewDate, onViewDateChange }) {
  const lotDays = useMemo(() => groupBatchesByReceiveDay(stockBatches), [stockBatches]);
  const day = lotDays.find((d) => d.dateKey === viewDate);
  const todayKey = dateKeyBangkok();
  const receiveCount = day?.itemCount ?? 0;
  const totalCost = day?.totalCost ?? 0;

  return (
    <div className="space-y-4">
      <DateNavBar
        dateKey={viewDate}
        onDateChange={onViewDateChange}
        subtitle={loadingSubtitle(receiveCount, totalCost)}
      />
      <p className="text-[11px] text-slate-500 px-1 leading-relaxed">
        ล็อตรับเข้าตามวัน · 1 วัน = 1 ล็อต · ขายออกวันเก่าก่อน (FIFO)
      </p>
      {!day || day.items.length === 0 ? (
        <div className="bg-white p-8 rounded-[2rem] shadow-sm text-center text-slate-400">
          <p className="font-bold">ไม่มีรายการรับเข้าวันนี้</p>
          <p className="text-xs mt-1">เลื่อนวันหรือแตะปฏิทินเพื่อดูประวัติ</p>
        </div>
      ) : (
        <div
          className={`bg-white p-5 rounded-[2rem] shadow-sm border-l-4 ${
            viewDate === todayKey ? 'border-emerald-400' : 'border-blue-400'
          }`}
        >
          <div className="flex justify-between items-start mb-3">
            <div>
              <p className="font-black text-slate-800">
                {viewDate === todayKey ? '📅 วันนี้' : '📅'}
                {' '}
                {day.label}
              </p>
              <p className="text-xs text-slate-500 mt-0.5">{day.itemCount} รายการรับเข้า</p>
            </div>
            <div className="text-right">
              <p className="text-[10px] text-slate-400">คงเหลือรวมวันนี้</p>
              <p className="font-black text-blue-700 text-sm">
                เป็น {day.remainingLive.toFixed(1)} · ตาย {day.remainingDead.toFixed(1)} กก.
              </p>
            </div>
          </div>
          <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-1">
            {day.items.map((b, idx) => (
              <div key={b.id} className="rounded-2xl border border-slate-100 bg-slate-50/80 p-3">
                <div className="flex justify-between items-start gap-2">
                  <p className="text-xs font-bold text-slate-600">
                    รายการที่ {idx + 1}
                    {b.note ? ` · ${b.note}` : ''}
                  </p>
                  <p className="text-xs font-black text-blue-600 shrink-0">
                    ฿{(b.effectiveCostPerKg || 0).toFixed(2)}/กก.
                  </p>
                </div>
                <div className="flex gap-3 mt-1.5 text-[11px] text-slate-600">
                  <span>สด {(parseFloat(b.remainingLiveKg ?? b.liveKg) || 0).toFixed(1)} กก.</span>
                  <span>ตาย {(parseFloat(b.remainingDeadKg ?? b.deadKg) || 0).toFixed(1)} กก.</span>
                  <span className="text-slate-400">รับ {formatBatchPurchaseDate(b.purchaseDate)}</span>
                </div>
                <p className="text-[10px] text-slate-400 mt-1">
                  ซื้อ ฿{(b.costPerKg || 0).toLocaleString()}/กก.
                  {b.transport > 0 && ` · ค่ารถ ฿${Number(b.transport).toLocaleString()}`}
                  {' · '}
                  ต้นทุนรวม ฿{(b.totalCost || 0).toLocaleString()}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function loadingSubtitle(count, totalCost) {
  if (!count) return '0 รายการรับเข้า';
  return `${count} รายการ · ฿${Number(totalCost).toLocaleString()}`;
}
