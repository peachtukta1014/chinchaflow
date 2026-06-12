import { useCallback, useEffect, useState } from 'react';
import { computeDayLedger } from '../lib/dailyLedger';
import { fetchTeaDailySummary } from '../lib/dailySummaryService';
import { getBiweeklyPeriodForDate } from '../lib/payrollPeriod';
import {
  fsQueryRestocksByDate,
  fsQueryStaffAttendanceByDate,
} from '../lib/firestoreRest';
import {
  getPeriodAttendanceSummary,
  listAttendanceStaff,
} from '../lib/staffAttendanceService';
import { wageMapFromStaffList } from '../lib/staffWage';

function StatCard({ label, value, sub, accent = '#3d1f0f', onClick }) {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={`rounded-2xl p-3 text-left border shadow-sm ${onClick ? 'active:scale-[0.98]' : ''}`}
      style={{ background: `${accent}08`, borderColor: `${accent}22` }}
    >
      <p className="text-[9px] font-bold uppercase tracking-wide text-stone-500">{label}</p>
      <p className="text-xl font-black mt-0.5" style={{ color: accent }}>{value}</p>
      {sub && <p className="text-[10px] text-stone-400 mt-0.5">{sub}</p>}
    </Tag>
  );
}

export function DashboardTab({
  t,
  todayKey,
  pendingRestocks = 0,
  onNavigate,
}) {
  const [loading, setLoading] = useState(true);
  const [todaySales, setTodaySales] = useState(0);
  const [orderCount, setOrderCount] = useState(0);
  const [operatingProfit, setOperatingProfit] = useState(0);
  const [staffPresent, setStaffPresent] = useState(0);
  const [todayWage, setTodayWage] = useState(0);
  const [periodWage, setPeriodWage] = useState(0);
  const [periodDays, setPeriodDays] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const period = getBiweeklyPeriodForDate(todayKey);
      const [dailySummary, restocks, attendance, staffList, periodSummary] = await Promise.all([
        fetchTeaDailySummary(todayKey),
        fsQueryRestocksByDate(todayKey),
        fsQueryStaffAttendanceByDate(todayKey),
        listAttendanceStaff(),
        getPeriodAttendanceSummary(period.startKey, period.endKey),
      ]);
      const wageMap = wageMapFromStaffList(staffList);
      const ledger = computeDayLedger({
        dailySummary,
        restocks,
        attendance,
        wageMap,
      });
      setTodaySales(ledger.totalSales);
      setOrderCount(ledger.orderCount);
      setOperatingProfit(ledger.operatingProfit);
      setStaffPresent(ledger.staffWageRows.length);
      setTodayWage(ledger.wageCost);
      const totalPeriodWage = periodSummary.reduce((s, r) => s + (r.wage || 0), 0);
      const totalPeriodDays = periodSummary.reduce((s, r) => s + (r.days || 0), 0);
      setPeriodWage(totalPeriodWage);
      setPeriodDays(totalPeriodDays);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  }, [todayKey]);

  useEffect(() => {
    load();
  }, [load]);

  const quickLinks = [
    { id: 'summary', label: t('summaryTabShort'), icon: '📊' },
    { id: 'profit', label: t('profitTabShort'), icon: '💰' },
    { id: 'payroll', label: t('payrollTabShort'), icon: '📅' },
    { id: 'restock', label: t('restockTabShort'), icon: '📦', badge: pendingRestocks },
    { id: 'admin', label: t('adminTabShort'), icon: '⚙️' },
  ];

  return (
    <div className="px-4 pt-2 pb-8 space-y-3">
      <div className="rounded-2xl p-4 text-white shadow-md" style={{ background: 'linear-gradient(145deg, #3d1f0f 0%, #5a2d14 100%)' }}>
        <p className="text-amber-200/90 text-[10px] font-bold uppercase tracking-wider">{t('dashboardTitle')}</p>
        <p className="text-2xl font-black text-amber-100 mt-1">฿{todaySales.toLocaleString()}</p>
        <p className="text-[11px] text-amber-200/80 mt-0.5">{t('dashboardTodaySales')} · {orderCount} {t('orders')}</p>
      </div>

      {loading ? (
        <p className="text-center text-stone-400 text-sm py-6">{t('loading')}</p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2">
            <StatCard
              label={t('dashboardOperatingProfit')}
              value={`฿${operatingProfit.toLocaleString()}`}
              sub={t('dashboardProfitHint')}
              accent="#166534"
              onClick={() => onNavigate?.('profit')}
            />
            <StatCard
              label={t('dashboardTodayWage')}
              value={`฿${todayWage.toLocaleString()}`}
              sub={`${staffPresent} ${t('staffAttendanceDaysUnit')}`}
              accent="#5b21b6"
              onClick={() => onNavigate?.('payroll')}
            />
            <StatCard
              label={t('dashboardPeriodWage')}
              value={`฿${periodWage.toLocaleString()}`}
              sub={`${periodDays} ${t('staffAttendanceDaysUnit')} · ${t('payrollTabShort')}`}
              accent="#7c3aed"
              onClick={() => onNavigate?.('payroll')}
            />
            <StatCard
              label={t('restockTabShort')}
              value={pendingRestocks > 0 ? `${pendingRestocks}` : '—'}
              sub={pendingRestocks > 0 ? t('dashboardRestockPending') : t('dashboardRestockClear')}
              accent="#b45309"
              onClick={() => onNavigate?.('restock')}
            />
          </div>

          <div>
            <p className="text-[9px] font-black uppercase tracking-wider text-amber-900/50 px-1 mb-2">
              {t('dashboardQuickLinks')}
            </p>
            <div className="grid grid-cols-3 gap-2">
              {quickLinks.map((link) => (
                <button
                  key={link.id}
                  type="button"
                  onClick={() => onNavigate?.(link.id)}
                  className="relative flex flex-col items-center justify-center gap-1 py-3 rounded-xl bg-white border border-stone-200 text-stone-700 active:scale-95"
                >
                  <span className="text-lg">{link.icon}</span>
                  <span className="text-[10px] font-bold leading-tight text-center">{link.label}</span>
                  {link.badge > 0 && (
                    <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[9px] font-black flex items-center justify-center">
                      {link.badge > 9 ? '9+' : link.badge}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
