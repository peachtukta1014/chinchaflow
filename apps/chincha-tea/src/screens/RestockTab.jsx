import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { fsPost, fsQueryRestocks } from '../lib/firestoreRest';
import { dateKeyBangkok } from '../lib/constants';
import { uploadOrderSlip } from '../lib/orderSlipService';
import {
  canManageRestock,
  canMarkRestockPurchased,
  deleteRestockRequest,
  isRestockPurchased,
  markRestockPurchased,
  removeRestockLine,
  restockPurchaseTotal,
} from '../lib/restockService';
import {
  RESTOCK_CATEGORIES,
  bootstrapCatalogFromRestocks,
  catalogReorderPatches,
  deleteRestockCatalogItem,
  fsQueryRestockCatalog,
  groupCatalogByCategory,
  guessRestockCategory,
  patchRestockCatalogItem,
  restockCategoryLabel,
  restockNameKey,
  updateRestockCatalogPrices,
  upsertRestockCatalogItems,
} from '../lib/restockCatalogService';
import { restockDisplayName } from '../lib/restockDisplay';
import { VoiceCommandBar } from '../components/VoiceCommandBar';
import { staffSnapshot, writeHistoryLog } from '../lib/historyLogService';
import { parseRestockVoice } from '../lib/voiceRestock';

function RestockItemName({ name, lang, catalogItem }) {
  const overrides = catalogItem
    ? { nameEn: catalogItem.nameEn, nameMy: catalogItem.nameMy }
    : undefined;
  const { primary, sub, en } = restockDisplayName(name, lang, overrides);
  const englishLine = lang === 'my' ? (en || sub) : en;
  const showEnglish = englishLine && englishLine !== primary;
  const showSub = sub && sub !== primary && sub !== englishLine;
  return (
    <span>
      {primary}
      {showEnglish ? (
        <span className="block text-[10px] font-semibold text-sky-700/90 leading-tight mt-0.5">{englishLine}</span>
      ) : null}
      {showSub ? (
        <span className="block text-[10px] font-normal text-stone-400 leading-tight mt-0.5">{sub}</span>
      ) : null}
    </span>
  );
}

function moneyLabel(value) {
  const amount = Math.round(Number(value) || 0);
  return amount > 0 ? `฿${amount.toLocaleString()}` : '';
}

function catalogUnitPrice(item) {
  return Math.max(0, Math.round(Number(
    item?.latestUnitPrice ?? item?.purchaseUnitPrice ?? item?.unitPrice ?? 0,
  ) || 0));
}

export function RestockTab({ member, t, lang = 'th', onRestockListChange }) {
  const [items, setItems] = useState([]);
  const [catalog, setCatalog] = useState([]);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [recentRequests, setRecentRequests] = useState([]);
  const [input, setInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [flash, setFlash] = useState('');
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [purchaseEditId, setPurchaseEditId] = useState(null);
  const [purchaseAmount, setPurchaseAmount] = useState('');
  const [purchaseLinePrices, setPurchaseLinePrices] = useState({});
  const [manageCatalog, setManageCatalog] = useState(false);
  const [catalogSaving, setCatalogSaving] = useState(false);
  const [nameEditId, setNameEditId] = useState(null);
  const [nameDraft, setNameDraft] = useState({ nameEn: '', nameMy: '', voiceAliases: '' });
  const fileRef = useRef(null);
  const dateKey = dateKeyBangkok();
  const isAdmin = member?.role === 'admin';

  const selectedKeys = useMemo(
    () => new Set(items.map((i) => restockNameKey(i.name))),
    [items],
  );

  const latestPriceByKey = useMemo(() => {
    const map = new Map();
    for (const item of catalog || []) {
      const unitPrice = catalogUnitPrice(item);
      if (unitPrice > 0) map.set(restockNameKey(item.name), unitPrice);
    }
    for (const req of recentRequests || []) {
      if (!isRestockPurchased(req)) continue;
      for (const line of req.purchaseItems || []) {
        const key = restockNameKey(line?.name);
        const unitPrice = Math.max(0, Math.round(Number(line?.unitPrice) || 0));
        if (key && unitPrice > 0 && !map.has(key)) map.set(key, unitPrice);
      }
    }
    return map;
  }, [catalog, recentRequests]);

  const catalogWithPrices = useMemo(
    () => (catalog || []).map((item) => ({
      ...item,
      latestUnitPrice: catalogUnitPrice(item) || latestPriceByKey.get(restockNameKey(item.name)) || 0,
    })),
    [catalog, latestPriceByKey],
  );

  const catalogGroups = useMemo(
    () => groupCatalogByCategory(catalogWithPrices, t, lang),
    [catalogWithPrices, t, lang],
  );

  const latestPriceForName = useCallback(
    (name) => latestPriceByKey.get(restockNameKey(name)) || 0,
    [latestPriceByKey],
  );

  const notifyRestockChange = () => onRestockListChange?.();

  const refreshRecent = () => fsQueryRestocks(20).then(setRecentRequests).catch(() => {});

  const refreshCatalog = useCallback(async (recent) => {
    setCatalogLoading(true);
    try {
      let list = await fsQueryRestockCatalog();
      const history = recent ?? await fsQueryRestocks(20);
      if (list.length === 0 && history.length > 0) {
        await bootstrapCatalogFromRestocks(history, member);
        list = await fsQueryRestockCatalog();
      }
      setCatalog(list);
    } catch (e) {
      console.error(e);
    }
    setCatalogLoading(false);
  }, [member]);

  useEffect(() => {
    refreshRecent();
    refreshCatalog();
  }, [refreshCatalog]);

  const STATUS_CFG = [
    { key: 'normal', label: t('statusNormal'), active: 'bg-emerald-100 text-emerald-700 border-emerald-300' },
    { key: 'low', label: t('statusLow'), active: 'bg-amber-100 text-amber-700 border-amber-300' },
    { key: 'out', label: t('statusOut'), active: 'bg-red-100 text-red-600 border-red-300' },
  ];

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
        ...staffSnapshot(member),
        items: listToSubmit.map((i) => ({ name: i.name, qty: i.qty, status: i.status })),
        purchaseStatus: 'pending',
        createdAt: new Date().toISOString(),
      });
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
  }, [dateKey, member, notifyRestockChange, refreshCatalog, refreshRecent, t]);

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

  const handleDeleteRestock = async (req) => {
    if (!canManageRestock(req, member) || deletingId) return;
    if (!window.confirm(t('confirmDeleteRestock'))) return;
    setDeletingId(req.id);
    try {
      await deleteRestockRequest(req.id);
      setRecentRequests((prev) => prev.filter((r) => r.id !== req.id));
      notifyRestockChange();
      setFlash(t('restockDeleted'));
      setTimeout(() => setFlash(''), 3000);
    } catch (e) {
      console.error(e);
      alert(t('restockDeleteFailed'));
    }
    setDeletingId(null);
  };

  const handleRemoveLine = async (req, lineIndex) => {
    if (!canManageRestock(req, member) || deletingId) return;
    if (!window.confirm(t('confirmDeleteRestockLine'))) return;
    setDeletingId(req.id);
    try {
      const updated = await removeRestockLine(req, lineIndex);
      if (updated) {
        setRecentRequests((prev) => prev.map((r) => (r.id === req.id ? { ...r, items: updated.items } : r)));
      } else {
        setRecentRequests((prev) => prev.filter((r) => r.id !== req.id));
      }
      notifyRestockChange();
      setFlash(t('restockDeleted'));
      setTimeout(() => setFlash(''), 3000);
    } catch (e) {
      console.error(e);
      alert(t('restockDeleteFailed'));
    }
    setDeletingId(null);
  };

  const purchaseLinesFor = (req) => (req.items || []).map((item, index) => {
    const qty = Math.max(1, Number(item.qty) || 1);
    const raw = purchaseLinePrices[`${req.id}:${index}`] || '';
    const unitPrice = parseInt(String(raw).replace(/\D/g, ''), 10) || 0;
    return { ...item, qty, unitPrice, lineTotal: unitPrice * qty };
  });

  const purchaseLineTotalFor = (req) => purchaseLinesFor(req).reduce((sum, line) => sum + line.lineTotal, 0);

  const startPurchaseEdit = (req) => {
    const draft = {};
    (req.items || []).forEach((item, index) => {
      const saved = req.purchaseItems?.[index];
      const amount = Number(saved?.unitPrice ?? item.purchaseUnitPrice ?? 0);
      if (amount > 0) draft[`${req.id}:${index}`] = String(Math.round(amount));
    });
    setPurchaseLinePrices(draft);
    setPurchaseAmount(String(restockPurchaseTotal(req) || ''));
    setPurchaseEditId(req.id);
  };

  const closePurchaseEdit = () => {
    setPurchaseEditId(null);
    setPurchaseAmount('');
    setPurchaseLinePrices({});
  };

  const handleSavePurchase = async (req) => {
    const lineItems = purchaseLinesFor(req);
    const lineTotal = lineItems.reduce((sum, line) => sum + line.lineTotal, 0);
    const manualAmount = parseInt(purchaseAmount.replace(/\D/g, ''), 10) || 0;
    const amount = lineTotal || manualAmount;
    if (!amount || amount <= 0) {
      alert(t('restockPurchaseInvalid'));
      return;
    }
    setDeletingId(req.id);
    try {
      const patch = await markRestockPurchased(req.id, {
        purchaseTotal: amount,
        purchaseItems: lineItems,
        purchasedBy: member?.name || '—',
        purchasedByUid: member?.uid || '',
      });
      await updateRestockCatalogPrices(lineItems);
      await refreshCatalog();
      await writeHistoryLog({ action: 'restock.purchase', collection: 'restocks', docId: req.id, refPath: `restocks/${req.id}`, dateKey: req.dateKey || dateKey, member, summary: { purchaseTotal: amount } });
      setRecentRequests((prev) => prev.map((r) => (r.id === req.id ? { ...r, ...patch } : r)));
      notifyRestockChange();
      closePurchaseEdit();
      setFlash(t('restockPurchaseSaved'));
      setTimeout(() => setFlash(''), 3000);
    } catch (e) {
      console.error(e);
      alert(t('saveFailed'));
    }
    setDeletingId(null);
  };

  return (
    <div className="px-4 pt-3 pb-8 space-y-4">
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
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm font-bold text-stone-700 min-w-0">
                            <RestockItemName name={catItem.name} lang={lang} catalogItem={catItem} />
                          </p>
                          {catalogUnitPrice(catItem) > 0 && (
                            <span className="shrink-0 rounded-full bg-emerald-50 border border-emerald-100 px-2 py-0.5 text-[10px] font-black text-emerald-700">
                              {t('restockLatestPrice')} {moneyLabel(catalogUnitPrice(catItem))}/{t('restockUnitShort')}
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
                <span className="font-black w-5 text-center">{item.qty}</span>
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

      {recentRequests.length > 0 && (
        <div className="mt-4">
          <p className="font-black text-xs text-stone-500 uppercase mb-2">{t('recentRestocks')}</p>
          <div className="space-y-2">
            {recentRequests.map((req) => {
              const canDel = canManageRestock(req, member);
              const canPurchase = canMarkRestockPurchased(req, member);
              const purchased = isRestockPurchased(req);
              const busy = deletingId === req.id;
              const editing = purchaseEditId === req.id;
              return (
              <div key={req.id} className={`bg-white rounded-2xl p-3 border ${purchased ? 'border-emerald-200' : 'border-stone-200'} ${busy ? 'opacity-60' : ''}`}>
                <div className="flex items-start justify-between gap-2 mb-1 flex-wrap">
                  <div className="min-w-0">
                    <p className="text-[10px] text-stone-400">{req.createdBy || '—'} · {(req.items || []).length} {t('items')}</p>
                    {purchased ? (
                      <>
                        <p className="text-[10px] font-bold text-emerald-600">
                          ✓ {t('restockPurchased')} · ฿{restockPurchaseTotal(req).toLocaleString()}
                        </p>
                        {!isAdmin && req.purchaseItems?.some((line) => Number(line?.lineTotal) > 0) && (
                          <p className="text-[10px] font-bold text-stone-400">{t('purchasePriceViewOnly')}</p>
                        )}
                      </>
                    ) : (
                      <p className="text-[10px] font-bold text-amber-600">{t('restockPending')}</p>
                    )}
                  </div>
                  <div className="flex gap-1 shrink-0">
                    {canPurchase && !purchased && !editing && (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => startPurchaseEdit(req)}
                        className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-lg active:scale-95 disabled:opacity-50"
                      >
                        {t('markPurchased')}
                      </button>
                    )}
                    {canDel && (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => handleDeleteRestock(req)}
                        className="text-[10px] font-bold text-red-600 bg-red-50 border border-red-200 px-2 py-0.5 rounded-lg active:scale-95 disabled:opacity-50"
                      >
                        {busy ? '…' : t('deleteRestock')}
                      </button>
                    )}
                  </div>
                </div>
                {editing && (
                  <div className="mb-2 rounded-2xl border border-emerald-100 bg-emerald-50/50 p-2 space-y-2">
                    <p className="text-[10px] font-black text-emerald-800">{t('purchaseLinePriceTitle')}</p>
                    {(req.items || []).map((line, i) => {
                      const key = `${req.id}:${i}`;
                      const qty = Math.max(1, Number(line.qty) || 1);
                      const unit = parseInt(String(purchaseLinePrices[key] || '').replace(/\D/g, ''), 10) || 0;
                      return (
                        <div key={key} className="grid grid-cols-[1fr_92px] gap-2 items-center">
                          <p className="text-[11px] font-bold text-stone-700 min-w-0">
                            <RestockItemName name={line.name} lang={lang} />
                            <span className="ml-1 text-stone-400">×{qty}</span>
                            {unit > 0 && <span className="block text-[10px] text-emerald-700">= ฿{(unit * qty).toLocaleString()}</span>}
                          </p>
                          <input
                            type="tel"
                            inputMode="numeric"
                            value={purchaseLinePrices[key] || ''}
                            onChange={(e) => {
                              const value = e.target.value.replace(/\D/g, '');
                              setPurchaseLinePrices((prev) => ({ ...prev, [key]: value }));
                            }}
                            placeholder={t('unitPricePlaceholder')}
                            className="w-full px-2 py-2 rounded-xl border-2 border-emerald-200 text-sm font-bold outline-none bg-white"
                          />
                        </div>
                      );
                    })}
                    <div className="flex gap-2 items-center">
                      <input
                        type="tel"
                        inputMode="numeric"
                        value={purchaseLineTotalFor(req) ? String(purchaseLineTotalFor(req)) : purchaseAmount}
                        onChange={(e) => setPurchaseAmount(e.target.value.replace(/\D/g, ''))}
                        placeholder={t('purchaseAmountPlaceholder')}
                        disabled={purchaseLineTotalFor(req) > 0}
                        className="flex-1 px-3 py-2 rounded-xl border-2 border-emerald-200 text-sm font-black outline-none bg-white disabled:bg-emerald-100 disabled:text-emerald-800"
                        autoFocus
                      />
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => handleSavePurchase(req)}
                        className="px-3 py-2 rounded-xl font-black text-white text-xs shrink-0"
                        style={{ background: '#1a8f4c' }}
                      >
                        {t('savePurchase')}
                      </button>
                      <button
                        type="button"
                        onClick={closePurchaseEdit}
                        className="px-2 py-2 text-stone-400 text-xs font-bold"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                )}
                {(req.items || []).map((it, i) => {
                  const purchasedLine = req.purchaseItems?.[i];
                  const unitPrice = Number(purchasedLine?.unitPrice || 0);
                  const lineTotal = Number(purchasedLine?.lineTotal || 0);
                  return (
                  <div key={i} className="flex items-start gap-1 text-xs text-stone-600">
                    <p className="flex-1 min-w-0">
                      <RestockItemName name={it.name} lang={lang} /> ×{it.qty}
                      <span className={`ml-1 text-[10px] font-bold ${it.status === 'out' ? 'text-red-500' : it.status === 'low' ? 'text-amber-600' : 'text-emerald-600'}`}>
                        {it.status === 'out' ? t('statusOut') : it.status === 'low' ? t('statusLow') : t('statusNormal')}
                      </span>
                      {purchased && lineTotal > 0 ? (
                        <span className="block text-[10px] font-black text-emerald-700">
                          ฿{lineTotal.toLocaleString()}{unitPrice > 0 ? ` · ฿${unitPrice.toLocaleString()}/${t('restockUnitShort')}` : ''}
                        </span>
                      ) : latestPriceForName(it.name) > 0 ? (
                        <span className="block text-[10px] font-bold text-emerald-700">
                          {t('restockLatestPrice')} {moneyLabel(latestPriceForName(it.name))}/{t('restockUnitShort')}
                        </span>
                      ) : null}
                    </p>
                    {canDel && !purchased && (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => handleRemoveLine(req, i)}
                        className="text-red-400 font-black px-1 active:scale-95 disabled:opacity-50"
                        aria-label={t('delete')}
                      >
                        ×
                      </button>
                    )}
                  </div>
                );})}
              </div>
            );})}
          </div>
        </div>
      )}
    </div>
  );
}
