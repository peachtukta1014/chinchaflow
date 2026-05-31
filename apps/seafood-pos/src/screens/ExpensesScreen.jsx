import React, { lazy, Suspense } from 'react';

const LotExpensesPanel = lazy(() => import('../components/LotExpensesPanel'));

function PanelLoading() {
  return (
    <div className="py-10 text-center text-slate-400 text-sm font-medium">กำลังโหลด...</div>
  );
}

/**
 * หน้าบันทึกรายจ่ายล็อต — ทุกคนเข้าถึงได้ (ไม่จำกัดแอดมิน)
 */
export default function ExpensesScreen({ stockBatches = [] }) {
  return (
    <div className="p-5">
      <Suspense fallback={<PanelLoading />}>
        <LotExpensesPanel stockBatches={stockBatches} standalone />
      </Suspense>
    </div>
  );
}
