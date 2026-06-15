/**
 * ยอดขาย/แก้ววันนี้แบบ real-time — source เดียวกับ header (dailySummaryService)
 */
export default function DailySummaryStickyBar({ t, dailySummary, loadError = false }) {
  const sales = Math.round(Number(dailySummary?.salesTotal) || 0);
  const cups = Math.round(Number(dailySummary?.cupsSold) || 0);
  const posSales = Math.round(Number(dailySummary?.posSalesTotal) || 0);
  const posCups = Math.round(Number(dailySummary?.posCupsSold) || 0);
  const orderCount = Math.round(Number(dailySummary?.orderCount) || 0);

  return (
    <div className="px-3 py-2 shrink-0 z-20 border-b border-amber-900/20" style={{ background: '#3d1f0f' }}>
      <p className="text-[9px] font-bold text-amber-400/90 uppercase tracking-wider mb-1.5">
        {t('dailyStickyTitle')}
        {loadError && (
          <span className="ml-2 text-red-300 normal-case">{t('dailyStickyLoadError')}</span>
        )}
      </p>
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-xl px-3 py-2 flex justify-between items-center bg-amber-500/90">
          <span className="text-[11px] font-bold text-amber-950 leading-tight">{t('todaySales')}</span>
          <span className="text-lg font-black text-white">฿{sales.toLocaleString()}</span>
        </div>
        <div className="rounded-xl px-3 py-2 flex justify-between items-center bg-emerald-600/90">
          <span className="text-[11px] font-bold text-emerald-100 leading-tight">{t('finalCupsSold')}</span>
          <span className="text-lg font-black text-white">{cups.toLocaleString()}</span>
        </div>
      </div>
      {(posSales > 0 || posCups > 0 || orderCount > 0) && (
        <p className="mt-1.5 text-[9px] font-bold text-amber-300/70 text-center">
          {t('dailyStickyPosHint')
            .replace('{sales}', posSales.toLocaleString())
            .replace('{cups}', String(posCups))
            .replace('{orders}', String(orderCount))}
        </p>
      )}
    </div>
  );
}
