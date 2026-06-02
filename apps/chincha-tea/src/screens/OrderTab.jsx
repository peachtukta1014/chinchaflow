import { useCallback, useMemo, useState } from 'react';
import { DRINK_CATEGORIES, menuItemToCard } from '../lib/constants';
import { burmeseToThai } from '../lib/burmeseToThai';
import { categoryDisplayLabel, categoryDisplaySub } from '../lib/displayNames';
import { parseTeaVoice, voiceLinesToCart, hasVoiceCommitCommand } from '../lib/voiceOrder';
import { VoiceCommandBar } from '../components/VoiceCommandBar';
import { MenuCard } from '../components/MenuCard';
import { CustomizeModal } from '../components/CustomizeModal';

export function OrderTab({ menuItems, toppingsList, lang, t, onAddToCart, onVoiceCommit, canVoiceCommit, setModalItem, modalItem }) {
  const [search, setSearch] = useState('');

  const onVoiceFinal = useCallback((text) => {
    const lines = parseTeaVoice(text, menuItems, toppingsList);
    const cartLines = voiceLinesToCart(lines, t);

    if (cartLines.length > 0) {
      cartLines.forEach((line) => onAddToCart(line));
      const summary = cartLines.map((c) => `${c.qty}×${c.nameSnapshot}`).join(', ');
      return { log: `${text} · ✅ ${summary}` };
    }

    if (hasVoiceCommitCommand(text)) {
      const hasItemsToCommit = canVoiceCommit || cartLines.length > 0;
      if (!hasItemsToCommit) {
        return { log: `${text} · ${t('voiceCartEmpty')}` };
      }
      onVoiceCommit?.({ pendingLines: cartLines, rawText: text });
      return { log: `${text} · ✅` };
    }

    return { log: `${text} · ${t('voiceNoMenu')}` };
  }, [menuItems, toppingsList, t, onAddToCart, onVoiceCommit, canVoiceCommit]);

  const grouped = useMemo(() => {
    const kw = burmeseToThai(search.trim()).toLowerCase();
    return DRINK_CATEGORIES.map((cat) => ({
      cat,
      items: menuItems.filter((m) => {
        if (m.active === false) return false;
        if (m.category !== cat.id) return false;
        if (!kw) return true;
        const th = (m.nameTh || '').toLowerCase();
        const en = (m.nameEn || '').toLowerCase();
        const my = (m.nameMy || t(m.key) || '').toLowerCase();
        return th.includes(kw) || en.includes(kw) || my.includes(kw) || (m.key || '').toLowerCase().includes(kw);
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
            placeholder={t('searchMenu')}
            className="w-full pl-4 pr-4 py-2.5 rounded-2xl bg-stone-100 text-sm outline-none focus:border-amber-300 border-2 border-transparent"
          />
        </div>
        <VoiceCommandBar lang={lang} t={t} onFinalText={onVoiceFinal} />
      </div>
      {grouped.map(({ cat, items }) => (
        <div key={cat.id} className="px-4 mt-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="h-px flex-1 bg-stone-200" />
            <p className="text-[11px] font-black tracking-widest whitespace-nowrap" style={{ color: cat.accent }}>
              {categoryDisplayLabel(cat, lang, t)}
              <span className="font-light text-stone-300 ml-2 block text-[9px]">{categoryDisplaySub(cat, lang)}</span>
            </p>
            <div className="h-px flex-1 bg-stone-200" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            {items.map((item) => (
              <MenuCard key={item.id} item={menuItemToCard(item, t, lang)} cat={cat} lang={lang} t={t} onAdd={() => setModalItem(item)} />
            ))}
          </div>
        </div>
      ))}
      {modalItem && (
        <CustomizeModal
          item={modalItem}
          toppingsList={toppingsList}
          lang={lang}
          t={t}
          onAdd={(line) => { onAddToCart(line); setModalItem(null); }}
          onClose={() => setModalItem(null)}
        />
      )}
    </div>
  );
}
