import { useCallback, useState } from 'react';
import { VoiceCommandBar } from '../components/VoiceCommandBar';
import { hasLineSummaryCommand } from '../lib/voiceTabCommands';
import { dateKeyBangkok, shiftDateKey } from '../lib/constants';
import { formatDateKeyLabel } from '../lib/localeFormat';
import { pushTeaLineSummary } from '../lib/lineNotify';
import { menuDisplayName } from '../lib/displayNames';
import { ExpensesTab } from './ExpensesTab';

export function SummaryTab({ orders, t, lang = 'th', viewDateKey, setViewDateKey, member, menuItems, isAdmin }) {
  const [lineSending, setLineSending] = useState(false);
  const [lineFlash, setLineFlash] = useState('');

  const todayKey = dateKeyBangkok();
  const isToday = viewDateKey === todayKey;

  const allItems = orders.flatMap((o) => o.items || []);

  const countMap = {};
  allItems.forEach((i) => { countMap[i.key] = (countMap[i.key] || 0) + (i.qty || 1); });
  const topItems = Object.entries(countMap).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const maxCount = topItems[0]?.[1] || 1;

  const labelForKey = (key) => {
    const m = menuItems.find((x) => x.key === key || x.id === key);
    if (m) return menuDisplayName(m, lang, t);
    return t(key) || key;
  };

  const sendLineSummary = useCallback(async () => {
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
  }, [viewDateKey, t]);

  const onVoiceFinal = useCallback((text) => {
    if (!isAdmin) return { log: text };
    if (hasLineSummaryCommand(text)) {
      sendLineSummary();
      return { log: `${text} · 📲 ${t('sendLineSummary')}` };
    }
    return { log: `${text} · ${t('voiceSummaryHint')}` };
  }, [isAdmin, sendLineSummary, t]);

  return (
    <div className="px-4 pt-3 pb-6 space-y-3">
      <div className="flex items-center gap-2 bg-white rounded-2xl p-2 border border-stone-200 shadow-sm">
        <button type="button" onClick={() => setViewDateKey(shiftDateKey(viewDateKey, -1))} className="w-12 h-12 rounded-2xl bg-stone-100 font-black text-lg text-stone-600 active:scale-95">‹</button>
        <div className="flex-1 text-center min-w-0">
          <p className="font-black text-sm text-stone-800 truncate">{formatDateKeyLabel(viewDateKey, lang, { year: true })}</p>
          {isToday ? (
            <p className="text-[10px] text-emerald-600 font-bold">{t('todaySales')}</p>
          ) : (
            <button type="button" onClick={() => setViewDateKey(todayKey)} className="text-[10px] text-amber-700 font-bold underline">{t('backToday')}</button>
          )}
        </div>
        <button
          type="button"
          disabled={viewDateKey >= todayKey}
          onClick={() => setViewDateKey(shiftDateKey(viewDateKey, 1))}
          className="w-12 h-12 rounded-2xl bg-stone-100 font-black text-lg text-stone-600 disabled:opacity-30 active:scale-95"
        >
          ›
        </button>
      </div>

      {isAdmin && (
        <VoiceCommandBar
          lang={lang}
          t={t}
          hint={t('voiceSummaryHint')}
          onFinalText={onVoiceFinal}
        />
      )}

      <ExpensesTab
        member={member}
        t={t}
        lang={lang}
        viewDateKey={viewDateKey}
        setViewDateKey={setViewDateKey}
        allowedModes={['summary']}
        defaultMode="summary"
        compactHeader
      />

      {lineFlash && (
        <p className={`text-center text-xs font-bold py-2 rounded-xl ${lineFlash.startsWith('✅') ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'}`}>
          {lineFlash}
        </p>
      )}
      {isAdmin && (
        <button
          type="button"
          disabled={lineSending}
          onClick={sendLineSummary}
          className="w-full min-h-14 py-4 rounded-2xl font-black text-base text-white flex items-center justify-center gap-2 disabled:opacity-60 active:scale-95"
          style={{ background: '#1a8f4c' }}
        >
          {lineSending ? '⏳' : '📲'} {t('sendLineSummary')}
        </button>
      )}
      <div className="bg-white rounded-3xl p-4 border border-stone-200">
        <p className="font-bold text-stone-500 text-[10px] uppercase mb-3">{t('topItems')}</p>
        {topItems.length === 0 ? (
          <p className="text-stone-300 text-sm text-center">{t('noOrders')}</p>
        ) : (
          topItems.map(([key, count], idx) => (
            <div key={key} className="flex items-center gap-2 mb-2">
              <span>{['🥇', '🥈', '🥉', '4.', '5.'][idx]}</span>
              <div className="flex-1">
                <div className="flex justify-between text-xs font-bold">
                  <span>{labelForKey(key)}</span>
                  <span>{count} {t('cupUnit')}</span>
                </div>
                <div className="h-1.5 bg-stone-100 rounded-full mt-1">
                  <div className="h-full rounded-full" style={{ background: '#c87941', width: `${(count / maxCount) * 100}%` }} />
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
