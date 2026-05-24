import { useCallback, useEffect, useState } from 'react';
import { DRINK_CATEGORIES, dateKeyBangkok, shiftDateKey } from '../lib/constants';
import {
  fsDelete,
  fsGetConfig,
  fsPatch,
  fsPost,
  fsQueryOrders,
  fsQueryProducts,
  fsQueryToppings,
  fsQueryUsers,
  fsSetConfig,
} from '../lib/firestoreRest';
import { validateTeaLineTargets } from '../lib/lineIds';

const PROJECT_ID = import.meta.env.VITE_FIREBASE_PROJECT_ID || '';
const DEFAULT_LINE_CONFIG = {
  webhookFunction: 'lineWebhookTea',
  webhookRegion: 'asia-southeast1',
  envSecret: 'LINE_TEA_CHANNEL_SECRET',
  envToken: 'LINE_TEA_CHANNEL_ACCESS_TOKEN',
  notifyGroupId: '',
  notifyUserIds: '',
  autoSummaryEnabled: false,
  autoSummaryHour: 22,
};

export function AdminPanel({ t, onOrdersChanged }) {
  const [section, setSection] = useState('members');
  const [users, setUsers] = useState([]);
  const [products, setProducts] = useState([]);
  const [toppings, setToppings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [flash, setFlash] = useState('');

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [u, p, tp] = await Promise.all([fsQueryUsers(), fsQueryProducts(), fsQueryToppings()]);
      setUsers(u);
      setProducts(p);
      setToppings(tp);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const showFlash = (msg) => {
    setFlash(msg);
    setTimeout(() => setFlash(''), 2500);
  };

  const updateUser = async (uid, patch) => {
    await fsPatch(`users/${uid}`, patch);
    await refresh();
    showFlash('✅ อัปเดตสมาชิกแล้ว');
  };

  const saveProduct = async (form, id) => {
    const data = {
      nameTh: form.nameTh.trim(),
      nameEn: form.nameEn.trim(),
      key: form.key.trim() || form.nameEn.toLowerCase().replace(/\s+/g, '-'),
      basePrice: parseInt(form.basePrice, 10) || 0,
      category: form.category,
      tag: form.tag || '',
      emoji: form.emoji || '☕',
      star: !!form.star,
      active: form.active !== false,
    };
    if (id) {
      await fsPatch(`products/${id}`, data);
    } else {
      await fsPost('products', data);
    }
    await refresh();
    showFlash('✅ บันทึกสินค้าแล้ว');
  };

  const saveTopping = async (form, id) => {
    const data = {
      label: form.label.trim(),
      price: parseInt(form.price, 10) || 0,
      active: form.active !== false,
    };
    if (id) await fsPatch(`toppings/${id}`, data);
    else await fsPost('toppings', data);
    await refresh();
    showFlash('✅ บันทึกท็อปปิ้งแล้ว');
  };

  return (
    <div className="px-4 pt-3 pb-8 space-y-3">
      {flash && (
        <div className="py-2 px-3 rounded-xl bg-emerald-50 text-emerald-700 text-sm font-bold border border-emerald-200">{flash}</div>
      )}
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
      {loading && (section === 'members' || section === 'products') ? (
        <p className="text-center text-stone-400 py-8">{t('loading')}</p>
      ) : section === 'members' ? (
        <MembersSection users={users} t={t} onUpdate={updateUser} />
      ) : section === 'products' ? (
        <ProductsSection
          products={products}
          toppings={toppings}
          t={t}
          onSaveProduct={saveProduct}
          onSaveTopping={saveTopping}
          onDeleteProduct={(id) => fsDelete(`products/${id}`).then(refresh)}
          onDeleteTopping={(id) => fsDelete(`toppings/${id}`).then(refresh)}
        />
      ) : section === 'orders' ? (
        <OrdersSection t={t} onChanged={onOrdersChanged} />
      ) : (
        <LineSettingsSection t={t} />
      )}
    </div>
  );
}

function MembersSection({ users, t, onUpdate }) {
  return (
    <div className="space-y-2">
      {users.length === 0 && <p className="text-stone-400 text-sm text-center py-6">ยังไม่มีผู้ใช้</p>}
      {users.map((u) => (
        <div key={u.id} className="bg-white rounded-2xl p-4 border border-stone-200 shadow-sm">
          <div className="flex justify-between items-start gap-2">
            <div>
              <p className="font-black text-stone-800">{u.name || '—'}</p>
              <p className="text-xs text-stone-400 truncate">{u.email}</p>
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
        </div>
      ))}
    </div>
  );
}

function ProductsSection({ products, toppings, t, onSaveProduct, onSaveTopping, onDeleteProduct, onDeleteTopping }) {
  const [prodForm, setProdForm] = useState(null);
  const [topForm, setTopForm] = useState(null);

  const emptyProduct = () => ({
    nameTh: '', nameEn: '', key: '', basePrice: 30, category: 'milk-tea', tag: '', emoji: '☕', star: false, active: true,
  });
  const emptyTopping = () => ({ label: '', price: 10, active: true });

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="font-black text-stone-700 text-sm">{t('products')}</p>
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
                <div key={p.id} className="p-3 flex justify-between items-center gap-2">
                  <div>
                    <p className="font-bold text-sm text-stone-800">{p.nameTh || p.nameEn}</p>
                    <p className="text-xs text-stone-400">฿{p.basePrice} · {p.active === false ? 'ปิด' : 'เปิด'}</p>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <button type="button" onClick={() => setProdForm({ ...p })} className="text-xs font-bold text-amber-700 px-2 py-1">{t('edit')}</button>
                    <button type="button" onClick={() => onDeleteProduct(p.id)} className="text-xs font-bold text-red-500 px-2 py-1">{t('delete')}</button>
                  </div>
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
          t={t}
          onClose={() => setProdForm(null)}
          onSave={(f) => onSaveProduct(f, prodForm._new ? null : prodForm.id).then(() => setProdForm(null))}
        />
      )}
      {topForm && (
        <ToppingFormModal
          form={topForm}
          t={t}
          onClose={() => setTopForm(null)}
          onSave={(f) => onSaveTopping(f, topForm._new ? null : topForm.id).then(() => setTopForm(null))}
        />
      )}
    </div>
  );
}

function ProductFormModal({ form, t, onClose, onSave }) {
  const [f, setF] = useState(form);
  return (
    <ModalShell title={t('addProduct')} onClose={onClose}>
      <div className="space-y-2">
        <input className="field" placeholder="ชื่อไทย" value={f.nameTh} onChange={(e) => setF({ ...f, nameTh: e.target.value })} />
        <input className="field" placeholder="ชื่อ EN" value={f.nameEn} onChange={(e) => setF({ ...f, nameEn: e.target.value })} />
        <input className="field" placeholder="key (i18n)" value={f.key} onChange={(e) => setF({ ...f, key: e.target.value })} />
        <input className="field" type="number" placeholder="ราคา" value={f.basePrice} onChange={(e) => setF({ ...f, basePrice: e.target.value })} />
        <select className="field" value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}>
          {DRINK_CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
        </select>
        <input className="field" placeholder="emoji" value={f.emoji} onChange={(e) => setF({ ...f, emoji: e.target.value })} />
        <button type="button" onClick={() => onSave(f)} className="w-full py-3 rounded-2xl font-black text-white" style={{ background: '#3d1f0f' }}>{t('save')}</button>
      </div>
    </ModalShell>
  );
}

function ToppingFormModal({ form, t, onClose, onSave }) {
  const [f, setF] = useState(form);
  return (
    <ModalShell title={t('addTopping')} onClose={onClose}>
      <input className="field" placeholder="ชื่อท็อปปิ้ง" value={f.label} onChange={(e) => setF({ ...f, label: e.target.value })} />
      <input className="field" type="number" placeholder="ราคา" value={f.price} onChange={(e) => setF({ ...f, price: e.target.value })} />
      <button type="button" onClick={() => onSave(f)} className="w-full py-3 mt-2 rounded-2xl font-black text-white" style={{ background: '#3d1f0f' }}>{t('save')}</button>
    </ModalShell>
  );
}

function OrdersSection({ t, onChanged }) {
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
                {o.createdBy || '—'} · {o.payType === 'transfer' ? 'โอน' : 'สด'}
              </p>
              <p className="font-black" style={{ color: '#3d1f0f' }}>฿{(o.total || 0).toLocaleString()}</p>
            </div>
            {(o.items || []).slice(0, 3).map((it, j) => (
              <p key={j} className="text-xs text-stone-500 truncate">{it.qty}× {it.nameSnapshot || it.nameEn}</p>
            ))}
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
        {[['cash', 'สด'], ['transfer', 'โอน']].map(([v, label]) => (
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
        <label className="text-[10px] font-bold text-stone-500 block">User ID เพิ่มเติม (คั่นด้วย comma)</label>
        <input
          className="w-full px-3 py-2.5 rounded-xl border-2 border-stone-200 text-xs font-mono outline-none"
          placeholder={t('lineUserIdsPlaceholder')}
          value={form.notifyUserIds || ''}
          onChange={(e) => setForm({ ...form, notifyUserIds: e.target.value })}
        />
        <p className="text-[10px] text-stone-400">{t('lineGroupIdHint')}</p>
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
        <p className="text-[10px] text-stone-400">{t('lineCommands')}: สรุป · สรุปวันนี้ · ปิดวัน · help</p>
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
