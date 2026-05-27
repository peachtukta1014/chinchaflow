import React, { lazy, Suspense, useState } from 'react';

const LotReportPanel = lazy(() => import('../components/LotReportPanel'));
const StockCountPanel = lazy(() => import('../components/StockCountPanel'));

function PanelLoading() {
  return (
    <div className="py-10 text-center text-slate-400 text-sm font-medium">กำลังโหลด...</div>
  );
}

/**
 * สรุปล็อต + ชั่งปิด — แท็บแอดมินด้านบน (รวมเป็นหน้าเดียว)
 */
export default function LotCloseScreen({
  stock,
  stockBatches = [],
  updateMainStock,
  member,
  onStockMoved,
}) {
  const [section, setSection] = useState('report');

  return (
    <div className="p-5 space-y-4">
      <div className="flex bg-slate-200 p-1 rounded-2xl gap-1">
        <button
          type="button"
          onClick={() => setSection('report')}
          className={`flex-1 py-2.5 font-bold text-xs rounded-xl ${
            section === 'report' ? 'bg-white text-purple-700' : 'text-slate-500'
          }`}
        >
          สรุปล็อต
        </button>
        <button
          type="button"
          onClick={() => setSection('count')}
          className={`flex-1 py-2.5 font-bold text-xs rounded-xl ${
            section === 'count' ? 'bg-white text-purple-700' : 'text-slate-500'
          }`}
        >
          ชั่งปิด
        </button>
      </div>

      {section === 'report' && (
        <Suspense fallback={<PanelLoading />}>
          <LotReportPanel stockBatches={stockBatches} active />
        </Suspense>
      )}

      {section === 'count' && (
        <Suspense fallback={<PanelLoading />}>
          <StockCountPanel
            stock={stock}
            stockBatches={stockBatches}
            updateMainStock={updateMainStock}
            member={member}
            onDone={onStockMoved}
          />
        </Suspense>
      )}
    </div>
  );
}
