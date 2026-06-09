import { useCallback, useEffect, useState } from 'react';
import { shiftDateKey } from '../lib/constants';
import { computeDayLedger } from '../lib/dailyLedger';
import { formatDateKeyLabel } from '../lib/localeFormat';
import {
  fsQueryExpenses,
  fsQueryOrders,
  fsQueryRestocksByDate,
  fsQueryStaffAttendanceByDate,
} from '../lib/firestoreRest';
import { restockPurchaseTotal } from '../lib/restockService';
import { listAttendanceStaff } from '../lib/staffAttendanceService';
import { wageMapFromStaffList } from '../lib/staffWage';
import { pushTeaLineSummary } from '../lib/lineNotify';

function Money({ n, className = '' }) {
  const v = Math.round(n || 0);
  return (
    <span className={className}>
      ฿{v.toLocaleString()}
    </span>
  );
}

function LedgerRow({ label, amount, negative, detail }) {
  return (
    <div className="flex justify-between items-start gap-2 py-2 border-b border-stone-100 last:border-0 text-sm">
      <div className="min-w-0">
        <span className="text-stone-700">{label}</span>
        {detail && <p className="text-[10px] text-stone-400 mt-0.5 truncate">{detail}</p>}
      </div>
      <span className={`font-black shrink-0 ${negative ? 'text-red-500' : 'text-stone-800'}`}>
        {negative && amount > 0 ? '−' : ''}
        <Money n={amount} />
      </span>
    </div>
  );
}

export function ProfitTab({ t, lang = 'th', viewDateKey, setViewDateKey, todayKey }) {
  const [ledger, setLedger] = useState(null);
  const [loading, setLoading] = useState(true);
  const [lineSending, setLineSending] = useState(false);
  const [lineFlash, setLineFlash] = useState('');

  const isToday = viewDateKey === todayKey;

  const loadLedger = useCallback(async () => {
    setLoading(true);
    try {
      const [orders, expenses, restocks, attendance, staffList] = await Promise.all([
        fsQueryOrders(viewDateKey),
        fsQueryExpenses(viewDateKey),
        fsQueryRestocksByDate(viewDateKey),
        fsQueryStaffAttendanceByDate(viewDateKey),
        listAttendanceStaff(),
      ]);
      const wageMap = wageMapFromStaffList(staffList);
      setLedger(
        computeDayLedger({
          orders,
          expenses,
          restocks,
          attendance,
          wageMap,
        }),
      );
    } catch (e) {
      console.error(e);
      setLedger(null);
    }
    setLoading(false);
  }, [viewDateKey]);

  useEffect(() => {
    loadLedger();
  }, [loadLedger]);

  const sendLineSummary = async () => {
    setLineSending(true);
    setLineFlash('');
    try {
      await pushTeaLineSummary(viewDateKey);
      setLineFlash(t('lineSummarySent'));
      setTimeout(() => setLineFlash(''), 3000);
    } catch (e) {
      console.error(e);
      setLineFlash(`⚠️ ${e.message || t('lineSummaryFailed')}`);
    }
    setLineSending(false);
  };

  return (
    <div className="px-4 pt-3 pb-8 space-y-3">
      <div className="flex items-center gap-2 bg-white rounded-2xl p-2 border border-violet-200 shadow-sm">
        <button
          type="button"
          onClick={() => setViewDateKey(shiftDateKey(viewDateKey, -1))}
          className="w-10 h-10 rounded-xl bg-violet-50 font-black text-violet-800"
        >
          ‹
        </button>
        <div className="flex-1 text-center min-w-0">
          <p className="font-black text-sm text-stone-800 truncate">
            {formatDateKeyLabel(viewDateKey, lang, { year: true })}
          </p>
          {isToday ? (
            <p className="text-[10px] text-violet-600 font-bold">{t('todayLabel')}</p>
          ) : (
            <button
              type="button"
              onClick={() => setViewDateKey(todayKey)}
              className="text-[10px] text-amber-700 font-bold underline"
            >
              {t('backToday')}
            </button>
          )}
        </div>
        <button
          type="button"
          disabled={viewDateKey >= todayKey}
          onClick={() => setViewDateKey(shiftDateKey(viewDateKey, 1))}
          className="w-10 h-10 rounded-xl bg-violet-50 font-black text-violet-800 disabled:opacity-30"
        >
          ›
        </button>
      </div>

      <p className="text-[10px] text-stone-500 text-center leading-relaxed px-2">
        {t('profitTabHint')}
      </p>

      {lineFlash && (
        <p
          className={`text-center text-xs font-bold py-2 rounded-xl ${
            lineFlash.startsWith('✅') ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'
          }`}
        >
          {lineFlash}
        </p>
      )}

      <button
        type="button"
        disabled={lineSending}
        onClick={sendLineSummary}
        className="w-full py-2.5 rounded-2xl font-bold text-sm text-white flex items-center justify-center gap-2 disabled:opacity-60"
        style={{ background: '#1a8f4c' }}
      >
        {lineSending ? '⏳' : '📲'} {t('sendLineSummary')}
      </button>

      {loading && (
        <p className="text-center text-sm text-stone-400 py-8">{t('loading')}</p>
      )}

      {!loading && ledger && (
        <>
          <div className="rounded-3xl p-5 text-white shadow-lg" style={{ background: '#4c1d95' }}>
            <p className="text-violet-200 text-[10px] font-bold uppercase tracking-widest">
              {t('profitOperatingTitle')}
            </p>
            <p className={`text-4xl font-black mt-1 leading-none ${ledger.operatingProfit >= 0 ? 'text-white' : 'text-red-200'}`}>
              <Money n={ledger.operatingProfit} />
            </p>
            <p className="text-violet-200/90 text-[10px] mt-2">{t('profitBreakdownHint')}</p>
            <p className="text-[10px] text-violet-300/80 mt-1">
              {ledger.totalCups} {t('cupUnit')} · {ledger.orderCount} {t('orders')}
            </p>
          </div>

          <div className="bg-white rounded-3xl p-4 border border-stone-200 shadow-sm space-y-1">
            <p className="font-bold text-emerald-700 text-[10px] uppercase mb-2">{t('profitRevenueSection')}</p>
            <LedgerRow label={t('cash')} amount={ledger.cashTotal} />
            <LedgerRow label={t('transfer')} amount={ledger.transferTotal} />
            <div className="flex justify-between pt-2 mt-1 border-t border-stone-200 text-sm font-black">
              <span>{t('profitRevenueTotal')}</span>
              <Money n={ledger.totalSales} className="text-emerald-700" />
            </div>
          </div>

          <div className="bg-white rounded-3xl p-4 border border-stone-200 shadow-sm space-y-1">
            <p className="font-bold text-red-600 text-[10px] uppercase mb-2">{t('profitExpenseSection')}</p>
            {ledger.expenseItems.length === 0 && ledger.totalRestockPurchased === 0 ? (
              <p className="text-stone-400 text-xs py-2">{t('profitNoExpenses')}</p>
            ) : (
              <>
                {ledger.expenseItems.map((e, i) => (
                  <LedgerRow
                    key={e.id || i}
                    label={e.description || '—'}
                    amount={e.amount || 0}
                    negative
                  />
                ))}
                {ledger.purchasedRestocks.map((r) => (
                  <LedgerRow
                    key={r.id}
                    label={t('restockPurchasesSection')}
                    detail={(r.items || []).map((it) => it.name).filter(Boolean).join(', ') || '—'}
                    amount={restockPurchaseTotal(r)}
                    negative
                  />
                ))}
              </>
            )}
            <div className="flex justify-between pt-2 mt-1 border-t border-stone-200 text-sm font-black">
              <span>{t('profitExpenseTotal')}</span>
              <span className="text-red-500">
                −<Money n={ledger.totalExpenses + ledger.totalRestockPurchased} />
              </span>
            </div>
          </div>

          <div className="bg-amber-50 rounded-3xl p-4 border border-amber-200">
            <p className="font-bold text-amber-900 text-[10px] uppercase mb-2">{t('profitWageTicketTitle')}</p>
            <p className="text-xs text-amber-800/90 mb-3 leading-relaxed">{t('profitWageTicketHint')}</p>
            {ledger.staffWageRows?.length > 0 ? (
              <div className="space-y-2">
                {ledger.staffWageRows.map((row) => (
                  <div key={row.staffUid} className="bg-white rounded-2xl p-3 border border-amber-100 flex justify-between items-center text-sm">
                    <div>
                      <p className="font-bold text-stone-800">{row.staffName}</p>
                      <p className="text-[10px] text-stone-500">
                        {t('profitStaffPresent')} · ฿{row.wageRate}/{t('staffAttendancePerDay')}
                      </p>
                    </div>
                    <span className="text-lg font-black text-amber-800"><Money n={row.wage} /></span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-stone-500 text-center py-2">{t('profitStaffAbsent')}</p>
            )}
            <div className="flex justify-between items-center mt-3 pt-2 border-t border-amber-100 text-sm">
              <span className="font-bold text-amber-900">{t('dashboardTodayWage')}</span>
              <span className="font-black text-amber-800"><Money n={ledger.wageCost} /></span>
            </div>
            <div className="flex justify-between items-center mt-3 pt-3 border-t border-amber-200/80 text-sm">
              <span className="font-bold text-amber-900">{t('profitAfterWageTitle')}</span>
              <span className={`text-xl font-black ${ledger.afterWage >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
                <Money n={ledger.afterWage} />
              </span>
            </div>
            <p className="text-[10px] text-amber-700/80 mt-2 text-center">{t('profitAfterWageHint')}</p>
          </div>
        </>
      )}
    </div>
  );
}
