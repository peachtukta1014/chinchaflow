import { useCallback, useMemo, useRef, useState } from 'react';
import { ref as stRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '../firebase';
import { compressImageFile } from '../lib/compressImage';
import { fsPost } from '../lib/firestoreRest';
import { uploadOrderSlip } from '../lib/orderSlipService';
import {
  RESTOCK_CATEGORIES,
  catalogReorderPatches,
  deleteRestockCatalogItem,
  guessRestockCategory,
  patchRestockCatalogItem,
  restockCategoryLabel,
  restockNameKey,
  upsertRestockCatalogItems,
} from '../lib/restockCatalogService';
import { invalidatePendingRestockCache } from '../lib/restockNotifyService';
import { staffSnapshot, writeHistoryLog } from '../lib/historyLogService';
import { actorSnapshot } from '../lib/teaUserService.js';
import { parseRestockVoice } from '../lib/voiceRestock';
import { VoiceCommandBar } from '../components/VoiceCommandBar';
import { RestockItemName, moneyLabel } from './RestockList';

export function RestockForm({
  member, t, lang, isAdmin, dateKey,
  catalog, setCatalog, catalogLoading, catalogGroups, catalogByKey,
  latestPriceForName,
  flash, setFlash,
  refreshRecent, refreshCatalog, notifyRestockChange,
}) {
  const [items, setItems] = useState([]);
  const [input, setInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [manageCatalog, setManageCatalog] = useState(false);
  const [catalogSaving, setCatalogSaving] = useState(false);
  const [nameEditId, setNameEditId] = useState(null);
  const [nameDraft, setNameDraft] = useState({ nameEn: '', nameMy: '', voiceAliases: '' });
  const [imageUploadId, setImageUploadId] = useState(null);
  const fileRef = useRef(null);
  const imageFileRef = useRef(null);
  const imageTargetRef = useRef(null);

  const STATUS_CFG = [
    { key: 'normal', label: t('statusNormal'), active: 'bg-emerald-100 text-emerald-700 border-emerald-300' },
    { key: 'low', label: t('statusLow'), active: 'bg-amber-100 text-amber-700 border-amber-300' },
    { key: 'out', label: t('statusOut'), active: 'bg-red-100 text-red-600 border-red-300' },
  ];

  const selectedKeys = useMemo(
    () => new Set(items.map((i) => restockNameKey(i.name))),
    [items],
  );

  const addItem = () => {
    const name = input.trim();
    if (!name) return;
    const key = restockNameKey(name);
    if (items.some((i) => restockNameKey(i.name) === key)) {
      setInput('');
      return;
    }
    setItems((prev) => [...prev, { cid: Date.now(), name, qty: 1, status: 'out' }]);
    setInput('');
  };

  const toggleCatalogItem = (catItem) => {
    const key = restockNameKey(catItem.name);
    if (selectedKeys.has(key)) {
      setItems((prev) => prev.filter((i) => restockNameKey(i.name) !== key));
    } else {
      setItems((prev) => [...prev, { cid: Date.now(), name: catItem.name, qty: 1, status: 'out' }]);
    }
  };

  const handleRemoveCatalog = async (catItem) => {
    if (!isAdmin) return;
    if (!window.confirm(t('confirmRemoveCatalog'))) return;
    try {
      await deleteRestockCatalogItem(catItem.id);
      setCatalog((prev) => prev.filter((c) => c.id !== catItem.id));
      setItems((prev) => prev.filter((i) => restockNameKey(i.name) !== restockNameKey(catItem.name)));
    } catch (e) {
      console.error(e);
      alert(t('saveFailed'));
    }
  };

  const handleCatalogImageUpload = async (catItem, file) => {
    if (!file || !storage) return;
    setImageUploadId(catItem.id);
    try {
      const compressed = await compressImageFile(file, { maxWidth: 400, maxHeight: 400, quality: 0.8 });
      const path = `catalogImages/${catItem.id}.jpg`;
      await uploadBytes(stRef(storage, path), compressed, { contentType: 'image/jpeg' });
      const url = await getDownloadURL(stRef(storage, path));
      await patchRestockCatalogItem(catItem.id, { imageUrl: url });
      setCatalog((prev) => prev.map((c) => (c.id === catItem.id ? { ...c, imageUrl: url } : c)));
    } catch (e) {
      console.error(e);
      alert(t('uploadFailed'));
    } finally {
      setImageUploadId(null);
      if (imageFileRef.current) imageFileRef.current.value = '';
    }
  };

  const applyCatalogSortPatches = async (nextCatalog, patches) => {
    if (!patches.length) return;
    setCatalog(nextCatalog);
    setCatalogSaving(true);
    try {
      await Promise.all(
        patches.map((p) => patchRestockCatalogItem(p.id, { sortOrder: p.sortOrder })),
      );
    } catch (e) {
      console.error(e);
      alert(t('saveFailed'));
      await refreshCatalog();
    }
    setCatalogSaving(false);
  };

  const handleMoveCatalogItem = (itemId, direction) => {
    const { catalog: next, patches } = catalogReorderPatches(catalog, itemId, direction);
    applyCatalogSortPatches(next, patches);
  };

  const handleCatalogCategoryChange = async (catItem, newCategory) => {
    if (!newCategory || newCategory === (catItem.category || guessRestockCategory(catItem.name))) return;
    const inNew = catalog.filter(
      (c) =>
        c.active !== false
        && (c.category || guessRestockCategory(c.name)) === newCategory
        && c.id !== catItem.id,
    );
    const maxOrder = inNew.reduce((m, c) => Math.max(m, typeof c.sortOrder === 'number' ? c.sortOrder : 0), 0);
    const patch = { category: newCategory, sortOrder: maxOrder + 10 };
    setCatalog((prev) => prev.map((c) => (c.id === catItem.id ? { ...c, ...patch } : c)));
    setCatalogSaving(true);
    try {
      await patchRestockCatalogItem(catItem.id, patch);
      setFlash(t('restockCategoryChanged'));
      setTimeout(() => setFlash(''), 2500);
    } catch (e) {
      console.error(e);
      alert(t('saveFailed'));
      await refreshCatalog();
    }
    setCatalogSaving(false);
  };

  const openNameEdit = (catItem) => {
    setNameEditId(catItem.id);
    setNameDraft({
      nameEn: catItem.nameEn || '',
      nameMy: catItem.nameMy || '',
      voiceAliases: catItem.voiceAliases || '',
    });
  };

  const handleSaveCatalogNames = async (catItem) => {
    const patch = {
      nameEn: nameDraft.nameEn.trim(),
      nameMy: nameDraft.nameMy.trim(),
      voiceAliases: nameDraft.voiceAliases.trim(),
    };
    setCatalog((prev) => prev.map((c) => (c.id === catItem.id ? { ...c, ...patch } : c)));
    setCatalogSaving(true);
    try {
      await patchRestockCatalogItem(catItem.id, patch);
      setNameEditId(null);
      setFlash(t('restockNamesSaved'));
      setTimeout(() => setFlash(''), 2500);
    } catch (e) {
      console.error(e);
      alert(t('saveFailed'));
      await refreshCatalog();
    }
    setCatalogSaving(false);
  };

  const uploadOrderPhoto = async (file) => {
    if (!file) return;
    setUploading(true);
    try {
      await uploadOrderSlip({ file, dateKey, member });
      setFlash(t('uploadOk'));
      setTimeout(() => setFlash(''), 3000);
    } catch (e) {
      console.error(e);
      alert(e?.message === 'storage not ready' ? t('storageNotReady') : t('uploadFailed'));
    }
    setUploading(false);
  };

  const mergeParsedIntoList = (prev, parsed) => {
    const next = [...prev];
    for (const vi of parsed) {
      const key = restockNameKey(vi.name);
      const existing = next.find((i) => restockNameKey(i.name) === key);
      if (existing) {
        existing.qty += vi.qty;
        existing.status = vi.status;
      } else {
        next.push({
          cid: Date.now() + Math.random(),
          name: vi.name,
          qty: vi.qty,
          status: vi.status,
        });
      }
    }
    return next;
  };

  const submitRestockList = useCallback(async (listToSubmit) => {
    if (!listToSubmit?.length) return;
    setSaving(true);
    try {
      const names = listToSubmit.map((i) => i.name);
      const created = await fsPost('restocks', {
        dateKey,
        uid: member?.uid || 'unknown',
        createdBy: member?.name || 'ชินชา',
        createdByUid: member?.uid || '',
        branchId: member?.branchId || 'main',
        actor: actorSnapshot(member),
        ...staffSnapshot(member),
        items: listToSubmit.map((i) => {
          const catalogItem = catalogByKey.get(restockNameKey(i.name));
          return {
            name: i.name,
            qty: i.qty,
            status: i.status,
            purchaseUnitPrice: latestPriceForName(i.name) || 0,
            unit: catalogItem?.unit || 'ชิ้น',
            base_unit: catalogItem?.base_unit || catalogItem?.unit || 'ชิ้น',
            conversion_rate: Math.max(1, Math.round(Number(catalogItem?.conversion_rate) || 1)),
          };
        }),
        purchaseStatus: 'pending',
        createdAt: new Date().toISOString(),
      });
      invalidatePendingRestockCache(dateKey);
      await writeHistoryLog({ action: 'restock.create', collection: 'restocks', docId: created?.id || '', refPath: created?.id ? `restocks/${created.id}` : '', dateKey, member, summary: { items: listToSubmit.length } });
      await upsertRestockCatalogItems(names, member);
      setItems([]);
      setFlash(t('restockSent'));
      await Promise.all([refreshRecent(), refreshCatalog()]);
      notifyRestockChange();
      setTimeout(() => setFlash(''), 3000);
    } catch (e) {
      console.error(e);
      alert(t('saveFailed'));
    }
    setSaving(false);
  }, [catalogByKey, dateKey, latestPriceForName, member, notifyRestockChange, refreshCatalog, refreshRecent, setFlash, t]);

  const handleSubmit = () => submitRestockList(items);

  const onVoiceFinal = useCallback((text) => {
    const { items: parsed, submit } = parseRestockVoice(text, catalog);
    if (parsed.length) {
      const names = parsed.map((i) => i.name).join(', ');
      setItems((prev) => {
        const next = mergeParsedIntoList(prev, parsed);
        if (submit && next.length) {
          setTimeout(() => submitRestockList(next), 200);
        }
        return next;
      });
      if (submit) {
        return { log: `${text} · ✅ ${names} · ${t('submitRestock')}` };
      }
      return { log: `${text} · ✅ ${names}` };
    }
    if (submit && items.length) {
      submitRestockList(items);
      return { log: `${text} · ${t('submitRestock')}` };
    }
    return { log: `${text} · ${t('voiceRestockNoMatch')}` };
  }, [catalog, items, submitRestockList, t]);

  return (
    <>
      <VoiceCommandBar
        lang={lang}
        t={t}
        hint={t('voiceRestockHint')}
        onFinalText={onVoiceFinal}
      />

      {flash && (
        <div className="py-3 rounded-2xl text-center font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 text-sm">{flash}</div>
      )}

      {/* รายการประจำร้าน — ติ๊กเลือกตามหมวด */}
      <div className="bg-white rounded-3xl border border-stone-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-stone-100" style={{ background: '#faf5f0' }}>
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="font-black text-sm text-stone-800">📋 {t('restockSavedList')}</p>
              <p className="text-[10px] text-stone-500 mt-0.5">
                {manageCatalog ? t('restockManageHint') : t('restockSavedHint')}
              </p>
            </div>
            {isAdmin && !catalogLoading && catalogGroups.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  setManageCatalog((v) => !v);
                  setNameEditId(null);
                }}
                className={`shrink-0 px-3 py-1.5 rounded-xl text-[10px] font-black border-2 active:scale-95 ${
                  manageCatalog
                    ? 'bg-amber-800 text-white border-amber-900'
                    : 'bg-white text-amber-900 border-amber-300'
                }`}
              >
                {manageCatalog ? t('restockManageDone') : t('restockManageCatalog')}
              </button>
            )}
          </div>
        </div>
        {catalogLoading ? (
          <p className="text-center text-stone-400 text-sm py-6">{t('loading')}</p>
        ) : catalogGroups.length === 0 ? (
          <p className="text-center text-stone-400 text-xs py-6 px-4">{t('restockCatalogEmpty')}</p>
        ) : (
          <div className="divide-y divide-stone-100">
            {catalogGroups.map((group) => (
              <div key={group.id}>
                <p className="px-4 py-2 text-[10px] font-black uppercase tracking-wide text-amber-900 bg-amber-50/80 border-b border-amber-100">
                  {group.label}
                  <span className="ml-1.5 font-bold text-stone-400">({group.items.length})</span>
                </p>
                {group.items.map((catItem, itemIdx) => {
                  const checked = selectedKeys.has(restockNameKey(catItem.name));
                  const itemCat = catItem.category || guessRestockCategory(catItem.name);
                  const editingNames = nameEditId === catItem.id;
                  const rowBody = (
                    <>
                      {!manageCatalog ? (
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleCatalogItem(catItem)}
                          className="mt-1 w-5 h-5 rounded border-2 border-stone-300 accent-amber-700 shrink-0"
                        />
                      ) : (
                        <div className="flex flex-col gap-0.5 shrink-0 mt-0.5">
                          <button
                            type="button"
                            disabled={catalogSaving || itemIdx === 0}
                            onClick={() => handleMoveCatalogItem(catItem.id, 'up')}
                            className="w-7 h-6 rounded-lg bg-stone-100 text-stone-600 font-black text-xs disabled:opacity-30 active:scale-95"
                            aria-label={t('restockMoveUp')}
                          >
                            ↑
                          </button>
                          <button
                            type="button"
                            disabled={catalogSaving || itemIdx === group.items.length - 1}
                            onClick={() => handleMoveCatalogItem(catItem.id, 'down')}
                            className="w-7 h-6 rounded-lg bg-stone-100 text-stone-600 font-black text-xs disabled:opacity-30 active:scale-95"
                            aria-label={t('restockMoveDown')}
                          >
                            ↓
                          </button>
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        {catItem.imageUrl && (
                          <img src={catItem.imageUrl} alt="" className="w-14 h-14 rounded-xl object-cover mb-2 border border-stone-200" />
                        )}
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm font-bold text-stone-700 min-w-0">
                            <RestockItemName name={catItem.name} lang={lang} catalogItem={catItem} />
                          </p>
                          {catItem.latestUnitPrice > 0 && (
                            <span className="shrink-0 rounded-full bg-emerald-50 border border-emerald-100 px-2 py-0.5 text-[10px] font-black text-emerald-700">
                              {t('restockLatestPrice')} {moneyLabel(catItem.latestUnitPrice)}/{t('restockUnitShort')}
                            </span>
                          )}
                        </div>
                        {manageCatalog && (
                          <div className="mt-2 flex flex-wrap items-center gap-2">
                            <select
                              value={itemCat}
                              disabled={catalogSaving}
                              onChange={(e) => handleCatalogCategoryChange(catItem, e.target.value)}
                              className="text-[10px] font-bold border-2 border-amber-200 rounded-lg px-2 py-1 bg-white text-stone-700 max-w-full"
                            >
                              {RESTOCK_CATEGORIES.map((c) => (
                                <option key={c} value={c}>
                                  {restockCategoryLabel(c, t)}
                                </option>
                              ))}
                            </select>
                            <button
                              type="button"
                              disabled={catalogSaving}
                              onClick={() => (editingNames ? setNameEditId(null) : openNameEdit(catItem))}
                              className="text-[10px] font-bold text-sky-800 bg-sky-50 border border-sky-200 px-2 py-1 rounded-lg active:scale-95"
                            >
                              {t('restockEditNames')}
                            </button>
                            <button
                              type="button"
                              disabled={catalogSaving || imageUploadId === catItem.id}
                              onClick={() => { imageTargetRef.current = catItem; imageFileRef.current?.click(); }}
                              className="text-[10px] font-bold text-stone-600 bg-stone-50 border border-stone-200 px-2 py-1 rounded-lg active:scale-95 disabled:opacity-50"
                            >
                              {imageUploadId === catItem.id ? '⏳' : catItem.imageUrl ? '🖼️' : '📷'}
                            </button>
                          </div>
                        )}
                        {manageCatalog && editingNames && (
                          <div className="mt-2 space-y-1.5 p-2 rounded-xl bg-stone-50 border border-stone-200">
                            <input
                              type="text"
                              value={nameDraft.nameEn}
                              onChange={(e) => setNameDraft((d) => ({ ...d, nameEn: e.target.value }))}
                              placeholder={t('nameEnLabel')}
                              className="w-full px-2 py-1.5 rounded-lg border border-stone-200 text-xs"
                            />
                            <input
                              type="text"
                              value={nameDraft.nameMy}
                              onChange={(e) => setNameDraft((d) => ({ ...d, nameMy: e.target.value }))}
                              placeholder={t('nameMyLabel')}
                              className="w-full px-2 py-1.5 rounded-lg border border-stone-200 text-xs"
                            />
                            <input
                              type="text"
                              value={nameDraft.voiceAliases}
                              onChange={(e) => setNameDraft((d) => ({ ...d, voiceAliases: e.target.value }))}
                              placeholder={t('voiceAliasesPlaceholder')}
                              className="w-full px-2 py-1.5 rounded-lg border border-amber-200 text-xs"
                            />
                            <button
                              type="button"
                              disabled={catalogSaving}
                              onClick={() => handleSaveCatalogNames(catItem)}
                              className="w-full py-1.5 rounded-lg font-black text-white text-[10px]"
                              style={{ background: '#3d1f0f' }}
                            >
                              {t('save')}
                            </button>
                          </div>
                        )}
                      </div>
                      {isAdmin && !manageCatalog && (
                        <button
                          type="button"
                          onClick={(e) => { e.preventDefault(); handleRemoveCatalog(catItem); }}
                          className="text-red-300 hover:text-red-500 font-black text-xs px-1 shrink-0"
                          aria-label={t('restockRemoveFromList')}
                        >
                          ×
                        </button>
                      )}
                      {isAdmin && manageCatalog && (
                        <button
                          type="button"
                          disabled={catalogSaving}
                          onClick={() => handleRemoveCatalog(catItem)}
                          className="text-red-300 hover:text-red-500 font-black text-xs px-1 shrink-0 self-start"
                          aria-label={t('restockRemoveFromList')}
                        >
                          ×
                        </button>
                      )}
                    </>
                  );
                  if (manageCatalog) {
                    return (
                      <div
                        key={catItem.id}
                        className={`flex items-start gap-3 px-4 py-3 ${catalogSaving ? 'opacity-60' : ''}`}
                      >
                        {rowBody}
                      </div>
                    );
                  }
                  return (
                    <label
                      key={catItem.id}
                      className={`flex items-start gap-3 px-4 py-3 cursor-pointer active:bg-stone-50 ${checked ? 'bg-amber-50/40' : ''}`}
                    >
                      {rowBody}
                    </label>
                  );
                })}
              </div>
            ))}
          </div>
        )}
      </div>

      <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadOrderPhoto(f); e.target.value = ''; }} />
      <input ref={imageFileRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f && imageTargetRef.current) handleCatalogImageUpload(imageTargetRef.current, f); }} />
      <button
        type="button"
        disabled={uploading}
        onClick={() => fileRef.current?.click()}
        className="w-full py-4 rounded-2xl font-black text-white text-sm shadow-lg active:scale-95 disabled:opacity-60 flex items-center justify-center gap-2"
        style={{ background: '#6b3a2a' }}
      >
        📷 {uploading ? t('uploading') : t('uploadOrderPhoto')}
      </button>

      <div className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addItem()}
          placeholder={t('restockPlaceholder')}
          className="flex-1 px-4 py-3.5 rounded-2xl border-2 border-stone-200 text-sm outline-none focus:border-amber-400 bg-white"
        />
        <button type="button" onClick={addItem} className="w-14 h-14 rounded-2xl font-black text-white text-2xl shrink-0" style={{ background: '#3d1f0f' }}>+</button>
      </div>

      {items.length > 0 && (
        <div className="bg-white rounded-3xl border border-stone-200 divide-y divide-stone-100 mb-4">
          {items.map((item) => (
            <div key={item.cid} className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-sm"><RestockItemName name={item.name} lang={lang} /></p>
                  {latestPriceForName(item.name) > 0 && (
                    <p className="text-[10px] font-bold text-emerald-700">
                      {t('restockLatestPrice')} {moneyLabel(latestPriceForName(item.name))}/{t('restockUnitShort')} · {t('restockEstimateTotal')} {moneyLabel(latestPriceForName(item.name) * item.qty)}
                    </p>
                  )}
                </div>
                <button type="button" onClick={() => setItems((prev) => prev.map((i) => (i.cid === item.cid ? { ...i, qty: Math.max(1, i.qty - 1) } : i)))} className="w-7 h-7 rounded-full bg-stone-100 font-bold">−</button>
                <input
                  type="tel"
                  inputMode="numeric"
                  value={item.qty}
                  onChange={(e) => {
                    const qty = Math.max(1, parseInt(e.target.value.replace(/\D/g, ''), 10) || 1);
                    setItems((prev) => prev.map((i) => (i.cid === item.cid ? { ...i, qty } : i)));
                  }}
                  className="w-12 px-1 py-1 rounded-lg border border-stone-200 text-center text-sm font-black"
                />
                <button type="button" onClick={() => setItems((prev) => prev.map((i) => (i.cid === item.cid ? { ...i, qty: i.qty + 1 } : i)))} className="w-7 h-7 rounded-full text-white font-bold" style={{ background: '#6b3a2a' }}>+</button>
                <button type="button" onClick={() => setItems((prev) => prev.filter((i) => i.cid !== item.cid))} className="text-red-400 font-black ml-1">×</button>
              </div>
              <div className="flex gap-1.5">
                {STATUS_CFG.map((s) => (
                  <button
                    key={s.key}
                    type="button"
                    onClick={() => setItems((prev) => prev.map((i) => (i.cid === item.cid ? { ...i, status: s.key } : i)))}
                    className={`flex-1 py-1.5 rounded-xl text-[11px] font-bold border-2 ${item.status === s.key ? s.active : 'border-stone-200 text-stone-400'}`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={handleSubmit}
        disabled={saving || !items.length}
        className="w-full py-4 rounded-2xl font-black text-white disabled:opacity-40"
        style={{ background: '#3d1f0f' }}
      >
        {saving ? '⏳...' : `📋 ${t('submitRestock')}${items.length ? ` (${items.length})` : ''}`}
      </button>
    </>
  );
}
