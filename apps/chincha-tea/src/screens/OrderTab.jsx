import { useCallback, useState } from 'react';
import { dateKeyBangkok } from '../lib/constants';
import { parseTeaVoice, voiceLinesToCart } from '../lib/voiceOrder';
import { VoiceCommandBar } from '../components/VoiceCommandBar';
import { SegmentedTabBar } from '../components/TabNav';
import { parseSmartPriceOrder, smartPriceOrderSummary } from '../lib/smartPriceOrder';
import { ExpensesTab } from './ExpensesTab';
import ToppingSaleSettings from '../components/ToppingSaleSettings';
import { canManageTeaSaleSettings } from '../lib/teaRoles';

export function OrderTab({
  toppingsList,
  lang,
  t,
  onAddToCart,
  onVoiceCartReady,
  member,
  viewDateKey,
  setViewDateKey,
  onSummaryChanged,
  section = 'order',
  onSectionChange,
  onToppingsChanged,
}) {
  const [localSection, setLocalSection] = useState(section);
  const activeSection = onSectionChange ? section : localSection;
  const setSection = onSectionChange || setLocalSection;

  const onVoiceFinal = useCallback((text) => {
    if (activeSection !== 'order') {
      return { log: `${text} · ${t('orderSubTabSale')}` };
    }

    const smartLine = parseSmartPriceOrder(text, toppingsList);
    if (smartLine) {
      onAddToCart(smartLine);
      onVoiceCartReady?.();
      return { log: `${text} · ✅ ${smartPriceOrderSummary(smartLine)} = ฿${smartLine.lineTotal} · ${t('voiceReviewCartHint')}` };
    }

    const lines = parseTeaVoice(text, [], toppingsList);
    const cartLines = voiceLinesToCart(lines, t, lang);

    if (cartLines.length > 0) {
      cartLines.forEach((line) => onAddToCart(line));
      onVoiceCartReady?.();
      const summary = cartLines.map((c) => `${c.qty}×${c.nameSnapshot}`).join(', ');
      return { log: `${text} · ✅ ${summary} · ${t('voiceReviewCartHint')}` };
    }

    return { log: `${text} · ${t('voiceNoMenu')}` };
  }, [activeSection, toppingsList, t, onAddToCart, onVoiceCartReady, lang]);

  return (
    <div className="pb-32">
      <div className="px-4 pt-3 sticky top-0 z-30 bg-[#fdf6f0]/95 backdrop-blur">
        <SegmentedTabBar
          tabs={[
            ['order', t('orderSubTabSale')],
            ['close', t('orderSubTabClose')],
          ]}
          activeId={activeSection}
          onSelect={setSection}
        />
      </div>

      {activeSection === 'order' ? (
        <>
          <div className="px-4 pt-3 pb-2 space-y-2">
            <VoiceCommandBar lang={lang} t={t} onFinalText={onVoiceFinal} />
          </div>
          <SmartPriceOrderPanel
            toppingsList={toppingsList}
            onAddToCart={onAddToCart}
            onCartReady={onVoiceCartReady}
            t={t}
            member={member}
            onToppingsChanged={onToppingsChanged}
          />
        </>
      ) : (
        <ExpensesTab
          member={member}
          t={t}
          lang={lang}
          viewDateKey={viewDateKey}
          setViewDateKey={setViewDateKey}
          allowedModes={['summary']}
          defaultMode="summary"
          compactHeader
          hideSummaryHero
          showLineSend
          onSummaryChanged={onSummaryChanged}
        />
      )}
    </div>
  );
}

function SmartPriceOrderPanel({ toppingsList, onAddToCart, onCartReady, t, member, onToppingsChanged }) {
  const canManageToppings = canManageTeaSaleSettings(member);
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
      nameSnapshot: `${t('smartCupPriceLabel')} ${cupPrice}`,
      size: t('smartCupSizeLabel'),
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
    setFlash(t('smartOrderAdded').replace('{total}', String(lineTotal)));
    setTimeout(() => setFlash(''), 2000);
  };

  return (
    <div className="px-4 mt-2">
      <div className="rounded-3xl border border-amber-100 bg-white p-4 shadow-sm space-y-3">
        <div>
          <p className="text-xs font-black text-amber-700 uppercase tracking-wide">{t('smartOrderTitle')}</p>
          <p className="text-[11px] text-stone-500 mt-0.5">{t('smartOrderHint')}</p>
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
          <BulkField label={t('smartPricePerCup')} value={basePrice} onChange={(v) => setBasePrice(digits(v))} suffix={t('bahtUnit')} />
          <BulkField label={t('smartCupQty')} value={qty} onChange={(v) => setQty(digits(v))} suffix={t('cupUnit')} />
        </div>
        {activeToppings.length > 0 && (
          <div>
            <div className="flex items-center justify-between gap-2 mb-2">
              <p className="text-[11px] font-black text-stone-500">{t('toppings')}</p>
              <label className="flex items-center gap-1 text-[11px] font-bold text-stone-500">
                {t('smartToppingCupCount')}
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
        {canManageToppings && (
          <ToppingSaleSettings toppingsList={toppingsList} t={t} onChanged={onToppingsChanged} />
        )}
        <button type="button" onClick={add} disabled={!cupPrice || !cupQty} className="w-full py-3 rounded-2xl font-black text-white text-sm disabled:opacity-50 active:scale-95" style={{ background: '#3d1f0f' }}>
          {t('smartAddToCart')} · ฿{lineTotal}
        </button>
      </div>
    </div>
  );
}

function digits(v) {
  return String(v || '').replace(/\D/g, '');
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
