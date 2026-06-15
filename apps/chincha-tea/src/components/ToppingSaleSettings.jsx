import { useEffect, useState } from 'react';
import { fsDelete } from '../lib/firestoreRest';
import { saveTopping } from '../lib/productService';

function digits(v) {
  return String(v || '').replace(/\D/g, '');
}

function ToppingRow({ item, t, onSaved, onDeleted }) {
  const [label, setLabel] = useState(item.label || '');
  const [price, setPrice] = useState(String(item.price ?? ''));
  const [saving, setSaving] = useState(false);
  const dirty = label.trim() !== (item.label || '').trim()
    || String(Math.max(0, Number(price) || 0)) !== String(Math.max(0, Number(item.price) || 0));

  useEffect(() => {
    setLabel(item.label || '');
    setPrice(String(item.price ?? ''));
  }, [item.id, item.label, item.price]);

  const save = async () => {
    if (!label.trim()) return;
    setSaving(true);
    try {
      await saveTopping({ label, price, active: true }, item.id);
      onSaved?.();
    } catch (e) {
      console.error(e);
      alert(t('saveFailed'));
    }
    setSaving(false);
  };

  const remove = async () => {
    if (!window.confirm(t('confirmDeleteTopping').replace('{name}', item.label || '—'))) return;
    setSaving(true);
    try {
      await fsDelete(`toppings/${item.id}`);
      onDeleted?.();
    } catch (e) {
      console.error(e);
      alert(t('saveFailed'));
    }
    setSaving(false);
  };

  return (
    <div className="flex items-center gap-2 rounded-2xl border border-stone-200 bg-stone-50/80 px-2 py-2">
      <input
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        placeholder={t('toppingName')}
        className="min-w-0 flex-1 rounded-xl border border-stone-200 bg-white px-2.5 py-2 text-xs font-bold text-stone-800 outline-none focus:border-amber-300"
      />
      <div className="flex items-center rounded-xl border border-stone-200 bg-white shrink-0">
        <input
          value={price}
          onChange={(e) => setPrice(digits(e.target.value))}
          inputMode="numeric"
          placeholder="0"
          className="w-12 bg-transparent px-2 py-2 text-center text-xs font-black text-stone-800 outline-none"
        />
        <span className="pr-2 text-[10px] font-bold text-stone-400">{t('bahtUnit')}</span>
      </div>
      <button
        type="button"
        disabled={saving || !dirty || !label.trim()}
        onClick={save}
        className="shrink-0 rounded-xl px-2.5 py-2 text-[10px] font-black text-white disabled:opacity-35 active:scale-95"
        style={{ background: '#3d1f0f' }}
      >
        {saving ? '…' : t('save')}
      </button>
      <button
        type="button"
        disabled={saving}
        onClick={remove}
        className="shrink-0 w-8 h-8 rounded-xl text-red-400 font-black text-sm disabled:opacity-35 active:scale-95"
        aria-label={t('delete')}
      >
        ×
      </button>
    </div>
  );
}

export default function ToppingSaleSettings({ toppingsList = [], t, onChanged }) {
  const [open, setOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [newLabel, setNewLabel] = useState('');
  const [newPrice, setNewPrice] = useState('10');
  const [savingNew, setSavingNew] = useState(false);

  const refresh = () => onChanged?.();

  const addTopping = async () => {
    if (!newLabel.trim()) return;
    setSavingNew(true);
    try {
      await saveTopping({ label: newLabel, price: newPrice, active: true }, null);
      setNewLabel('');
      setNewPrice('10');
      setAdding(false);
      refresh();
    } catch (e) {
      console.error(e);
      alert(t('saveFailed'));
    }
    setSavingNew(false);
  };

  return (
    <div className="rounded-2xl border border-dashed border-amber-200/80 bg-amber-50/40 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-2 px-3 py-2.5 text-left active:bg-amber-50/80"
      >
        <span className="text-[11px] font-black text-amber-900">{t('saleToppingSettings')}</span>
        <span className="text-xs text-amber-700 font-bold">{open ? '▲' : '⚙'}</span>
      </button>
      {open && (
        <div className="px-3 pb-3 space-y-2 border-t border-amber-100/80">
          <p className="text-[10px] text-amber-800/75 leading-relaxed pt-2">{t('saleToppingSettingsHint')}</p>
          {toppingsList.length === 0 ? (
            <p className="text-xs text-stone-400 text-center py-2">{t('saleToppingEmpty')}</p>
          ) : (
            toppingsList.map((tp) => (
              <ToppingRow key={tp.id} item={tp} t={t} onSaved={refresh} onDeleted={refresh} />
            ))
          )}
          {adding ? (
            <div className="flex items-center gap-2 rounded-2xl border-2 border-amber-300 bg-white px-2 py-2">
              <input
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                placeholder={t('toppingName')}
                className="min-w-0 flex-1 rounded-xl border border-stone-200 px-2.5 py-2 text-xs font-bold outline-none focus:border-amber-300"
                autoFocus
              />
              <input
                value={newPrice}
                onChange={(e) => setNewPrice(digits(e.target.value))}
                inputMode="numeric"
                className="w-12 rounded-xl border border-stone-200 px-2 py-2 text-center text-xs font-black outline-none"
              />
              <button
                type="button"
                disabled={savingNew || !newLabel.trim()}
                onClick={addTopping}
                className="shrink-0 rounded-xl px-2.5 py-2 text-[10px] font-black text-white disabled:opacity-40"
                style={{ background: '#3d1f0f' }}
              >
                {savingNew ? '…' : t('save')}
              </button>
              <button type="button" onClick={() => setAdding(false)} className="text-stone-400 font-black px-1">×</button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setAdding(true)}
              className="w-full py-2 rounded-xl border border-amber-200 bg-white text-[11px] font-black text-amber-900 active:scale-[0.99]"
            >
              + {t('addTopping')}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
