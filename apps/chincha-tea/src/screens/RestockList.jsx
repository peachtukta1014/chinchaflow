import { useState } from 'react';
import {
  canManageRestock,
  canMarkRestockPurchased,
  canConfirmRestockReceived,
  isRestockPurchased,
  isRestockReceived,
  confirmPurchase,
  removeRestockLine,
  restockPurchaseTotal,
  normalizeRestockStatus,
  updateRestockLineQty,
  updateRestockStatus,
  markRestockPurchased,
} from '../lib/restockService';
import { updateRestockCatalogPrices, restockNameKey } from '../lib/restockCatalogService';
import { buildInventoryReceivePreview } from '../lib/inventoryMath';
import { restockDisplayName } from '../lib/restockDisplay';
import { writeHistoryLog } from '../lib/historyLogService';

// ── shared helpers (imported by RestockForm) ─────────────────────────────────

export function RestockItemName({ name, lang, catalogItem }) {
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

export function moneyLabel(value) {
  const amount = Math.round(Number(value) || 0);
  return amount > 0 ? `฿${amount.toLocaleString()}` : '';
}

// ── RestockList ───────────────────────────────────────────────────────────────

export function RestockList({
  member, t, lang, isAdmin, dateKey,
  recentRequests, setRecentRequests,
  catalogByKey, latestPriceForName,
  notifyRestockChange, refreshCatalog, setFlash,
}) {
  const [deletingId, setDeletingId] = useState(null);
  const [purchaseEditId, setPurchaseEditId] = useState(null);
  const [purchaseAmount, setPurchaseAmount] = useState('');
  const [purchaseLinePrices, setPurchaseLinePrices] = useState({});
  const [purchaseLineInventory, setPurchaseLineInventory] = useState({});

  const restockStatusLabel = (status) => ({
    pending: t('restockStatusPending'),
    picked: t('restockStatusPicked'),
    pending_confirm: t('restockStatusPendingConfirm'),
    received: t('restockStatusReceived'),
    cancelled: t('restockStatusCancelled'),
  }[normalizeRestockStatus(status)] || t('restockStatusPending'));

  const restockStatusClass = (status) => ({
    pending: 'text-amber-700 bg-amber-50 border-amber-100',
    picked: 'text-sky-700 bg-sky-50 border-sky-100',
    pending_confirm: 'text-orange-700 bg-orange-50 border-orange-100',
    received: 'text-emerald-700 bg-emerald-50 border-emerald-100',
    cancelled: 'text-stone-500 bg-stone-100 border-stone-200',
  }[normalizeRestockStatus(status)] || 'text-amber-700 bg-amber-50 border-amber-100');

  const purchaseLinesFor = (req) => (req.items || []).map((item, index) => {
    const qty = Math.max(1, Number(item.qty) || 1);
    const raw = purchaseLinePrices[`${req.id}:${index}`] || '';
    const unitPrice = parseInt(String(raw).replace(/\D/g, ''), 10) || 0;
    const inventory = purchaseLineInventory[`${req.id}:${index}`] || {};
    return {
      ...item,
      qty,
      unitPrice,
      lineTotal: unitPrice * qty,
      unit: (inventory.unit || item.unit || 'ชิ้น').trim(),
      base_unit: (inventory.base_unit || item.base_unit || item.unit || 'ชิ้น').trim(),
      conversion_rate: Math.max(1, Math.round(Number(inventory.conversion_rate ?? item.conversion_rate) || 1)),
    };
  });

  const purchaseLineTotalFor = (req) => purchaseLinesFor(req).reduce((sum, line) => sum + line.lineTotal, 0);

  const startPurchaseEdit = (req) => {
    const draft = {};
    const inventoryDraft = {};
    (req.items || []).forEach((item, index) => {
      const saved = req.purchaseItems?.[index];
      const amount = Number(saved?.unitPrice ?? item.purchaseUnitPrice ?? 0);
      if (amount > 0) draft[`${req.id}:${index}`] = String(Math.round(amount));
      const catalogItem = catalogByKey.get(restockNameKey(item.name));
      inventoryDraft[`${req.id}:${index}`] = {
        unit: saved?.unit || item.unit || catalogItem?.unit || 'ชิ้น',
        base_unit: saved?.base_unit || item.base_unit || catalogItem?.base_unit || item.unit || 'ชิ้น',
        conversion_rate: String(saved?.conversion_rate || item.conversion_rate || catalogItem?.conversion_rate || 1),
      };
    });
    setPurchaseLinePrices(draft);
    setPurchaseLineInventory(inventoryDraft);
    setPurchaseAmount(String(restockPurchaseTotal(req) || ''));
    setPurchaseEditId(req.id);
  };

  const closePurchaseEdit = () => {
    setPurchaseEditId(null);
    setPurchaseAmount('');
    setPurchaseLinePrices({});
    setPurchaseLineInventory({});
  };

  const handleDeleteRestock = async (req) => {
    if (!canManageRestock(req, member) || deletingId) return;
    if (normalizeRestockStatus(req.purchaseStatus) === 'cancelled') return;
    if (!window.confirm(t('confirmCancelRestock'))) return;
    setDeletingId(req.id);
    try {
      const patch = await updateRestockStatus(req.id, { status: 'cancelled', member });
      setRecentRequests((prev) => prev.map((r) => (r.id === req.id ? { ...r, ...patch } : r)));
      notifyRestockChange();
      await writeHistoryLog({ action: 'restock.cancelled', collection: 'restocks', docId: req.id, refPath: `restocks/${req.id}`, dateKey: req.dateKey || dateKey, member, summary: { status: 'cancelled' } });
      setFlash(t('restockCancelled'));
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

  const handleTogglePicked = async (req, checked) => {
    const status = normalizeRestockStatus(req.purchaseStatus);
    if (isRestockReceived(req) || status === 'cancelled' || status === 'pending_confirm' || deletingId) return;
    const nextStatus = checked ? 'picked' : 'pending';
    setDeletingId(req.id);
    try {
      const patch = await updateRestockStatus(req.id, { status: nextStatus, member });
      setRecentRequests((prev) => prev.map((r) => (r.id === req.id ? { ...r, ...patch } : r)));
      notifyRestockChange();
      await writeHistoryLog({ action: `restock.${nextStatus}`, collection: 'restocks', docId: req.id, refPath: `restocks/${req.id}`, dateKey: req.dateKey || dateKey, member, summary: { status: nextStatus } });
    } catch (e) {
      console.error(e);
      alert(t('saveFailed'));
    }
    setDeletingId(null);
  };

  const handleUpdateExistingQty = async (req, lineIndex, qty) => {
    if (!canManageRestock(req, member) || deletingId) return;
    setDeletingId(req.id);
    try {
      const updatedItems = await updateRestockLineQty(req, lineIndex, qty, member);
      setRecentRequests((prev) => prev.map((r) => (r.id === req.id ? { ...r, items: updatedItems } : r)));
      notifyRestockChange();
    } catch (e) {
      console.error(e);
      alert(t('saveFailed'));
    }
    setDeletingId(null);
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
        member,
      });
      await writeHistoryLog({ action: 'restock.pending_confirm', collection: 'restocks', docId: req.id, refPath: `restocks/${req.id}`, dateKey: req.dateKey || dateKey, member, summary: { purchaseTotal: amount } });
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

  const handleConfirmReceived = async (req) => {
    if (!canConfirmRestockReceived(req, member) || deletingId) return;
    const lineItems = req.purchaseItems?.length ? req.purchaseItems : req.items || [];
    const amount = restockPurchaseTotal(req) || lineItems.reduce((sum, line) => sum + Math.max(0, Number(line.lineTotal) || 0), 0);
    if (!amount || amount <= 0) {
      alert(t('restockPurchaseInvalid'));
      return;
    }
    setDeletingId(req.id);
    try {
      const patch = await confirmPurchase(req.id, {
        purchaseTotal: amount,
        purchaseItems: lineItems,
        purchasedBy: req.purchasedBy || member?.name || '—',
        purchasedByUid: req.purchasedByUid || member?.uid || '',
        member,
      });
      await updateRestockCatalogPrices(lineItems);
      await refreshCatalog();
      await writeHistoryLog({ action: 'restock.received', collection: 'restocks', docId: req.id, refPath: `restocks/${req.id}`, dateKey: req.dateKey || dateKey, member, summary: { purchaseTotal: amount } });
      setRecentRequests((prev) => prev.map((r) => (r.id === req.id ? { ...r, ...patch } : r)));
      notifyRestockChange();
      setFlash(t('restockReceivedSaved'));
      setTimeout(() => setFlash(''), 3000);
    } catch (e) {
      console.error(e);
      alert(t('saveFailed'));
    }
    setDeletingId(null);
  };

  const pending = recentRequests.filter(
    (r) => !isRestockReceived(r) && normalizeRestockStatus(r.purchaseStatus) !== 'cancelled',
  );

  if (!pending.length) return null;

  return (
    <div className="mt-4">
      <p className="font-black text-xs text-stone-500 uppercase mb-2">{t('recentRestocks')}</p>
      <div className="space-y-2">
        {pending.map((req) => {
          const canDel = canManageRestock(req, member);
          const canPurchase = canMarkRestockPurchased(req, member);
          const canReceive = canConfirmRestockReceived(req, member);
          const purchased = isRestockPurchased(req);
          const received = isRestockReceived(req);
          const status = normalizeRestockStatus(req.purchaseStatus);
          const busy = deletingId === req.id;
          const editing = purchaseEditId === req.id;
          const locked = received || status === 'cancelled' || status === 'pending_confirm';
          return (
            <div key={req.id} className={`bg-white rounded-2xl p-3 border ${restockStatusClass(status)} ${busy ? 'opacity-60' : ''}`}>
              <div className="flex items-start justify-between gap-2 mb-2 flex-wrap">
                <label className={`flex items-start gap-2 min-w-0 ${locked ? 'opacity-70' : 'cursor-pointer'}`}>
                  <input
                    type="checkbox"
                    checked={status === 'picked' || status === 'pending_confirm' || received}
                    disabled={locked || busy}
                    onChange={(e) => handleTogglePicked(req, e.target.checked)}
                    className="mt-0.5 w-5 h-5 rounded border-2 border-stone-300 accent-sky-700 shrink-0 disabled:opacity-50"
                  />
                  <span className="min-w-0">
                    <span className="block text-[10px] text-stone-400">{req.createdBy || '—'} · {(req.items || []).length} {t('items')}</span>
                    <span className={`inline-flex mt-1 px-2 py-0.5 rounded-full border text-[10px] font-black ${restockStatusClass(status)}`}>{restockStatusLabel(status)}</span>
                    {purchased && (
                      <span className="block text-[10px] font-black text-emerald-700 mt-1">
                        ฿{restockPurchaseTotal(req).toLocaleString()}
                        {status === 'pending_confirm' ? ` · ${t('restockAwaitingConfirm')}` : ''}
                      </span>
                    )}
                    {!isAdmin && req.purchaseItems?.some((line) => Number(line?.lineTotal) > 0) && (
                      <span className="block text-[10px] font-bold text-stone-400">{t('purchasePriceViewOnly')}</span>
                    )}
                  </span>
                </label>
                <div className="flex gap-1 shrink-0 flex-wrap justify-end">
                  {canPurchase && !received && !editing && status !== 'cancelled' && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => startPurchaseEdit(req)}
                      className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-lg active:scale-95 disabled:opacity-50"
                    >
                      {purchased ? t('editPurchase') : t('markPurchased')}
                    </button>
                  )}
                  {canReceive && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => handleConfirmReceived(req)}
                      className="text-[10px] font-black text-white bg-emerald-700 border border-emerald-700 px-2 py-0.5 rounded-lg active:scale-95 disabled:opacity-50"
                    >
                      {t('confirmReceived')}
                    </button>
                  )}
                  {canDel && !received && status !== 'cancelled' && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => handleDeleteRestock(req)}
                      className="text-[10px] font-bold text-red-600 bg-red-50 border border-red-200 px-2 py-0.5 rounded-lg active:scale-95 disabled:opacity-50"
                    >
                      {busy ? '…' : t('cancelRestock')}
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
                    const inventoryDraft = purchaseLineInventory[key] || {};
                    const preview = buildInventoryReceivePreview({
                      ...line,
                      qty,
                      unit: inventoryDraft.unit,
                      base_unit: inventoryDraft.base_unit,
                      conversion_rate: inventoryDraft.conversion_rate,
                    });
                    const setInventoryField = (field, value) => setPurchaseLineInventory((prev) => ({
                      ...prev,
                      [key]: { ...(prev[key] || {}), [field]: value },
                    }));
                    return (
                      <div key={key} className="rounded-xl bg-white/70 border border-emerald-100 p-2 space-y-2">
                        <div className="grid grid-cols-[1fr_92px] gap-2 items-center">
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
                        <div className="grid grid-cols-3 gap-1.5">
                          <input type="text" value={inventoryDraft.unit || ''} onChange={(e) => setInventoryField('unit', e.target.value)} placeholder={t('inventoryUnitLabel')} className="px-2 py-1.5 rounded-lg border border-emerald-100 text-[11px] font-bold" />
                          <input type="text" value={inventoryDraft.base_unit || ''} onChange={(e) => setInventoryField('base_unit', e.target.value)} placeholder={t('inventoryBaseUnitLabel')} className="px-2 py-1.5 rounded-lg border border-emerald-100 text-[11px] font-bold" />
                          <input type="tel" inputMode="numeric" value={inventoryDraft.conversion_rate || ''} onChange={(e) => setInventoryField('conversion_rate', e.target.value.replace(/\D/g, ''))} placeholder={t('inventoryConversionLabel')} className="px-2 py-1.5 rounded-lg border border-emerald-100 text-[11px] font-bold" />
                        </div>
                        <p className="text-[10px] font-black text-orange-700">
                          {t('inventoryReceivePreview').replace('{n}', String(preview.received_base_qty)).replace('{unit}', preview.base_unit)} · {t('restockReceiveOnlyAfterConfirm')}
                        </p>
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
                    <button type="button" disabled={busy} onClick={() => handleSavePurchase(req)} className="px-3 py-2 rounded-xl font-black text-white text-xs shrink-0" style={{ background: '#1a8f4c' }}>
                      {t('savePurchase')}
                    </button>
                    <button type="button" onClick={closePurchaseEdit} className="px-2 py-2 text-stone-400 text-xs font-bold">✕</button>
                  </div>
                </div>
              )}
              <div className="divide-y divide-stone-100">
                {(req.items || []).map((it, i) => {
                  const purchasedLine = req.purchaseItems?.[i];
                  const unitPrice = Number(purchasedLine?.unitPrice || it.purchaseUnitPrice || latestPriceForName(it.name) || 0);
                  const lineTotal = Number(purchasedLine?.lineTotal || 0);
                  const qty = Math.max(1, Number(it.qty) || 1);
                  return (
                    <div key={i} className="grid grid-cols-[1fr_auto_auto] gap-2 items-center py-2 text-xs text-stone-700">
                      <p className="min-w-0 font-bold">
                        <RestockItemName name={it.name} lang={lang} />
                        <span className="block text-[10px] font-black text-emerald-700">
                          {purchasedLine ? `${moneyLabel(unitPrice)}/${t('restockUnitShort')}${lineTotal > 0 ? ` · ฿${lineTotal.toLocaleString()}` : ''}` : unitPrice > 0 ? `${t('restockLatestPrice')} ${moneyLabel(unitPrice)}/${t('restockUnitShort')}` : t('restockNoLatestPrice')}
                        </span>
                      </p>
                      {!locked && canDel ? (
                        <div className="flex items-center gap-1">
                          <button type="button" disabled={busy} onClick={() => handleUpdateExistingQty(req, i, qty - 1)} className="w-7 h-7 rounded-full bg-stone-100 font-bold disabled:opacity-50">−</button>
                          <input
                            type="tel"
                            inputMode="numeric"
                            value={qty}
                            disabled={busy}
                            onChange={(e) => handleUpdateExistingQty(req, i, e.target.value.replace(/\D/g, ''))}
                            className="w-12 px-1 py-1 rounded-lg border border-stone-200 text-center text-sm font-black disabled:opacity-50"
                          />
                          <button type="button" disabled={busy} onClick={() => handleUpdateExistingQty(req, i, qty + 1)} className="w-7 h-7 rounded-full text-white font-bold disabled:opacity-50" style={{ background: '#6b3a2a' }}>+</button>
                        </div>
                      ) : (
                        <span className="text-sm font-black text-stone-700">×{qty}</span>
                      )}
                      {canDel && !locked && (
                        <button type="button" disabled={busy} onClick={() => handleRemoveLine(req, i)} className="text-red-400 font-black px-1 active:scale-95 disabled:opacity-50" aria-label={t('delete')}>×</button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
