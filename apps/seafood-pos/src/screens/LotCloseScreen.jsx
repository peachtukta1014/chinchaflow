import React, { lazy, Suspense, useCallback, useEffect, useState } from 'react';
import { isLotClosed } from '../services/lotCloseService';
import { groupBatchesByReceiveDay } from '../lib/stockBatchUtils';

const LotReportPanel = lazy(() => import('../components/LotReportPanel'));
const StockCountPanel = lazy(() => import('../components/StockCountPanel'));
const LotHistoryPanel = lazy(() => import('../components/LotHistoryPanel'));

function PanelLoading() {
  return (
    <div className="py-10 text-center text-slate-400 text-sm font-medium">กำลังโหลด...</div>
  );
}

/**
 * สรุปล็อต + ชั่งปิด + ประวัติล็อต — แอดมินเท่านั้น
 *
 * แท็บย่อย:
 *  1. สรุป+ชั่งปิด  — LotReportPanel (สรุป P&L + ปิดล็อต) + StockCountPanel (ชั่งปิดทั้งบ่อ)
 *  2. ประวัติล็อต   — LotHistoryPanel (รายการล็อตที่ปิดแล้ว)
 */
export default function LotCloseScreen({
  stock,
  stockBatches = [],
  updateMainStock,
  member,
  onStockMoved,
}) {
  const [section, setSection] = useState('report');
  const [closedLotKeys, setClosedLotKeys] = useState(new Set());

  // pre-load which lots are already closed (check against existing batches)
  useEffect(() => {
    const lotDays = groupBatchesByReceiveDay(stockBatches);
    if (!lotDays.length) return;
    Promise.all(lotDays.map((d) => isLotClosed(d.dateKey).then((closed) => ({ key: d.dateKey, closed }))))
      .then((results) => {
        const closed = new Set(results.filter((r) => r.closed).map((r) => r.key));
        setClosedLotKeys(closed);
      })
      .catch(() => {});
  }, [stockBatches]);

  const handleLotClosed = useCallback((lotDateKey) => {
    setClosedLotKeys((prev) => new Set([...prev, lotDateKey]));
    onStockMoved?.();
  }, [onStockMoved]);

  return (
    <div className="p-5 space-y-4">
      {/* ── sub-tab switcher ─────────────────────────────────────────────── */}
      <div className="flex bg-slate-200 p-1 rounded-2xl gap-1">
        <button
          type="button"
          onClick={() => setSection('report')}
          className={`flex-1 py-2.5 font-bold text-xs rounded-xl ${
            section === 'report' ? 'bg-white text-purple-700' : 'text-slate-500'
          }`}
        >
          สรุป + ชั่งปิด
        </button>
        <button
          type="button"
          onClick={() => setSection('history')}
          className={`flex-1 py-2.5 font-bold text-xs rounded-xl ${
            section === 'history' ? 'bg-white text-purple-700' : 'text-slate-500'
          }`}
        >
          ประวัติล็อต
        </button>
      </div>

      {/* ── สรุป + ชั่งปิด ──────────────────────────────────────────────── */}
      {section === 'report' && (
        <Suspense fallback={<PanelLoading />}>
          <LotReportPanel
            stockBatches={stockBatches}
            active
            member={member}
            onLotClosed={handleLotClosed}
            closedLotKeys={closedLotKeys}
          />

          <div className="my-2 border-t-2 border-dashed border-slate-200" />

          <StockCountPanel
            stock={stock}
            stockBatches={stockBatches}
            updateMainStock={updateMainStock}
            member={member}
            onDone={onStockMoved}
          />
        </Suspense>
      )}

      {/* ── ประวัติล็อต ─────────────────────────────────────────────────── */}
      {section === 'history' && (
        <Suspense fallback={<PanelLoading />}>
          <LotHistoryPanel />
        </Suspense>
      )}
    </div>
  );
}
