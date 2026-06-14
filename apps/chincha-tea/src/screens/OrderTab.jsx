import { useCallback, useMemo, useState } from 'react';
import { DRINK_CATEGORIES, dateKeyBangkok, menuItemToCard } from '../lib/constants';
import { burmeseToThai } from '../lib/burmeseToThai';
import { categoryDisplayLabel, categoryDisplaySub } from '../lib/displayNames';
import { parseTeaVoice, voiceLinesToCart } from '../lib/voiceOrder';
import { VoiceCommandBar } from '../components/VoiceCommandBar';
import { MenuCard } from '../components/MenuCard';
import { CustomizeModal } from '../components/CustomizeModal';
import { saveBulkEntry } from '../lib/bulkEntryService';

export function OrderTab({ menuItems, toppingsList, lang, t, onAddToCart, onVoiceCartReady, setModalItem, modalItem, member, onBulkEntrySaved }) {
  const [search, setSearch] = useState('');

  const onVoiceFinal = useCallback((text) => {
    const lines = parseTeaVoice(text, menuItems, toppingsList);
    const cartLines = voiceLinesToCart(lines, t, lang);

    if (cartLines.length > 0) {
      cartLines.forEach((line) => onAddToCart(line));
      onVoiceCartReady?.();
      const summary = cartLines.map((c) => `${c.qty}×${c.nameSnapshot}`).join(', ');
      return { log: `${text} · ✅ ${summary} · ตรวจรายการแล้วกดบันทึกเอง` };
    }

    return { log: `${text} · ${t('voiceNoMenu')}` };
  }, [menuItems, toppingsList, t, onAddToCart, onVoiceCartReady, lang]);

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
      <BulkEntryForm t={t} member={member} onSaved={onBulkEntrySaved} />
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


function digits(v) {
  return String(v || '').replace(/\D/g, '');
}

function BulkEntryForm({ t, member, onSaved }) {
  const [dateKey, setDateKey] = useState(dateKeyBangkok());
  const [total, setTotal] = useState('');
  const [cups, setCups] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [flash, setFlash] = useState('');
  const todayKey = dateKeyBangkok();

  const submit = async () => {
    if (!dateKey || !total) return;
    setSaving(true);
    setFlash('');
    try {
      await saveBulkEntry({ dateKey, manualBulkTotal: total, manualCupsSold: cups, note, member });
      setTotal('');
      setCups('');
      setNote('');
      setFlash(t('bulkEntrySaved'));
      onSaved?.(dateKey);
      setTimeout(() => setFlash(''), 2500);
    } catch (e) {
      console.error(e);
      alert(t('saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="px-4 mt-3">
      <div className="rounded-3xl border border-amber-100 bg-white p-4 shadow-sm space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-black text-amber-700 uppercase tracking-wide">{t('bulkEntryTitle')}</p>
            <p className="text-[11px] text-stone-500 mt-0.5">{t('bulkEntryHint')}</p>
          </div>
          <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[10px] font-black text-amber-800">PR 3</span>
        </div>
        {flash && <p className="rounded-2xl bg-emerald-50 px-3 py-2 text-center text-xs font-black text-emerald-700">{flash}</p>}
        <input type="date" max={todayKey} value={dateKey} onChange={(e) => setDateKey(e.target.value)} className="w-full px-4 py-3 rounded-2xl border-2 border-stone-200 text-sm font-black outline-none focus:border-amber-300" />
        <div className="grid grid-cols-2 gap-2">
          <BulkField label={t('manualBulkTotal')} value={total} onChange={(v) => setTotal(digits(v))} suffix="บาท" />
          <BulkField label={t('manualCupsSold')} value={cups} onChange={(v) => setCups(digits(v))} suffix={t('cupUnit')} />
        </div>
        <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder={t('bulkEntryNotePlaceholder')} rows={2} className="w-full px-4 py-3 rounded-2xl border-2 border-stone-200 text-sm font-semibold outline-none resize-none focus:border-amber-300" />
        <p className="text-[11px] font-bold text-stone-500">{t('staffRecorderLabel')}: {member?.name || 'ชินชา'}</p>
        <button type="button" onClick={submit} disabled={saving || !dateKey || !total} className="w-full py-3 rounded-2xl font-black text-white text-sm disabled:opacity-50 active:scale-95" style={{ background: '#3d1f0f' }}>{saving ? '⏳' : t('bulkEntrySaveBtn')}</button>
      </div>
    </div>
  );
}

function BulkField({ label, value, onChange, suffix }) {
  return (
    <label className="block">
      <span className="block text-[11px] font-black text-stone-500 mb-1">{label}</span>
      <div className="flex items-center rounded-2xl border-2 border-stone-200 bg-white focus-within:border-amber-300">
        <input value={value} onChange={(e) => onChange(e.target.value)} inputMode="numeric" className="min-w-0 flex-1 bg-transparent px-3 py-3 text-lg font-black text-stone-800 outline-none" />
        <span className="pr-3 text-xs font-bold text-stone-400">{suffix}</span>
      </div>
    </label>
  );
}
