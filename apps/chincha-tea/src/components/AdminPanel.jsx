import { useCallback, useEffect, useState } from 'react';
import { DRINK_CATEGORIES } from '../lib/constants';
import {
  fsDelete,
  fsPatch,
  fsPost,
  fsQueryProducts,
  fsQueryToppings,
  fsQueryUsers,
} from '../lib/firestoreRest';

export function AdminPanel({ t }) {
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
      <div className="flex gap-2">
        {[['members', t('members')], ['products', t('products')]].map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setSection(id)}
            className={`flex-1 py-2.5 rounded-2xl font-bold text-xs ${section === id ? 'text-white' : 'bg-stone-200 text-stone-500'}`}
            style={section === id ? { background: '#3d1f0f' } : {}}
          >
            {label}
          </button>
        ))}
      </div>
      {loading ? (
        <p className="text-center text-stone-400 py-8">{t('loading')}</p>
      ) : section === 'members' ? (
        <MembersSection users={users} t={t} onUpdate={updateUser} />
      ) : (
        <ProductsSection
          products={products}
          toppings={toppings}
          t={t}
          onSaveProduct={saveProduct}
          onSaveTopping={saveTopping}
          onDeleteProduct={(id) => fsDelete(`products/${id}`).then(refresh)}
          onDeleteTopping={(id) => fsDelete(`toppings/${id}`).then(refresh)}
        />
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
