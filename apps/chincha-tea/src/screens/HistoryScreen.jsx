import { useCallback, useEffect, useState } from 'react';
import { shiftDateKey } from '../lib/constants';
import { formatDateKeyLabel, formatTimeLabel } from '../lib/localeFormat';
import { fetchTeaDailySummary } from '../lib/dailySummaryService';
import { cartItemDisplayName } from '../lib/displayNames';
import { pushTeaLineSummary } from '../lib/lineNotify';
import { isTeaAdmin } from '../lib/teaRoles';

function moneyLabel(value) {
  const n = Math.round(Number(value) || 0);
  return `฿${n.toLocaleString()}`;
}

function SummaryRow({ label, value, strong = false }) {
  return (
    <div className="flex items-center justify-between gap-3 py-1">
      <span className={`text-sm ${strong ? 'font-black text-stone-700' : 'font-bold text-stone-500'}`}>{label}</span>
      <span className={`${strong ? 'text-lg' : 'text-sm'} font-black text-stone-800`}>{value}</span>
    </div>
  );
}

export default function HistoryScreen({
  orders,
  viewDateKey,
  setViewDateKey,
  todayKey,
  t,
  lang = 'th',
  menuItems = [],
  member,
}) {
  const [loading, setLoading] = useState(true);
  const [daySummary, setDaySummary] = useState(null);
  const [lineSending, setLineSending] = useState(false);
  const [lineFlash, setLineFlash] = useState('');
  const isAdmin = isTeaAdmin(member);
  const closeDoc = daySummary?.dailySummaryDoc;

  const loadDay = useCallback(async () => {
    setLoading(true);
    try {
      const summary = await fetchTeaDailySummary(viewDateKey);
      setDaySummary(summary);
    } catch (e) {
      console.error(e);
      setDaySummary(null);
    }
    setLoading(false);
  }, [viewDateKey]);

  useEffect(() => {
    loadDay();
  }, [loadDay]);

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

  const totalSales = closeDoc
    ? (Number(closeDoc.cashAmount || closeDoc.cash_amount || 0)
      + Number(closeDoc.transferAmount || closeDoc.transfer_amount || 0)
      + Number(closeDoc.manualBulkTotal || closeDoc.manual_bulk_total || 0))
    : (daySummary?.salesTotal || 0);

  const cupsSold = closeDoc
    ? (Number(closeDoc.finalCupsSold || closeDoc.final_cups_sold || closeDoc.manualCupsSold || closeDoc.manual_cups_sold || closeDoc.cupsSold || 0)
      || Number(daySummary?.cupsSold || 0))
    : (daySummary?.cupsSold || 0);

  return (
    <div className="px-4 pt-3 pb-6 space-y-3">
      <div className="flex items-center gap-2 bg-white rounded-2xl p-2 border border-stone-200 mb-2">
        <button type="button" onClick={() => setViewDateKey(shiftDateKey(viewDateKey, -1))} className="w-9 h-9 rounded-xl bg-stone-100 font-black text-stone-600">‹</button>
        <p className="flex-1 text-center text-xs font-black text-stone-600">
          {viewDateKey === todayKey ? t('todaySales') : formatDateKeyLabel(viewDateKey, lang)}
        </p>
        <button type="button" disabled={viewDateKey >= todayKey} onClick={() => setViewDateKey(shiftDateKey(viewDateKey, 1))} className="w-9 h-9 rounded-xl bg-stone-100 font-black disabled:opacity-30">›</button>
      </div>

      {loading ? (
        <p className="text-center text-stone-400 text-sm py-8">{t('loading')}</p>
      ) : closeDoc ? (
        <div className="bg-white rounded-3xl p-4 border border-stone-200 shadow-sm space-y-3">
          <div className="rounded-2xl p-4 text-white" style={{ background: 'linear-gradient(145deg, #3d1f0f 0%, #5a2d14 100%)' }}>
            <p className="text-[10px] font-black uppercase tracking-wide text-amber-200/90">{t('historyDailyCloseTitle')}</p>
            <p className="text-3xl font-black text-amber-100 mt-1">{moneyLabel(totalSales)}</p>
            <p className="text-[11px] text-amber-200/80 mt-0.5">
              {cupsSold.toLocaleString()} {t('cupUnit')}
              {closeDoc.updatedBy || closeDoc.createdBy ? ` · ${closeDoc.updatedBy || closeDoc.createdBy}` : ''}
            </p>
            {(closeDoc.updatedAt || closeDoc.createdAt) && (
              <p className="text-[10px] text-amber-300/70 mt-1">
                {formatTimeLabel(closeDoc.updatedAt || closeDoc.createdAt, lang)}
              </p>
            )}
          </div>

          <SummaryRow label={t('dailyCash')} value={moneyLabel(closeDoc.cashAmount || closeDoc.cash_amount)} />
          <SummaryRow label={t('dailyTransfer')} value={moneyLabel(closeDoc.transferAmount || closeDoc.transfer_amount)} />
          <SummaryRow label={t('expenseAmount')} value={moneyLabel(closeDoc.storefrontExpense || closeDoc.expense_amount || closeDoc.amount)} />
          <SummaryRow label={t('dailyCashChangeRemaining')} value={moneyLabel(closeDoc.cashChangeRemaining || closeDoc.cash_change_remaining)} />
          <SummaryRow label={t('manualBulkTotal')} value={moneyLabel(closeDoc.manualBulkTotal || closeDoc.manual_bulk_total)} />
          <SummaryRow label={t('finalCupsSold')} value={`${cupsSold.toLocaleString()} ${t('cupUnit')}`} strong />

          {closeDoc.note && (
            <p className="text-xs text-stone-500 bg-stone-50 rounded-2xl px-3 py-2">{closeDoc.note}</p>
          )}

          {isAdmin && (
            <button
              type="button"
              disabled={lineSending}
              onClick={sendLineSummary}
              className="w-full min-h-12 py-3 rounded-2xl font-black text-sm text-white flex items-center justify-center gap-2 disabled:opacity-60 active:scale-95"
              style={{ background: '#1a8f4c' }}
            >
              {lineSending ? '⏳' : '📲'} {t('sendLineSummary')}
            </button>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-3xl p-6 border border-stone-200 text-center space-y-2">
          <p className="text-stone-400 text-sm">{t('historyNoCloseRecord')}</p>
          <p className="text-[11px] text-stone-300">{t('historyNoCloseHint')}</p>
        </div>
      )}

      {lineFlash && (
        <p className={`text-center text-xs font-bold py-2 rounded-xl ${lineFlash.startsWith('✅') ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'}`}>
          {lineFlash}
        </p>
      )}

      <details className="bg-white rounded-2xl border border-stone-200 overflow-hidden">
        <summary className="cursor-pointer px-4 py-3 text-xs font-black text-stone-500">
          {t('historyOrdersSection')} ({orders.length})
        </summary>
        <div className="px-4 pb-4 space-y-2 border-t border-stone-100">
          {orders.length === 0 ? (
            <p className="text-center text-stone-300 py-6 text-sm">{t('noOrders')}</p>
          ) : (
            orders.map((o, i) => (
              <div key={o.id || i} className="rounded-2xl p-3 border border-stone-100 bg-stone-50/50">
                <div className="flex justify-between mb-1">
                  <p className="text-[10px] text-stone-400">
                    {formatTimeLabel(o.createdAt, lang)}
                    {o.payType && <span className="ml-2 font-bold">{o.payType === 'cash' ? t('cash') : t('transfer')}</span>}
                  </p>
                  <p className="font-black text-sm" style={{ color: '#3d1f0f' }}>฿{(o.total || 0).toLocaleString()}</p>
                </div>
                {(o.items || []).map((it, j) => {
                  const { primary, sub } = cartItemDisplayName(it, lang, t, menuItems);
                  return (
                    <p key={j} className="text-xs text-stone-600">
                      {it.emoji} {it.qty}× {primary}
                      {sub ? <span className="block text-[10px] text-stone-400">{sub}</span> : null}
                    </p>
                  );
                })}
              </div>
            ))
          )}
        </div>
      </details>
    </div>
  );
}
