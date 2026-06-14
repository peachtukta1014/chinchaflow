import { useCallback, useMemo, useState } from 'react';
import { DRINK_CATEGORIES, dateKeyBangkok, menuItemToCard } from '../lib/constants';
import { burmeseToThai } from '../lib/burmeseToThai';
import { categoryDisplayLabel, categoryDisplaySub } from '../lib/displayNames';
import { parseTeaVoice, voiceLinesToCart } from '../lib/voiceOrder';
import { VoiceCommandBar } from '../components/VoiceCommandBar';
import { MenuCard } from '../components/MenuCard';
import { CustomizeModal } from '../components/CustomizeModal';
import { saveBulkEntry } from '../lib/bulkEntryService';
import { parseSmartPriceOrder, smartPriceOrderSummary } from '../lib/smartPriceOrder';

export function OrderTab({ menuItems, toppingsList, lang, t, onAddToCart, onVoiceCartReady, setModalItem, modalItem, member, onBulkEntrySaved }) {
  const [search, setSearch] = useState('');

  const onVoiceFinal = useCallback((text) => {
    const smartLine = parseSmartPriceOrder(text, toppingsList);
    if (smartLine) {
      onAddToCart(smartLine);
      onVoiceCartReady?.();
      return { log: `${text} · ✅ ${smartPriceOrderSummary(smartLine)} = ฿${smartLine.lineTotal} · ตรวจรายการแล้วกดบันทึกเอง` };
    }

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
        <VoiceCommandBar lang={lang} t={t} onFinalText={onVoiceFinal} />
      </div>
      <SmartPriceOrderPanel toppingsList={toppingsList} onAddToCart={onAddToCart} onCartReady={onVoiceCartReady} />
      <BulkEntryForm t={t} member={member} onSaved={onBulkEntrySaved} />
      <div className="px-4 mt-4">
        <details className="rounded-3xl border border-stone-200 bg-white p-3 shadow-sm">
          <summary className="cursor-pointer text-xs font-black text-stone-500">เมนูเดิม / สำรอง</summary>
          <div className="relative mt-3">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('searchMenu')}
              className="w-full pl-4 pr-4 py-2.5 rounded-2xl bg-stone-100 text-sm outline-none focus:border-amber-300 border-2 border-transparent"
            />
          </div>
          {grouped.map(({ cat, items }) => (
            <div key={cat.id} className="mt-4">
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
        </details>
      </div>
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


function SmartPriceOrderPanel({ toppingsList, onAddToCart, onCartReady }) {
  const [basePrice, setBasePrice] = useState('25');
  const [qty, setQty] = useState('1');
  const [selectedToppingIds, setSelectedToppingIds] = useState([]);
  const [toppingQty, setToppingQty] = useState('1');
  const [flash, setFlash] = useState('');

  const quickPrices = [20, 25, 30, 35, 40, 45, 50, 60];
  const activeToppings = toppingsList.filter((tp) => tp.active !== false);
  const selectedToppings = activeToppings
    .filter((tp) => selectedToppingIds.includes(tp.id))
    .map((tp) => ({ ...tp, qty: Math.max(1, Math.min(Number(qty) || 1, Number(toppingQty) || 1)) }));
  const cupQty = Math.max(1, Number(qty) || 1);
  const cupPrice = Math.max(0, Number(basePrice) || 0);
  const toppingTotal = selectedToppings.reduce((sum, tp) => sum + Number(tp.price || 0) * Number(tp.qty || 1), 0);
  const lineTotal = (cupPrice * cupQty) + toppingTotal;

  const toggleTopping = (tp) => {
    setSelectedToppingIds((prev) => (
      prev.includes(tp.id) ? prev.filter((id) => id !== tp.id) : [...prev, tp.id]
    ));
  };

  const add = () => {
    if (!cupPrice || !cupQty) return;
    onAddToCart({
      key: 'smart-price-cup',
      emoji: '🥤',
      nameSnapshot: `แก้วละ ${cupPrice} บาท`,
      size: 'หน้าร้าน',
      sweet: '-',
      ice: 'normalice',
      toppings: selectedToppings,
      price: cupPrice,
      qty: cupQty,
      lineTotal,
      smartPrice: true,
      basePrice: cupPrice,
      note: smartPriceOrderSummary({ smartPrice: true, basePrice: cupPrice, price: cupPrice, qty: cupQty, toppings: selectedToppings }),
      cartId: Date.now() + Math.random(),
    });
    onCartReady?.();
    setSelectedToppingIds([]);
    setFlash(`เพิ่มแล้ว ${cupPrice}×${cupQty} = ฿${lineTotal}`);
    setTimeout(() => setFlash(''), 2000);
  };

  return (
    <div className="px-4 mt-2">
      <div className="rounded-3xl border border-amber-100 bg-white p-4 shadow-sm space-y-3">
        <div>
          <p className="text-xs font-black text-amber-700 uppercase tracking-wide">Smart Order</p>
          <p className="text-[11px] text-stone-500 mt-0.5">กรอกแค่ราคาแก้ว + จำนวน + ท็อปปิ้ง แล้วตรวจตะกร้าก่อนบันทึก</p>
        </div>
        {flash && <p className="rounded-2xl bg-emerald-50 px-3 py-2 text-center text-xs font-black text-emerald-700">{flash}</p>}
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {quickPrices.map((price) => (
            <button
              key={price}
              type="button"
              onClick={() => setBasePrice(String(price))}
              className={`shrink-0 rounded-2xl px-3 py-2 text-xs font-black border-2 ${Number(basePrice) === price ? 'border-amber-400 bg-amber-50 text-amber-800' : 'border-stone-200 text-stone-500'}`}
            >
              ฿{price}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <BulkField label="ราคา/แก้ว" value={basePrice} onChange={(v) => setBasePrice(digits(v))} suffix="บาท" />
          <BulkField label="จำนวนแก้ว" value={qty} onChange={(v) => setQty(digits(v))} suffix="แก้ว" />
        </div>
        {activeToppings.length > 0 && (
          <div>
            <div className="flex items-center justify-between gap-2 mb-2">
              <p className="text-[11px] font-black text-stone-500">ท็อปปิ้ง</p>
              <label className="flex items-center gap-1 text-[11px] font-bold text-stone-500">
                ใส่กี่แก้ว
                <input value={toppingQty} onChange={(e) => setToppingQty(digits(e.target.value))} inputMode="numeric" className="w-12 rounded-xl border border-stone-200 px-2 py-1 text-center font-black outline-none" />
              </label>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {activeToppings.map((tp) => {
                const selected = selectedToppingIds.includes(tp.id);
                return (
                  <button
                    key={tp.id}
                    type="button"
                    onClick={() => toggleTopping(tp)}
                    className={`rounded-2xl border-2 px-3 py-2 text-left text-xs font-bold ${selected ? 'border-amber-400 bg-amber-50 text-amber-900' : 'border-stone-200 text-stone-600'}`}
                  >
                    {tp.label} <span className="text-amber-600">+{tp.price}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
        <button type="button" onClick={add} disabled={!cupPrice || !cupQty} className="w-full py-3 rounded-2xl font-black text-white text-sm disabled:opacity-50 active:scale-95" style={{ background: '#3d1f0f' }}>
          เพิ่มเข้าตะกร้า · ฿{lineTotal}
        </button>
      </div>
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
