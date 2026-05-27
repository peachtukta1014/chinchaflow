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
  bootstrapCatalogFromRestocks,
  deleteRestockCatalogItem,
  fsQueryRestockCatalog,
  groupCatalogByCategory,
  restockNameKey,
  upsertRestockCatalogItems,
} from '../lib/restockCatalogService';
import { restockDisplayName } from '../lib/restockDisplay';

function RestockItemName({ name, lang }) {
  const { primary, sub } = restockDisplayName(name, lang);
  return (
    <span>
      {primary}
      {sub ? <span className="block text-[10px] font-normal text-stone-400 leading-tight mt-0.5">{sub}</span> : null}
    </span>
  );
}

export function RestockTab({ member, t, lang = 'th' }) {
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
  const fileRef = useRef(null);
  const dateKey = dateKeyBangkok();
  const isAdmin = member?.role === 'admin';

  const selectedKeys = useMemo(
    () => new Set(items.map((i) => restockNameKey(i.name))),
    [items],
  );

  const catalogGroups = useMemo(
    () => groupCatalogByCategory(catalog, t, lang),
    [catalog, t, lang],
  );

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

  const handleSubmit = async () => {
    if (!items.length) return;
    setSaving(true);
    try {
      const names = items.map((i) => i.name);
      await fsPost('restocks', {
        dateKey,
        uid: member?.uid || 'unknown',
        createdBy: member?.name || 'ชินชา',
        items: items.map((i) => ({ name: i.name, qty: i.qty, status: i.status })),
        purchaseStatus: 'pending',
        createdAt: new Date().toISOString(),
      });
      await upsertRestockCatalogItems(names, member);
      setItems([]);
      setFlash(t('restockSent'));
      await Promise.all([refreshRecent(), refreshCatalog()]);
      setTimeout(() => setFlash(''), 3000);
    } catch (e) {
      console.error(e);
      alert(t('saveFailed'));
    }
    setSaving(false);
  };

  const handleDeleteRestock = async (req) => {
    if (!canManageRestock(req, member) || deletingId) return;
    if (!window.confirm(t('confirmDeleteRestock'))) return;
    setDeletingId(req.id);
    try {
      await deleteRestockRequest(req.id);
      setRecentRequests((prev) => prev.filter((r) => r.id !== req.id));
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
      setFlash(t('restockDeleted'));
      setTimeout(() => setFlash(''), 3000);
    } catch (e) {
      console.error(e);
      alert(t('restockDeleteFailed'));
    }
    setDeletingId(null);
  };

  const handleSavePurchase = async (req) => {
    const amount = parseInt(purchaseAmount.replace(/\D/g, ''), 10);
    if (!amount || amount <= 0) {
      alert(t('restockPurchaseInvalid'));
      return;
    }
    setDeletingId(req.id);
    try {
      const patch = await markRestockPurchased(req.id, {
        purchaseTotal: amount,
        purchasedBy: member?.name || '—',
      });
      setRecentRequests((prev) => prev.map((r) => (r.id === req.id ? { ...r, ...patch } : r)));
      setPurchaseEditId(null);
      setPurchaseAmount('');
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
      {flash && (
        <div className="py-3 rounded-2xl text-center font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 text-sm">{flash}</div>
      )}

      {/* รายการประจำร้าน — ติ๊กเลือกตามหมวด */}
      <div className="bg-white rounded-3xl border border-stone-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-stone-100" style={{ background: '#faf5f0' }}>
          <p className="font-black text-sm text-stone-800">📋 {t('restockSavedList')}</p>
          <p className="text-[10px] text-stone-500 mt-0.5">{t('restockSavedHint')}</p>
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
                {group.items.map((catItem) => {
                  const checked = selectedKeys.has(restockNameKey(catItem.name));
                  return (
                    <label
                      key={catItem.id}
                      className={`flex items-start gap-3 px-4 py-3 cursor-pointer active:bg-stone-50 ${checked ? 'bg-amber-50/40' : ''}`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleCatalogItem(catItem)}
                        className="mt-1 w-5 h-5 rounded border-2 border-stone-300 accent-amber-700 shrink-0"
                      />
                      <span className="flex-1 min-w-0 text-sm font-bold text-stone-700">
                        <RestockItemName name={catItem.name} lang={lang} />
                      </span>
                      {isAdmin && (
                        <button
                          type="button"
                          onClick={(e) => { e.preventDefault(); handleRemoveCatalog(catItem); }}
                          className="text-red-300 hover:text-red-500 font-black text-xs px-1 shrink-0"
                          aria-label={t('restockRemoveFromList')}
                        >
                          ×
                        </button>
                      )}
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
                <p className="flex-1 font-bold text-sm"><RestockItemName name={item.name} lang={lang} /></p>
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
                      <p className="text-[10px] font-bold text-emerald-600">
                        ✓ {t('restockPurchased')} · ฿{restockPurchaseTotal(req).toLocaleString()}
                      </p>
                    ) : (
                      <p className="text-[10px] font-bold text-amber-600">{t('restockPending')}</p>
                    )}
                  </div>
                  <div className="flex gap-1 shrink-0">
                    {canPurchase && !purchased && !editing && (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => { setPurchaseEditId(req.id); setPurchaseAmount(''); }}
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
                  <div className="flex gap-2 mb-2">
                    <input
                      type="tel"
                      inputMode="numeric"
                      value={purchaseAmount}
                      onChange={(e) => setPurchaseAmount(e.target.value.replace(/\D/g, ''))}
                      placeholder={t('purchaseAmountPlaceholder')}
                      className="flex-1 px-3 py-2 rounded-xl border-2 border-emerald-200 text-sm font-bold outline-none"
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
                      onClick={() => { setPurchaseEditId(null); setPurchaseAmount(''); }}
                      className="px-2 py-2 text-stone-400 text-xs font-bold"
                    >
                      ✕
                    </button>
                  </div>
                )}
                {(req.items || []).map((it, i) => (
                  <div key={i} className="flex items-center gap-1 text-xs text-stone-600">
                    <p className="flex-1 min-w-0">
                      <RestockItemName name={it.name} lang={lang} /> ×{it.qty}
                      <span className={`ml-1 text-[10px] font-bold ${it.status === 'out' ? 'text-red-500' : it.status === 'low' ? 'text-amber-600' : 'text-emerald-600'}`}>
                        {it.status === 'out' ? t('statusOut') : it.status === 'low' ? t('statusLow') : t('statusNormal')}
                      </span>
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
                ))}
              </div>
            );})}
          </div>
        </div>
      )}
    </div>
  );
}
