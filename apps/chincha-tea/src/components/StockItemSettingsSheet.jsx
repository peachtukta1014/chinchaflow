import { useEffect, useState } from 'react';
import { patchRestockCatalogItem } from '../lib/restockCatalogService';

function Field({ label, value, onChange, placeholder = '', mono = false }) {
  return (
    <label className="block">
      <span className="block text-[10px] font-black text-stone-500 mb-1">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`w-full px-3 py-2.5 rounded-xl border-2 border-stone-200 text-sm outline-none focus:border-amber-300 ${mono ? 'font-mono text-xs' : 'font-semibold'}`}
      />
    </label>
  );
}

export default function StockItemSettingsSheet({ item, t, onClose, onSaved }) {
  const [form, setForm] = useState({
    name: '',
    nameTh: '',
    nameNickTh: '',
    nameEn: '',
    nameNickEn: '',
    nameMy: '',
    nameNickMy: '',
    unit: '',
    base_unit: '',
    conversion_rate: '1',
    voiceAliases: '',
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!item) return;
    setForm({
      name: item.name || '',
      nameTh: item.nameTh || item.name || '',
      nameNickTh: item.nameNickTh || '',
      nameEn: item.nameEn || '',
      nameNickEn: item.nameNickEn || '',
      nameMy: item.nameMy || '',
      nameNickMy: item.nameNickMy || '',
      unit: item.unit || 'แพ็ค',
      base_unit: item.base_unit || item.unit || 'ชิ้น',
      conversion_rate: String(item.conversion_rate || 1),
      voiceAliases: (item.voiceAliases || []).join(', '),
    });
  }, [item]);

  if (!item) return null;

  const save = async () => {
    setSaving(true);
    try {
      const aliases = form.voiceAliases.split(/[,;]+/).map((s) => s.trim()).filter(Boolean);
      await patchRestockCatalogItem(item.id, {
        name: form.nameTh.trim() || form.name.trim(),
        nameTh: form.nameTh.trim() || form.name.trim(),
        nameNickTh: form.nameNickTh.trim(),
        nameEn: form.nameEn.trim(),
        nameNickEn: form.nameNickEn.trim(),
        nameMy: form.nameMy.trim(),
        nameNickMy: form.nameNickMy.trim(),
        unit: form.unit.trim() || 'แพ็ค',
        base_unit: form.base_unit.trim() || 'ชิ้น',
        conversion_rate: Math.max(1, Math.round(Number(form.conversion_rate) || 1)),
        voiceAliases: aliases,
        updatedAt: new Date().toISOString(),
      });
      onSaved?.();
      onClose();
    } catch (e) {
      console.error(e);
      alert(t('saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/45" onClick={onClose}>
      <div
        className="w-full max-w-md max-h-[88vh] overflow-y-auto rounded-t-3xl bg-white p-4 pb-8 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 mb-3">
          <div>
            <p className="text-xs font-black text-amber-800 uppercase tracking-wide">{t('stockSettingsTitle')}</p>
            <p className="text-sm font-bold text-stone-800 mt-0.5">{form.nameTh || form.name}</p>
          </div>
          <button type="button" onClick={onClose} className="w-8 h-8 rounded-full bg-stone-100 text-stone-500 font-black">×</button>
        </div>

        <div className="space-y-3">
          <Field label={t('stockNameMainTh')} value={form.nameTh} onChange={(v) => setForm((p) => ({ ...p, nameTh: v, name: v }))} />
          <Field label={t('stockNameNickTh')} value={form.nameNickTh} onChange={(v) => setForm((p) => ({ ...p, nameNickTh: v }))} />
          <Field label={t('stockNameMainEn')} value={form.nameEn} onChange={(v) => setForm((p) => ({ ...p, nameEn: v }))} />
          <Field label={t('stockNameNickEn')} value={form.nameNickEn} onChange={(v) => setForm((p) => ({ ...p, nameNickEn: v }))} />
          <Field label={t('stockNameMainMy')} value={form.nameMy} onChange={(v) => setForm((p) => ({ ...p, nameMy: v }))} />
          <Field label={t('stockNameNickMy')} value={form.nameNickMy} onChange={(v) => setForm((p) => ({ ...p, nameNickMy: v }))} />

          <div className="rounded-2xl border border-emerald-100 bg-emerald-50/60 p-3 space-y-2">
            <p className="text-[10px] font-black text-emerald-900">{t('stockUnitGroupTitle')}</p>
            <div className="grid grid-cols-2 gap-2">
              <Field label={t('inventoryUnitLabel')} value={form.unit} onChange={(v) => setForm((p) => ({ ...p, unit: v }))} />
              <Field label={t('inventoryBaseUnitLabel')} value={form.base_unit} onChange={(v) => setForm((p) => ({ ...p, base_unit: v }))} />
              <Field label={t('inventoryConversionLabel')} value={form.conversion_rate} onChange={(v) => setForm((p) => ({ ...p, conversion_rate: v.replace(/\D/g, '') }))} mono />
            </div>
            <p className="text-[10px] text-emerald-800/80 leading-relaxed">{t('stockUnitHint')}</p>
          </div>

          <Field label={t('voiceAliasesPlaceholder')} value={form.voiceAliases} onChange={(v) => setForm((p) => ({ ...p, voiceAliases: v }))} />

          <button
            type="button"
            disabled={saving}
            onClick={save}
            className="w-full min-h-12 py-3 rounded-2xl font-black text-white disabled:opacity-50"
            style={{ background: '#3d1f0f' }}
          >
            {saving ? '⏳' : t('save')}
          </button>
        </div>
      </div>
    </div>
  );
}
