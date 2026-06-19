import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  fsQueryRestockCatalog,
  groupCatalogByCategory,
} from '../lib/restockCatalogService';
import { restockDisplayName } from '../lib/restockDisplay';
import { isTeaAdmin } from '../lib/teaRoles';
import StockItemSettingsSheet from '../components/StockItemSettingsSheet';

function stockQty(item) {
  return Math.max(0, Math.round(Number(item?.stock_base_qty) || 0));
}

function stockTone(qty) {
  if (qty <= 0) return { key: 'stockStatusOut', className: 'bg-red-50 text-red-700 border-red-200' };
  if (qty <= 20) return { key: 'stockStatusLow', className: 'bg-amber-50 text-amber-800 border-amber-200' };
  return { key: 'stockStatusOk', className: 'bg-emerald-50 text-emerald-800 border-emerald-200' };
}

function displayOverrides(item, lang) {
  const nick = lang === 'en' ? item.nameNickEn : lang === 'my' ? item.nameNickMy : item.nameNickTh;
  const main = lang === 'en' ? (item.nameEn || item.name) : lang === 'my' ? (item.nameMy || item.name) : (item.nameTh || item.name);
  return {
    nameEn: item.nameEn,
    nameMy: item.nameMy,
    nameTh: item.nameTh || item.name,
    displayMain: main,
    displayNick: nick && nick !== main ? nick : '',
  };
}

export function StockTab({ member, t, lang = 'th' }) {
  const [catalog, setCatalog] = useState([]);
  const [loading, setLoading] = useState(true);
  const [settingsItem, setSettingsItem] = useState(null);
  const isAdmin = isTeaAdmin(member);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setCatalog(await fsQueryRestockCatalog());
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const groups = useMemo(() => groupCatalogByCategory(catalog, t, lang), [catalog, t, lang]);

  return (
    <div className="px-4 pt-3 pb-8 space-y-3">
      <p className="text-[11px] text-stone-500 bg-white border border-stone-200 rounded-2xl px-3 py-2 leading-relaxed">
        {t('stockTabHint')}
      </p>

      {loading ? (
        <p className="text-center text-stone-400 py-10">{t('loading')}</p>
      ) : groups.length === 0 ? (
        <p className="text-center text-stone-400 py-10">{t('stockEmpty')}</p>
      ) : (
        groups.map((group) => (
          <section key={group.id} className="bg-white rounded-2xl border border-stone-200 overflow-hidden shadow-sm">
            <p className="px-4 py-2 text-[10px] font-black uppercase tracking-wide text-amber-900/60 bg-stone-50 border-b border-stone-100">
              {group.label}
            </p>
            <div className="divide-y divide-stone-100">
              {group.items.map((item) => {
                const qty = stockQty(item);
                const tone = stockTone(qty);
                const names = displayOverrides(item, lang);
                const displayName = item.nameTh || item.name;
                const { primary, sub } = restockDisplayName(displayName, lang, {
                  nameEn: names.nameEn,
                  nameMy: names.nameMy,
                  nameTh: names.nameTh,
                });
                const showNick = names.displayNick && names.displayNick !== primary;
                return (
                  <div key={item.id} className="flex items-center gap-3 px-3 py-2.5">
                    <div className="w-11 h-11 rounded-xl bg-stone-100 border border-stone-200 flex items-center justify-center text-lg shrink-0 overflow-hidden">
                      {item.imageUrl
                        ? <img src={item.imageUrl} alt="" className="w-full h-full object-cover" />
                        : '📦'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-stone-800 truncate">{primary}</p>
                      {showNick && <p className="text-[10px] text-amber-700 font-semibold truncate">{names.displayNick}</p>}
                      {sub && sub !== primary && !showNick && (
                        <p className="text-[10px] text-stone-400 truncate">{sub}</p>
                      )}
                      <div className="mt-1 flex flex-wrap items-center gap-1.5">
                        <span className={`text-[9px] font-black px-2 py-0.5 rounded-full border ${tone.className}`}>
                          {t(tone.key)}
                        </span>
                        {item.latestUnitPrice > 0 && (
                          <span className="text-[9px] font-bold text-stone-400">
                            ฿{Math.round(item.latestUnitPrice).toLocaleString()}/{item.unit || t('restockUnitShort')}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xl font-black text-stone-800">{qty.toLocaleString()}</p>
                      <p className="text-[9px] font-bold text-stone-400">{item.base_unit || t('inventoryBaseUnitLabel')}</p>
                    </div>
                    {isAdmin && (
                      <button
                        type="button"
                        onClick={() => setSettingsItem(item)}
                        className="w-9 h-9 rounded-xl border border-stone-200 bg-stone-50 text-stone-600 font-black shrink-0 active:scale-95"
                        aria-label={t('stockSettingsTitle')}
                      >
                        ⚙
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        ))
      )}

      {settingsItem && (
        <StockItemSettingsSheet
          item={settingsItem}
          t={t}
          onClose={() => setSettingsItem(null)}
          onSaved={load}
        />
      )}
    </div>
  );
}
