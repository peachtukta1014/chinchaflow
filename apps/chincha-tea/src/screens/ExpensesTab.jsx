import { useEffect, useMemo, useState } from 'react';
import { dateKeyBangkok, shiftDateKey } from '../lib/constants';
import { formatDateKeyLabel } from '../lib/localeFormat';
import {
  fsGetDoc,
  fsQueryExpenses,
  fsQueryOrders,
  fsQueryRestocksByDate,
  fsUpsertDoc,
} from '../lib/firestoreRest';
import { sumOrderRevenue } from '../lib/dailyLedger';
import { sumPurchasedRestocks } from '../lib/restockService';

const MONEY_FIELDS = ['salesAmount', 'cashAmount', 'transferAmount', 'frontExpenseAmount'];
const SUMMARY_DOC_PREFIX = 'storefront-summary';
const SUMMARY_EXPENSE_PREFIX = 'storefront-expense';
const CUP_LOOKBACK_DAYS = 14;

function numberOnly(value) {
  return String(value ?? '').replace(/\D/g, '');
}

function toInt(value) {
  const n = parseInt(String(value ?? '').replace(/,/g, ''), 10);
  return Number.isFinite(n) ? n : 0;
}

function money(n) {
  const value = toInt(n);
  const sign = value < 0 ? '-' : '';
  return `${sign}฿${Math.abs(value).toLocaleString()}`;
}

function dateKeyToInputValue(dateKey) {
  return /^\d{4}-\d{2}-\d{2}$/.test(dateKey || '') ? dateKey : dateKeyBangkok();
}

function two(n) {
  return String(n).padStart(2, '0');
}

function normalizeYear(rawYear) {
  const y = parseInt(rawYear, 10);
  if (!Number.isFinite(y)) return null;
  if (y > 2400) return y - 543;
  if (y < 100) return 2000 + y;
  return y;
}

function parseSummaryText(text) {
  const raw = (text || '').trim();
  if (!raw) return null;
  const compact = raw.replace(/,/g, '');
  const readAmount = (...words) => {
    for (const word of words) {
      const re = new RegExp(`${word}\\s*[:=]?\\s*(\\d+(?:\\.\\d+)?)`, 'i');
      const match = compact.match(re);
      if (match) return Math.round(parseFloat(match[1]));
    }
    return 0;
  };
  const dateMatch = compact.match(/(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})/);
  let dateKey = '';
  if (dateMatch) {
    const day = parseInt(dateMatch[1], 10);
    const month = parseInt(dateMatch[2], 10);
    const year = normalizeYear(dateMatch[3]);
    if (year && month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      dateKey = `${year}-${two(month)}-${two(day)}`;
    }
  }
  return {
    dateKey,
    salesAmount: readAmount('ขายได้', 'ยอดขาย', 'ขาย'),
    cashAmount: readAmount('เงินสด', 'สด'),
    transferAmount: readAmount('เงินโอน', 'โอน'),
    frontExpenseAmount: readAmount('จ่ายออกหน้าร้าน', 'จ่ายออก', 'รายจ่าย', 'ค่าใช้จ่าย', 'จ่าย'),
    cupsSold: readAmount('จำนวนแก้วขายได้', 'แก้วขายได้', 'ขายได้.*แก้ว', 'แก้ว'),
    rawSummary: raw,
  };
}

function summaryDocId(dateKey) {
  return `${SUMMARY_DOC_PREFIX}-${dateKey}`;
}

function summaryExpenseDocId(dateKey) {
  return `${SUMMARY_EXPENSE_PREFIX}-${dateKey}`;
}

function cupStockDocId(dateKey) {
  return dateKey;
}

function createBlankSummary(dateKey) {
  return {
    dateKey,
    salesAmount: '',
    cashAmount: '',
    transferAmount: '',
    frontExpenseAmount: '',
    cupsSold: '',
    restockPurchaseAmount: 0,
    rawSummary: '',
  };
}

function createBlankCupStock(dateKey) {
  return {
    dateKey,
    openingCups: '',
    addedCups: '',
    cupsSold: '',
    remainingCups: 0,
  };
}

function Field({ label, value, onChange, suffix = 'บาท', readOnly = false, highlight = false }) {
  return (
    <label className={`block rounded-2xl border p-3 ${highlight ? 'bg-amber-50 border-amber-200' : 'bg-white border-stone-200'}`}>
      <span className="block text-[11px] font-black text-stone-500 mb-1">{label}</span>
      <div className="flex items-center gap-2">
        <input
          value={value ?? ''}
          onChange={(e) => onChange?.(numberOnly(e.target.value))}
          inputMode="numeric"
          readOnly={readOnly}
          className={`min-w-0 flex-1 bg-transparent text-right text-2xl font-black outline-none ${readOnly ? 'text-stone-500' : 'text-stone-900'}`}
          placeholder="0"
        />
        <span className="text-xs font-bold text-stone-400 shrink-0">{suffix}</span>
      </div>
    </label>
  );
}

function StatCard({ label, value, tone = 'stone' }) {
  const toneClass = tone === 'green'
    ? 'bg-emerald-50 border-emerald-100 text-emerald-800'
    : tone === 'red'
      ? 'bg-red-50 border-red-100 text-red-700'
      : 'bg-stone-50 border-stone-100 text-stone-800';
  return (
    <div className={`rounded-2xl border p-3 ${toneClass}`}>
      <p className="text-[10px] font-black opacity-70">{label}</p>
      <p className="text-xl font-black mt-1">{value}</p>
    </div>
  );
}

export function ExpensesTab({ member, t, lang = 'th', viewDateKey, setViewDateKey }) {
  const [summary, setSummary] = useState(() => createBlankSummary(viewDateKey));
  const [cupStock, setCupStock] = useState(() => createBlankCupStock(viewDateKey));
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [savingSummary, setSavingSummary] = useState(false);
  const [savingCups, setSavingCups] = useState(false);
  const [flash, setFlash] = useState('');

  const todayKey = dateKeyBangkok();
  const isToday = viewDateKey === todayKey;
  const isAdmin = member?.role === 'admin';

  const totals = useMemo(() => {
    const salesAmount = toInt(summary.salesAmount);
    const cashAmount = toInt(summary.cashAmount);
    const transferAmount = toInt(summary.transferAmount);
    const frontExpenseAmount = toInt(summary.frontExpenseAmount);
    const restockPurchaseAmount = toInt(summary.restockPurchaseAmount);
    const receivedAmount = cashAmount + transferAmount;
    const salesGap = salesAmount - receivedAmount;
    const netBeforeRestock = receivedAmount - frontExpenseAmount;
    const dayNet = netBeforeRestock - restockPurchaseAmount;
    return {
      salesAmount,
      cashAmount,
      transferAmount,
      frontExpenseAmount,
      restockPurchaseAmount,
      receivedAmount,
      salesGap,
      netBeforeRestock,
      dayNet,
    };
  }, [summary]);

  const cupTotals = useMemo(() => {
    const openingCups = toInt(cupStock.openingCups);
    const addedCups = toInt(cupStock.addedCups);
    const cupsSold = toInt(cupStock.cupsSold || summary.cupsSold);
    const remainingCups = Math.max(0, openingCups + addedCups - cupsSold);
    return { openingCups, addedCups, cupsSold, remainingCups };
  }, [cupStock, summary.cupsSold]);

  const showFlash = (message) => {
    setFlash(message);
    setTimeout(() => setFlash(''), 2200);
  };

  const findPreviousCupRemaining = async (dateKey) => {
    for (let i = 1; i <= CUP_LOOKBACK_DAYS; i += 1) {
      const prevKey = shiftDateKey(dateKey, -i);
      const prev = await fsGetDoc(`dailyCupStocks/${cupStockDocId(prevKey)}`);
      if (prev?.remainingCups !== undefined) return toInt(prev.remainingCups);
    }
    return 0;
  };

  const loadDay = async (dateKey) => {
    setLoading(true);
    try {
      const [orders, restocks, expenseRows, savedSummary, savedCupStock] = await Promise.all([
        fsQueryOrders(dateKey),
        fsQueryRestocksByDate(dateKey),
        fsQueryExpenses(dateKey),
        fsGetDoc(`dailyShopSummaries/${summaryDocId(dateKey)}`),
        fsGetDoc(`dailyCupStocks/${cupStockDocId(dateKey)}`),
      ]);
      const orderRevenue = sumOrderRevenue(orders);
      const restockPurchaseAmount = sumPurchasedRestocks(restocks);
      const baseSummary = {
        ...createBlankSummary(dateKey),
        salesAmount: orderRevenue.totalSales ? String(orderRevenue.totalSales) : '',
        cashAmount: orderRevenue.cashTotal ? String(orderRevenue.cashTotal) : '',
        transferAmount: orderRevenue.transferTotal ? String(orderRevenue.transferTotal) : '',
        cupsSold: orderRevenue.totalCups ? String(orderRevenue.totalCups) : '',
        restockPurchaseAmount,
      };
      setSummary({
        ...baseSummary,
        ...(savedSummary || {}),
        restockPurchaseAmount,
        dateKey,
      });
      if (savedCupStock) {
        setCupStock({ ...createBlankCupStock(dateKey), ...savedCupStock, dateKey });
      } else {
        const previousRemaining = await findPreviousCupRemaining(dateKey);
        setCupStock({
          ...createBlankCupStock(dateKey),
          openingCups: previousRemaining ? String(previousRemaining) : '',
          cupsSold: baseSummary.cupsSold,
        });
      }
      setExpenses(expenseRows.filter((e) => e.id !== summaryExpenseDocId(dateKey)));
    } catch (e) {
      console.error(e);
      alert(t('saveFailed'));
    }
    setLoading(false);
  };

  useEffect(() => {
    loadDay(viewDateKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewDateKey]);

  const updateSummaryField = (field, value) => {
    setSummary((prev) => ({ ...prev, [field]: value }));
    if (field === 'cupsSold') setCupStock((prev) => ({ ...prev, cupsSold: value }));
  };

  const applySummaryText = () => {
    const parsed = parseSummaryText(summary.rawSummary);
    if (!parsed) return;
    const nextDateKey = parsed.dateKey || viewDateKey;
    setSummary((prev) => ({
      ...prev,
      ...Object.fromEntries(
        [...MONEY_FIELDS, 'cupsSold']
          .filter((field) => parsed[field] > 0)
          .map((field) => [field, String(parsed[field])]),
      ),
      rawSummary: parsed.rawSummary,
      dateKey: nextDateKey,
    }));
    if (parsed.cupsSold > 0) setCupStock((prev) => ({ ...prev, cupsSold: String(parsed.cupsSold) }));
  };

  const saveSummary = async () => {
    const dateKey = summary.dateKey || viewDateKey;
    setSavingSummary(true);
    try {
      const now = new Date().toISOString();
      const payload = {
        dateKey,
        salesAmount: totals.salesAmount,
        cashAmount: totals.cashAmount,
        transferAmount: totals.transferAmount,
        frontExpenseAmount: totals.frontExpenseAmount,
        cupsSold: toInt(summary.cupsSold),
        receivedAmount: totals.receivedAmount,
        salesGap: totals.salesGap,
        restockPurchaseAmount: totals.restockPurchaseAmount,
        netBeforeRestock: totals.netBeforeRestock,
        dayNet: totals.dayNet,
        rawSummary: summary.rawSummary || '',
        updatedBy: member?.name || 'ชินชา',
        updatedByUid: member?.uid || '',
        updatedAt: now,
      };
      const existing = await fsGetDoc(`dailyShopSummaries/${summaryDocId(dateKey)}`);
      await fsUpsertDoc('dailyShopSummaries', summaryDocId(dateKey), {
        ...payload,
        createdBy: existing?.createdBy || member?.name || 'ชินชา',
        createdByUid: existing?.createdByUid || member?.uid || '',
        createdAt: existing?.createdAt || now,
      });
      await fsUpsertDoc('dailyExpenses', summaryExpenseDocId(dateKey), {
        dateKey,
        description: 'จ่ายออกหน้าร้าน',
        amount: totals.frontExpenseAmount,
        entryMode: 'dailySummary',
        createdBy: existing?.createdBy || member?.name || 'ชินชา',
        createdByUid: existing?.createdByUid || member?.uid || '',
        updatedBy: member?.name || 'ชินชา',
        updatedByUid: member?.uid || '',
        updatedAt: now,
        createdAt: existing?.createdAt || now,
      });
      showFlash(t('expenseSummarySaved'));
      await loadDay(dateKey);
    } catch (e) {
      console.error(e);
      alert(t('saveFailed'));
    }
    setSavingSummary(false);
  };

  const saveCupStock = async () => {
    const dateKey = cupStock.dateKey || viewDateKey;
    setSavingCups(true);
    try {
      const now = new Date().toISOString();
      const existing = await fsGetDoc(`dailyCupStocks/${cupStockDocId(dateKey)}`);
      await fsUpsertDoc('dailyCupStocks', cupStockDocId(dateKey), {
        dateKey,
        openingCups: cupTotals.openingCups,
        addedCups: cupTotals.addedCups,
        cupsSold: cupTotals.cupsSold,
        remainingCups: cupTotals.remainingCups,
        carriedToNextDay: true,
        updatedBy: member?.name || 'ชินชา',
        updatedByUid: member?.uid || '',
        updatedAt: now,
        createdBy: existing?.createdBy || member?.name || 'ชินชา',
        createdByUid: existing?.createdByUid || member?.uid || '',
        createdAt: existing?.createdAt || now,
      });
      showFlash(t('cupStockSaved'));
      await loadDay(dateKey);
    } catch (e) {
      console.error(e);
      alert(t('saveFailed'));
    }
    setSavingCups(false);
  };

  return (
    <div className="px-4 pt-3 pb-8 space-y-3">
      <div className="flex items-center gap-2 bg-white rounded-2xl p-2 border border-stone-200 shadow-sm">
        <button
          type="button"
          onClick={() => setViewDateKey(shiftDateKey(viewDateKey, -1))}
          className="w-10 h-10 rounded-xl bg-stone-100 font-black text-stone-600"
        >
          ‹
        </button>
        <div className="flex-1 text-center min-w-0">
          <p className="font-black text-sm text-stone-800 truncate">
            {formatDateKeyLabel(viewDateKey, lang, { year: true })}
          </p>
          {isToday ? (
            <p className="text-[10px] text-emerald-600 font-bold">{t('todayLabel')}</p>
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
          className="w-10 h-10 rounded-xl bg-stone-100 font-black text-stone-600 disabled:opacity-30"
        >
          ›
        </button>
      </div>

      <div className="rounded-3xl p-5 text-white shadow-lg" style={{ background: '#3d1f0f' }}>
        <p className="text-amber-600 text-[10px] font-bold uppercase tracking-widest mb-1">
          💸 {t('expenseDailyCloseTitle')}
        </p>
        <p className="text-amber-500 text-xs leading-relaxed">{t('expenseDailyCloseHint')}</p>
        <p className="text-4xl font-black text-amber-200 mt-3 leading-none">
          {money(totals.dayNet)}
        </p>
        <p className="text-amber-700 text-xs mt-1">{t('expenseDayNetLabel')}</p>
      </div>

      {flash && (
        <p className="text-center text-xs font-bold py-2 rounded-xl bg-emerald-50 text-emerald-700">
          {flash}
        </p>
      )}

      <div className="bg-white rounded-3xl p-4 shadow-sm border border-stone-200 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="text-sm font-black text-stone-800">{t('expenseStorefrontSummaryTitle')}</p>
            <p className="text-[11px] text-stone-400">{t('expenseStorefrontSummaryHint')}</p>
          </div>
          <span className="px-2 py-1 rounded-full bg-stone-100 text-[10px] font-black text-stone-500">
            {loading ? '...' : isAdmin ? 'ADMIN' : 'STAFF'}
          </span>
        </div>

        <label className="block rounded-2xl border border-stone-200 bg-white p-3">
          <span className="block text-[11px] font-black text-stone-500 mb-1">{t('expenseSummaryDateLabel')}</span>
          <input
            type="date"
            max={todayKey}
            value={dateKeyToInputValue(summary.dateKey || viewDateKey)}
            onChange={(e) => setViewDateKey(e.target.value)}
            className="w-full bg-transparent text-lg font-black text-stone-900 outline-none"
          />
        </label>

        <label className="block rounded-2xl border border-amber-100 bg-amber-50 p-3">
          <span className="block text-[11px] font-black text-amber-800 mb-1">{t('expensePasteSummaryLabel')}</span>
          <textarea
            value={summary.rawSummary || ''}
            onChange={(e) => setSummary((prev) => ({ ...prev, rawSummary: e.target.value }))}
            placeholder={t('expenseSummaryPlaceholder')}
            rows={3}
            className="w-full bg-white rounded-xl border border-amber-100 px-3 py-2 text-sm font-semibold outline-none focus:border-amber-300 resize-none"
          />
          <button
            type="button"
            onClick={applySummaryText}
            disabled={!summary.rawSummary?.trim()}
            className="mt-2 w-full py-2.5 rounded-xl bg-amber-200 text-amber-950 text-xs font-black disabled:opacity-40 active:scale-95"
          >
            {t('expenseFillFromSummary')}
          </button>
        </label>

        <div className="grid grid-cols-1 gap-2">
          <Field label={t('expenseSalesAmountLabel')} value={summary.salesAmount} onChange={(v) => updateSummaryField('salesAmount', v)} />
          <Field label={t('expenseCashLabel')} value={summary.cashAmount} onChange={(v) => updateSummaryField('cashAmount', v)} />
          <Field label={t('expenseTransferLabel')} value={summary.transferAmount} onChange={(v) => updateSummaryField('transferAmount', v)} />
          <Field label={t('expenseFrontExpenseLabel')} value={summary.frontExpenseAmount} onChange={(v) => updateSummaryField('frontExpenseAmount', v)} />
          <Field label={t('expenseCupsSoldLabel')} value={summary.cupsSold} suffix={t('cupUnit')} onChange={(v) => updateSummaryField('cupsSold', v)} />
          <Field label={t('expenseRestockPurchaseLabel')} value={summary.restockPurchaseAmount} readOnly highlight />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <StatCard label={t('expenseReceivedTotalLabel')} value={money(totals.receivedAmount)} tone="green" />
          <StatCard label={t('expenseAfterFrontExpenseLabel')} value={money(totals.netBeforeRestock)} />
          <StatCard label={t('expenseSalesGapLabel')} value={(totals.salesGap === 0 ? '' : totals.salesGap > 0 ? '+' : '') + money(totals.salesGap)} tone={totals.salesGap === 0 ? 'stone' : 'red'} />
          <StatCard label={t('expenseDayNetLabel')} value={money(totals.dayNet)} tone={totals.dayNet >= 0 ? 'green' : 'red'} />
        </div>

        <button
          type="button"
          onClick={saveSummary}
          disabled={savingSummary || loading}
          className="w-full py-3.5 rounded-2xl font-black text-white text-sm disabled:opacity-50 active:scale-95"
          style={{ background: '#3d1f0f' }}
        >
          {savingSummary ? '⏳' : t('expenseSaveDailySummaryBtn')}
        </button>
      </div>

      <div className="bg-white rounded-3xl p-4 shadow-sm border border-stone-200 space-y-3">
        <div>
          <p className="text-sm font-black text-stone-800">🥤 {t('cupStockTitle')}</p>
          <p className="text-[11px] text-stone-400 leading-relaxed">{t('cupStockHint')}</p>
        </div>
        <div className="grid grid-cols-1 gap-2">
          <Field label={t('cupOpeningLabel')} value={cupStock.openingCups} suffix={t('cupPieceUnit')} onChange={(v) => setCupStock((prev) => ({ ...prev, openingCups: v }))} />
          <Field label={t('cupAddedLabel')} value={cupStock.addedCups} suffix={t('cupPieceUnit')} onChange={(v) => setCupStock((prev) => ({ ...prev, addedCups: v }))} />
          <Field label={t('cupSoldTodayLabel')} value={cupStock.cupsSold || summary.cupsSold} suffix={t('cupUnit')} onChange={(v) => setCupStock((prev) => ({ ...prev, cupsSold: v }))} />
          <Field label={t('cupRemainingLabel')} value={cupTotals.remainingCups} suffix={t('cupPieceUnit')} readOnly highlight />
        </div>
        <div className="rounded-2xl bg-sky-50 border border-sky-100 p-3 text-[11px] text-sky-800 leading-relaxed">
          {t('cupCarryHint')}
        </div>
        <button
          type="button"
          onClick={saveCupStock}
          disabled={savingCups || loading}
          className="w-full py-3.5 rounded-2xl font-black text-white text-sm disabled:opacity-50 active:scale-95 bg-sky-900"
        >
          {savingCups ? '⏳' : t('cupStockSaveBtn')}
        </button>
      </div>

      <div className="bg-white rounded-3xl p-4 shadow-sm border border-stone-200">
        <p className="text-xs font-black text-stone-500 mb-2">{t('expenseExtraListTitle')}</p>
        {expenses.length === 0 ? (
          <p className="text-stone-400 text-sm text-center py-5">{t('expensesEmpty')}</p>
        ) : (
          <div className="divide-y divide-stone-100">
            {expenses.map((e, i) => (
              <div key={e.id || i} className="flex justify-between items-start gap-3 py-2.5">
                <div className="min-w-0">
                  <p className="text-sm font-bold text-stone-800">{e.description}</p>
                  <p className="text-[10px] text-stone-400 mt-0.5">{e.createdBy || e.updatedBy || 'ชินชา'}</p>
                </div>
                <span className="font-black text-red-500 shrink-0">−{money(e.amount || 0)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <p className="text-center text-[11px] text-stone-400 px-4 leading-relaxed">
        {t('expensesRestockHint')}
      </p>
    </div>
  );
}
