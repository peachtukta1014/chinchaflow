import { useCallback, useMemo, useState } from 'react';
import { DRINK_CATEGORIES } from '../lib/constants';
import { parseTeaVoice, useVoice, voiceLinesToCart, hasVoiceCommitCommand } from '../lib/voiceOrder';
import { MenuCard } from './MenuCard';
import { CustomizeModal } from './CustomizeModal';

export function OrderTab({ menuItems, toppingsList, t, onAddToCart, onVoiceCommit, canVoiceCommit, setModalItem, modalItem }) {
  const [search, setSearch] = useState('');
  const [voiceLog, setVoiceLog] = useState('');

  const onVoiceFinal = useCallback((text) => {
    setVoiceLog(text);
    const lines = parseTeaVoice(text, menuItems, toppingsList);
    const cartLines = voiceLinesToCart(lines, t);
    cartLines.forEach((line) => onAddToCart(line));

    if (hasVoiceCommitCommand(text)) {
      const hasItemsToCommit = canVoiceCommit || cartLines.length > 0;
      if (!hasItemsToCommit) {
        setVoiceLog(`${text} · ยังไม่มีรายการในตะกร้า`);
        return;
      }
      onVoiceCommit?.({ pendingLines: cartLines, rawText: text });
    }
  }, [menuItems, toppingsList, t, onAddToCart, onVoiceCommit, canVoiceCommit]);

  const { listening, toggle, liveText } = useVoice(onVoiceFinal);

  const grouped = useMemo(() => {
    const kw = search.trim().toLowerCase();
    return DRINK_CATEGORIES.map((cat) => ({
      cat,
      items: menuItems.filter((m) => {
        if (m.active === false) return false;
        if (m.category !== cat.id) return false;
        if (!kw) return true;
        const th = (m.nameTh || '').toLowerCase();
        const en = (m.nameEn || '').toLowerCase();
        return th.includes(kw) || en.includes(kw) || (m.key || '').toLowerCase().includes(kw);
      }),
    })).filter((g) => g.items.length > 0);
  }, [menuItems, search]);

  return (
    <div className="pb-32">
      <div className="px-4 pt-3 pb-2 space-y-2">
        <div className="relative">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="ค้นหาเมนู..."
            className="w-full pl-4 pr-4 py-2.5 rounded-2xl bg-stone-100 text-sm outline-none focus:border-amber-300 border-2 border-transparent"
          />
        </div>
        <button
          type="button"
          onClick={toggle}
          className={`w-full flex items-center justify-center gap-2 py-3 rounded-2xl font-bold text-sm border-2 transition-all ${
            listening ? 'bg-red-500 border-red-400 text-white' : 'bg-white border-stone-200 text-stone-600'
          }`}
        >
          <span>{listening ? '🎙️' : '🎤'}</span>
          {listening ? t('voiceStop') : t('voiceListen')}
        </button>
        {(listening || liveText || voiceLog) && (
          <p className={`text-xs px-2 py-2 rounded-xl ${listening ? 'bg-red-50 text-red-600' : 'bg-stone-100 text-stone-500'}`}>
            {liveText || voiceLog || t('voiceHint')}
          </p>
        )}
      </div>
      {grouped.map(({ cat, items }) => (
        <div key={cat.id} className="px-4 mt-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="h-px flex-1 bg-stone-200" />
            <p className="text-[11px] font-black tracking-widest whitespace-nowrap" style={{ color: cat.accent }}>
              {cat.label}
              <span className="font-light text-stone-300 ml-2">{cat.labelEn}</span>
            </p>
            <div className="h-px flex-1 bg-stone-200" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            {items.map((item) => (
              <MenuCard key={item.id} item={item} cat={cat} t={t} onAdd={() => setModalItem(item)} />
            ))}
          </div>
        </div>
      ))}
      {modalItem && (
        <CustomizeModal
          item={modalItem}
          toppingsList={toppingsList}
          t={t}
          onAdd={(line) => { onAddToCart(line); setModalItem(null); }}
          onClose={() => setModalItem(null)}
        />
      )}
    </div>
  );
}
