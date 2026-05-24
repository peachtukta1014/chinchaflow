import { useEffect, useState } from 'react';
import { PRODUCTS } from '../constants';
import { FS_BASE, fsAuthHeaders, fsObj } from '../lib/firestoreRest';

// ─── Admin: Product Settings ───────────────────────────────────────────────────

export function ProductSettingsScreen() {
  const defaultPrices = { large: 1450, medium: 1100, small: 850 };
  const [prices, setPrices] = useState(defaultPrices);
  const [saving, setSaving] = useState(false);
  const [flash, setFlash]   = useState('');

  useEffect(() => {
    fsAuthHeaders().then(h => fetch(`${FS_BASE}/productSettings/shrimp`, { headers: h }))
      .then(r => r.ok ? r.json() : null)
      .then(j => {
        if (!j?.fields) return;
        const p = {};
        ['large','medium','small'].forEach(k => {
          const v = j.fields[k];
          if (v) p[k] = parseInt(v.integerValue ?? v.doubleValue ?? defaultPrices[k]);
        });
        if (Object.keys(p).length) setPrices(prev => ({ ...prev, ...p }));
      })
      .catch(() => {});
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      const fields = fsObj({ large: prices.large, medium: prices.medium, small: prices.small });
      const qs = Object.keys(fields).map(k => `updateMask.fieldPaths=${k}`).join('&');
      const r = await fetch(`${FS_BASE}/productSettings/shrimp?${qs}`, {
        method: 'PATCH', headers: await fsAuthHeaders(),
        body: JSON.stringify({ fields }),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      setFlash('✅ บันทึกราคาแล้ว');
    } catch { setFlash('⚠️ บันทึกไม่สำเร็จ'); }
    setSaving(false);
    setTimeout(() => setFlash(''), 2500);
  };

  return (
    <div className="px-4 pt-4 pb-8 space-y-4">
      <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">ตั้งค่าราคาสินค้า</p>
      {flash && <p className="text-center text-sm font-bold py-2.5 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200">{flash}</p>}
      {PRODUCTS.filter(p => p.type === 'live').map(p => (
        <div key={p.id} className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-bold text-slate-800">{p.emoji} {p.name}</p>
              <p className="text-xs text-slate-400">ราคาต่อกิโลกรัม</p>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-slate-400 font-bold">฿</span>
              <input type="number" inputMode="numeric"
                value={prices[p.id]}
                onChange={e => setPrices(prev => ({ ...prev, [p.id]: parseInt(e.target.value) || 0 }))}
                className="w-24 text-right bg-slate-50 border-2 border-slate-200 rounded-xl px-3 py-2 text-lg font-black text-slate-800 focus:outline-none focus:border-blue-400" />
            </div>
          </div>
        </div>
      ))}
      <button onClick={save} disabled={saving}
        className="w-full py-4 rounded-2xl bg-blue-600 text-white font-black text-base shadow-lg active:scale-95 disabled:opacity-50">
        {saving ? '⏳ กำลังบันทึก...' : '💾 บันทึกราคา'}
      </button>
    </div>
  );
}
