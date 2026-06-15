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
import { canAccessTeaTab } from '../lib/teaRoles';

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
  member,
}) {
  const [loading, setLoading] = useState(true);
  const [todaySales, setTodaySales] = useState(0);
  const [orderCount, setOrderCount] = useState(0);
  const [operatingProfit, setOperatingProfit] = useState(0);
  const [staffPresent, setStaffPresent] = useState(0);
  const [todayWage, setTodayWage] = useState(0);
  const [periodWage, setPeriodWage] = useState(0);
  const [periodDays, setPeriodDays] = useState(0);
  const canOpen = useCallback(
    (id) => canAccessTeaTab(member, id),
    [member],
  );
  const canViewFinancials = canOpen('profit') || canOpen('payroll');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const period = getBiweeklyPeriodForDate(todayKey);
      const [dailySummary, restocks, attendance, staffList, periodSummary] = await Promise.all([
        fetchTeaDailySummary(todayKey),
        fsQueryRestocksByDate(todayKey),
        canViewFinancials ? fsQueryStaffAttendanceByDate(todayKey) : Promise.resolve([]),
        canViewFinancials ? listAttendanceStaff() : Promise.resolve([]),
        canViewFinancials ? getPeriodAttendanceSummary(period.startKey, period.endKey) : Promise.resolve([]),
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
  }, [canViewFinancials, todayKey]);

  useEffect(() => {
    load();
  }, [load]);

  const quickLinks = [
    { id: 'order-close', label: t('orderSubTabClose'), icon: '📊' },
    { id: 'profit', label: t('profitTabShort'), icon: '💰' },
    { id: 'payroll', label: t('payrollTabShort'), icon: '📅' },
    { id: 'restock', label: t('restockTabShort'), icon: '📦', badge: pendingRestocks },
    { id: 'history', label: t('historyTabShort'), icon: '🕘' },
    { id: 'admin', label: t('adminTabShort'), icon: '⚙️' },
  ].filter((link) => {
    if (link.id === 'order-close') return canOpen('order');
    return canOpen(link.id);
  });

  return (
    <div className="px-4 pt-2 pb-8 space-y-3">
      {loading ? (
        <p className="text-center text-stone-400 text-sm py-6">{t('loading')}</p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2">
            {canOpen('profit') && (
              <StatCard
                label={t('dashboardOperatingProfit')}
                value={`฿${operatingProfit.toLocaleString()}`}
                sub={t('dashboardProfitHint')}
                accent="#166534"
                onClick={() => onNavigate?.('profit')}
              />
            )}
            {canOpen('payroll') && (
              <StatCard
                label={t('dashboardTodayWage')}
                value={`฿${todayWage.toLocaleString()}`}
                sub={`${staffPresent} ${t('staffAttendanceDaysUnit')}`}
                accent="#5b21b6"
                onClick={() => onNavigate?.('payroll')}
              />
            )}
            {canOpen('payroll') && (
              <StatCard
                label={t('dashboardPeriodWage')}
                value={`฿${periodWage.toLocaleString()}`}
                sub={`${periodDays} ${t('staffAttendanceDaysUnit')} · ${t('payrollTabShort')}`}
                accent="#7c3aed"
                onClick={() => onNavigate?.('payroll')}
              />
            )}
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
                  onClick={() => onNavigate?.(link.id === 'order-close' ? 'summary' : link.id)}
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
