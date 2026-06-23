import React from 'react';
import { formatViewDateLabel } from '../lib/date';
import DateNavBar from '../components/DateNavBar';
import StockLotTimeline from '../components/StockLotTimeline';
import { SHRIMP_DAMAGE, STOCK_LINE } from '../constants/stockLines';

function formatTime(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '—';
  }
}

export default function StockBatchList({
  stockBatches,
  stockLine,
  tab,
  lotViewDate,
  setLotViewDate,
  lotPondTransfers,
  deadInboundHistory,
  historyLoading,
  historyViewDate,
  setHistoryViewDate,
}) {
  return (
    <>
      {tab === 'lots' && (
        <StockLotTimeline
          stockBatches={stockBatches}
          stockLine={stockLine}
          viewDate={lotViewDate}
          onViewDateChange={setLotViewDate}
          pondTransfers={stockLine === 'dead' ? lotPondTransfers : []}
        />
      )}

      {stockLine === 'dead' && tab === 'history' && (
        <div className="bg-white p-5 rounded-[2rem] shadow-sm space-y-4">
          <h3 className="font-bold text-red-700">ประวัติรับ — {STOCK_LINE.dead.label}</h3>
          <p className="text-[11px] text-slate-500">รับตรง + ยอดจากบ่อ ({STOCK_LINE.live.tag})</p>
          <DateNavBar
            dateKey={historyViewDate}
            onDateChange={setHistoryViewDate}
            subtitle={historyLoading ? 'โหลด...' : 'ตามวัน'}
          />
          {historyLoading ? (
            <p className="text-center text-slate-400 py-6 text-sm">กำลังโหลด...</p>
          ) : (
            <div className="space-y-4 max-h-[50vh] overflow-y-auto pr-1">
              {deadInboundHistory.directReceives?.length > 0 && (
                <div>
                  <p className="text-xs font-bold text-slate-500 mb-2">รับตายตรง</p>
                  {deadInboundHistory.directReceives.map((b) => (
                    <div key={b.id} className="border border-red-100 rounded-xl p-3 mb-2">
                      <p className="text-[10px] text-red-600 font-bold">📥 รับตรง</p>
                      <p className="font-black text-red-600 text-lg">
                        {(parseFloat(b.deadKg) || 0).toFixed(2)} กก.
                      </p>
                      {b.note && <p className="text-xs text-slate-500">{b.note}</p>}
                    </div>
                  ))}
                </div>
              )}
              {deadInboundHistory.spoilageDead?.length > 0 && (
                <div>
                  <p className="text-xs font-bold text-slate-500 mb-2">{SHRIMP_DAMAGE.full}</p>
                  {deadInboundHistory.spoilageDead.map((row) => (
                    <div key={row.id} className="border border-amber-100 rounded-xl p-3 mb-2">
                      <p className="text-[10px] font-bold text-amber-800">⚠️ สายตาย</p>
                      <p className="font-black text-amber-900 text-lg">
                        {(parseFloat(row.weightKg) || 0).toFixed(2)} กก.
                      </p>
                      {row.note && <p className="text-xs text-slate-500">{row.note}</p>}
                    </div>
                  ))}
                </div>
              )}
              {deadInboundHistory.fromPond?.length > 0 && (
                <div>
                  <p className="text-xs font-bold text-slate-500 mb-2">ส่งมาจากบ่อ (สายเป็น)</p>
                  {deadInboundHistory.fromPond.map((row) => (
                    <div key={row.id} className="border border-slate-100 rounded-xl p-3 mb-2">
                      <div className="flex justify-between">
                        <span className="text-[10px] font-bold text-red-700 bg-red-50 px-2 py-0.5 rounded-full">
                          🔄 จากบ่อ
                        </span>
                        <span className="text-[10px] text-slate-400">{formatTime(row.createdAt)}</span>
                      </div>
                      <p className="font-black text-red-600 text-lg mt-1">
                        {(parseFloat(row.weightKg) || 0).toFixed(2)} กก.
                      </p>
                      {row.note && <p className="text-xs text-slate-500">{row.note}</p>}
                    </div>
                  ))}
                </div>
              )}
              {!deadInboundHistory.directReceives?.length
                && !deadInboundHistory.fromPond?.length
                && !deadInboundHistory.spoilageDead?.length && (
                <p className="text-center text-slate-400 py-6 text-sm">
                  ไม่มีรายการ
                  {' '}
                  {formatViewDateLabel(historyViewDate)}
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </>
  );
}
