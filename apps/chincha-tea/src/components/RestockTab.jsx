import { useEffect, useRef, useState } from 'react';
import { ref as stRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '../firebase';
import { fsPost, fsQueryRestocks } from '../lib/firestoreRest';
import { dateKeyBangkok } from '../lib/constants';

export function RestockTab({ member, t }) {
  const [items, setItems] = useState([]);
  const [recentRequests, setRecentRequests] = useState([]);
  const [input, setInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [flash, setFlash] = useState('');
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef(null);
  const dateKey = dateKeyBangkok();

  useEffect(() => {
    fsQueryRestocks(20).then(setRecentRequests).catch(() => {});
  }, []);

  const STATUS_CFG = [
    { key: 'normal', label: t('statusNormal'), active: 'bg-emerald-100 text-emerald-700 border-emerald-300' },
    { key: 'low', label: t('statusLow'), active: 'bg-amber-100 text-amber-700 border-amber-300' },
    { key: 'out', label: t('statusOut'), active: 'bg-red-100 text-red-600 border-red-300' },
  ];

  const addItem = () => {
    const name = input.trim();
    if (!name) return;
    setItems((prev) => [...prev, { cid: Date.now(), name, qty: 1, status: 'out' }]);
    setInput('');
  };

  const uploadOrderPhoto = async (file) => {
    if (!file || !storage) {
      alert(t('storageNotReady'));
      return;
    }
    setUploading(true);
    try {
      const ext = file.name?.split('.').pop() || 'jpg';
      const path = `orders/${dateKey}/${member?.uid || 'anon'}_${Date.now()}.${ext}`;
      const r = stRef(storage, path);
      await uploadBytes(r, file, { contentType: file.type || 'image/jpeg' });
      const url = await getDownloadURL(r);
      await fsPost('orderSlips', {
        dateKey,
        storagePath: path,
        downloadUrl: url,
        uploadedBy: member?.name || member?.email || 'staff',
        uid: member?.uid || '',
        createdAt: new Date().toISOString(),
      });
      setFlash(t('uploadOk'));
      setTimeout(() => setFlash(''), 3000);
    } catch (e) {
      console.error(e);
      alert(t('uploadFailed'));
    }
    setUploading(false);
  };

  const handleSubmit = async () => {
    if (!items.length) return;
    setSaving(true);
    try {
      await fsPost('restocks', {
        dateKey,
        uid: member?.uid || 'unknown',
        createdBy: member?.name || 'ชินชา',
        items: items.map((i) => ({ name: i.name, qty: i.qty, status: i.status })),
        createdAt: new Date().toISOString(),
      });
      setItems([]);
      setFlash('✅ ส่งรายการแล้ว!');
      setRecentRequests(await fsQueryRestocks(20));
      setTimeout(() => setFlash(''), 3000);
    } catch (e) {
      console.error(e);
    }
    setSaving(false);
  };

  return (
    <div className="px-4 pt-3 pb-8 space-y-4">
      {flash && (
        <div className="py-3 rounded-2xl text-center font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 text-sm">{flash}</div>
      )}

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
                <p className="flex-1 font-bold text-sm">{item.name}</p>
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
            {recentRequests.map((req) => (
              <div key={req.id} className="bg-white rounded-2xl p-3 border border-stone-200">
                <p className="text-[10px] text-stone-400 mb-1">{req.createdBy || '—'} · {(req.items || []).length} รายการ</p>
                {(req.items || []).map((it, i) => (
                  <p key={i} className="text-xs text-stone-600">
                    {it.name} ×{it.qty}
                    <span className={`ml-1 text-[10px] font-bold ${it.status === 'out' ? 'text-red-500' : it.status === 'low' ? 'text-amber-600' : 'text-emerald-600'}`}>
                      {it.status === 'out' ? t('statusOut') : it.status === 'low' ? t('statusLow') : t('statusNormal')}
                    </span>
                  </p>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
