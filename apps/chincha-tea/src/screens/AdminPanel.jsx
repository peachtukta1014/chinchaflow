import { useCallback, useEffect, useState } from 'react';
import { auth } from '../firebase';
import { DRINK_CATEGORIES, dateKeyBangkok, shiftDateKey } from '../lib/constants';
import {
  fsDelete,
  fsGetConfig,
  fsPatch,
  fsPost,
  fsQueryLineMessages,
  fsQueryOrders,
  fsQueryProducts,
  fsQueryToppings,
  fsQueryUsers,
  fsSetConfig,
} from '../lib/firestoreRest';
import {
  mergeNotifyUserIds,
  pickLatestLineIds,
  validateTeaLineTargets,
} from '../lib/lineIds';
import { cartItemDisplayName } from '../lib/displayNames';
import {
  importDefaultMenuToFirestore,
  importDefaultToppingsToFirestore,
  listMenuNotInFirestore,
  normalizeProductForm,
  normalizeToppingForm,
  saveProduct,
  saveTopping,
  updateProductPrice,
} from '../lib/productService';
import { invalidateAttendanceStaffCache } from '../lib/staffAttendanceService';
import { FIREBASE_PROJECT_ID } from '../lib/viteEnv.js';

const PROJECT_ID = FIREBASE_PROJECT_ID;
const DEFAULT_LINE_CONFIG = {
  webhookFunction: 'lineWebhookTea',
  webhookRegion: 'asia-southeast1',
  envSecret: 'LINE_TEA_CHANNEL_SECRET',
  envToken: 'LINE_TEA_CHANNEL_ACCESS_TOKEN',
  notifyGroupId: '',
  notifyUserIds: '',
  autoSummaryEnabled: false,
  autoSummaryHour: 22,
  instantRestockNotify: true,
};

/** @param {{ catalogOnly?: boolean }} props — catalogOnly: พนักงานเห็นเฉพาะจัดการสินค้า */
export function AdminPanel({ t, lang = 'th', menuItems = [], onOrdersChanged, onCatalogChanged, catalogOnly = false }) {
  const [section, setSection] = useState('products');
  const [users, setUsers] = useState([]);
  const [products, setProducts] = useState([]);
  const [toppings, setToppings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [importBusy, setImportBusy] = useState(false);
  const [flash, setFlash] = useState('');

  const refreshCatalogSection = useCallback(async () => {
    try {
      const [p, tp] = await Promise.all([fsQueryProducts(), fsQueryToppings()]);
      setProducts(p);
      setToppings(tp);
    } catch (e) {
      console.error(e);
    }
  }, []);

  const refreshMembers = useCallback(async () => {
    try {
      setUsers(await fsQueryUsers());
    } catch (e) {
      console.error(e);
    }
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      if (catalogOnly) await refreshCatalogSection();
      else await Promise.all([refreshMembers(), refreshCatalogSection()]);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  }, [catalogOnly, refreshCatalogSection, refreshMembers]);

  useEffect(() => { refresh(); }, [refresh]);

  const showFlash = (msg) => {
    setFlash(msg);
    setTimeout(() => setFlash(''), 2500);
  };

  const updateUser = async (uid, patch) => {
    await fsPatch(`users/${uid}`, patch);
    setUsers((prev) => prev.map((u) => (u.id === uid ? { ...u, ...patch } : u)));
    if (patch.role != null || patch.approved != null) invalidateAttendanceStaffCache();
    showFlash('✅ อัปเดตสมาชิกแล้ว');
  };

  const deleteUser = async (u) => {
    const selfId = auth?.currentUser?.uid;
    if (!u?.id) return;
    if (u.id === selfId) {
      alert(t('cannotDeleteSelf'));
      return;
    }
    const activeAdmins = users.filter((x) => x.role === 'admin' && x.approved);
    if (u.role === 'admin' && u.approved && activeAdmins.length <= 1) {
      alert(t('cannotDeleteLastAdmin'));
      return;
    }
    const msg = t('confirmDeleteMember')
      .replace('{name}', u.name || '—')
      .replace('{email}', u.email || '—');
    if (!window.confirm(msg)) return;
    try {
      await fsDelete(`users/${u.id}`);
      setUsers((prev) => prev.filter((x) => x.id !== u.id));
      invalidateAttendanceStaffCache();
      showFlash(t('memberDeleted'));
    } catch (e) {
      console.error(e);
      alert(t('memberDeleteFailed'));
    }
  };

  const saveProductHandler = async (form, id) => {
    const saved = await saveProduct(form, id);
    const row = { ...normalizeProductForm(form), id: saved.id || id };
    setProducts((prev) => {
      const idx = prev.findIndex((p) => p.id === row.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], ...row };
        return next;
      }
      return [...prev, row];
    });
    onCatalogChanged?.();
    showFlash(t('productSaved'));
  };

  const saveToppingHandler = async (form, id) => {
    const saved = await saveTopping(form, id);
    const row = { ...normalizeToppingForm(form), id: saved.id || id };
    setToppings((prev) => {
      const idx = prev.findIndex((p) => p.id === row.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], ...row };
        return next;
      }
      return [...prev, row];
    });
    onCatalogChanged?.();
    showFlash(t('toppingSaved'));
  };

  const quickPriceHandler = async (id, basePrice) => {
    const price = await updateProductPrice(id, basePrice);
    setProducts((prev) => prev.map((p) => (p.id === id ? { ...p, basePrice: price } : p)));
    onCatalogChanged?.();
    showFlash(t('priceUpdated'));
  };

  const menuNotInDb = listMenuNotInFirestore(products);

  const importMenuHandler = async () => {
    if (!window.confirm(`${t('importMenuToDb')}?\n(${menuNotInDb.length} เมนู)`)) return;
    setImportBusy(true);
    try {
      const addedMenu = await importDefaultMenuToFirestore(products);
      const addedTop = await importDefaultToppingsToFirestore(toppings);
      await refresh();
      onCatalogChanged?.();
      showFlash(`${t('importMenuDone')} (+${addedMenu} เมนู · +${addedTop} ท็อป)`);
    } catch (e) {
      console.error(e);
      showFlash(`❌ ${e?.message || 'นำเข้าไม่สำเร็จ'}`);
    } finally {
      setImportBusy(false);
    }
  };

  return (
    <div className="px-4 pt-3 pb-8 space-y-3">
      {catalogOnly && (
        <p className="text-[11px] text-sky-900 bg-sky-50 border border-sky-200 rounded-xl px-3 py-2 leading-relaxed">
          {t('staffCatalogHint')}
        </p>
      )}
      {flash && (
        <div className="py-2 px-3 rounded-xl bg-emerald-50 text-emerald-700 text-sm font-bold border border-emerald-200">{flash}</div>
      )}
      {!catalogOnly && (
        <div className="flex gap-1.5 flex-wrap">
          {[['members', t('members')], ['products', t('products')], ['orders', t('orderHistory')], ['settings', t('lineSettings')]].map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setSection(id)}
              className={`shrink-0 px-3 py-2 rounded-2xl font-bold text-[10px] ${section === id ? 'text-white' : 'bg-stone-200 text-stone-500'}`}
              style={section === id ? { background: '#3d1f0f' } : {}}
            >
              {label}
            </button>
          ))}
        </div>
      )}
      {loading && (!catalogOnly && section === 'members' || section === 'products') ? (
        <p className="text-center text-stone-400 py-8">{t('loading')}</p>
      ) : !catalogOnly && section === 'members' ? (
        <MembersSection users={users} t={t} onUpdate={updateUser} onDelete={deleteUser} />
      ) : section === 'products' || catalogOnly ? (
        <ProductsSection
          products={products}
          toppings={toppings}
          menuNotInDb={menuNotInDb}
          importBusy={importBusy}
          onImportMenu={importMenuHandler}
          t={t}
          onSaveProduct={saveProductHandler}
          onSaveTopping={saveToppingHandler}
          onQuickPrice={quickPriceHandler}
          onDeleteProduct={(id) => fsDelete(`products/${id}`).then(() => {
            setProducts((prev) => prev.filter((p) => p.id !== id));
            onCatalogChanged?.();
          })}
          onDeleteTopping={(id) => fsDelete(`toppings/${id}`).then(() => {
            setToppings((prev) => prev.filter((p) => p.id !== id));
            onCatalogChanged?.();
          })}
        />
      ) : section === 'orders' ? (
        <OrdersSection t={t} lang={lang} menuItems={menuItems} onChanged={onOrdersChanged} />
      ) : (
        <LineSettingsSection t={t} />
      )}
    </div>
  );
}

function MembersSection({ users, t, onUpdate, onDelete }) {
  const selfId = auth?.currentUser?.uid;

  return (
    <div className="space-y-2">
      {users.length === 0 && <p className="text-stone-400 text-sm text-center py-6">ยังไม่มีผู้ใช้</p>}
      {users.map((u) => {
        const isSelf = u.id === selfId;
        return (
          <div key={u.id} className="bg-white rounded-2xl p-4 border border-stone-200 shadow-sm">
            <div className="flex justify-between items-start gap-2">
              <div className="min-w-0">
                <p className="font-black text-stone-800">{u.name || '—'}</p>
                <p className="text-xs text-stone-400 truncate">{u.email}</p>
                {isSelf && (
                  <p className="text-[10px] text-amber-700 font-bold mt-0.5">{t('currentAccount')}</p>
                )}
                <p className="text-[10px] mt-1">
                  <span className={`px-2 py-0.5 rounded-full font-bold ${u.approved ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                    {u.approved ? 'อนุมัติแล้ว' : 'รออนุมัติ'}
                  </span>
                  <span className="ml-2 text-stone-500">{u.role === 'admin' ? t('roleAdmin') : t('roleStaff')}</span>
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 mt-3">
              {!u.approved && (
                <button
                  type="button"
                  onClick={() => onUpdate(u.id, { approved: true })}
                  className="px-3 py-1.5 rounded-xl bg-emerald-500 text-white text-xs font-bold"
                >
                  {t('approve')}
                </button>
              )}
              <button
                type="button"
                onClick={() => onUpdate(u.id, { role: u.role === 'admin' ? 'staff' : 'admin' })}
                className="px-3 py-1.5 rounded-xl border-2 border-stone-200 text-xs font-bold text-stone-600"
              >
                → {u.role === 'admin' ? t('roleStaff') : t('roleAdmin')}
              </button>
            </div>
            <button
              type="button"
              disabled={isSelf}
              onClick={() => onDelete(u)}
              className="w-full mt-2 py-2 rounded-xl border-2 border-red-200 text-red-600 text-xs font-bold disabled:opacity-40 disabled:border-stone-200 disabled:text-stone-400"
            >
              🗑 {t('deleteMember')}
            </button>
          </div>
        );
      })}
    </div>
  );
}

function ProductsSection({
  products,
  toppings,
  menuNotInDb,
  importBusy,
  onImportMenu,
  t,
  onSaveProduct,
  onSaveTopping,
  onQuickPrice,
  onDeleteProduct,
  onDeleteTopping,
}) {
  const [prodForm, setProdForm] = useState(null);
  const [topForm, setTopForm] = useState(null);
  const [priceEditId, setPriceEditId] = useState(null);
  const [priceDraft, setPriceDraft] = useState('');

  const emptyProduct = () => ({
    nameTh: '', nameEn: '', nameMy: '', key: '', basePrice: 30, category: 'milk-tea', tag: '', emoji: '☕', star: false, active: true,
  });
  const emptyTopping = () => ({ label: '', price: 10, active: true });

  const startPriceEdit = (p) => {
    setPriceEditId(p.id);
    setPriceDraft(String(p.basePrice ?? 0));
  };

  const commitPriceEdit = async (id) => {
    await onQuickPrice(id, priceDraft);
    setPriceEditId(null);
    setPriceDraft('');
  };

  return (
    <div className="space-y-4">
      <p className="text-[11px] text-amber-900 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 leading-relaxed">
        {t('adminProductsHint')}
      </p>
      {menuNotInDb.length > 0 && (
        <div className="rounded-2xl border-2 border-amber-400 bg-amber-50 p-3 space-y-2">
          <p className="text-xs font-bold text-amber-900 leading-relaxed">{t('menuNotInDbHint')}</p>
          <p className="text-[10px] text-amber-800">
            ยังไม่ในระบบ {menuNotInDb.length} รายการ เช่น {menuNotInDb.slice(0, 3).map((m) => m.nameTh).join(', ')}
            {menuNotInDb.length > 3 ? '…' : ''}
          </p>
          <button
            type="button"
            disabled={importBusy}
            onClick={onImportMenu}
            className="w-full py-2.5 rounded-xl text-white text-sm font-black disabled:opacity-50"
            style={{ background: '#c87941' }}
          >
            {importBusy ? t('loading') : `${t('importMenuToDb')} (${menuNotInDb.length})`}
          </button>
        </div>
      )}
      <div className="flex justify-between items-center gap-2 flex-wrap">
        <p className="font-black text-stone-700 text-sm">{t('products')} ({products.length})</p>
        <button
          type="button"
          onClick={() => setProdForm({ ...emptyProduct(), _new: true })}
          className="px-3 py-1.5 rounded-xl text-white text-xs font-bold"
          style={{ background: '#3d1f0f' }}
        >
          + {t('addProduct')}
        </button>
      </div>
      {DRINK_CATEGORIES.map((cat) => {
        const items = products.filter((p) => p.category === cat.id);
        if (!items.length && !prodForm) return null;
        return (
          <div key={cat.id} className="rounded-2xl border border-stone-200 overflow-hidden">
            <div className="px-3 py-2 font-black text-xs" style={{ background: cat.accentBg, color: cat.accent }}>
              {cat.emoji} {cat.label}
            </div>
            <div className="divide-y divide-stone-100 bg-white">
              {items.map((p) => (
                <div key={p.id} className="p-3 flex flex-col gap-2">
                  <div className="flex justify-between items-start gap-2">
                    <div className="min-w-0">
                      <p className="font-bold text-sm text-stone-800">{p.nameTh || p.nameEn}</p>
                      <p className="text-[10px] text-stone-400 truncate">{p.nameEn}{p.nameMy ? ` · ${p.nameMy}` : ''}</p>
                      <p className="text-xs text-stone-500 mt-0.5">
                        {p.active === false ? t('productOff') : t('productOn')}
                        {p.tag ? ` · ${p.tag}` : ''}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-1.5 shrink-0 justify-end">
                      <button
                        type="button"
                        onClick={() => setProdForm({ ...p })}
                        className="text-xs font-black text-white px-3 py-1.5 rounded-lg"
                        style={{ background: '#3d1f0f' }}
                      >
                        {t('edit')}
                      </button>
                      <button type="button" onClick={() => onDeleteProduct(p.id)} className="text-xs font-bold text-red-600 bg-red-50 border border-red-200 px-2 py-1 rounded-lg">{t('delete')}</button>
                    </div>
                  </div>
                  {priceEditId === p.id ? (
                    <div className="flex gap-2 items-center">
                      <span className="text-sm font-bold text-stone-500">฿</span>
                      <input
                        type="tel"
                        inputMode="numeric"
                        value={priceDraft}
                        onChange={(e) => setPriceDraft(e.target.value.replace(/\D/g, ''))}
                        className="flex-1 px-3 py-2 rounded-xl border-2 border-amber-300 text-sm font-bold outline-none"
                        autoFocus
                      />
                      <button type="button" onClick={() => commitPriceEdit(p.id)} className="text-xs font-black text-white px-3 py-2 rounded-xl" style={{ background: '#3d1f0f' }}>{t('save')}</button>
                      <button type="button" onClick={() => setPriceEditId(null)} className="text-xs font-bold text-stone-400 px-2">✕</button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => startPriceEdit(p)}
                      className="text-left text-lg font-black text-stone-800 active:opacity-70"
                    >
                      ฿{(p.basePrice ?? 0).toLocaleString()}
                      <span className="text-[10px] font-bold text-amber-700 ml-2">{t('tapToEditPrice')}</span>
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        );
      })}

      <div className="flex justify-between items-center pt-2">
        <p className="font-black text-stone-700 text-sm">ท็อปปิ้ง</p>
        <button
          type="button"
          onClick={() => setTopForm({ ...emptyTopping(), _new: true })}
          className="px-3 py-1.5 rounded-xl text-white text-xs font-bold"
          style={{ background: '#6b3a2a' }}
        >
          + {t('addTopping')}
        </button>
      </div>
      <div className="bg-white rounded-2xl border border-stone-200 divide-y divide-stone-100">
        {toppings.map((tp) => (
          <div key={tp.id} className="p-3 flex justify-between items-center">
            <p className="font-bold text-sm">{tp.label} <span className="text-amber-600">+{tp.price}</span></p>
            <div className="flex gap-1">
              <button type="button" onClick={() => setTopForm({ ...tp })} className="text-xs font-bold text-amber-700 px-2">{t('edit')}</button>
              <button type="button" onClick={() => onDeleteTopping(tp.id)} className="text-xs font-bold text-red-500 px-2">{t('delete')}</button>
            </div>
          </div>
        ))}
      </div>

      {prodForm && (
        <ProductFormModal
          form={prodForm}
          isNew={!!prodForm._new}
          t={t}
          onClose={() => setProdForm(null)}
          onSave={(f) => onSaveProduct(f, prodForm._new ? null : prodForm.id).then(() => setProdForm(null))}
        />
      )}
      {topForm && (
        <ToppingFormModal
          form={topForm}
          isNew={!!topForm._new}
          t={t}
          onClose={() => setTopForm(null)}
          onSave={(f) => onSaveTopping(f, topForm._new ? null : topForm.id).then(() => setTopForm(null))}
        />
      )}
    </div>
  );
}

function ProductFormModal({ form, isNew, t, onClose, onSave }) {
  const [f, setF] = useState(form);
  return (
    <ModalShell title={isNew ? t('addProduct') : t('editProduct')} onClose={onClose}>
      <div className="space-y-2">
        <label className="text-[10px] font-bold text-stone-500">{t('nameThLabel')}</label>
        <input className="field" value={f.nameTh} onChange={(e) => setF({ ...f, nameTh: e.target.value })} />
        <label className="text-[10px] font-bold text-stone-500">{t('nameEnLabel')}</label>
        <input className="field" value={f.nameEn} onChange={(e) => setF({ ...f, nameEn: e.target.value })} />
        <label className="text-[10px] font-bold text-stone-500">{t('nameMyLabel')}</label>
        <input className="field" value={f.nameMy || ''} onChange={(e) => setF({ ...f, nameMy: e.target.value })} />
        <label className="text-[10px] font-bold text-stone-500">{t('priceLabel')}</label>
        <input className="field" type="tel" inputMode="numeric" value={f.basePrice} onChange={(e) => setF({ ...f, basePrice: e.target.value.replace(/\D/g, '') })} />
        <label className="text-[10px] font-bold text-stone-500">{t('categoryLabel')}</label>
        <select className="field" value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}>
          {DRINK_CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
        </select>
        <input className="field" placeholder={t('tagPlaceholder')} value={f.tag || ''} onChange={(e) => setF({ ...f, tag: e.target.value })} />
        <input className="field" placeholder="emoji" value={f.emoji} onChange={(e) => setF({ ...f, emoji: e.target.value })} />
        <label className="flex items-center gap-2 text-sm font-bold text-stone-600">
          <input type="checkbox" checked={f.active !== false} onChange={(e) => setF({ ...f, active: e.target.checked })} />
          {t('productOn')}
        </label>
        <button type="button" onClick={() => onSave(f)} className="w-full py-3 rounded-2xl font-black text-white" style={{ background: '#3d1f0f' }}>{t('save')}</button>
      </div>
    </ModalShell>
  );
}

function ToppingFormModal({ form, isNew, t, onClose, onSave }) {
  const [f, setF] = useState(form);
  return (
    <ModalShell title={isNew ? t('addTopping') : t('editProduct')} onClose={onClose}>
      <input className="field" placeholder="ชื่อท็อปปิ้ง" value={f.label} onChange={(e) => setF({ ...f, label: e.target.value })} />
      <input className="field" type="number" placeholder="ราคา" value={f.price} onChange={(e) => setF({ ...f, price: e.target.value })} />
      <button type="button" onClick={() => onSave(f)} className="w-full py-3 mt-2 rounded-2xl font-black text-white" style={{ background: '#3d1f0f' }}>{t('save')}</button>
    </ModalShell>
  );
}

function OrdersSection({ t, lang = 'th', menuItems = [], onChanged }) {
  const todayKey = dateKeyBangkok();
  const [viewDateKey, setViewDateKey] = useState(todayKey);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editOrder, setEditOrder] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setOrders(await fsQueryOrders(viewDateKey));
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  }, [viewDateKey]);

  useEffect(() => { load(); }, [load]);

  const saveOrder = async (form) => {
    await fsPatch(`teaOrders/${form.id}`, {
      total: parseInt(form.total, 10) || 0,
      payType: form.payType,
    });
    setEditOrder(null);
    await load();
    onChanged?.();
  };

  const deleteOrder = async (id) => {
    if (!window.confirm(t('confirmDeleteOrder'))) return;
    await fsDelete(`teaOrders/${id}`);
    await load();
    onChanged?.();
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 bg-white rounded-2xl p-2 border border-stone-200">
        <button type="button" onClick={() => setViewDateKey(shiftDateKey(viewDateKey, -1))} className="w-9 h-9 rounded-xl bg-stone-100 font-black">‹</button>
        <p className="flex-1 text-center text-xs font-black text-stone-700">{viewDateKey}</p>
        <button type="button" disabled={viewDateKey >= todayKey} onClick={() => setViewDateKey(shiftDateKey(viewDateKey, 1))} className="w-9 h-9 rounded-xl bg-stone-100 font-black disabled:opacity-30">›</button>
      </div>
      {loading ? (
        <p className="text-center text-stone-400 py-6">{t('loading')}</p>
      ) : orders.length === 0 ? (
        <p className="text-center text-stone-400 py-6">{t('noOrders')}</p>
      ) : (
        orders.map((o) => (
          <div key={o.id} className="bg-white rounded-2xl p-4 border border-stone-200">
            <div className="flex justify-between mb-2">
              <p className="text-xs text-stone-400">
                {o.createdBy || '—'} · {o.payType === 'transfer' ? t('transfer') : t('cash')}
              </p>
              <p className="font-black" style={{ color: '#3d1f0f' }}>฿{(o.total || 0).toLocaleString()}</p>
            </div>
            {(o.items || []).map((it, j) => {
              const { primary, sub } = cartItemDisplayName(it, lang, t, menuItems);
              return (
              <p key={j} className="text-xs text-stone-600">
                {it.qty}× {primary}
                {sub ? <span className="block text-[10px] text-sky-700/90 font-semibold">{sub}</span> : null}
              </p>
            );})}
            <div className="flex gap-2 mt-3">
              <button type="button" onClick={() => setEditOrder(o)} className="flex-1 py-2 rounded-xl border-2 border-amber-200 text-xs font-bold text-amber-800">{t('edit')}</button>
              <button type="button" onClick={() => deleteOrder(o.id)} className="flex-1 py-2 rounded-xl border-2 border-red-200 text-xs font-bold text-red-600">{t('delete')}</button>
            </div>
          </div>
        ))
      )}
      {editOrder && (
        <OrderEditModal
          order={editOrder}
          t={t}
          onClose={() => setEditOrder(null)}
          onSave={saveOrder}
        />
      )}
    </div>
  );
}

function OrderEditModal({ order, t, onClose, onSave }) {
  const [total, setTotal] = useState(String(order.total || 0));
  const [payType, setPayType] = useState(order.payType || 'cash');
  return (
    <ModalShell title={t('editOrder')} onClose={onClose}>
      <p className="text-xs text-stone-400 mb-3">ID: {order.id}</p>
      <label className="text-xs font-bold text-stone-500">ยอดรวม (฿)</label>
      <input className="field" type="number" value={total} onChange={(e) => setTotal(e.target.value)} />
      <label className="text-xs font-bold text-stone-500 mt-2 block">การชำระ</label>
      <div className="flex gap-2 mb-3">
        {[['cash', t('cash')], ['transfer', t('transfer')]].map(([v, label]) => (
          <button key={v} type="button" onClick={() => setPayType(v)} className={`flex-1 py-2 rounded-xl font-bold text-sm border-2 ${payType === v ? 'border-amber-400 bg-amber-50' : 'border-stone-200'}`}>{label}</button>
        ))}
      </div>
      <button type="button" onClick={() => onSave({ id: order.id, total, payType })} className="w-full py-3 rounded-2xl font-black text-white" style={{ background: '#3d1f0f' }}>{t('save')}</button>
    </ModalShell>
  );
}

function LineSettingsSection({ t }) {
  const [form, setForm] = useState({ ...DEFAULT_LINE_CONFIG });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [fetchBusy, setFetchBusy] = useState(null);
  const [flash, setFlash] = useState('');

  useEffect(() => {
    fsGetConfig('teaLine').then((doc) => {
      if (doc) setForm({ ...DEFAULT_LINE_CONFIG, ...doc });
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const webhookUrl = PROJECT_ID
    ? `https://${form.webhookRegion}-${PROJECT_ID}.cloudfunctions.net/${form.webhookFunction}`
    : '(ตั้ง VITE_FIREBASE_PROJECT_ID)';

  const save = async () => {
    const errKey = validateTeaLineTargets(form);
    if (errKey) {
      setFlash(`⚠️ ${t(errKey)}`);
      return;
    }
    setSaving(true);
    try {
      await fsSetConfig('teaLine', {
        ...form,
        notifyGroupId: (form.notifyGroupId || '').trim(),
        instantRestockNotify: form.instantRestockNotify !== false,
        updatedAt: new Date().toISOString(),
      });
      setFlash('✅ บันทึกการตั้งค่าแล้ว');
      setTimeout(() => setFlash(''), 2500);
    } catch (e) {
      console.error(e);
      setFlash('⚠️ บันทึกไม่สำเร็จ');
    }
    setSaving(false);
  };

  const fetchLineIds = async (kind) => {
    setFetchBusy(kind);
    try {
      const messages = await fsQueryLineMessages(80);
      const { groupId, userId } = pickLatestLineIds(messages);
      if (kind === 'group') {
        if (!groupId) {
          setFlash(`⚠️ ${t('lineFetchNoGroupId')}`);
          return;
        }
        setForm((p) => ({ ...p, notifyGroupId: groupId }));
        setFlash(t('lineFetchGroupIdOk'));
      } else {
        if (!userId) {
          setFlash(`⚠️ ${t('lineFetchNoUserId')}`);
          return;
        }
        setForm((p) => ({ ...p, notifyUserIds: mergeNotifyUserIds(p.notifyUserIds, userId) }));
        setFlash(t('lineFetchUserIdOk'));
      }
      setTimeout(() => setFlash(''), 2500);
    } catch (e) {
      console.error(e);
      setFlash(`⚠️ ${t('lineFetchFailed')}`);
    } finally {
      setFetchBusy(null);
    }
  };

  if (loading) return <p className="text-center text-stone-400 py-8">{t('loading')}</p>;

  return (
    <div className="space-y-3">
      {flash && <div className="py-2 px-3 rounded-xl bg-emerald-50 text-emerald-700 text-sm font-bold">{flash}</div>}
      <div className="bg-white rounded-2xl p-4 border border-stone-200 space-y-2">
        <p className="font-black text-sm text-stone-800">{t('lineWebhookUrl')}</p>
        <p className="text-[10px] text-stone-400 break-all font-mono bg-stone-50 p-2 rounded-lg">{webhookUrl}</p>
        <p className="text-[10px] text-stone-500">{t('lineWebhookHint')}</p>
      </div>
      <div className="bg-amber-50 rounded-2xl p-4 border border-amber-200 text-xs text-amber-900 space-y-2">
        <p className="font-black">{t('lineBotPurpose')}</p>
        <p className="text-[11px] leading-relaxed">{t('lineBotPurposeDesc')}</p>
      </div>
      <div className="bg-amber-50 rounded-2xl p-4 border border-amber-200 text-xs text-amber-900 space-y-1">
        <p className="font-black">{t('lineEnvKeys')}</p>
        <p><code className="bg-white px-1 rounded">{form.envSecret}</code> — Channel Secret (Functions env)</p>
        <p><code className="bg-white px-1 rounded">{form.envToken}</code> — Channel Access Token (Functions env)</p>
        <p className="text-[10px] opacity-80">รหัสลับตั้งใน Firebase Console → Functions → Environment variables เท่านั้น</p>
      </div>
      <div className="bg-white rounded-2xl p-4 border border-stone-200 space-y-3">
        <p className="font-bold text-xs text-stone-700">{t('lineNotifyTargets')}</p>
        <label className="text-[10px] font-bold text-stone-500 block">LINE Group ID (แจ้งสรุปปิดวัน)</label>
        <input
          className="w-full px-3 py-2.5 rounded-xl border-2 border-stone-200 text-xs font-mono outline-none"
          placeholder={t('lineGroupIdPlaceholder')}
          value={form.notifyGroupId || ''}
          onChange={(e) => setForm({ ...form, notifyGroupId: e.target.value.trim() })}
        />
        <button
          type="button"
          disabled={!!fetchBusy || saving}
          onClick={() => fetchLineIds('group')}
          className="w-full py-2 rounded-xl text-xs font-bold border-2 border-emerald-300 bg-emerald-50 text-emerald-800 disabled:opacity-50"
        >
          {fetchBusy === 'group' ? '⏳' : `📥 ${t('lineFetchGroupId')}`}
        </button>
        <label className="text-[10px] font-bold text-stone-500 block">User ID เพิ่มเติม (คั่นด้วย comma)</label>
        <input
          className="w-full px-3 py-2.5 rounded-xl border-2 border-stone-200 text-xs font-mono outline-none"
          placeholder={t('lineUserIdsPlaceholder')}
          value={form.notifyUserIds || ''}
          onChange={(e) => setForm({ ...form, notifyUserIds: e.target.value })}
        />
        <button
          type="button"
          disabled={!!fetchBusy || saving}
          onClick={() => fetchLineIds('user')}
          className="w-full py-2 rounded-xl text-xs font-bold border-2 border-emerald-300 bg-emerald-50 text-emerald-800 disabled:opacity-50"
        >
          {fetchBusy === 'user' ? '⏳' : `📥 ${t('lineFetchUserId')}`}
        </button>
        <p className="text-[10px] text-stone-400">{t('lineGroupIdHint')}</p>
      </div>
      <div className="bg-emerald-50 rounded-2xl p-4 border border-emerald-200 space-y-2">
        <p className="font-bold text-xs text-emerald-900">{t('lineInstantRestockNotify')}</p>
        <p className="text-[10px] text-emerald-800 leading-relaxed">{t('lineInstantRestockNotifyDesc')}</p>
        <label className="flex items-center gap-2 text-sm font-bold text-emerald-900">
          <input
            type="checkbox"
            checked={form.instantRestockNotify !== false}
            onChange={(e) => setForm({ ...form, instantRestockNotify: e.target.checked })}
          />
          {t('lineInstantRestockNotifyOn')}
        </label>
      </div>
      <div className="bg-white rounded-2xl p-4 border border-stone-200 space-y-2">
        <p className="font-bold text-xs text-stone-700">{t('lineAutoSummary')}</p>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={form.autoSummaryEnabled !== false}
            onChange={(e) => setForm({ ...form, autoSummaryEnabled: e.target.checked })}
          />
          {t('lineAutoSummaryOn')}
        </label>
        <label className="text-[10px] font-bold text-stone-500 block">{t('lineAutoSummaryTime')} (0–23)</label>
        <input
          type="number"
          min={0}
          max={23}
          className="w-24 px-3 py-2 rounded-xl border-2 border-stone-200 text-sm font-bold text-center"
          value={form.autoSummaryHour ?? 22}
          onChange={(e) => setForm({ ...form, autoSummaryHour: parseInt(e.target.value, 10) || 22 })}
        />
        <p className="text-[10px] text-stone-400">เวลาไทย (Bangkok)</p>
        <p className="text-[10px] text-stone-400">{t('lineCommands')}: {t('lineCommandsHint')}</p>
      </div>
      <button type="button" disabled={saving} onClick={save} className="w-full py-3 rounded-2xl font-black text-white" style={{ background: '#3d1f0f' }}>
        {saving ? '⏳' : t('save')}
      </button>
    </div>
  );
}

function ModalShell({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center" onClick={onClose}>
      <div className="bg-white w-full max-w-md rounded-t-3xl p-5 max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between mb-3">
          <p className="font-black text-stone-800">{title}</p>
          <button type="button" onClick={onClose} className="text-stone-300 text-2xl">×</button>
        </div>
        {children}
        <style>{`.field{width:100%;padding:12px;border-radius:12px;border:2px solid #e7e5e4;margin-bottom:8px;font-weight:700;font-size:14px;outline:none}`}</style>
      </div>
    </div>
  );
}
