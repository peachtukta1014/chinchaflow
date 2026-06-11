import { useEffect, useMemo, useState } from 'react';
import { dateKeyBangkok, shiftDateKey } from '../lib/constants';
import { formatDateKeyLabel } from '../lib/localeFormat';
import { fsPatch, fsPost, fsQueryExpenses } from '../lib/firestoreRest';

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
  const amountMatch = compact.match(/(?:จ่าย|ค่าใช้จ่าย|รายจ่าย)\s*[:=]?\s*(\d+(?:\.\d+)?)/i);
  const dateMatch = compact.match(/(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})/);
  const amount = amountMatch ? Math.round(parseFloat(amountMatch[1])) : 0;
  let dateKey = '';
  if (dateMatch) {
    const day = parseInt(dateMatch[1], 10);
    const month = parseInt(dateMatch[2], 10);
    const year = normalizeYear(dateMatch[3]);
    if (year && month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      dateKey = `${year}-${two(month)}-${two(day)}`;
    }
  }
  const firstLine = raw.split('\n').map((line) => line.trim()).find(Boolean) || 'สรุปเหมา';
  return {
    amount,
    dateKey,
    description: firstLine.startsWith('ยอดขาย') ? `สรุปเหมา ${firstLine.replace(/^ยอดขาย\s*/i, '')}` : firstLine,
  };
}

export function ExpensesTab({ member, t, lang = 'th', viewDateKey, setViewDateKey }) {
  const [expenses, setExpenses] = useState([]);
  const [expDesc, setExpDesc] = useState('');
  const [expAmount, setExpAmount] = useState('');
  const [entryDateKey, setEntryDateKey] = useState(viewDateKey);
  const [summaryText, setSummaryText] = useState('');
  const [editingExpense, setEditingExpense] = useState(null);
  const [saving, setSaving] = useState(false);
  const [flash, setFlash] = useState('');

  const todayKey = dateKeyBangkok();
  const isToday = viewDateKey === todayKey;
  const total = useMemo(() => expenses.reduce((s, e) => s + (e.amount || 0), 0), [expenses]);
  const isEditing = Boolean(editingExpense?.id);

  useEffect(() => {
    fsQueryExpenses(viewDateKey).then(setExpenses);
    setEntryDateKey(viewDateKey);
    setEditingExpense(null);
    setExpDesc('');
    setExpAmount('');
    setSummaryText('');
  }, [viewDateKey]);

  const showFlash = (message) => {
    setFlash(message);
    setTimeout(() => setFlash(''), 2000);
  };

  const resetForm = () => {
    setEditingExpense(null);
    setExpDesc('');
    setExpAmount('');
    setSummaryText('');
    setEntryDateKey(viewDateKey);
  };

  const fillFromSummary = () => {
    const parsed = parseSummaryText(summaryText);
    if (!parsed) return;
    if (parsed.description) setExpDesc(parsed.description);
    if (parsed.amount > 0) setExpAmount(String(parsed.amount));
    if (parsed.dateKey) setEntryDateKey(parsed.dateKey);
  };

  const addOrUpdateExpense = async ({ mode = 'manual', description, amountValue, dateKey, rawSummary } = {}) => {
    const desc = (description ?? expDesc).trim();
    const amount = parseInt(amountValue ?? expAmount, 10);
    const targetDateKey = dateKey || entryDateKey;
    if (!desc || !amount || amount <= 0 || !targetDateKey) return;
    setSaving(true);
    try {
      const payload = {
        dateKey: targetDateKey,
        description: desc,
        amount,
        entryMode: mode,
        updatedBy: member?.name || 'ชินชา',
        updatedByUid: member?.uid || '',
        updatedAt: new Date().toISOString(),
      };
      if (isEditing) {
        await fsPatch(`dailyExpenses/${editingExpense.id}`, payload);
      } else {
        await fsPost('dailyExpenses', {
          ...payload,
          createdBy: member?.name || 'ชินชา',
          createdByUid: member?.uid || '',
          createdAt: new Date().toISOString(),
          rawSummary: mode === 'summary' ? (rawSummary ?? summaryText).trim() : undefined,
        });
      }
      const nextViewDateKey = targetDateKey;
      if (nextViewDateKey !== viewDateKey) {
        setViewDateKey(nextViewDateKey);
      } else {
        setExpenses(await fsQueryExpenses(nextViewDateKey));
      }
      resetForm();
      showFlash(isEditing ? t('expenseUpdated') : t('expenseSaved'));
    } catch (e) {
      console.error(e);
      alert(t('saveFailed'));
    }
    setSaving(false);
  };

  const saveSummary = async () => {
    const parsed = parseSummaryText(summaryText);
    if (!parsed?.amount) return;
    const targetDateKey = parsed.dateKey || entryDateKey;
    await addOrUpdateExpense({
      mode: 'summary',
      description: parsed.description || 'สรุปเหมา',
      amountValue: parsed.amount,
      dateKey: targetDateKey,
      rawSummary: summaryText,
    });
  };

  const startEdit = (expense) => {
    setEditingExpense(expense);
    setExpDesc(expense.description || '');
    setExpAmount(expense.amount ? String(expense.amount) : '');
    setEntryDateKey(expense.dateKey || viewDateKey);
    setSummaryText(expense.rawSummary || '');
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
          💸 {t('expensesTabTitle')}
        </p>
        <p className="text-amber-500 text-xs leading-relaxed">{t('expensesStaffHint')}</p>
        <p className="text-4xl font-black text-amber-200 mt-3 leading-none">
          ฿{total.toLocaleString()}
        </p>
        <p className="text-amber-700 text-xs mt-1">{t('expensesDayTotal')}</p>
      </div>

      {flash && (
        <p className="text-center text-xs font-bold py-2 rounded-xl bg-emerald-50 text-emerald-700">
          {flash}
        </p>
      )}

      <div className="bg-white rounded-3xl p-4 shadow-sm border border-stone-200 space-y-4">
        <div className="rounded-2xl bg-amber-50 border border-amber-100 p-3 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-black text-amber-800">{t('expenseSummaryTitle')}</p>
            <button
              type="button"
              onClick={fillFromSummary}
              disabled={!summaryText.trim()}
              className="px-3 py-1.5 rounded-full bg-white text-[11px] font-black text-amber-800 border border-amber-200 disabled:opacity-40"
            >
              {t('expenseFillFromSummary')}
            </button>
          </div>
          <textarea
            value={summaryText}
            onChange={(e) => setSummaryText(e.target.value)}
            placeholder={t('expenseSummaryPlaceholder')}
            rows={4}
            className="w-full px-3 py-3 rounded-2xl border-2 border-amber-100 bg-white text-sm font-semibold outline-none focus:border-amber-300 resize-none"
          />
          <button
            type="button"
            onClick={saveSummary}
            disabled={saving || !summaryText.trim()}
            className="w-full py-3 rounded-2xl font-black text-white text-sm disabled:opacity-50 active:scale-95"
            style={{ background: '#3d1f0f' }}
          >
            {saving ? '⏳' : t('expenseSaveSummaryBtn')}
          </button>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-black text-stone-500 uppercase tracking-wide">
              {isEditing ? t('expenseEditTitle') : t('expenseManualTitle')}
            </p>
            {isEditing && (
              <button
                type="button"
                onClick={resetForm}
                className="text-[11px] font-black text-stone-500 underline"
              >
                {t('cancel')}
              </button>
            )}
          </div>
          <input
            type="date"
            max={todayKey}
            value={dateKeyToInputValue(entryDateKey)}
            onChange={(e) => setEntryDateKey(e.target.value)}
            className="w-full px-4 py-3 rounded-2xl border-2 border-stone-200 text-sm font-black outline-none focus:border-amber-300"
          />
          <input
            value={expDesc}
            onChange={(e) => setExpDesc(e.target.value)}
            placeholder={t('expensePlaceholder')}
            className="w-full px-4 py-3 rounded-2xl border-2 border-stone-200 text-sm font-semibold outline-none focus:border-amber-300"
          />
          <div className="flex gap-2">
            <input
              value={expAmount}
              onChange={(e) => setExpAmount(e.target.value.replace(/\D/g, ''))}
              placeholder={t('expenseAmountPlaceholder')}
              inputMode="numeric"
              className="flex-1 px-4 py-3 rounded-2xl border-2 border-stone-200 text-lg text-center font-black outline-none focus:border-amber-300"
            />
            <button
              type="button"
              onClick={() => addOrUpdateExpense({ mode: 'manual' })}
              disabled={saving || !expDesc.trim() || !expAmount || !entryDateKey}
              className="px-5 py-3 rounded-2xl font-black text-white text-sm disabled:opacity-50 active:scale-95"
              style={{ background: '#3d1f0f' }}
            >
              {saving ? '⏳' : isEditing ? t('expenseUpdateBtn') : t('expenseAddBtn')}
            </button>
          </div>
          <p className="text-[11px] text-stone-400 leading-relaxed">{t('expenseBackdateHint')}</p>
        </div>

        {expenses.length === 0 ? (
          <p className="text-stone-400 text-sm text-center py-6">{t('expensesEmpty')}</p>
        ) : (
          <div className="divide-y divide-stone-100">
            {expenses.map((e, i) => (
              <button
                key={e.id || i}
                type="button"
                onClick={() => startEdit(e)}
                className="w-full flex justify-between items-start gap-3 py-2.5 text-left active:bg-stone-50"
              >
                <div className="min-w-0">
                  <p className="text-sm font-bold text-stone-800">{e.description}</p>
                  <p className="text-[10px] text-stone-400 mt-0.5">
                    {e.createdBy || e.updatedBy || 'ชินชา'} · {t('tapToEditExpense')}
                  </p>
                </div>
                <span className="font-black text-red-500 shrink-0">
                  −฿{(e.amount || 0).toLocaleString()}
                </span>
              </button>
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
