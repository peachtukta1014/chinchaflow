import { useEffect, useState } from 'react';
import { dateKeyBangkok, shiftDateKey } from '../lib/constants';
import { formatDateKeyLabel } from '../lib/localeFormat';
import { fsPost, fsQueryExpenses } from '../lib/firestoreRest';

export function ExpensesTab({ member, t, lang = 'th', viewDateKey, setViewDateKey }) {
  const [expenses, setExpenses] = useState([]);
  const [expDesc, setExpDesc] = useState('');
  const [expAmount, setExpAmount] = useState('');
  const [saving, setSaving] = useState(false);
  const [flash, setFlash] = useState('');

  const todayKey = dateKeyBangkok();
  const isToday = viewDateKey === todayKey;
  const total = expenses.reduce((s, e) => s + (e.amount || 0), 0);

  useEffect(() => {
    fsQueryExpenses(viewDateKey).then(setExpenses);
  }, [viewDateKey]);

  const addExpense = async () => {
    if (!isToday) return;
    const desc = expDesc.trim();
    const amount = parseInt(expAmount, 10);
    if (!desc || !amount || amount <= 0) return;
    setSaving(true);
    try {
      await fsPost('dailyExpenses', {
        dateKey: viewDateKey,
        description: desc,
        amount,
        createdBy: member?.name || 'ชินชา',
        createdAt: new Date().toISOString(),
      });
      setExpenses(await fsQueryExpenses(viewDateKey));
      setExpDesc('');
      setExpAmount('');
      setFlash(t('expenseSaved'));
      setTimeout(() => setFlash(''), 2000);
    } catch (e) {
      console.error(e);
      alert(t('saveFailed'));
    }
    setSaving(false);
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

      <div className="bg-white rounded-3xl p-4 shadow-sm border border-stone-200">
        {!isToday && (
          <p className="text-xs text-stone-400 mb-3">{t('expenseTodayOnly')}</p>
        )}
        {isToday && (
          <div className="space-y-2 mb-4">
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
                onClick={addExpense}
                disabled={saving || !expDesc.trim() || !expAmount}
                className="px-5 py-3 rounded-2xl font-black text-white text-sm disabled:opacity-50 active:scale-95"
                style={{ background: '#3d1f0f' }}
              >
                {saving ? '⏳' : t('expenseAddBtn')}
              </button>
            </div>
          </div>
        )}

        {expenses.length === 0 ? (
          <p className="text-stone-400 text-sm text-center py-6">{t('expensesEmpty')}</p>
        ) : (
          <div className="divide-y divide-stone-100">
            {expenses.map((e, i) => (
              <div key={e.id || i} className="flex justify-between items-start gap-3 py-2.5">
                <div className="min-w-0">
                  <p className="text-sm font-bold text-stone-800">{e.description}</p>
                  {e.createdBy && (
                    <p className="text-[10px] text-stone-400 mt-0.5">{e.createdBy}</p>
                  )}
                </div>
                <span className="font-black text-red-500 shrink-0">
                  −฿{(e.amount || 0).toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <p className="text-[10px] text-stone-400 text-center px-2 leading-relaxed">
        {t('expensesRestockHint')}
      </p>
    </div>
  );
}
