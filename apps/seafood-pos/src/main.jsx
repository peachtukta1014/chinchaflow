import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  addDoc, collection, doc, getDoc, getDocs, increment, limit,
  onSnapshot, orderBy, query, serverTimestamp, setDoc, where,
} from 'firebase/firestore';
import { ref as stRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import {
  Bell, Camera, CheckCircle, ChevronRight, Delete, Edit3,
  Home, LogOut, MapPin, Mic, MicOff, Package, PlusCircle,
  ShoppingCart, Users, X,
} from 'lucide-react';
import { auth, db, storage, isFirebaseReady } from './firebase';
import { dateKeyBangkok, tomorrowDateKeyBangkok } from './lib/date';
import {
  hasVoiceCommitCommand,
  isVoiceOrderComplete,
  parseShrimpVoice,
} from './lib/voiceParse';
import { ADMIN_EMAIL, CUSTOMERS, PAY, PRODUCTS } from './constants';
import {
  FS_BASE,
  fsAuthHeaders,
  fsIncrementDebt,
  fsObj,
  fsPatch,
  fsPost,
  fsRunQuery,
  fsSetStockDoc,
} from './lib/firestoreRest';
import { useVoice } from './hooks/useVoice';

// ─── App (Auth Shell) ─────────────────────────────────────────────────────────

function App() {
  const [member, setMember]         = useState(undefined);
  const [activeTab, setActiveTab]   = useState('pos');
  const [stock, setStock]           = useState({ live: 0, dead: 0 });
  const [transactions, setTransactions] = useState([]);
  const [pendingOrders, setPendingOrders] = useState(0);

  // Session restore via Firebase Auth persistence
  useEffect(() => {
    if (!auth) { setMember(null); return; }
    return onAuthStateChanged(auth, async (user) => {
      if (!user) { setMember(null); return; }
      try {
        const token = await user.getIdToken();
        const resp = await fetch(`${FS_BASE}/shrimp_users/${user.uid}`, { headers: { Authorization: `Bearer ${token}` } });
        if (!resp.ok) { await signOut(auth); return; }
        const json = await resp.json();
        const f = json.fields || {};
        if (!f.approved?.booleanValue) { await signOut(auth); return; }
        setMember({ uid: user.uid, name: f.name?.stringValue || 'สมาชิก', email: user.email || '', role: f.role?.stringValue || 'staff' });
      } catch { setMember(null); }
    });
  }, []);

  // Real-time shared stock
  useEffect(() => {
    if (!db || !member) return;
    return onSnapshot(doc(db, 'config', 'stock'), snap => { if (snap.exists()) setStock(snap.data()); }, () => {});
  }, [member]);

  // Badge: pending LINE orders
  useEffect(() => {
    if (!member || !import.meta.env.VITE_FIREBASE_PROJECT_ID) return;
    const today = dateKeyBangkok();
    const load = async () => {
      const rows = await fsRunQuery({ from: [{ collectionId: 'lineOrders' }], where: { compositeFilter: { op: 'AND', filters: [
        { fieldFilter: { field: { fieldPath: 'deliveryDate' }, op: 'GREATER_THAN_OR_EQUAL', value: { stringValue: today } } },
        { fieldFilter: { field: { fieldPath: 'status' }, op: 'EQUAL', value: { stringValue: 'pending' } } },
      ]}} });
      setPendingOrders(rows.length);
    };
    load();
    const t = setInterval(load, 30000);
    return () => clearInterval(t);
  }, [member]);

  const handleLogin  = (m) => setMember(m);
  const handleLogout = async () => {
    if (!window.confirm('ออกจากระบบ?')) return;
    if (auth) await signOut(auth).catch(() => {});
  };

  const updateMainStock = async (live, dead) => {
    const val = {
      live: Math.max(0, parseFloat(Number(live).toFixed(3))),
      dead: Math.max(0, parseFloat(Number(dead).toFixed(3))),
    };
    setStock(val);
    const payload = { ...val, updatedAt: new Date().toISOString() };
    try {
      if (isFirebaseReady) await fsSetStockDoc(payload);
    } catch (e) {
      console.warn('fsSetStockDoc', e);
      if (db) {
        setDoc(doc(db, 'config', 'stock'), { ...val, updatedAt: serverTimestamp() }, { merge: true }).catch(console.error);
      }
    }
  };

  if (member === undefined) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-white text-center">
          <img src="/logo.jpg" alt="โกอ้วน คลังซีฟู้ด" className="w-32 h-32 object-contain mx-auto mb-3 rounded-2xl shadow-2xl" />
          <p className="text-slate-400 text-sm">กำลังโหลด...</p>
        </div>
      </div>
    );
  }

  if (!member) return <LoginScreen onLogin={handleLogin} />;

  const isAdmin = member.role === 'admin';

  return (
    <div className="bg-slate-50 h-screen font-sans max-w-md mx-auto relative shadow-2xl overflow-hidden flex flex-col">
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-0">
        <img src="/logo.jpg" alt="" className="w-72 h-72 object-contain opacity-[0.04]" />
      </div>

      {/* Header */}
      <div className="bg-slate-900 text-white z-10 shrink-0">
        <div className="px-4 pt-6 pb-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/logo.jpg" alt="KOSEAFOOD" className="w-10 h-10 rounded-xl object-cover border border-slate-700 shrink-0" />
            <div>
              <p className="text-sm font-black text-white leading-none">โกอ้วน คลังซีฟู้ด</p>
              <p className="text-[10px] text-slate-400 mt-0.5 truncate max-w-[160px]">
                {member.name}
                {isAdmin && <span className="ml-1.5 text-purple-400">· แอดมิน</span>}
              </p>
            </div>
          </div>
          <button onClick={handleLogout}
            className="w-10 h-10 rounded-full bg-slate-800 border-2 border-slate-700 flex items-center justify-center text-slate-400 active:scale-95">
            <LogOut size={18} />
          </button>
        </div>
        {/* Admin tabs row */}
        {isAdmin && (
          <div className="px-4 pb-3 flex gap-2">
            {[['admin-users','👥 สมาชิก'],['admin-products','⚙️ ตั้งค่าสินค้า']].map(([t,label]) => (
              <button key={t} onClick={() => setActiveTab(t)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${activeTab===t ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-300'}`}>
                {label}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto pb-24" style={{ scrollbarWidth: 'none' }}>
        {activeTab === 'home'           && <Dashboard stock={stock} />}
        {activeTab === 'pos'            && <POSMobile user={member} stock={stock} updateMainStock={updateMainStock} onSaveBill={b => setTransactions([b,...transactions])} />}
        {activeTab === 'stock'          && <InventoryScreen stock={stock} updateMainStock={updateMainStock} />}
        {activeTab === 'members'        && <MembersScreen />}
        {activeTab === 'orders'         && <LineOrdersScreen onNewOrder={() => setActiveTab('orders')} />}
        {activeTab === 'admin-users'    && <AdminUsersScreen />}
        {activeTab === 'admin-products' && <ProductSettingsScreen />}
      </div>

      <div className="absolute bottom-0 left-0 right-0 bg-white border-t border-slate-200 flex justify-around p-2 z-50 rounded-t-2xl"
        style={{ paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))' }}>
        <NavButton icon={<ShoppingCart />} label="ขายของ"    isActive={activeTab === 'pos'}     onClick={() => setActiveTab('pos')} />
        <NavButton icon={<Home />}         label="ภาพรวม"    isActive={activeTab === 'home'}    onClick={() => setActiveTab('home')} />
        <NavButton icon={<Package />}      label="รับสต๊อก" isActive={activeTab === 'stock'}   onClick={() => setActiveTab('stock')} />
        <NavButton icon={<Bell />}         label="ออเดอร์"   isActive={activeTab === 'orders'}  onClick={() => setActiveTab('orders')} badge={pendingOrders} />
        <NavButton icon={<Users />}        label="ลูกค้า"    isActive={activeTab === 'members'} onClick={() => setActiveTab('members')} />
      </div>

      <style>{`
        select optgroup { font-weight: 700; color: #475569; background: #f8fafc; }
        select option   { font-weight: 500; color: #0f172a; }
      `}</style>
    </div>
  );
}

// ─── Login / Register Screen ──────────────────────────────────────────────────

function LoginScreen({ onLogin }) {
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [name,     setName]     = useState('');
  const [mode,     setMode]     = useState('login'); // 'login' | 'register' | 'pending'
  const [error,    setError]    = useState('');
  const [loading,  setLoading]  = useState(false);


  const handleSubmit = async () => {
    if (!email.trim() || !password) { setError('กรุณากรอก Email และ Password'); return; }
    if (mode === 'register' && !name.trim()) { setError('กรุณากรอกชื่อเล่น'); return; }
    if (!auth) { setError('Firebase ยังไม่พร้อม'); return; }
    setLoading(true); setError('');
    try {
      if (mode === 'register') {
        const { user } = await createUserWithEmailAndPassword(auth, email.trim(), password);
        const token    = await user.getIdToken();
        const authH    = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
        const listJson = await fetch(`${FS_BASE}/shrimp_users?pageSize=1`, { headers: authH }).then(r => r.json());
        const isFirst  = !listJson.documents?.length;
        const isAdminEmail = email.trim().toLowerCase() === ADMIN_EMAIL.toLowerCase();
        const grantAdmin   = isFirst || isAdminEmail;
        await fetch(`${FS_BASE}/shrimp_users/${user.uid}`, {
          method: 'PATCH', headers: authH,
          body: JSON.stringify({ fields: {
            name:      { stringValue: name.trim() },
            email:     { stringValue: email.trim() },
            role:      { stringValue: grantAdmin ? 'admin' : 'staff' },
            approved:  { booleanValue: grantAdmin },
            createdAt: { stringValue: new Date().toISOString() },
          }}),
        });
        if (!grantAdmin) { await signOut(auth); setMode('pending'); return; }
        onLogin({ uid: user.uid, name: name.trim(), email: email.trim(), role: 'admin' });
      } else {
        const { user } = await signInWithEmailAndPassword(auth, email.trim(), password);
        const token    = await user.getIdToken();
        const authH    = { Authorization: `Bearer ${token}` };
        const resp = await fetch(`${FS_BASE}/shrimp_users/${user.uid}`, { headers: authH });
        if (!resp.ok) throw new Error('ไม่พบข้อมูลสมาชิก กรุณาสมัครสมาชิกก่อน');
        const f = (await resp.json()).fields || {};
        if (!f.approved?.booleanValue) { await signOut(auth); setMode('pending'); return; }
        onLogin({ uid: user.uid, name: f.name?.stringValue || 'สมาชิก', email: email.trim(), role: f.role?.stringValue || 'staff' });
      }
    } catch (e) {
      const c = e.code || '';
      if (c.includes('email-already-in-use'))                       setError('Email นี้ถูกใช้แล้ว');
      else if (c.includes('wrong-password') || c.includes('invalid-credential')) setError('Email หรือ Password ไม่ถูกต้อง');
      else if (c.includes('user-not-found'))                        setError('ไม่พบบัญชีนี้ กรุณาสมัครสมาชิกก่อน');
      else if (c.includes('weak-password'))                         setError('Password ต้องมีอย่างน้อย 6 ตัวอักษร');
      else setError(e?.message || 'เชื่อมต่อไม่ได้');
    } finally { setLoading(false); }
  };

  if (mode === 'pending') {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-6 text-white max-w-md mx-auto">
        <img src="/logo.jpg" alt="" className="w-28 h-28 rounded-3xl mb-6 shadow-2xl" />
        <div className="bg-yellow-500/20 border border-yellow-500/40 rounded-2xl p-6 text-center w-full">
          <p className="text-4xl mb-3">⏳</p>
          <p className="text-yellow-300 font-bold text-lg">รอการอนุมัติ</p>
          <p className="text-slate-400 text-sm mt-2">แอดมินจะอนุมัติสิทธิ์ให้เร็วๆ นี้ครับ</p>
          <p className="text-slate-500 text-xs mt-1">{email}</p>
        </div>
        <button onClick={() => { setMode('login'); setEmail(''); setPassword(''); setName(''); }}
          className="mt-6 text-slate-400 text-sm underline">ย้อนกลับ</button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col justify-center items-center p-6 text-white max-w-md mx-auto relative overflow-hidden">
      <div className="absolute top-[-10%] left-[-20%] w-64 h-64 bg-blue-600 rounded-full filter blur-3xl opacity-40" />
      <div className="absolute top-[20%] right-[-10%] w-64 h-64 bg-cyan-400 rounded-full filter blur-3xl opacity-40" />

      <div className="relative z-10 w-full text-center mb-10">
        <img src="/logo.jpg" alt="โกอ้วน คลังซีฟู้ด" className="w-44 h-44 object-contain mx-auto mb-4 rounded-3xl shadow-2xl drop-shadow-[0_0_30px_rgba(96,165,250,0.3)]" />
        <h1 className="text-2xl font-black text-white mb-1">โกอ้วน คลังซีฟู้ด</h1>
        <p className="text-slate-400 text-sm font-medium tracking-wide">ระบบจัดการสต๊อกและจุดขาย</p>
      </div>

      <div className="relative z-10 w-full space-y-3">
        {mode === 'register' && (
          <input value={name} onChange={e => setName(e.target.value)}
            placeholder="ชื่อเล่น"
            className="w-full bg-slate-800 border border-slate-700 text-white placeholder-slate-500 rounded-2xl px-4 py-4 text-base focus:outline-none focus:border-blue-500" />
        )}
        <input value={email} onChange={e => setEmail(e.target.value)}
          placeholder="Email" type="email" inputMode="email"
          className="w-full bg-slate-800 border border-slate-700 text-white placeholder-slate-500 rounded-2xl px-4 py-4 text-base focus:outline-none focus:border-blue-500" />
        <input value={password} onChange={e => setPassword(e.target.value)}
          placeholder="Password" type="password"
          onKeyDown={e => e.key === 'Enter' && handleSubmit()}
          className="w-full bg-slate-800 border border-slate-700 text-white placeholder-slate-500 rounded-2xl px-4 py-4 text-base focus:outline-none focus:border-blue-500" />

        {error && <p className="text-red-400 text-sm text-center">{error}</p>}

        <button onClick={handleSubmit} disabled={loading}
          className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-4 rounded-2xl shadow-lg active:scale-95 transition-all disabled:opacity-50">
          {loading ? 'กำลังตรวจสอบ...' : mode === 'register' ? 'สมัครสมาชิก' : 'เข้าสู่ระบบ'}
        </button>

        <button onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(''); }}
          className="w-full text-slate-400 text-sm py-2">
          {mode === 'login' ? 'ยังไม่มีบัญชี? → สมัครสมาชิก' : 'มีบัญชีแล้ว? → เข้าสู่ระบบ'}
        </button>

        {!isFirebaseReady && <p className="text-yellow-400 text-xs text-center">⚠️ Firebase config ยังไม่ครบ</p>}
      </div>
    </div>
  );
}

// ─── Members Screen (approve/reject pending members) ─────────────────────────

function MembersScreen() {
  const [fsCustomers, setFsCustomers] = useState({});
  const [cusLoading, setCusLoading]   = useState(true);
  const [cusEditId, setCusEditId]     = useState(null);
  const [cusEditData, setCusEditData] = useState({ name: '', zone: '', phone: '' });
  const [showAdd, setShowAdd]         = useState(false);
  const [newCus, setNewCus]           = useState({ name: '', zone: '', phone: '' });

  useEffect(() => {
    if (!db) { setCusLoading(false); return; }
    return onSnapshot(collection(db, 'customers'), snap => {
      const map = {};
      snap.docs.forEach(d => { map[d.id] = { id: d.id, ...d.data() }; });
      setFsCustomers(map);
      setCusLoading(false);
    }, () => setCusLoading(false));
  }, []);

  const allCustomers = [
    ...CUSTOMERS.map(c => ({ ...c, ...(fsCustomers[c.id] || {}) })),
    ...Object.values(fsCustomers).filter(c => !CUSTOMERS.find(b => b.id === c.id)),
  ];

  const [saveFlash, setSaveFlash] = useState('');
  const showFlash = (msg) => { setSaveFlash(msg); setTimeout(() => setSaveFlash(''), 3000); };

  const saveCusEdit = async (id) => {
    if (!cusEditData.name.trim()) return;
    try {
      await setDoc(doc(db, 'customers', id), {
        name: cusEditData.name.trim(), zone: cusEditData.zone.trim(), phone: cusEditData.phone.trim(),
      }, { merge: true });
      setCusEditId(null);
      showFlash('✅ บันทึกสำเร็จแล้วครับ');
    } catch (e) {
      showFlash('❌ บันทึกไม่สำเร็จ: ' + (e?.message || 'ลองใหม่'));
    }
  };

  const addCustomer = async () => {
    if (!newCus.name.trim()) return;
    await setDoc(doc(db, 'customers', `cx_${Date.now()}`), {
      name: newCus.name.trim(), zone: newCus.zone.trim(), phone: newCus.phone.trim(),
      createdAt: serverTimestamp(),
    });
    setNewCus({ name: '', zone: '', phone: '' });
    setShowAdd(false);
    showFlash('✅ เพิ่มลูกค้าสำเร็จแล้วครับ');
  };

  return (
    <div className="p-4 space-y-4">
      {saveFlash && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 bg-emerald-600 text-white text-sm font-bold px-6 py-3 rounded-2xl shadow-2xl whitespace-nowrap">
          {saveFlash}
        </div>
      )}
      <>
          <div className="flex items-center justify-between">
            <h2 className="text-base font-black text-slate-800">รายชื่อลูกค้า</h2>
            <button onClick={() => setShowAdd(v => !v)}
              className="bg-blue-600 text-white text-xs font-bold px-3 py-2 rounded-xl flex items-center gap-1.5 active:scale-95">
              <PlusCircle size={14} /> เพิ่มลูกค้า
            </button>
          </div>
          {showAdd && (
            <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 space-y-2">
              <p className="text-xs font-bold text-blue-600 mb-1">เพิ่มลูกค้าใหม่</p>
              <input value={newCus.name} onChange={e => setNewCus(p => ({ ...p, name: e.target.value }))}
                placeholder="ชื่อลูกค้า *" autoFocus
                className="w-full bg-white border border-blue-200 rounded-xl px-3 py-2 text-sm font-bold outline-none" />
              <input value={newCus.zone} onChange={e => setNewCus(p => ({ ...p, zone: e.target.value }))}
                placeholder="โซน (เช่น ป่าตอง)"
                className="w-full bg-white border border-blue-200 rounded-xl px-3 py-2 text-sm outline-none" />
              <input value={newCus.phone} onChange={e => setNewCus(p => ({ ...p, phone: e.target.value }))}
                placeholder="เบอร์โทร (ถ้ามี)" type="tel"
                className="w-full bg-white border border-blue-200 rounded-xl px-3 py-2 text-sm outline-none" />
              <div className="flex gap-2 pt-1">
                <button onClick={addCustomer}
                  className="flex-1 bg-blue-600 text-white text-sm font-bold py-2 rounded-xl active:scale-95">บันทึก</button>
                <button onClick={() => { setShowAdd(false); setNewCus({ name: '', zone: '', phone: '' }); }}
                  className="flex-1 bg-white border border-slate-200 text-slate-500 text-sm font-bold py-2 rounded-xl">ยกเลิก</button>
              </div>
            </div>
          )}
          {cusLoading
            ? <p className="text-slate-400 text-sm text-center py-8">กำลังโหลด...</p>
            : (
              <div className="space-y-2">
                {allCustomers.map(c => (
                  <div key={c.id} className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
                    {cusEditId === c.id ? (
                      <div className="space-y-2">
                        <input value={cusEditData.name} onChange={e => setCusEditData(p => ({ ...p, name: e.target.value }))}
                          placeholder="ชื่อลูกค้า" autoFocus
                          className="w-full border border-blue-400 rounded-xl px-3 py-2 text-sm font-bold outline-none" />
                        <input value={cusEditData.zone} onChange={e => setCusEditData(p => ({ ...p, zone: e.target.value }))}
                          placeholder="โซน"
                          className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none" />
                        <input value={cusEditData.phone} onChange={e => setCusEditData(p => ({ ...p, phone: e.target.value }))}
                          placeholder="เบอร์โทร" type="tel"
                          className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none" />
                        <div className="flex gap-2">
                          <button onClick={() => saveCusEdit(c.id)}
                            className="flex-1 bg-blue-600 text-white text-xs font-bold py-2 rounded-xl active:scale-95">บันทึก</button>
                          <button onClick={() => setCusEditId(null)}
                            className="flex-1 border border-slate-200 text-slate-400 text-xs font-bold py-2 rounded-xl">ยกเลิก</button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-slate-800 truncate">{c.name}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            {c.zone && <span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">{c.zone}</span>}
                            {c.phone && <span className="text-[10px] text-slate-400">{c.phone}</span>}
                          </div>
                        </div>
                        <button onClick={() => { setCusEditId(c.id); setCusEditData({ name: c.name, zone: c.zone || '', phone: c.phone || '' }); }}
                          className="text-xs text-blue-500 border border-blue-200 px-3 py-1.5 rounded-lg ml-2 shrink-0">แก้ไข</button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )
          }
      </>
    </div>
  );
}

// ─── POS Screen ───────────────────────────────────────────────────────────────

const POSMobile = ({ user, stock, updateMainStock, onSaveBill }) => {
  const [selectedCustomer, setSelectedCustomer] = useState('general');
  const [fsCustomers, setFsCustomers] = useState({});
  const [cart, setCart]             = useState([]);
  const [selectedProduct, setSelectedProduct] = useState(PRODUCTS[0].id);
  const [weight, setWeight]         = useState('');
  const [customPrice, setCustomPrice] = useState(PRODUCTS[0].price.toString());
  const [loadedPrices, setLoadedPrices] = useState({});
  const [note, setNote]             = useState('');
  const [inputMode, setInputMode]   = useState('weight');
  const [saving, setSaving]         = useState(false);
  const [paymentType, setPaymentType] = useState('cash');
  const [paidAmount, setPaidAmount] = useState('');
  const [photoUrl, setPhotoUrl]     = useState(null);
  const [photoUploading, setPhotoUploading] = useState(false);
  const photoInputRef = useRef(null);
  const billNoRef     = useRef(`INV-${Date.now().toString().slice(-8)}`);

  const allCustomers = useMemo(() => [
    ...CUSTOMERS.map(c => ({ ...c, ...(fsCustomers[c.id] || {}) })),
    ...Object.values(fsCustomers).filter(c => !CUSTOMERS.find(b => b.id === c.id)),
  ], [fsCustomers]);

  const activeProduct    = PRODUCTS.find(p => p.id === selectedProduct);
  const isDeadShrimp     = activeProduct?.type === 'dead';
  const currentItemTotal = isDeadShrimp
    ? (parseFloat(customPrice) || 0)
    : (parseFloat(weight) || 0) * (parseFloat(customPrice) || 0);
  const cartTotal = cart.reduce((s, i) => s + i.total, 0);

  const paidAmt = paymentType === 'cash' || paymentType === 'transfer'
    ? cartTotal
    : paymentType === 'credit' ? 0 : (parseFloat(paidAmount) || 0);
  const remaining = cartTotal - paidAmt;

  const [voiceResult, setVoiceResult] = useState('');
  const voiceTimerRef = useRef(null);

  const handlePhotoChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoUploading(true);
    try {
      if (storage) {
        const r = stRef(storage, `billPhotos/${billNoRef.current}.jpg`);
        await uploadBytes(r, file);
        setPhotoUrl(await getDownloadURL(r));
      }
    } catch { }
    finally { setPhotoUploading(false); }
  };

  useEffect(() => {
    if (!db) return;
    return onSnapshot(collection(db, 'customers'), snap => {
      const map = {};
      snap.docs.forEach(d => { map[d.id] = { id: d.id, ...d.data() }; });
      setFsCustomers(map);
    }, () => {});
  }, []);

  useEffect(() => {
    fsAuthHeaders().then(h => fetch(`${FS_BASE}/productSettings/shrimp`, { headers: h }))
      .then(r => r.ok ? r.json() : null)
      .then(j => {
        if (!j?.fields) return;
        const p = {};
        ['large','medium','small'].forEach(k => {
          const v = j.fields[k];
          if (v) p[k] = parseInt(v.integerValue ?? v.doubleValue ?? 0);
        });
        setLoadedPrices(p);
      })
      .catch(() => {});
  }, []);

  const priceOf = (productId) => loadedPrices[productId] ?? PRODUCTS.find(p => p.id === productId)?.price ?? 0;

  const handleProductChange = (productId) => {
    setSelectedProduct(productId);
    const prod = PRODUCTS.find(p => p.id === productId);
    setWeight(''); setNote('');
    if (prod.type === 'dead') { setCustomPrice(''); setInputMode('price'); }
    else { setCustomPrice(priceOf(productId).toString()); setInputMode('weight'); }
  };

  const handleNumpad = (num) => {
    if (inputMode === 'weight') {
      if (num === '.' && weight.includes('.')) return;
      setWeight(p => p + num);
    } else {
      if (num === '.' && customPrice.includes('.')) return;
      setCustomPrice(p => p + num);
    }
  };

  const addToCart = () => {
    if (!isDeadShrimp && !weight) return alert('ใส่น้ำหนักก่อนนะครับ');
    if (!customPrice) return alert('ใส่ราคาก่อนครับ');
    setCart([...cart, {
      id: Date.now(), productId: activeProduct.id, productName: activeProduct.name,
      type: activeProduct.type, weight: parseFloat(weight) || 0,
      pricePerKg: isDeadShrimp ? 0 : parseFloat(customPrice),
      total: currentItemTotal, note,
    }]);
    setWeight(''); setNote('');
    if (!isDeadShrimp) setCustomPrice(priceOf(activeProduct.id).toString());
    setInputMode('weight');
  };

  const saveBillWithCart = async (cartItems) => {
    if (cartItems.length === 0 || saving) return;
    if (paymentType === 'installment' && !paidAmount) { alert('ใส่จำนวนเงินที่ผ่อนมาด้วยครับ'); return; }
    const liveKg = cartItems.reduce((s, i) => i.type !== 'dead' ? s + i.weight : s, 0);
    const deadKg = cartItems.reduce((s, i) => i.type === 'dead' ? s + i.weight : s, 0);
    if (liveKg > stock.live) { alert(`⚠️ กุ้งเป็นในสต๊อกมีแค่ ${stock.live} กก.\nขายเกินสต๊อกไม่ได้ครับ`); return; }
    if (deadKg > stock.dead) { alert(`⚠️ กุ้งตายในสต๊อกมีแค่ ${stock.dead} กก.\nขายเกินสต๊อกไม่ได้ครับ`); return; }
    const total = cartItems.reduce((s, i) => s + i.total, 0);
    const paidA = paymentType === 'cash' || paymentType === 'transfer' ? total : paymentType === 'credit' ? 0 : (parseFloat(paidAmount) || 0);
    const remain = total - paidA;
    const customer = allCustomers.find(c => c.id === selectedCustomer) || CUSTOMERS.find(c => c.id === selectedCustomer);
    const billData = {
      billNo: billNoRef.current,
      customerName: customer.name, customerId: selectedCustomer, zone: customer.zone,
      items: cartItems, total,
      paymentType, paidAmount: paidA, remainingAmount: remain,
      photoUrl: photoUrl || null,
      timestamp: new Date().toLocaleTimeString('th-TH'),
      recordedBy: user.name,
    };
    setSaving(true);
    try {
      if (isFirebaseReady) {
        const dateKey = dateKeyBangkok();
        const now = new Date().toISOString();
        const withTimeout = (p) => Promise.race([p, new Promise((_, r) => setTimeout(() => r(new Error('timeout')), 10000))]);
        await withTimeout(fsPost('sales', {
          ...billData,
          dateKey,
          items: cartItems.map(i => ({
            productId: i.productId, productName: i.productName, type: i.type,
            weightKg: i.weight, pricePerKg: i.pricePerKg, lineTotal: i.total, note: i.note || '',
          })),
          createdAt: now, source: 'koseafood-pos',
        }));
        if (remain > 0) {
          await withTimeout(fsIncrementDebt(selectedCustomer, {
            customerId: selectedCustomer, customerName: customer.name, zone: customer.zone,
            lastBillNo: billNoRef.current, lastUpdated: now,
          }, remain));
        }
      }
      updateMainStock(Math.max(0, stock.live - liveKg), Math.max(0, stock.dead - deadKg));
      onSaveBill(billData);
      const payLabel = PAY.find(p => p.id === paymentType)?.label || paymentType;
      alert(`✅ บันทึกบิลสำเร็จ!\nยอด: ฿${total.toLocaleString()} | ${payLabel}${remain > 0 ? `\nค้าง ฿${remain.toLocaleString()}` : ''}`);
      setCart([]); setSelectedCustomer('general');
      setPaymentType('cash'); setPaidAmount('');
      setPhotoUrl(null);
      billNoRef.current = `INV-${Date.now().toString().slice(-8)}`;
    } catch (err) {
      console.error(err);
      alert('⚠️ บันทึกไม่สำเร็จ กรุณาลองอีกครั้งครับ');
    } finally {
      setSaving(false);
    }
  };
  const handleSaveBill = () => saveBillWithCart(cart);

  const cartRef = useRef(cart);
  cartRef.current = cart;

  const applyVoiceDraft = (draft) => {
    if (draft.customerId) setSelectedCustomer(draft.customerId);
    if (draft.productId) {
      const prod = PRODUCTS.find((p) => p.id === draft.productId);
      setSelectedProduct(draft.productId);
      setNote('');
      if (prod?.type === 'dead') {
        setCustomPrice(draft.weight != null ? String(draft.weight) : '');
        setWeight('');
        setInputMode('price');
      } else {
        setCustomPrice(String(priceOf(draft.productId)));
        setInputMode('weight');
        setWeight(draft.weight != null ? String(draft.weight) : '');
      }
    } else if (draft.weight != null) {
      const prod = PRODUCTS.find((p) => p.id === selectedProduct);
      if (prod?.type === 'dead') setCustomPrice(String(draft.weight));
      else setWeight(String(draft.weight));
    }
  };

  const buildCartItemsFromVoice = (complete) => complete.map((o) => {
    const prod = PRODUCTS.find((p) => p.id === o.productId);
    if (!prod) return null;
    const w = parseFloat(o.weight) || 0;
    const ppk = prod.type === 'dead' ? 0 : priceOf(prod.id);
    const total = prod.type === 'dead' ? w : w * ppk;
    return {
      id: Date.now() + Math.random(),
      productId: prod.id,
      productName: prod.name,
      type: prod.type,
      weight: w,
      pricePerKg: ppk,
      total,
      note: '',
    };
  }).filter(Boolean);

  const onVoiceText = (text) => {
    setVoiceResult(text);
    clearTimeout(voiceTimerRef.current);
    voiceTimerRef.current = setTimeout(() => setVoiceResult(''), 6000);
    const parsed = parseShrimpVoice(text, allCustomers, selectedCustomer);
    const complete = parsed.filter(isVoiceOrderComplete);
    const commit = hasVoiceCommitCommand(text);

    if (complete.length > 0) {
      applyVoiceDraft(complete[complete.length - 1]);
      const newItems = buildCartItemsFromVoice(complete);
      if (newItems.length) {
        setSelectedCustomer(complete[0].customerId);
        if (commit) {
          saveBillWithCart([...cartRef.current, ...newItems]);
          setVoiceResult(`${text} · ✅ บันทึกแล้ว`);
        } else {
          setCart((prev) => [...prev, ...newItems]);
          setVoiceResult(`${text} · ✅ เพิ่ม ${newItems.length} รายการ`);
        }
      }
      return;
    }

    if (parsed.length > 0) {
      applyVoiceDraft(parsed[0]);
      const miss = [];
      if (!parsed[0].productId) miss.push('ขนาดกุ้ง (ใหญ่/กลาง/เล็ก/ตาย)');
      if (!parsed[0].weight) miss.push('น้ำหนัก (กก.)');
      setVoiceResult(miss.length ? `${text} · ยังขาด: ${miss.join(', ')}` : `${text} · ตรวจสอบแล้วกด + เพิ่มตะกร้า`);
      return;
    }

    const m = text.match(/\d+(?:\.\d+)?/);
    if (m) {
      if (inputMode === 'weight') setWeight(m[0]);
      else setCustomPrice(m[0]);
      setVoiceResult(`${text} · ใส่ตัวเลขในช่องที่เลือก`);
    } else {
      setVoiceResult(`${text} · ลอง: "กุ้งใหญ่ 2 กิโล" หรือ "จ๊ะขียด กุ้งกลาง 1.5 กก."`);
    }
  };

  const { listening: voiceListen, toggle: toggleVoice, liveText } = useVoice(onVoiceText);

  const groupedCustomers = allCustomers.reduce((acc, c) => {
    const zone = c.zone || 'อื่นๆ';
    if (!acc[zone]) acc[zone] = [];
    acc[zone].push(c);
    return acc;
  }, {});

  return (
    <div className="flex flex-col bg-slate-100" style={{ minHeight: 'calc(100vh - 120px)' }}>
      <div className="bg-white p-4 rounded-b-3xl shadow-sm z-10">
        {/* Customer selector */}
        <div className="flex items-center bg-slate-50 rounded-2xl p-2 border border-slate-200 mb-3">
          <MapPin className="text-blue-500 ml-2 shrink-0" size={20} />
          <select value={selectedCustomer} onChange={e => setSelectedCustomer(e.target.value)}
            className="bg-transparent text-slate-800 w-full outline-none p-2 font-bold text-base">
            {Object.keys(groupedCustomers).map(zone => (
              <optgroup key={zone} label={`── ${zone} ──`}>
                {groupedCustomers[zone].map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </optgroup>
            ))}
          </select>
          <ChevronRight className="text-slate-400 mr-2 shrink-0" size={20} />
        </div>

        {/* Cart items */}
        {cart.length > 0 && (
          <div className="max-h-40 overflow-y-auto mb-3 space-y-2 border-t border-slate-100 pt-3">
            {cart.map((item, idx) => (
              <div key={item.id} className="flex justify-between items-center bg-slate-50 p-3 rounded-2xl border border-slate-200">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-slate-800">{idx + 1}. {item.productName}</p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {item.weight} กก.{item.type === 'live' ? ` × ฿${item.pricePerKg}` : ' (เหมา)'}
                    {item.note && <span className="text-orange-500 ml-1">*{item.note}</span>}
                  </p>
                </div>
                <div className="flex items-center gap-2 ml-2">
                  <p className="font-bold text-blue-600">฿{item.total.toLocaleString()}</p>
                  <button onClick={() => setCart(cart.filter(i => i.id !== item.id))}
                    className="text-red-400 bg-red-50 p-1.5 rounded-full"><X size={14} /></button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Payment type row */}
        {cart.length > 0 && (
          <div className="border-t border-slate-100 pt-3 space-y-2 mb-2">
            <div className="flex gap-2">
              {PAY.map(pt => (
                <button key={pt.id}
                  onClick={() => { setPaymentType(pt.id); if (pt.id !== 'installment') setPaidAmount(''); }}
                  className={`flex-1 py-2 rounded-xl font-bold text-xs transition-all ${
                    paymentType === pt.id ? pt.cls + ' text-white shadow-md' : 'bg-slate-100 text-slate-500'
                  }`}>{pt.label}</button>
              ))}
            </div>
            {paymentType === 'installment' && (
              <input type="number" inputMode="decimal" value={paidAmount}
                onChange={e => setPaidAmount(e.target.value)} placeholder="จ่ายมาแล้ว (฿)"
                className="w-full p-3 bg-purple-50 border border-purple-200 rounded-2xl text-base font-bold outline-none" />
            )}
            {remaining > 0 && (
              <p className="text-xs text-orange-500 font-bold text-right">ค้างจ่าย ฿{remaining.toLocaleString()}</p>
            )}
          </div>
        )}

        {/* Total + camera + save */}
        <div className="flex justify-between items-end border-t border-slate-100 pt-3">
          <div>
            <p className="text-slate-400 text-[11px] font-bold tracking-wide">ยอดรวมบิล ({cart.length} รายการ)</p>
            <h2 className="text-4xl font-black text-emerald-500 leading-none mt-1">฿{cartTotal.toLocaleString()}</h2>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => photoInputRef.current?.click()}
              className={`w-11 h-11 rounded-2xl flex items-center justify-center border-2 transition-all ${
                photoUrl ? 'border-emerald-400 bg-emerald-50' : 'border-slate-200 bg-slate-50'
              }`} title="ถ่ายรูปบิล">
              {photoUploading
                ? <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                : photoUrl
                  ? <img src={photoUrl} className="w-full h-full object-cover rounded-xl" alt="bill" />
                  : <Camera size={20} className="text-slate-400" />}
            </button>
            <input ref={photoInputRef} type="file" accept="image/*"
              onChange={handlePhotoChange} className="hidden" />
            {cart.length > 0 && (
              <button onClick={handleSaveBill} disabled={saving}
                className="bg-emerald-500 text-white px-5 py-3 rounded-2xl font-bold flex items-center gap-2 shadow-lg active:scale-95 disabled:opacity-60">
                <CheckCircle size={20} /> {saving ? 'กำลังบันทึก...' : 'จบบิล'}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Product chips */}
      <div className="px-4 py-3 overflow-x-auto whitespace-nowrap flex gap-3 shrink-0">
        {PRODUCTS.map(p => (
          <button key={p.id} onClick={() => handleProductChange(p.id)}
            className={`inline-block px-6 py-3 rounded-3xl font-bold text-sm transition-all ${
              selectedProduct === p.id
                ? (p.type === 'dead' ? 'bg-red-500 text-white shadow-lg' : 'bg-blue-600 text-white shadow-lg')
                : 'bg-white text-slate-500 border border-slate-200'
            }`}>{p.name}</button>
        ))}
      </div>

      {/* Numpad */}
      <div className="flex-1 bg-white p-5 flex flex-col rounded-t-[2.5rem] shadow-[0_-10px_30px_rgba(0,0,0,0.04)]"
        style={{ paddingBottom: 'max(1.25rem, env(safe-area-inset-bottom))' }}>
        <div className="flex gap-2 mb-3">
          <button onClick={() => setInputMode('weight')}
            className={`flex-1 py-3 rounded-2xl font-bold text-xs border ${inputMode === 'weight' ? 'bg-slate-800 text-white' : 'bg-slate-50 text-slate-500'}`}>
            น้ำหนัก: {weight || '0.0'} กก.
          </button>
          <button onClick={() => setInputMode('price')}
            className={`flex-1 py-3 rounded-2xl font-bold text-xs border ${inputMode === 'price' ? 'bg-slate-800 text-white' : 'bg-slate-50 text-slate-500'}`}>
            {isDeadShrimp ? 'เหมา: ' : 'โลละ: '}{customPrice || '0'} บ.
          </button>
          <button onClick={toggleVoice}
            className={`w-12 rounded-2xl flex items-center justify-center border-2 transition-all shrink-0 ${
              voiceListen ? 'bg-red-500 border-red-400 text-white' : 'bg-slate-50 border-slate-200 text-slate-400'
            }`}>
            {voiceListen ? <MicOff size={20} /> : <Mic size={20} />}
          </button>
        </div>

        {/* Voice transcript bar */}
        {(voiceListen || liveText || voiceResult) && (
          <div className={`mb-3 px-4 py-3 rounded-2xl flex items-center gap-3 transition-all ${
            voiceListen ? 'bg-red-50 border border-red-200' : 'bg-slate-50 border border-slate-200'
          }`}>
            {voiceListen && (
              <div className="flex gap-0.5 items-end shrink-0 h-5">
                {[6,10,8,12,7].map((h, i) => (
                  <div key={i} className="w-1 rounded-full bg-red-400 animate-bounce"
                    style={{ height: `${h}px`, animationDelay: `${i * 0.1}s` }} />
                ))}
              </div>
            )}
            <p className={`flex-1 text-sm font-medium truncate ${voiceListen ? 'text-red-600' : 'text-slate-500'}`}>
              {liveText || voiceResult || 'กำลังฟัง...'}
            </p>
          </div>
        )}

        <div className="relative mb-3">
          <Edit3 className="absolute left-4 top-3 text-slate-400" size={16} />
          <input type="text" placeholder="หมายเหตุ (ถ้ามี)" value={note} onChange={e => setNote(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 pl-11 pr-4 py-3 rounded-2xl text-sm outline-none" />
        </div>

        <div className="flex justify-between items-center mb-3">
          <p className="text-slate-400 font-bold text-sm">ยอดรายการนี้</p>
          <p className="text-2xl font-black text-blue-600">฿{currentItemTotal.toLocaleString()}</p>
        </div>

        <div className="grid grid-cols-4 gap-2 flex-1">
          <div className="col-span-3 grid grid-cols-3 gap-2">
            {[1,2,3,4,5,6,7,8,9].map(n => (
              <button key={n} onClick={() => handleNumpad(n.toString())}
                className="bg-slate-50 active:bg-slate-200 text-2xl font-bold text-slate-700 rounded-2xl py-4">{n}</button>
            ))}
            <button onClick={() => handleNumpad('.')} className="bg-slate-50 text-3xl font-bold text-slate-700 rounded-2xl py-4">.</button>
            <button onClick={() => handleNumpad('0')} className="bg-slate-50 text-2xl font-bold text-slate-700 rounded-2xl py-4">0</button>
            <button onClick={() => {
              if (inputMode === 'weight') setWeight(p => p.slice(0, -1));
              else setCustomPrice(p => p.slice(0, -1));
            }} className="bg-red-50 text-red-500 rounded-2xl flex items-center justify-center py-4">
              <Delete size={28} />
            </button>
          </div>
          <button onClick={addToCart}
            className="col-span-1 bg-blue-600 text-white rounded-2xl font-bold flex flex-col items-center justify-center gap-2 shadow-lg active:scale-95">
            <PlusCircle size={32} /><span className="text-sm">เพิ่ม</span>
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Inventory Screen ─────────────────────────────────────────────────────────

const InventoryScreen = ({ stock, updateMainStock }) => {
  const [tab, setTab]           = useState('receive');
  const [rcvLive, setRcvLive]   = useState('');
  const [rcvDead, setRcvDead]   = useState('');
  const [rcvCost, setRcvCost]   = useState('');
  const [rcvTransport, setRcvTransport] = useState('');
  const [rcvNote, setRcvNote]   = useState('');
  const [deadWeight, setDeadWeight] = useState('');
  const [saving, setSaving]     = useState(false);

  const liveKg    = parseFloat(rcvLive) || 0;
  const deadKg    = parseFloat(rcvDead) || 0;
  const costPerKg = parseFloat(rcvCost) || 0;
  const transport = parseFloat(rcvTransport) || 0;
  const shrimpCost = (liveKg + deadKg) * costPerKg;
  const grandTotal = shrimpCost + transport;
  const effectiveCost = (liveKg + deadKg) > 0 ? grandTotal / (liveKg + deadKg) : 0;

  const handleReceive = async () => {
    if (!rcvLive && !rcvDead) return alert('ใส่น้ำหนักอย่างน้อย 1 ช่องครับ');
    if (!rcvCost) return alert('ใส่ราคาซื้อ/กก.ด้วยครับ');
    setSaving(true);
    try {
      const withTimeout = (p) => Promise.race([p, new Promise((_, r) => setTimeout(() => r(new Error('timeout')), 10000))]);
      await withTimeout(updateMainStock(stock.live + liveKg, stock.dead + deadKg));
      if (isFirebaseReady) {
        await withTimeout(fsPost('stockBatches', {
          purchaseDate: new Date().toISOString(),
          liveKg, deadKg, costPerKg, transport,
          totalCost: grandTotal, effectiveCostPerKg: effectiveCost,
          remainingLiveKg: liveKg, remainingDeadKg: deadKg,
          note: rcvNote,
        }));
      }
      alert(`✅ รับกุ้งเข้าสำเร็จ!\nต้นทุน: ฿${grandTotal.toLocaleString()} (฿${effectiveCost.toFixed(2)}/กก.)`);
      setRcvLive(''); setRcvDead(''); setRcvCost(''); setRcvTransport(''); setRcvNote('');
    } catch (err) {
      console.error(err);
      alert('⚠️ บันทึกไม่สำเร็จ กรุณาลองอีกครั้งครับ');
    } finally {
      setSaving(false);
    }
  };

  const handleDead = () => {
    if (!deadWeight) return;
    const w = parseFloat(deadWeight);
    if (w > stock.live) return alert('ยอดกุ้งตายมากกว่ากุ้งเป็นครับ');
    updateMainStock(stock.live - w, stock.dead + w);
    alert('ย้ายยอดกุ้งตายสำเร็จ!'); setDeadWeight('');
  };

  return (
    <div className="p-5 space-y-5">
      <div className="flex bg-slate-200 p-1.5 rounded-2xl">
        <button onClick={() => setTab('receive')}
          className={`flex-1 py-3 font-bold text-sm rounded-xl ${tab === 'receive' ? 'bg-white text-blue-600' : 'text-slate-500'}`}>
          รับกุ้งเข้า
        </button>
        <button onClick={() => setTab('dead')}
          className={`flex-1 py-3 font-bold text-sm rounded-xl ${tab === 'dead' ? 'bg-white text-red-600' : 'text-slate-500'}`}>
          กุ้งตายจากบ่อ
        </button>
      </div>

      {tab === 'receive' && (
        <div className="bg-white p-6 rounded-[2rem] shadow-sm space-y-4">
          <h2 className="font-black text-slate-800 text-xl">บันทึกรับกุ้งเข้าบ่อ</h2>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-slate-500 mb-1 block">น้ำหนักกุ้งสด (กก.)</label>
              <input type="number" inputMode="decimal" value={rcvLive}
                onChange={e => setRcvLive(e.target.value)} placeholder="0.000"
                className="w-full p-3 bg-slate-50 rounded-2xl outline-none text-lg font-bold" />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-500 mb-1 block">น้ำหนักกุ้งตาย (กก.)</label>
              <input type="number" inputMode="decimal" value={rcvDead}
                onChange={e => setRcvDead(e.target.value)} placeholder="0.000"
                className="w-full p-3 bg-slate-50 rounded-2xl outline-none text-lg font-bold" />
            </div>
          </div>
          <div>
            <label className="text-xs font-bold text-slate-500 mb-1 block">ราคาซื้อ/กก. (฿/กก.)</label>
            <input type="number" inputMode="decimal" value={rcvCost}
              onChange={e => setRcvCost(e.target.value)} placeholder="0"
              className="w-full p-3 bg-slate-50 rounded-2xl outline-none text-lg font-bold" />
          </div>
          <div>
            <label className="text-xs font-bold text-slate-500 mb-1 block">ค่ารถ (฿)</label>
            <input type="number" inputMode="decimal" value={rcvTransport}
              onChange={e => setRcvTransport(e.target.value)} placeholder="0"
              className="w-full p-3 bg-slate-50 rounded-2xl outline-none text-lg font-bold" />
          </div>
          <div>
            <label className="text-xs font-bold text-slate-500 mb-1 block">หมายเหตุ</label>
            <input type="text" value={rcvNote} onChange={e => setRcvNote(e.target.value)}
              placeholder="เช่น รถทะเบียน กข-1234"
              className="w-full p-3 bg-slate-50 rounded-2xl outline-none" />
          </div>
          <div className="bg-slate-50 rounded-2xl p-4 space-y-2 border border-slate-200">
            <div className="flex justify-between text-sm text-slate-600">
              <span>น้ำหนักรวม</span><span className="font-bold">{(liveKg+deadKg).toFixed(3)} กก.</span>
            </div>
            <div className="flex justify-between text-sm text-slate-600">
              <span>ค่ากุ้ง</span><span className="font-bold">฿{shrimpCost.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-sm text-slate-600">
              <span>ค่ารถ</span><span className="font-bold">฿{transport.toLocaleString()}</span>
            </div>
            <div className="flex justify-between font-black text-slate-800 text-base border-t border-slate-200 pt-2">
              <span>ต้นทุนทั้งหมด</span><span className="text-blue-600">฿{grandTotal.toLocaleString()}</span>
            </div>
            {effectiveCost > 0 && (
              <div className="flex justify-between text-sm text-emerald-600 font-bold">
                <span>ต้นทุนจริง/กก. (FIFO)</span><span>฿{effectiveCost.toFixed(2)}</span>
              </div>
            )}
          </div>
          <button onClick={handleReceive} disabled={saving}
            className="w-full bg-slate-800 text-white font-bold py-5 rounded-2xl disabled:opacity-60">
            {saving ? 'กำลังบันทึก...' : 'บันทึกเข้าสต๊อก (FIFO)'}
          </button>
        </div>
      )}

      {tab === 'dead' && (
        <div className="bg-white p-6 rounded-[2rem] shadow-sm">
          <h2 className="font-black text-red-600 text-xl mb-4">บันทึกกุ้งตาย</h2>
          <div className="bg-red-50 p-4 rounded-2xl mb-4">
            <span className="text-sm text-red-800">กุ้งเป็นคงเหลือ: <span className="font-black text-xl">{stock.live.toFixed(1)} กก.</span></span>
          </div>
          <input type="number" inputMode="decimal" value={deadWeight}
            onChange={e => setDeadWeight(e.target.value)} placeholder="0.0"
            className="w-full p-5 bg-white border-2 border-red-200 text-red-600 font-black text-3xl text-center rounded-2xl outline-none" />
          <button onClick={handleDead}
            className="w-full mt-4 bg-red-500 text-white font-bold py-5 rounded-2xl">
            ย้ายสต๊อกไปกุ้งตาย
          </button>
        </div>
      )}
    </div>
  );
};

// ─── Dashboard ────────────────────────────────────────────────────────────────

const Dashboard = ({ stock }) => {
  const [dashTab, setDashTab]       = useState('today');
  const [firestoreSales, setFirestoreSales] = useState([]);
  const [customerDebts, setCustomerDebts]   = useState([]);
  const [stockBatches, setStockBatches]     = useState([]);
  const [loading, setLoading]       = useState(true);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    if (!db) { setLoading(false); return; }
    const unsubs = [];
    const todayKey = dateKeyBangkok();
    const loadTimer = setTimeout(() => setLoading(false), 8000);

    const sortSales = (docs) => docs.sort((a, b) => {
      const ta = typeof a.createdAt === 'string' ? a.createdAt : (a.createdAt?.toDate?.()?.toISOString() ?? '');
      const tb = typeof b.createdAt === 'string' ? b.createdAt : (b.createdAt?.toDate?.()?.toISOString() ?? '');
      return tb.localeCompare(ta);
    });
    const applySales = (docs) => {
      setFirestoreSales(sortSales(docs));
      setLoading(false);
    };

    const salesQ = query(collection(db, 'sales'), where('dateKey', '==', todayKey));
    unsubs.push(onSnapshot(salesQ, snap => {
      applySales(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, () => {
      const fallbackQ = query(collection(db, 'sales'), limit(200));
      const unsub2 = onSnapshot(fallbackQ, snap => {
        const todayMidnight = new Date(todayKey + 'T00:00:00+07:00');
        const filtered = snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(s => {
          if (s.dateKey) return s.dateKey === todayKey;
          const d = s.createdAt?.toDate?.() ?? (s.createdAt ? new Date(s.createdAt) : null);
          return d && d >= todayMidnight;
        });
        applySales(filtered);
      }, () => {
        setLoading(false);
        if (retryCount < 3) setTimeout(() => setRetryCount(c => c + 1), 5000);
      });
      unsubs.push(unsub2);
    }));

    unsubs.push(onSnapshot(collection(db, 'customerDebts'), snap => {
      setCustomerDebts(snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(d => (d.totalDebt || 0) > 0));
    }, () => {}));

    const batchQ = query(collection(db, 'stockBatches'), orderBy('purchaseDate', 'desc'), limit(30));
    unsubs.push(onSnapshot(batchQ, snap => {
      setStockBatches(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, () => {
      fsRunQuery({
        from: [{ collectionId: 'stockBatches' }],
        orderBy: [{ field: { fieldPath: 'purchaseDate' }, direction: 'DESCENDING' }],
        limit: 30,
      }).then((rows) => setStockBatches(rows)).catch(() => {});
    }));

    return () => { clearTimeout(loadTimer); unsubs.forEach(u => u()); };
  }, [retryCount]); // eslint-disable-line react-hooks/exhaustive-deps

  const displayStock = (() => {
    const live = Number(stock?.live) || 0;
    const dead = Number(stock?.dead) || 0;
    if (live > 0 || dead > 0) return { live, dead };
    return stockBatches.reduce((acc, b) => ({
      live: acc.live + (parseFloat(b.remainingLiveKg ?? b.liveKg) || 0),
      dead: acc.dead + (parseFloat(b.remainingDeadKg ?? b.deadKg) || 0),
    }), { live: 0, dead: 0 });
  })();

  const todaySales = firestoreSales;

  const todayTotal  = todaySales.reduce((s, t) => s + (t.total || 0), 0);
  const todayCash   = todaySales.filter(s => s.paymentType === 'cash').reduce((s, t) => s + t.total, 0);
  const todayTransfer = todaySales.filter(s => s.paymentType === 'transfer').reduce((s, t) => s + t.total, 0);
  const todayCredit = todaySales.filter(s => s.paymentType === 'credit').reduce((s, t) => s + t.total, 0);
  const todayInstall = todaySales.filter(s => s.paymentType === 'installment').reduce((s, t) => s + t.total, 0);
  const totalDebt   = customerDebts.reduce((s, c) => s + (c.totalDebt || 0), 0);

  const payBreakdown = [
    { ...PAY[0], amount: todayCash,     count: todaySales.filter(s => s.paymentType === 'cash').length },
    { ...PAY[1], amount: todayTransfer, count: todaySales.filter(s => s.paymentType === 'transfer').length },
    { ...PAY[2], amount: todayCredit,   count: todaySales.filter(s => s.paymentType === 'credit').length },
    { ...PAY[3], amount: todayInstall,  count: todaySales.filter(s => s.paymentType === 'installment').length },
  ];

  return (
    <div className="p-5 space-y-5">
      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-[2rem] p-5 text-white col-span-2">
          <p className="text-slate-400 text-xs font-bold mb-1">ยอดขายวันนี้</p>
          <p className="text-4xl font-black">฿{todayTotal.toLocaleString()}</p>
          <p className="text-slate-400 text-xs mt-1">{todaySales.length} บิล{loading && ' · กำลังโหลด...'}</p>
        </div>
        <div className="bg-gradient-to-br from-blue-500 to-blue-700 rounded-[2rem] p-5 text-white">
          <p className="text-blue-200 text-xs font-bold mb-1">กุ้งเป็น</p>
          <p className="text-2xl font-black">{displayStock.live.toFixed(1)}<span className="text-sm font-normal"> กก.</span></p>
        </div>
        <div className="bg-gradient-to-br from-red-400 to-orange-500 rounded-[2rem] p-5 text-white">
          <p className="text-red-100 text-xs font-bold mb-1">กุ้งตาย</p>
          <p className="text-2xl font-black">{displayStock.dead.toFixed(1)}<span className="text-sm font-normal"> กก.</span></p>
        </div>
        <div className="bg-gradient-to-br from-orange-400 to-amber-500 rounded-[2rem] p-5 text-white col-span-2">
          <p className="text-orange-100 text-xs font-bold mb-1">ลูกหนี้รวม (AR)</p>
          <p className="text-3xl font-black">฿{totalDebt.toLocaleString()}</p>
          <p className="text-orange-100 text-xs mt-1">{customerDebts.length} ราย</p>
        </div>
      </div>

      {/* Sub-tabs */}
      <div className="flex bg-slate-200 p-1.5 rounded-2xl">
        {[['today','วันนี้'],['debts','ลูกหนี้'],['fifo','สต๊อก FIFO']].map(([id, label]) => (
          <button key={id} onClick={() => setDashTab(id)}
            className={`flex-1 py-2.5 font-bold text-xs rounded-xl transition-all ${dashTab === id ? 'bg-white text-blue-600' : 'text-slate-500'}`}>
            {label}
          </button>
        ))}
      </div>

      {/* Today tab */}
      {dashTab === 'today' && (
        <>
          <div className="bg-white p-5 rounded-[2rem] shadow-sm">
            <h3 className="font-bold text-slate-800 mb-4">แยกตามการชำระ</h3>
            {payBreakdown.map(pt => (
              <div key={pt.id} className="mb-3 last:mb-0">
                <div className="flex justify-between text-sm mb-1.5">
                  <span className="font-bold text-slate-700">{pt.label} ({pt.count} บิล)</span>
                  <span className="font-black text-slate-800">฿{pt.amount.toLocaleString()}</span>
                </div>
                <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
                  <div className={`h-full ${pt.cls} rounded-full transition-all duration-500`}
                    style={{ width: todayTotal > 0 ? `${Math.max(2, pt.amount / todayTotal * 100).toFixed(1)}%` : '0%' }} />
                </div>
              </div>
            ))}
          </div>

          <div className="bg-white p-5 rounded-[2rem] shadow-sm">
            <h3 className="font-bold text-slate-800 mb-4">บิลล่าสุดวันนี้</h3>
            {todaySales.length === 0
              ? <p className="text-center text-slate-400 py-6">ยังไม่มีรายการวันนี้</p>
              : (
                <div className="space-y-3">
                  {todaySales.slice(0, 15).map((tx, i) => {
                    const pt = PAY.find(p => p.id === tx.paymentType);
                    return (
                      <div key={tx.id || i} className="flex justify-between items-start border-b border-slate-100 pb-3">
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-sm text-slate-700 truncate">{tx.customerName}</p>
                          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                            <span className={`text-[10px] font-bold text-white px-2 py-0.5 rounded-full shrink-0 ${pt?.cls || 'bg-slate-400'}`}>
                              {pt?.label || tx.paymentType}
                            </span>
                            {(tx.remainingAmount || 0) > 0 && (
                              <span className="text-[10px] text-orange-500 font-bold">
                                ค้าง ฿{tx.remainingAmount.toLocaleString()}
                              </span>
                            )}
                          </div>
                        </div>
                        <p className="font-black text-emerald-600 ml-2 shrink-0">฿{(tx.total || 0).toLocaleString()}</p>
                      </div>
                    );
                  })}
                </div>
              )}
          </div>
        </>
      )}

      {/* Debts (AR) tab */}
      {dashTab === 'debts' && (
        <div className="bg-white p-5 rounded-[2rem] shadow-sm">
          <h3 className="font-bold text-slate-800 mb-1">ลูกหนี้ทั้งหมด</h3>
          <p className="text-sm text-slate-500 mb-5">รวม ฿{totalDebt.toLocaleString()} ({customerDebts.length} ราย)</p>
          {customerDebts.length === 0
            ? <p className="text-center text-emerald-500 font-bold py-8">ไม่มีลูกหนี้ 🎉</p>
            : (
              <div className="space-y-3">
                {[...customerDebts].sort((a, b) => (b.totalDebt || 0) - (a.totalDebt || 0)).map(c => (
                  <div key={c.id} className="flex justify-between items-center border-b border-slate-100 pb-3">
                    <div>
                      <p className="font-bold text-slate-800">{c.customerName}</p>
                      <p className="text-xs text-slate-400">{c.zone} • บิล {c.lastBillNo || '—'}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-black text-orange-500 text-lg">฿{(c.totalDebt || 0).toLocaleString()}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
        </div>
      )}

      {/* FIFO Stock tab */}
      {dashTab === 'fifo' && (
        <div className="space-y-4">
          {stockBatches.length === 0
            ? (
              <div className="bg-white p-8 rounded-[2rem] shadow-sm text-center text-slate-400">
                <p className="font-bold">ยังไม่มีข้อมูล FIFO</p>
                <p className="text-xs mt-1">รับกุ้งเข้าเพื่อสร้างล็อตแรก</p>
              </div>
            )
            : stockBatches.map((b, i) => (
              <div key={b.id}
                className={`bg-white p-5 rounded-[2rem] shadow-sm border-l-4 ${i === stockBatches.length - 1 ? 'border-amber-400' : 'border-blue-400'}`}>
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <p className="font-black text-slate-800 text-sm">
                      {i === stockBatches.length - 1 ? '🟡 ล็อตเก่าสุด (ขายออกก่อน)' : i === 0 ? '🔵 ล็อตล่าสุด' : `ล็อต #${stockBatches.length - i}`}
                    </p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {b.purchaseDate?.toDate?.()?.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' }) || '—'}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-black text-blue-600 text-lg">฿{(b.effectiveCostPerKg || 0).toFixed(2)}/กก.</p>
                    <p className="text-xs text-slate-400">ต้นทุน ฿{(b.totalCost || 0).toLocaleString()}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-blue-50 rounded-2xl p-3 text-center">
                    <p className="text-[10px] text-blue-500 font-bold">กุ้งสด</p>
                    <p className="font-black text-blue-700 text-lg">{b.liveKg || 0} <span className="text-xs font-normal">กก.</span></p>
                  </div>
                  <div className="bg-red-50 rounded-2xl p-3 text-center">
                    <p className="text-[10px] text-red-500 font-bold">กุ้งตาย</p>
                    <p className="font-black text-red-700 text-lg">{b.deadKg || 0} <span className="text-xs font-normal">กก.</span></p>
                  </div>
                </div>
                {b.note && <p className="text-xs text-slate-500 mt-2">📝 {b.note}</p>}
              </div>
            ))
          }
        </div>
      )}
    </div>
  );
};

// ─── LINE Orders Screen ───────────────────────────────────────────────────────

function LineOrdersScreen() {
  const [orders,  setOrders]  = useState([]);
  const [loading, setLoading] = useState(true);

  const todayBKK = dateKeyBangkok;

  useEffect(() => {
    fsRunQuery({ from: [{ collectionId: 'lineOrders' }], orderBy: [{ field: { fieldPath: 'createdAt' }, direction: 'DESCENDING' }], limit: 100 })
      .then(rows => { setOrders(rows); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const markDone = (id) => {
    fsPatch(`lineOrders/${id}`, { status: 'done' });
    setOrders(prev => prev.map(o => o.id === id ? { ...o, status: 'done' } : o));
  };

  const today    = todayBKK();
  const tomorrow = tomorrowDateKeyBangkok();
  const dateLabel = (k) => k === today ? 'วันนี้' : k === tomorrow ? 'พรุ่งนี้' : k;

  // Group by deliveryDate, show today + future only
  const upcoming = orders.filter(o => (o.deliveryDate || '') >= today);
  const grouped  = upcoming.reduce((acc, o) => {
    const k = o.deliveryDate || 'ไม่ระบุ';
    (acc[k] = acc[k] || []).push(o);
    return acc;
  }, {});

  if (loading) return <div className="flex items-center justify-center h-40 text-slate-400 text-sm">กำลังโหลด...</div>;

  if (upcoming.length === 0) return (
    <div className="flex flex-col items-center justify-center h-60 text-slate-300">
      <Bell size={48} strokeWidth={1} className="mb-3" />
      <p className="font-bold text-sm">ยังไม่มีออเดอร์</p>
      <p className="text-xs mt-1">ออเดอร์จาก LINE จะขึ้นที่นี่</p>
    </div>
  );

  return (
    <div className="px-4 pt-4 pb-6 space-y-5">
      {Object.entries(grouped).sort().map(([date, items]) => (
        <div key={date}>
          <p className="text-xs font-bold text-slate-500 mb-2 uppercase tracking-wide">
            📅 ส่ง{dateLabel(date)} · {items.length} ออเดอร์
            {items.filter(o => o.status !== 'done').length > 0 && (
              <span className="ml-2 bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full">
                {items.filter(o => o.status !== 'done').length} รอ
              </span>
            )}
          </p>
          <div className="space-y-2">
            {items.map(o => (
              <div key={o.id}
                className={`bg-white rounded-2xl p-4 shadow-sm border transition-all ${o.status === 'done' ? 'border-green-200 opacity-50' : 'border-slate-200'}`}>
                <div className="flex justify-between items-start mb-2">
                  <div className="flex-1 min-w-0 mr-2">
                    <p className="text-[11px] text-slate-400">LINE · {o.lineUserId?.slice(-6) || '—'}</p>
                    <p className="text-xs text-slate-500 mt-0.5 truncate italic">"{o.rawText}"</p>
                  </div>
                  {o.status === 'done'
                    ? <span className="text-xs bg-green-100 text-green-600 font-bold px-2 py-1 rounded-xl shrink-0">✓ เสร็จ</span>
                    : <button onClick={() => markDone(o.id)}
                        className="text-xs bg-green-500 text-white font-bold px-3 py-1 rounded-xl active:scale-95 shrink-0">
                        ✓ เสร็จ
                      </button>
                  }
                </div>
                <div className="space-y-1">
                  {(o.items || []).map((item, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-blue-400 shrink-0" />
                      <p className="text-sm font-bold text-slate-700">{item.product}</p>
                      <p className="text-sm text-slate-500 ml-auto">{item.qty} {item.unit}</p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Admin: User Management ────────────────────────────────────────────────────

function AdminUsersScreen() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadUsers = async () => {
    const rows = await fsRunQuery({
      from: [{ collectionId: "shrimp_users" }],
      orderBy: [{ field: { fieldPath: 'createdAt' }, direction: 'ASCENDING' }],
      limit: 100,
    });
    setUsers(rows);
    setLoading(false);
  };

  useEffect(() => { loadUsers(); }, []);

  const setApproved = async (uid, val) => {
    await fsPatch(`shrimp_users/${uid}`, { approved: val });
    setUsers(prev => prev.map(u => u.id === uid ? { ...u, approved: val } : u));
  };

  const setRole = async (uid, role) => {
    await fsPatch(`shrimp_users/${uid}`, { role });
    setUsers(prev => prev.map(u => u.id === uid ? { ...u, role } : u));
  };

  if (loading) return <div className="p-8 text-center text-slate-400">กำลังโหลด...</div>;

  return (
    <div className="px-4 pt-4 pb-8 space-y-3">
      <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">จัดการสมาชิก ({users.length} คน)</p>
      {users.length === 0 && <p className="text-slate-300 text-center py-12">ยังไม่มีสมาชิก</p>}
      {users.map(u => (
        <div key={u.id} className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200">
          <div className="flex justify-between items-start mb-3">
            <div className="min-w-0 flex-1">
              <p className="font-bold text-slate-800 truncate">{u.name || '—'}</p>
              <p className="text-xs text-slate-400 truncate">{u.email}</p>
            </div>
            <div className="flex items-center gap-1 ml-2 shrink-0">
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${u.role === 'admin' ? 'bg-purple-100 text-purple-700' : 'bg-slate-100 text-slate-600'}`}>
                {u.role === 'admin' ? 'แอดมิน' : 'สตาฟ'}
              </span>
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${u.approved ? 'bg-emerald-100 text-emerald-700' : 'bg-orange-100 text-orange-600'}`}>
                {u.approved ? 'อนุมัติแล้ว' : 'รออนุมัติ'}
              </span>
            </div>
          </div>
          <div className="flex gap-2">
            {!u.approved
              ? <button onClick={() => setApproved(u.id, true)}
                  className="flex-1 py-2 rounded-xl bg-emerald-500 text-white text-xs font-bold active:scale-95">✓ อนุมัติ</button>
              : <button onClick={() => setApproved(u.id, false)}
                  className="flex-1 py-2 rounded-xl bg-red-50 text-red-500 text-xs font-bold active:scale-95">✗ ระงับ</button>
            }
            <button onClick={() => setRole(u.id, u.role === 'admin' ? 'staff' : 'admin')}
              className="flex-1 py-2 rounded-xl bg-slate-100 text-slate-700 text-xs font-bold active:scale-95">
              {u.role === 'admin' ? '→ สตาฟ' : '→ แอดมิน'}
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Admin: Product Settings ───────────────────────────────────────────────────

function ProductSettingsScreen() {
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

// ─── Nav Button (with optional badge) ────────────────────────────────────────

const NavButton = ({ icon, label, isActive, onClick, badge }) => (
  <button onClick={onClick}
    className={`flex flex-col items-center justify-center w-full p-3 transition-all relative ${isActive ? 'text-blue-600 scale-110' : 'text-slate-400'}`}>
    <div className="relative">
      {React.cloneElement(icon, { size: 22, strokeWidth: isActive ? 2.5 : 2, className: 'mb-1' })}
      {badge > 0 && (
        <span className="absolute -top-1 -right-2 bg-red-500 text-white text-[9px] font-black w-4 h-4 rounded-full flex items-center justify-center">
          {badge > 9 ? '9+' : badge}
        </span>
      )}
    </div>
    <span className={`text-[10px] ${isActive ? 'font-bold' : 'font-medium'}`}>{label}</span>
  </button>
);

createRoot(document.getElementById('root')).render(<App />);
