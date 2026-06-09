import { useState } from 'react';
import { ICE_OPTIONS, SIZES, SWEET_OPTIONS } from '../lib/constants';
import { menuDisplayName, toppingDisplayLabel, toppingDisplaySub } from '../lib/displayNames';

export function CustomizeModal({ item, toppingsList, lang, t, onAdd, onClose }) {
  const [selectedSize, setSelectedSize] = useState(SIZES[0]);
  const [selectedSweet, setSelectedSweet] = useState(SWEET_OPTIONS[4]);
  const [selectedIce, setSelectedIce] = useState(ICE_OPTIONS[2]);
  const [selectedToppings, setSelectedToppings] = useState([]);
  const [qty, setQty] = useState(1);
  const [note, setNote] = useState('');

  const toppingTotal = selectedToppings.reduce((s, tp) => s + (tp.price || 0), 0);
  const unitPrice = (item.basePrice || 0) + selectedSize.addPrice + toppingTotal;
  const lineTotal = unitPrice * qty;
  const name = menuDisplayName(item, lang, t);
  const nameSub = lang === 'my' ? (item.nameTh || item.nameEn) : item.nameEn;

  const toggleTopping = (tp) => {
    setSelectedToppings((prev) =>
      (prev.find((x) => x.id === tp.id) ? prev.filter((x) => x.id !== tp.id) : [...prev, tp]),
    );
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-end justify-center" onClick={onClose}>
      <div
        className="bg-white w-full max-w-md rounded-t-[2rem] p-6 space-y-4 max-h-[90vh] overflow-y-auto"
        style={{ paddingBottom: 'max(1.5rem,env(safe-area-inset-bottom))' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3">
          <span className="text-4xl">{item.emoji}</span>
          <div className="flex-1">
            <h2 className="font-black text-stone-800 text-xl">{name}</h2>
            {nameSub && <p className="text-xs text-stone-400">{nameSub}</p>}
            <p className="text-stone-400 text-sm">
              ฿{item.basePrice}
              {toppingTotal > 0 && <span className="text-amber-600"> +{toppingTotal}</span>}
              {' = '}
              <strong style={{ color: '#3d1f0f' }}>฿{lineTotal}</strong>
            </p>
          </div>
          <button type="button" onClick={onClose} className="text-stone-300 text-3xl">×</button>
        </div>

        <div>
          <p className="text-[11px] font-bold text-stone-400 mb-2 uppercase">{t('size')}</p>
          <div className="flex gap-2">
            {SIZES.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setSelectedSize(s)}
                className={`flex-1 py-2.5 rounded-2xl font-black text-sm border-2 ${selectedSize.id === s.id ? 'text-white border-transparent' : 'text-stone-500 border-stone-200'}`}
                style={selectedSize.id === s.id ? { background: '#3d1f0f' } : {}}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="text-[11px] font-bold text-stone-400 mb-2 uppercase">{t('sweet')}</p>
          <div className="flex gap-1.5 flex-wrap">
            {SWEET_OPTIONS.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setSelectedSweet(s)}
                className={`px-3 py-2 rounded-xl font-bold text-xs border-2 ${selectedSweet.id === s.id ? 'text-white border-transparent' : 'text-stone-500 border-stone-200'}`}
                style={selectedSweet.id === s.id ? { background: '#c87941' } : {}}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="text-[11px] font-bold text-stone-400 mb-2 uppercase">{t('ice')}</p>
          <div className="flex gap-1.5 flex-wrap">
            {ICE_OPTIONS.map((ic) => (
              <button
                key={ic.id}
                type="button"
                onClick={() => setSelectedIce(ic)}
                className={`px-3 py-2 rounded-xl font-bold text-xs border-2 ${selectedIce.id === ic.id ? 'text-white border-transparent' : 'text-stone-500 border-stone-200'}`}
                style={selectedIce.id === ic.id ? { background: '#4a7a8a' } : {}}
              >
                {t(ic.labelKey)}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="text-[11px] font-bold text-stone-400 mb-2 uppercase">{t('toppings')}</p>
          <div className="grid grid-cols-2 gap-2">
            {toppingsList.map((tp) => {
              const selected = !!selectedToppings.find((x) => x.id === tp.id);
              return (
                <button
                  key={tp.id}
                  type="button"
                  onClick={() => toggleTopping(tp)}
                  className={`px-3 py-2.5 rounded-2xl border-2 text-left text-xs font-bold ${selected ? 'border-amber-400 bg-amber-50' : 'border-stone-200'}`}
                >
                  <span>{toppingDisplayLabel(tp, lang)}</span>
                  {toppingDisplaySub(tp, lang) && (
                    <span className="block text-[9px] text-stone-400 font-normal">{toppingDisplaySub(tp, lang)}</span>
                  )}
                  <span className="text-amber-600"> +{tp.price}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex items-center gap-4 ml-auto justify-end">
          <button type="button" onClick={() => setQty((q) => Math.max(1, q - 1))} className="w-10 h-10 rounded-full bg-stone-100 font-bold">−</button>
          <span className="text-2xl font-black w-8 text-center">{qty}</span>
          <button type="button" onClick={() => setQty((q) => q + 1)} className="w-10 h-10 rounded-full text-white font-bold" style={{ background: '#3d1f0f' }}>+</button>
        </div>

        <input
          type="text"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder={t('note')}
          className="w-full p-3 bg-stone-50 border border-stone-200 rounded-2xl text-sm outline-none"
        />

        <button
          type="button"
          onClick={() => onAdd({
            key: item.key || item.id,
            emoji: item.emoji,
            nameSnapshot: name,
            size: selectedSize.label,
            sweet: selectedSweet.label,
            ice: selectedIce.id,
            toppings: selectedToppings,
            price: unitPrice,
            qty,
            note,
            cartId: Date.now() + Math.random(),
          })}
          className="w-full py-4 rounded-2xl font-black text-white text-lg"
          style={{ background: '#3d1f0f' }}
        >
          {t('addToOrder')} · ฿{lineTotal}
        </button>
      </div>
    </div>
  );
}
