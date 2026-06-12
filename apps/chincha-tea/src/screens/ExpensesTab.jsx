import { useEffect, useMemo, useState } from 'react';
import { dateKeyBangkok, shiftDateKey } from '../lib/constants';
import { formatDateKeyLabel } from '../lib/localeFormat';
import {
  fsPatch,
  fsPost,
  fsQueryExpenses,
  fsQueryRestocksByDate,
  fsUpsertDoc,
} from '../lib/firestoreRest';
import { sumPurchasedRestocks } from '../lib/restockService';
import { fetchTeaDailySummary, intValue, moneyValue } from '../lib/dailySummaryService';
import { staffSnapshot, writeHistoryLog } from '../lib/historyLogService';

const EMPTY_DAY = {
  cashAmount: '',
  transferAmount: '',
  storefrontExpense: '',
  manualBulkTotal: '',
  cashChangeRemaining: '',
  manualCupsSold: '',
  note: '',
};

const EMPTY_CUPS = {
  openingCups: '',
  refillCups: '',
  remainingCups: '',
  note: '',
};

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

function digits(v) {
  return String(v || '').replace(/\D/g, '');
}

function parseNumberAfter(compact, labels) {
  for (const label of labels) {
    const m = compact.match(new RegExp(`${label}\\s*[:=]?\\s*(\\d+(?:\\.\\d+)?)`, 'i'));
    if (m) return Math.round(parseFloat(m[1]));
  }
  return 0;
}

function parseSummaryText(text) {
  const raw = (text || '').trim();
  if (!raw) return null;
  const compact = raw.replace(/,/g, '').replace(/ขาย\s+ได้/g, 'ขายได้');
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
    cashAmount: parseNumberAfter(compact, ['เงินสด', 'สด', 'cash']),
    transferAmount: parseNumberAfter(compact, ['เงินโอน', 'โอน', 'transfer']),
    storefrontExpense: parseNumberAfter(compact, ['จ่ายออกหน้าร้าน', 'จ่ายออก', 'จ่าย', 'ค่าใช้จ่าย', 'รายจ่าย']),
    manualBulkTotal: parseNumberAfter(compact, ['ยอดเหมา', 'ยอดรวม', 'ขายเหมา', 'manual', 'รวม']),
    manualCupsSold: parseNumberAfter(compact, ['จำนวนแก้วขายได้', 'แก้วขายได้', 'ขายได้.*?แก้ว', 'แก้ว']),
    totalSales: parseNumberAfter(compact, ['ยอดขาย', 'ขายได้', 'รวม']),
    note: raw,
  };
}

function amountLabel(value) {
  const n = Math.round(Number(value) || 0);
  const sign = n < 0 ? '-' : '';
  return `${sign}฿${Math.abs(n).toLocaleString()}`;
}

function getCupStockStatus(remaining) {
  const count = Math.max(0, Math.round(Number(remaining) || 0));
  if (count <= 20) {
    return { labelKey: 'cupStockStatusCritical', tone: 'bg-red-50 text-red-700 border-red-200', dot: 'bg-red-500', panel: 'from-red-600 to-red-500' };
  }
  if (count <= 50) {
    return { labelKey: 'cupStockStatusLow', tone: 'bg-amber-50 text-amber-800 border-amber-200', dot: 'bg-amber-400', panel: 'from-amber-500 to-orange-400' };
  }
  return { labelKey: 'cupStockStatusNormal', tone: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500', panel: 'from-emerald-600 to-teal-500' };
}

async function saveDailySummaryExpense({ existing, dateKey, form, member, rawSummary }) {
  const now = new Date().toISOString();
  const cashAmount = moneyValue(form.cashAmount);
  const transferAmount = moneyValue(form.transferAmount);
  const cashChangeRemaining = moneyValue(form.cashChangeRemaining);
  const storefrontExpense = moneyValue(form.storefrontExpense);
  const manualBulkTotal = moneyValue(form.manualBulkTotal);
  const autoCupsSold = intValue(form.autoCupsSold);
  const manualCupsSold = intValue(form.manualCupsSold);
  const finalCupsSold = manualCupsSold || autoCupsSold;
  const totalSales = cashAmount + transferAmount + manualBulkTotal;
  const payload = {
    dateKey,
    type: 'dailySummary',
    entryMode: 'dailySummary',
    description: storefrontExpense > 0 ? 'จ่ายจากเงินร้านตามสรุปวัน' : 'สรุปยอดขายปิดวัน',
    amount: storefrontExpense,
    cashAmount,
    cash_amount: cashAmount,
    transferAmount,
    transfer_amount: transferAmount,
    storefrontExpense,
    expense_amount: storefrontExpense,
    cashChangeRemaining,
    cash_change_remaining: cashChangeRemaining,
    manualBulkTotal,
    manual_bulk_total: manualBulkTotal,
    autoCupsSold,
    auto_cups_sold: autoCupsSold,
    manualCupsSold,
    manual_cups_sold: manualCupsSold,
    finalCupsSold,
    final_cups_sold: finalCupsSold,
    cupsSold: finalCupsSold,
    totalSales,
    totalRestockPurchased: 0,
    manualRestockPurchased: 0,
    dailyNetTotal: totalSales - storefrontExpense,
    note: form.note || '',
    rawSummary: rawSummary || undefined,
    updatedBy: member?.name || 'ชินชา',
    updatedByUid: member?.uid || '',
    ...staffSnapshot(member),
    updatedAt: now,
  };
  if (existing?.id) {
    await fsPatch(`dailyExpenses/${existing.id}`, payload);
    await writeHistoryLog({ action: 'dailySummary.update', collection: 'dailyExpenses', docId: existing.id, refPath: `dailyExpenses/${existing.id}`, dateKey, member, summary: { totalSales, cashAmount, transferAmount, manualBulkTotal, storefrontExpense, cashChangeRemaining, autoCupsSold, manualCupsSold, finalCupsSold } });
    return existing.id;
  }
  const created = await fsPost('dailyExpenses', {
    ...payload,
    createdBy: member?.name || 'ชินชา',
    createdByUid: member?.uid || '',
    createdAt: now,
  });
  await writeHistoryLog({ action: 'dailySummary.create', collection: 'dailyExpenses', docId: created.id, refPath: `dailyExpenses/${created.id}`, dateKey, member, summary: { totalSales, cashAmount, transferAmount, manualBulkTotal, storefrontExpense, cashChangeRemaining, autoCupsSold, manualCupsSold, finalCupsSold } });
  return created.id;
}

export function ExpensesTab({ member, t, lang = 'th', viewDateKey, setViewDateKey, allowedModes = ['summary', 'cups', 'manual'], defaultMode = 'summary', compactHeader = false, onSummaryChanged }) {
  const [expenses, setExpenses] = useState([]);
  const [restocks, setRestocks] = useState([]);
  const [entryDateKey, setEntryDateKey] = useState(viewDateKey);
  const [mode, setMode] = useState(defaultMode);
  const [dayForm, setDayForm] = useState(EMPTY_DAY);
  const [cupForm, setCupForm] = useState(EMPTY_CUPS);
  const [summaryText, setSummaryText] = useState('');
  const [expDesc, setExpDesc] = useState('');
  const [expAmount, setExpAmount] = useState('');
  const [editingExpense, setEditingExpense] = useState(null);
  const [cupDoc, setCupDoc] = useState(null);
  const [saving, setSaving] = useState(false);
  const [flash, setFlash] = useState('');

  const todayKey = dateKeyBangkok();
  const isToday = viewDateKey === todayKey;
  const manualExpenses = useMemo(() => expenses.filter((e) => e.type !== 'dailySummary' && e.type !== 'bulkEntry'), [expenses]);
  const dailySummary = useMemo(() => expenses.find((e) => e.type === 'dailySummary'), [expenses]);
  const restockPurchased = useMemo(() => sumPurchasedRestocks(restocks), [restocks]);
  const [centralSummary, setCentralSummary] = useState(null);
  const liveRevenue = centralSummary || { salesTotal: 0, cupsSold: 0, posSalesTotal: 0, posCupsSold: 0 };
  const bulkSummary = centralSummary ? { count: centralSummary.bulkEntryCount, manualBulkTotal: centralSummary.manualBulkTotal, manualCupsSold: centralSummary.bulkCupsSold } : { count: 0, manualBulkTotal: 0, manualCupsSold: 0 };
  const cashAmount = moneyValue(dayForm.cashAmount);
  const transferAmount = moneyValue(dayForm.transferAmount);
  const manualBulkTotal = moneyValue(dayForm.manualBulkTotal);
  const totalSales = cashAmount + transferAmount + manualBulkTotal;
  const storefrontExpense = moneyValue(dayForm.storefrontExpense);
  const cashChangeRemaining = moneyValue(dayForm.cashChangeRemaining);
  const autoCupsSold = liveRevenue.autoCupsSold || liveRevenue.cupsSold || 0;
  const manualCupsSold = intValue(dayForm.manualCupsSold);
  const finalCupsSold = manualCupsSold || autoCupsSold;
  const cupsSold = finalCupsSold;
  const dailyNetTotal = totalSales - storefrontExpense;
  const openingCups = intValue(cupForm.openingCups);
  const refillCups = intValue(cupForm.refillCups);
  const refillTodayTotal = openingCups + refillCups;
  const autoRemainingCups = Math.max(0, refillTodayTotal - finalCupsSold);
  const remainingCups = cupForm.remainingCups === '' ? autoRemainingCups : intValue(cupForm.remainingCups);
  const isEditing = Boolean(editingExpense?.id);

  const showFlash = (message) => {
    setFlash(message);
    setTimeout(() => setFlash(''), 2000);
  };

  const reloadDay = async (dateKey) => {
    const [loadedSummary, restockRows] = await Promise.all([
      fetchTeaDailySummary(dateKey),
      fsQueryRestocksByDate(dateKey),
    ]);
    const expenseRows = loadedSummary.expenses;
    const cups = loadedSummary.cupStock;
    setCentralSummary(loadedSummary);
    setExpenses(expenseRows);
    setRestocks(restockRows);
    setCupDoc(cups);
    const summary = loadedSummary.dailySummaryDoc;
    const revenue = { cashTotal: loadedSummary.posCashTotal, transferTotal: loadedSummary.posTransferTotal };
    const loadedBulkSummary = { manualBulkTotal: loadedSummary.manualBulkTotal, manualCupsSold: loadedSummary.bulkCupsSold };
    const savedStorefrontExpense = summary ? loadedSummary.storefrontExpense : 0;
    setDayForm(summary ? {
      cashAmount: summary.cashAmount ? String(summary.cashAmount) : '',
      transferAmount: summary.transferAmount ? String(summary.transferAmount) : '',
      storefrontExpense: savedStorefrontExpense ? String(savedStorefrontExpense) : '',
      manualBulkTotal: summary.manualBulkTotal || summary.manual_bulk_total ? String(summary.manualBulkTotal || summary.manual_bulk_total) : (loadedBulkSummary.manualBulkTotal ? String(loadedBulkSummary.manualBulkTotal) : ''),
      cashChangeRemaining: summary.cashChangeRemaining ? String(summary.cashChangeRemaining) : '',
      manualCupsSold: summary.manualCupsSold || summary.manual_cups_sold ? String(summary.manualCupsSold || summary.manual_cups_sold) : (loadedBulkSummary.manualCupsSold ? String(loadedBulkSummary.manualCupsSold) : ''),
      note: summary.note || '',
    } : {
      ...EMPTY_DAY,
      cashAmount: revenue.cashTotal ? String(revenue.cashTotal) : '',
      transferAmount: revenue.transferTotal ? String(revenue.transferTotal) : '',
      manualBulkTotal: loadedBulkSummary.manualBulkTotal ? String(loadedBulkSummary.manualBulkTotal) : '',
      manualCupsSold: loadedBulkSummary.manualCupsSold ? String(loadedBulkSummary.manualCupsSold) : '',
    });
    setCupForm(cups ? {
      openingCups: cups.openingCups ? String(cups.openingCups) : '',
      refillCups: cups.refillCups ? String(cups.refillCups) : '',
      remainingCups: cups.remainingCups || cups.remainingCups === 0 ? String(cups.remainingCups) : '',
      note: cups.note || '',
    } : EMPTY_CUPS);
  };

  useEffect(() => {
    setEntryDateKey(viewDateKey);
    setEditingExpense(null);
    setExpDesc('');
    setExpAmount('');
    setSummaryText('');
    setMode((prev) => (allowedModes.includes(prev) ? prev : allowedModes[0] || defaultMode));
    reloadDay(viewDateKey).catch((e) => console.error(e));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewDateKey]);

  const fillFromSummary = () => {
    const parsed = parseSummaryText(summaryText);
    if (!parsed) return;
    if (parsed.dateKey) setEntryDateKey(parsed.dateKey);
    setDayForm((prev) => ({
      ...prev,
      cashAmount: parsed.cashAmount ? String(parsed.cashAmount) : prev.cashAmount,
      transferAmount: parsed.transferAmount ? String(parsed.transferAmount) : prev.transferAmount,
      storefrontExpense: parsed.storefrontExpense ? String(parsed.storefrontExpense) : prev.storefrontExpense,
      manualBulkTotal: parsed.manualBulkTotal ? String(parsed.manualBulkTotal) : prev.manualBulkTotal,
      manualCupsSold: parsed.manualCupsSold ? String(parsed.manualCupsSold) : prev.manualCupsSold,
      note: parsed.note || prev.note,
    }));
  };

  const saveDaySummary = async () => {
    const targetDateKey = entryDateKey || viewDateKey;
    if (!targetDateKey) return;
    setSaving(true);
    try {
      const targetDailySummary = targetDateKey === viewDateKey
        ? dailySummary
        : (await fsQueryExpenses(targetDateKey)).find((e) => e.type === 'dailySummary');
      await saveDailySummaryExpense({
        existing: targetDailySummary,
        dateKey: targetDateKey,
        form: { ...dayForm, autoCupsSold },
        member,
        rawSummary: summaryText.trim(),
      });
      await fsUpsertDoc('dailyCupStocks', targetDateKey, {
        dateKey: targetDateKey,
        openingCups,
        refillCups,
        refillTodayTotal,
        cupsSold: finalCupsSold,
        autoCupsSold,
        manualCupsSold,
        finalCupsSold,
        remainingCups: autoRemainingCups,
        note: cupForm.note || dayForm.note || '',
        updatedBy: member?.name || 'ชินชา',
        updatedByUid: member?.uid || '',
        ...staffSnapshot(member),
        updatedAt: new Date().toISOString(),
        createdBy: cupDoc?.createdBy || member?.name || 'ชินชา',
        createdByUid: cupDoc?.createdByUid || member?.uid || '',
        createdAt: cupDoc?.createdAt || new Date().toISOString(),
      });
      if (targetDateKey !== viewDateKey) setViewDateKey(targetDateKey);
      else await reloadDay(targetDateKey);
      onSummaryChanged?.(targetDateKey);
      showFlash(t('expenseSaved'));
    } catch (e) {
      console.error(e);
      alert(t('saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  const saveCupStock = async () => {
    const targetDateKey = entryDateKey || viewDateKey;
    setSaving(true);
    try {
      await fsUpsertDoc('dailyCupStocks', targetDateKey, {
        dateKey: targetDateKey,
        openingCups,
        refillCups,
        refillTodayTotal,
        cupsSold: finalCupsSold,
        autoCupsSold,
        manualCupsSold,
        finalCupsSold,
        remainingCups,
        note: cupForm.note || '',
        updatedBy: member?.name || 'ชินชา',
        updatedByUid: member?.uid || '',
        ...staffSnapshot(member),
        updatedAt: new Date().toISOString(),
        createdBy: cupDoc?.createdBy || member?.name || 'ชินชา',
        createdByUid: cupDoc?.createdByUid || member?.uid || '',
        createdAt: cupDoc?.createdAt || new Date().toISOString(),
      });
      await writeHistoryLog({ action: 'cupStock.upsert', collection: 'dailyCupStocks', docId: targetDateKey, refPath: `dailyCupStocks/${targetDateKey}`, dateKey: targetDateKey, member, summary: { openingCups, refillCups, autoCupsSold, manualCupsSold, finalCupsSold, remainingCups } });
      if (targetDateKey !== viewDateKey) setViewDateKey(targetDateKey);
      else await reloadDay(targetDateKey);
      onSummaryChanged?.(targetDateKey);
      showFlash(t('cupStockSaved'));
    } catch (e) {
      console.error(e);
      alert(t('saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  const resetManualForm = () => {
    setEditingExpense(null);
    setExpDesc('');
    setExpAmount('');
    setEntryDateKey(viewDateKey);
  };

  const addOrUpdateExpense = async () => {
    const desc = expDesc.trim();
    const amount = parseInt(expAmount, 10);
    const targetDateKey = entryDateKey || viewDateKey;
    if (!desc || !amount || amount <= 0 || !targetDateKey) return;
    setSaving(true);
    try {
      const payload = {
        dateKey: targetDateKey,
        description: desc,
        amount,
        entryMode: 'manual',
        updatedBy: member?.name || 'ชินชา',
        updatedByUid: member?.uid || '',
        ...staffSnapshot(member),
        updatedAt: new Date().toISOString(),
      };
      if (isEditing) {
        await fsPatch(`dailyExpenses/${editingExpense.id}`, payload);
        await writeHistoryLog({ action: 'expense.update', collection: 'dailyExpenses', docId: editingExpense.id, refPath: `dailyExpenses/${editingExpense.id}`, dateKey: targetDateKey, member, summary: { amount, description: desc } });
      } else {
        const created = await fsPost('dailyExpenses', {
          ...payload,
          createdBy: member?.name || 'ชินชา',
          createdByUid: member?.uid || '',
          createdAt: new Date().toISOString(),
        });
        await writeHistoryLog({ action: 'expense.create', collection: 'dailyExpenses', docId: created.id, refPath: `dailyExpenses/${created.id}`, dateKey: targetDateKey, member, summary: { amount, description: desc } });
      }
      if (targetDateKey !== viewDateKey) setViewDateKey(targetDateKey);
      else await reloadDay(targetDateKey);
      onSummaryChanged?.(targetDateKey);
      resetManualForm();
      showFlash(isEditing ? t('expenseUpdated') : t('expenseSaved'));
    } catch (e) {
      console.error(e);
      alert(t('saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (expense) => {
    setMode('manual');
    setEditingExpense(expense);
    setExpDesc(expense.description || '');
    setExpAmount(expense.amount ? String(expense.amount) : '');
    setEntryDateKey(expense.dateKey || viewDateKey);
  };

  const addRefillCups = (amount) => {
    setCupForm((prev) => ({ ...prev, refillCups: String(intValue(prev.refillCups) + amount), remainingCups: '' }));
  };

  const cupStockStatus = getCupStockStatus(remainingCups);

  return (
    <div className="px-4 pt-3 pb-8 space-y-3">
      {!compactHeader && <div className="flex items-center gap-2 bg-white rounded-2xl p-2 border border-stone-200 shadow-sm">
        <button type="button" onClick={() => setViewDateKey(shiftDateKey(viewDateKey, -1))} className="w-10 h-10 rounded-xl bg-stone-100 font-black text-stone-600">‹</button>
        <div className="flex-1 text-center min-w-0">
          <p className="font-black text-sm text-stone-800 truncate">{formatDateKeyLabel(viewDateKey, lang)}</p>
          {!isToday && <button type="button" onClick={() => setViewDateKey(todayKey)} className="text-[11px] text-emerald-600 font-black">{t('todayLabel')}</button>}
        </div>
        <button type="button" disabled={viewDateKey >= todayKey} onClick={() => setViewDateKey(shiftDateKey(viewDateKey, 1))} className="w-10 h-10 rounded-xl bg-stone-100 font-black text-stone-600 disabled:opacity-30">›</button>
      </div>}

      {allowedModes.length > 1 && <div className="grid grid-cols-3 gap-2 rounded-3xl bg-white p-1.5 border border-stone-200 shadow-sm sticky top-2 z-20">
        {[
          ['summary', t('dailySummaryTab')],
          ['cups', t('cupStockTab')],
          ['manual', t('expenseManualTab')],
        ].filter(([id]) => allowedModes.includes(id)).map(([id, label]) => (
          <button key={id} type="button" onClick={() => setMode(id)} className={`py-3 rounded-2xl text-xs font-black ${mode === id ? 'text-white shadow' : 'text-stone-500'}`} style={mode === id ? { background: '#3d1f0f' } : undefined}>{label}</button>
        ))}
      </div>}

      {flash && <p className="text-center text-xs font-bold py-2 rounded-xl bg-emerald-50 text-emerald-700">{flash}</p>}

      {mode === 'summary' && (
        <div className="space-y-3">
          <div className="rounded-3xl p-5 text-white shadow-lg" style={{ background: '#3d1f0f' }}>
            <p className="text-amber-500 text-xs font-black">{t('closingOnePageTitle')}</p>
            <p className="text-4xl font-black text-amber-200 mt-2">{amountLabel(totalSales)}</p>
            <p className="text-amber-700 text-xs">{t('dailySalesTotal')}</p>
            <div className="grid grid-cols-3 gap-2 mt-4 text-center">
              <div className="rounded-2xl bg-white/10 p-2"><p className="text-[10px] text-amber-200">{t('cash')}</p><p className="font-black">{amountLabel(cashAmount)}</p></div>
              <div className="rounded-2xl bg-white/10 p-2"><p className="text-[10px] text-amber-200">{t('transfer')}</p><p className="font-black">{amountLabel(transferAmount)}</p></div>
              <div className="rounded-2xl bg-white/10 p-2"><p className="text-[10px] text-amber-200">{t('finalCupsSold')}</p><p className="font-black">{finalCupsSold}</p></div>
            </div>
          </div>

          <div className="bg-white rounded-3xl p-4 shadow-sm border border-stone-200 space-y-4">
            <input type="date" max={todayKey} value={dateKeyToInputValue(entryDateKey)} onChange={(e) => setEntryDateKey(e.target.value)} className="w-full min-h-12 px-4 py-3 rounded-2xl border-2 border-stone-200 text-base font-black outline-none focus:border-amber-300" />

            <SectionCard title={t('moneyGroupTitle')}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label={t('dailyCash')} value={dayForm.cashAmount} onChange={(v) => setDayForm((p) => ({ ...p, cashAmount: digits(v) }))} />
                <Field label={t('dailyTransfer')} value={dayForm.transferAmount} onChange={(v) => setDayForm((p) => ({ ...p, transferAmount: digits(v) }))} />
                <Field label={t('manualBulkTotal')} value={dayForm.manualBulkTotal} onChange={(v) => setDayForm((p) => ({ ...p, manualBulkTotal: digits(v) }))} />
                <Field label={t('expenseAmount')} value={dayForm.storefrontExpense} onChange={(v) => setDayForm((p) => ({ ...p, storefrontExpense: digits(v) }))} />
                <Field label={t('dailyCashChangeRemaining')} value={dayForm.cashChangeRemaining} onChange={(v) => setDayForm((p) => ({ ...p, cashChangeRemaining: digits(v) }))} />
              </div>
              {bulkSummary.count > 0 && <p className="text-[11px] font-bold text-amber-700 bg-amber-50 border border-amber-100 rounded-2xl px-3 py-2">{t('bulkEntrySummaryHint').replace('{count}', String(bulkSummary.count)).replace('{total}', amountLabel(bulkSummary.manualBulkTotal)).replace('{cups}', String(bulkSummary.manualCupsSold))}</p>}
            </SectionCard>

            <SectionCard title={t('cupCountGroupTitle')}>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <ReadBox label={t('autoCupsSold')} value={`${autoCupsSold.toLocaleString()} ${t('cupUnit')}`} />
                <Field label={t('manualCupsSold')} value={dayForm.manualCupsSold} onChange={(v) => setDayForm((p) => ({ ...p, manualCupsSold: digits(v) }))} suffix={t('cupUnit')} />
                <ReadBox label={t('finalCupsSold')} value={`${finalCupsSold.toLocaleString()} ${t('cupUnit')}`} />
              </div>
              <p className="text-[11px] text-stone-500 bg-stone-50 rounded-2xl px-3 py-2">{t('finalCupsHint')}</p>
            </SectionCard>

            <SectionCard title={t('cupStockGroupTitle')}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label={t('cupOpening')} value={cupForm.openingCups} onChange={(v) => setCupForm((p) => ({ ...p, openingCups: digits(v), remainingCups: '' }))} suffix={t('cupPieceUnit')} />
                <Field label={t('cupRefill')} value={cupForm.refillCups} onChange={(v) => setCupForm((p) => ({ ...p, refillCups: digits(v), remainingCups: '' }))} suffix={t('cupPieceUnit')} />
                <ReadBox label={t('finalCupsSold')} value={`${finalCupsSold.toLocaleString()} ${t('cupPieceUnit')}`} />
                <ReadBox label={t('cupNetRemaining')} value={`${autoRemainingCups.toLocaleString()} ${t('cupPieceUnit')}`} />
              </div>
              <div className={`flex items-center gap-2 rounded-2xl border px-3 py-2 text-xs font-black ${getCupStockStatus(autoRemainingCups).tone}`}>
                <span className={`h-2.5 w-2.5 rounded-full ${getCupStockStatus(autoRemainingCups).dot}`} />
                {t(getCupStockStatus(autoRemainingCups).labelKey)} · {autoRemainingCups.toLocaleString()} {t('cupPieceUnit')}
              </div>
              <p className="text-[11px] text-stone-500 bg-emerald-50 border border-emerald-100 rounded-2xl px-3 py-2">{t('cupNetFormula')}</p>
            </SectionCard>

            <div className="rounded-2xl bg-amber-50 border border-amber-100 p-3 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-black text-amber-800">{t('expenseSummaryTitle')}</p>
                <button type="button" onClick={fillFromSummary} disabled={!summaryText.trim()} className="min-h-11 px-4 rounded-2xl bg-white text-[11px] font-black text-amber-800 border border-amber-200 disabled:opacity-40 active:scale-95">{t('expenseFillFromSummary')}</button>
              </div>
              <textarea value={summaryText} onChange={(e) => setSummaryText(e.target.value)} placeholder={t('expenseSummaryPlaceholder')} rows={3} className="w-full px-3 py-3 rounded-2xl border-2 border-amber-100 bg-white text-sm font-semibold outline-none focus:border-amber-300 resize-none" />
            </div>

            <textarea value={dayForm.note} onChange={(e) => setDayForm((p) => ({ ...p, note: e.target.value }))} placeholder={t('dailyNotePlaceholder')} rows={2} className="w-full px-4 py-3 rounded-2xl border-2 border-stone-200 text-sm font-semibold outline-none resize-none" />

            <div className="rounded-2xl bg-stone-50 p-3 space-y-1 text-sm">
              <SummaryRow label={t('dailySalesTotal')} value={amountLabel(totalSales)} strong />
              <SummaryRow label={t('expenseAmount')} value={`−${amountLabel(storefrontExpense)}`} tone="text-red-600" />
              <SummaryRow label={t('dailyAllSummary')} value={amountLabel(dailyNetTotal)} strong tone={dailyNetTotal >= 0 ? 'text-emerald-700' : 'text-red-600'} />
            </div>

            <button type="button" onClick={saveDaySummary} disabled={saving || !entryDateKey} className="w-full min-h-14 py-4 rounded-2xl font-black text-white text-base disabled:opacity-50 active:scale-95" style={{ background: '#3d1f0f' }}>{saving ? '⏳' : t('expenseSaveSummaryBtn')}</button>
            <p className="text-[11px] font-bold text-stone-500">{t('staffRecorderLabel')}: {member?.name || 'ชินชา'}</p>
            <p className="text-[11px] text-stone-400 leading-relaxed">{t('liveSalesHint').replace('{sales}', amountLabel(liveRevenue.salesTotal || liveRevenue.posSalesTotal || 0)).replace('{cups}', String(liveRevenue.cupsSold || liveRevenue.posCupsSold || 0))}</p>
          </div>
        </div>
      )}

      {mode === 'cups' && (
        <div className="bg-white rounded-3xl p-4 shadow-sm border border-stone-200 space-y-4">
          <div className={`rounded-3xl p-5 text-white bg-gradient-to-br ${cupStockStatus.panel}`}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-white/80 text-xs font-black">{t('cupStockTitle')}</p>
                <p className="text-5xl font-black text-white mt-2">{remainingCups.toLocaleString()}</p>
                <p className="text-white/80 text-xs">{t('cupRemaining')}</p>
              </div>
              <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-black bg-white/95 ${cupStockStatus.tone}`}>
                <span className={`h-2.5 w-2.5 rounded-full ${cupStockStatus.dot}`} />
                {t(cupStockStatus.labelKey)}
              </span>
            </div>
          </div>
          <input type="date" max={todayKey} value={dateKeyToInputValue(entryDateKey)} onChange={(e) => setEntryDateKey(e.target.value)} className="w-full min-h-12 px-4 py-3 rounded-2xl border-2 border-stone-200 text-base font-black outline-none focus:border-amber-300" />
          <SectionCard title={t('cupQuickFillTitle')} hint={t('cupQuickFillHint')}>
            <div className="grid grid-cols-4 gap-2">
              {[10, 20, 30, 50].map((amount) => (
                <button key={amount} type="button" onClick={() => addRefillCups(amount)} className="min-h-14 rounded-2xl bg-amber-50 border-2 border-amber-100 text-lg font-black text-amber-900 active:scale-95">+{amount}</button>
              ))}
            </div>
            <Field label={t('cupRefill')} value={cupForm.refillCups} onChange={(v) => setCupForm((p) => ({ ...p, refillCups: digits(v), remainingCups: '' }))} suffix={t('cupPieceUnit')} large />
          </SectionCard>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label={t('cupOpening')} value={cupForm.openingCups} onChange={(v) => setCupForm((p) => ({ ...p, openingCups: digits(v), remainingCups: '' }))} suffix={t('cupPieceUnit')} large />
            <ReadBox label={t('cupTodayTotal')} value={`${refillTodayTotal.toLocaleString()} ${t('cupPieceUnit')}`} />
            <ReadBox label={t('dailyCupsSold')} value={`${cupsSold.toLocaleString()} ${t('cupUnit')}`} />
            <Field label={t('cupRemainingEdit')} value={cupForm.remainingCups} onChange={(v) => setCupForm((p) => ({ ...p, remainingCups: digits(v) }))} placeholder={`${autoRemainingCups} ${t('cupPieceUnit')}`} suffix={t('cupPieceUnit')} large />
          </div>
          <textarea value={cupForm.note} onChange={(e) => setCupForm((p) => ({ ...p, note: e.target.value }))} placeholder={t('cupNotePlaceholder')} rows={2} className="w-full px-4 py-3 rounded-2xl border-2 border-stone-200 text-sm font-semibold outline-none resize-none" />
          <p className="text-[11px] font-bold text-stone-500">{t('staffRecorderLabel')}: {member?.name || 'ชินชา'}</p>
          <p className="text-[11px] text-stone-500 bg-amber-50 border border-amber-100 rounded-2xl p-3 leading-relaxed">{t('cupCarryHint')}</p>
          <button type="button" onClick={saveCupStock} disabled={saving || !entryDateKey} className="w-full min-h-14 py-4 rounded-2xl font-black text-white text-base disabled:opacity-50 active:scale-95" style={{ background: '#3d1f0f' }}>{saving ? '⏳' : t('cupSaveBtn')}</button>
        </div>
      )}

      {mode === 'manual' && (
        <div className="bg-white rounded-3xl p-4 shadow-sm border border-stone-200 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="text-xs font-black text-stone-500 uppercase tracking-wide">{isEditing ? t('expenseEditTitle') : t('expenseManualTitle')}</p>
              <p className="text-[11px] text-stone-400 mt-0.5">{t('expenseManualHelp')}</p>
            </div>
            {isEditing && <button type="button" onClick={resetManualForm} className="text-[11px] font-black text-stone-500 underline">{t('cancel')}</button>}
          </div>
          <div className="grid grid-cols-2 gap-2">
            {[t('dailyStoreExpense'), t('dailyRestockPurchased')].map((label) => (
              <button key={label} type="button" onClick={() => setExpDesc(label)} className="rounded-2xl border border-amber-100 bg-amber-50 px-3 py-2 text-left text-[11px] font-black text-amber-900 active:scale-95">
                + {label}
              </button>
            ))}
          </div>
          {restockPurchased > 0 && (
            <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-3 py-2">
              <p className="text-[11px] font-black text-emerald-800">{t('restockPurchasesSection')}</p>
              <p className="text-sm font-black text-emerald-700">{amountLabel(restockPurchased)}</p>
              <p className="text-[10px] text-emerald-700/70">{t('restockPurchasesHint')}</p>
            </div>
          )}
          <input type="date" max={todayKey} value={dateKeyToInputValue(entryDateKey)} onChange={(e) => setEntryDateKey(e.target.value)} className="w-full px-4 py-3 rounded-2xl border-2 border-stone-200 text-sm font-black outline-none focus:border-amber-300" />
          <input value={expDesc} onChange={(e) => setExpDesc(e.target.value)} placeholder={t('expensePlaceholder')} className="w-full px-4 py-3 rounded-2xl border-2 border-stone-200 text-sm font-semibold outline-none focus:border-amber-300" />
          <div className="flex gap-2">
            <input value={expAmount} onChange={(e) => setExpAmount(digits(e.target.value))} placeholder={t('expenseAmountPlaceholder')} inputMode="numeric" className="flex-1 px-4 py-3 rounded-2xl border-2 border-stone-200 text-lg text-center font-black outline-none focus:border-amber-300" />
            <button type="button" onClick={addOrUpdateExpense} disabled={saving || !expDesc.trim() || !expAmount || !entryDateKey} className="px-5 py-3 rounded-2xl font-black text-white text-sm disabled:opacity-50 active:scale-95" style={{ background: '#3d1f0f' }}>{saving ? '⏳' : isEditing ? t('expenseUpdateBtn') : t('expenseAddBtn')}</button>
          </div>
          <p className="text-[11px] text-stone-400 leading-relaxed">{t('expenseBackdateHint')}</p>
          {manualExpenses.length === 0 ? <p className="text-stone-400 text-sm text-center py-6">{t('expensesEmpty')}</p> : (
            <div className="divide-y divide-stone-100">
              {manualExpenses.map((e, i) => (
                <button key={e.id || i} type="button" onClick={() => startEdit(e)} className="w-full flex justify-between items-start gap-3 py-2.5 text-left active:bg-stone-50">
                  <div className="min-w-0"><p className="text-sm font-bold text-stone-800">{e.description}</p><p className="text-[10px] text-stone-400 mt-0.5">{e.createdBy || e.updatedBy || 'ชินชา'} · {t('tapToEditExpense')}</p></div>
                  <span className="font-black text-red-500 shrink-0">−{amountLabel(e.amount || 0)}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {mode === 'manual' && <p className="text-center text-[11px] text-stone-400 px-4 leading-relaxed">{t('expensesRestockHint')}</p>}
    </div>
  );
}

function SectionCard({ title, hint = '', children }) {
  return (
    <section className="rounded-3xl border border-stone-200 bg-stone-50/60 p-3 space-y-3">
      <div>
        <p className="text-xs font-black text-stone-600 uppercase tracking-wide">{title}</p>
        {hint && <p className="text-[11px] font-bold text-stone-400 mt-0.5">{hint}</p>}
      </div>
      {children}
    </section>
  );
}

function Field({ label, value, onChange, suffix = 'บาท', disabled = false, placeholder = '', large = false }) {
  return (
    <label className="block">
      <span className="block text-[11px] font-black text-stone-500 mb-1">{label}</span>
      <div className={`flex min-h-14 items-center rounded-2xl border-2 ${disabled ? 'bg-stone-100 border-stone-100' : 'bg-white border-stone-200 focus-within:border-amber-300'}`}>
        <input value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled} placeholder={placeholder} inputMode="numeric" className={`min-w-0 flex-1 bg-transparent px-3 py-3 ${large ? 'text-3xl text-center' : 'text-xl'} font-black text-stone-800 outline-none disabled:text-stone-500`} />
        <span className="pr-3 text-xs font-bold text-stone-400">{suffix}</span>
      </div>
    </label>
  );
}

function ReadBox({ label, value }) {
  return (
    <div className="min-h-14 rounded-2xl bg-stone-50 border border-stone-100 p-3">
      <p className="text-[11px] font-black text-stone-500 mb-1">{label}</p>
      <p className="text-xl font-black text-stone-800">{value}</p>
    </div>
  );
}

function SummaryRow({ label, value, strong = false, tone = 'text-stone-800' }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className={`${strong ? 'font-black' : 'font-bold'} text-stone-600`}>{label}</span>
      <span className={`${strong ? 'text-lg' : 'text-sm'} font-black ${tone}`}>{value}</span>
    </div>
  );
}
