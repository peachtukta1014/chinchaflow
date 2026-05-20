import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  addDoc, collection, doc, getDoc, getDocs, increment, limit,
  onSnapshot, orderBy, query, serverTimestamp, setDoc, where,
} from 'firebase/firestore';
import { ref as stRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { onAuthStateChanged, signInAnonymously, signOut } from 'firebase/auth';
import {
  Camera, CheckCircle, ChevronRight, Delete, Edit3,
  Home, LogOut, MapPin, Mic, MicOff, Package, PlusCircle,
  ShoppingCart, Users, X,
} from 'lucide-react';
import { auth, db, storage, isFirebaseReady } from './firebase';

// ─── Constants ────────────────────────────────────────────────────────────────

const CUSTOMERS = [
  { id: 'general', name: 'ลูกค้าทั่วไปและตลาดนัด', zone: 'ทั่วไป' },
  { id: 'c1',  name: 'เจ๊เขียด',           zone: 'ป่าตอง' },
  { id: 'c2',  name: 'ตาจุ้ย 1',           zone: 'ป่าตอง' },
  { id: 'c3',  name: 'ตาจุ้ย 2',           zone: 'ป่าตอง' },
  { id: 'c4',  name: 'น้องเล็ก 1',         zone: 'ป่าตอง' },
  { id: 'c5',  name: 'ปุ้ย',               zone: 'ป่าตอง' },
  { id: 'c6',  name: 'เจ๊แหวว',            zone: 'ป่าตอง' },
  { id: 'c7',  name: 'ร้านเฟิร์ส',          zone: 'ป่าตอง' },
  { id: 'c8',  name: 'ร้านสองพี่น้อง 1',    zone: 'ป่าตอง' },
  { id: 'c9',  name: 'ร้านสองพี่น้อง 2',    zone: 'ป่าตอง' },
  { id: 'c10', name: 'ร้านแสนสบาย',         zone: 'ป่าตอง' },
  { id: 'c11', name: 'น้องเล็ก 2',          zone: 'กะทู้'  },
  { id: 'c12', name: 'อีสานรสเด็ด',         zone: 'กะทู้'  },
  { id: 'c13', name: 'โบ๊ทซีฟู้ด',          zone: 'ภูเก็ต' },
  { id: 'c14', name: 'ร้านคุณเชษฐ์',        zone: 'ภูเก็ต' },
  { id: 'c15', name: 'ร้าน มุขมณี',         zone: 'ราไวย์' },
  { id: 'c16', name: 'ร้าน ฟาง',           zone: 'ราไวย์' },
  { id: 'c17', name: 'ร้าน ป้าก้อย',        zone: 'ราไวย์' },
  { id: 'c18', name: 'ร้าน มด',            zone: 'ราไวย์' },
  { id: 'c19', name: 'ร้าน อ้อม',          zone: 'ราไวย์' },
  { id: 'c20', name: 'ร้าน ป้าแมว',         zone: 'ราไวย์' },
  { id: 'c21', name: 'ร้าน เฮง 777',       zone: 'ราไวย์' },
  { id: 'c22', name: 'ร้าน โอเล่',         zone: 'ราไวย์' },
  { id: 'c23', name: 'ร้าน โกห้า',         zone: 'ราไวย์' },
  { id: 'c24', name: 'ร้าน วิทยาซีฟู้ด',   zone: 'ราไวย์' },
  { id: 'c25', name: 'ร้าน ฟลุ๊ค',         zone: 'ราไวย์' },
  { id: 'c26', name: 'ร้าน มุกอันดา',       zone: 'ราไวย์' },
  { id: 'c27', name: 'ร้าน สตูล',          zone: 'ราไวย์' },
];

const PRODUCTS = [
  { id: 'large',  name: 'ไซส์ใหญ่',  type: 'live', price: 1450 },
  { id: 'medium', name: 'ไซส์กลาง', type: 'live', price: 1100 },
  { id: 'small',  name: 'ไซส์เล็ก',  type: 'live', price: 850  },
  { id: 'dead',   name: 'กุ้งตาย',   type: 'dead', price: 0    },
];

const PAY = [
  { id: 'cash',        label: 'สด',   cls: 'bg-emerald-500' },
  { id: 'transfer',    label: 'โอน',  cls: 'bg-blue-500'    },
  { id: 'credit',      label: 'ค้าง', cls: 'bg-orange-500'  },
  { id: 'installment', label: 'ผ่อน', cls: 'bg-purple-500'  },
];

// ─── Voice Hook ───────────────────────────────────────────────────────────────

function useVoice(onNumber) {
  const [listening, setListening] = useState(false);
  const recRef = useRef(null);

  const toggle = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { alert('ใช้ Chrome เพื่อเปิด Voice ครับ'); return; }
    if (listening) { recRef.current?.stop(); return; }
    const rec = new SR();
    rec.lang = 'th-TH';
    rec.continuous = false;
    recRef.current = rec;
    rec.onresult = (e) => {
      const t = e.results[0][0].transcript.trim();
      const m = t.match(/[\d.]+/);
      if (m) { onNumber(m[0]); return; }
      // simple Thai digit map
      const map = { ศูนย์:'0',หนึ่ง:'1',สอง:'2',สาม:'3',สี่:'4',ห้า:'5',หก:'6',เจ็ด:'7',แปด:'8',เก้า:'9' };
      let s = t;
      Object.entries(map).forEach(([k,v]) => { s = s.replaceAll(k, v); });
      const m2 = s.match(/[\d.]+/);
      if (m2) onNumber(m2[0]);
    };
    rec.onerror = () => setListening(false);
    rec.onend = () => setListening(false);
    rec.start();
    setListening(true);
  };

  return { listening, toggle };
}

// ─── Session helpers (localStorage, 30-day TTL) ───────────────────────────────

const SESSION_KEY = 'koseafood-session';
const SESSION_DAYS = 30;

function getSession() {
  try {
    const s = JSON.parse(localStorage.getItem(SESSION_KEY) || 'null');
    if (!s?.phone || !s?.loginAt) return null;
    if (Date.now() - s.loginAt > SESSION_DAYS * 86400000) { localStorage.removeItem(SESSION_KEY); return null; }
    return s;
  } catch { return null; }
}
function saveSession(m) { localStorage.setItem(SESSION_KEY, JSON.stringify({ ...m, loginAt: Date.now() })); }
function clearSession() { localStorage.removeItem(SESSION_KEY); }

// ─── App (Auth Shell) ─────────────────────────────────────────────────────────

function App() {
  const [member, setMember]     = useState(undefined); // undefined=loading, null=logged out, obj=logged in
  const [activeTab, setActiveTab] = useState('pos');
  const [stock, setStock]       = useState({ live: 0, dead: 0 });
  const [transactions, setTransactions] = useState([]);

  // On mount: restore session → sign in anonymously (satisfies Firestore auth rules)
  useEffect(() => {
    const session = getSession();
    if (!session) { setMember(null); return; }
    if (!auth) { setMember(session); return; }
    signInAnonymously(auth)
      .then(() => setMember(session))
      .catch(() => setMember(session));
  }, []);

  // Real-time shared stock from Firestore
  useEffect(() => {
    if (!db || !member) return;
    return onSnapshot(doc(db, 'config', 'stock'), (snap) => {
      if (snap.exists()) setStock(snap.data());
    }, () => {});
  }, [member]);

  const handleLogin = async (memberData) => {
    saveSession(memberData);
    if (auth) { try { await signInAnonymously(auth); } catch {} }
    setMember(memberData);
  };

  const handleLogout = async () => {
    if (!window.confirm('ออกจากระบบ?')) return;
    clearSession();
    setMember(null);
    if (auth) await signOut(auth).catch(() => {});
  };

  const updateMainStock = (live, dead) => {
    const val = {
      live: Math.max(0, parseFloat(live.toFixed(3))),
      dead: Math.max(0, parseFloat(dead.toFixed(3))),
    };
    setStock(val);
    if (db) setDoc(doc(db, 'config', 'stock'), { ...val, updatedAt: serverTimestamp() }).catch(console.error);
  };

  // ── Loading ───────────────────────────────────────────────────────────────
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

  // ── Login / Register ──────────────────────────────────────────────────────
  if (!member) return <LoginScreen onLogin={handleLogin} />;

  // ── Main App ──────────────────────────────────────────────────────────────
  return (
    <div className="bg-slate-50 h-screen font-sans max-w-md mx-auto relative shadow-2xl overflow-hidden flex flex-col">
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-0">
        <img src="/logo.jpg" alt="" className="w-72 h-72 object-contain opacity-[0.04]" />
      </div>

      <div className="bg-slate-900 text-white px-4 pt-6 pb-4 rounded-b-3xl shadow-lg flex items-center justify-between z-10 shrink-0">
        <div className="flex items-center gap-3">
          <img src="/logo.jpg" alt="KOSEAFOOD" className="w-10 h-10 rounded-xl object-cover border border-slate-700 shrink-0" />
          <div>
            <p className="text-sm font-black text-white leading-none">โกอ้วน คลังซีฟู้ด</p>
            <p className="text-[10px] text-slate-400 mt-0.5 truncate max-w-[160px]">{member.name}</p>
          </div>
        </div>
        <button onClick={handleLogout}
          className="w-10 h-10 rounded-full bg-slate-800 border-2 border-slate-700 flex items-center justify-center text-slate-400 active:scale-95 transition-all">
          <LogOut size={18} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto pb-24" style={{ scrollbarWidth: 'none' }}>
        {activeTab === 'home'    && <Dashboard stock={stock} />}
        {activeTab === 'pos'     && (
          <POSMobile user={member} stock={stock} updateMainStock={updateMainStock}
            onSaveBill={(bill) => setTransactions([bill, ...transactions])} />
        )}
        {activeTab === 'stock'   && <InventoryScreen stock={stock} updateMainStock={updateMainStock} />}
        {activeTab === 'members' && <MembersScreen />}
      </div>

      <div className="absolute bottom-0 left-0 right-0 bg-white border-t border-slate-200 flex justify-around p-2 z-50 rounded-t-2xl"
        style={{ paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))' }}>
        <NavButton icon={<ShoppingCart />} label="ขายของ"    isActive={activeTab === 'pos'}     onClick={() => setActiveTab('pos')} />
        <NavButton icon={<Home />}         label="ภาพรวม"    isActive={activeTab === 'home'}    onClick={() => setActiveTab('home')} />
        <NavButton icon={<Package />}      label="รับสต๊อก" isActive={activeTab === 'stock'}   onClick={() => setActiveTab('stock')} />
        <NavButton icon={<Users />}        label="สมาชิก"    isActive={activeTab === 'members'} onClick={() => setActiveTab('members')} />
      </div>

      <style>{`
        select optgroup { font-weight: 700; color: #475569; background: #f8fafc; }
        select option   { font-weight: 500; color: #0f172a; }
      `}</style>
    </div>
  );
}

// ─── Login / Register Screen ──────────────────────────────────────────────────

function LoginScreen({ onLogin }) {
  const [phone, setPhone]   = useState('');
  const [name, setName]     = useState('');
  const [mode, setMode]     = useState('login');   // 'login' | 'register' | 'pending'
  const [error, setError]   = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    const p = phone.trim().replace(/\D/g, '');
    if (p.length < 9) { setError('กรุณากรอกเบอร์โทรให้ถูกต้อง'); return; }
    if (mode === 'register' && !name.trim()) { setError('กรุณากรอกชื่อ'); return; }

    const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID;
    if (!projectId) { setError('Firebase config ไม่ครบ'); return; }

    setLoading(true); setError('');
    // Use Firestore REST API directly — bypasses SDK auth token issues entirely
    const BASE = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/chincha/documents`;
    const mkT = (ms) => new Promise((_, r) => setTimeout(() => r(new Error('timeout')), ms));

    try {
      const resp = await Promise.race([fetch(`${BASE}/members/${p}`), mkT(12000)]);

      if (resp.status === 403) { throw new Error('permission-denied — เพิ่ม members rule ใน Firestore'); }
      if (resp.status !== 200 && resp.status !== 404) { throw new Error(`HTTP ${resp.status}`); }

      if (resp.status === 404) {
        // New member
        const n = name.trim() || 'ไม่ระบุชื่อ';
        const listResp = await Promise.race([fetch(`${BASE}/members?pageSize=1`), mkT(8000)]);
        const listJson = await listResp.json();
        const isFirst  = !listJson.documents?.length;

        await fetch(`${BASE}/members/${p}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fields: {
            name:     { stringValue: n },
            phone:    { stringValue: p },
            approved: { booleanValue: isFirst },
          }}),
        });

        if (isFirst) { onLogin({ name: n, phone: p }); }
        else         { setMode('pending'); }
        return;
      }

      const json = await resp.json();
      const f    = json.fields || {};
      const memberName = f.name?.stringValue || 'สมาชิก';
      const approved   = f.approved?.booleanValue || false;

      if (!approved) { setMode('pending'); return; }
      onLogin({ name: memberName, phone: p });

    } catch (e) {
      setError(e?.message || 'เชื่อมต่อไม่ได้');
    } finally {
      setLoading(false);
    }
  };

  if (mode === 'pending') {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-6 text-white max-w-md mx-auto">
        <img src="/logo.jpg" alt="" className="w-28 h-28 rounded-3xl mb-6 shadow-2xl" />
        <div className="bg-yellow-500/20 border border-yellow-500/40 rounded-2xl p-6 text-center w-full">
          <p className="text-4xl mb-3">⏳</p>
          <p className="text-yellow-300 font-bold text-lg">รอการอนุมัติ</p>
          <p className="text-slate-400 text-sm mt-2">เจ้าของร้านจะอนุมัติให้เร็วๆ นี้ครับ</p>
          <p className="text-slate-500 text-xs mt-1">เบอร์: {phone.replace(/\D/g,'')}</p>
        </div>
        <button onClick={() => { setMode('login'); setPhone(''); setName(''); }}
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
            placeholder="ชื่อ-นามสกุล"
            className="w-full bg-slate-800 border border-slate-700 text-white placeholder-slate-500 rounded-2xl px-4 py-4 text-base focus:outline-none focus:border-blue-500" />
        )}
        <input value={phone} onChange={e => setPhone(e.target.value)}
          placeholder="เบอร์โทร"
          type="tel" inputMode="numeric"
          className="w-full bg-slate-800 border border-slate-700 text-white placeholder-slate-500 rounded-2xl px-4 py-4 text-base focus:outline-none focus:border-blue-500" />

        {error && <p className="text-red-400 text-sm text-center">{error}</p>}

        <button onClick={handleSubmit} disabled={loading}
          className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-4 rounded-2xl shadow-lg active:scale-95 transition-all disabled:opacity-50">
          {loading ? 'กำลังตรวจสอบ...' : mode === 'register' ? 'ขอเข้าใช้งาน' : 'เข้าสู่ระบบ'}
        </button>

        <button onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(''); }}
          className="w-full text-slate-400 text-sm py-2">
          {mode === 'login' ? 'ยังไม่มีบัญชี? ขอสมัครสมาชิก' : 'มีบัญชีแล้ว? เข้าสู่ระบบ'}
        </button>

        {!isFirebaseReady && (
          <p className="text-yellow-400 text-xs text-center">
            ⚠️ Firebase config ยังไม่ครบ
          </p>
        )}
      </div>
    </div>
  );
}

// ─── Members Screen (approve/reject pending members) ─────────────────────────

function MembersScreen() {
  const [members, setMembers]   = useState([]);
  const [loading, setLoading]   = useState(true);
  const [editId, setEditId]     = useState(null);
  const [editName, setEditName] = useState('');

  useEffect(() => {
    if (!db) return;
    const q = query(collection(db, 'members'), orderBy('createdAt', 'desc'));
    return onSnapshot(q, snap => {
      setMembers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    }, () => setLoading(false));
  }, []);

  const setApproved = (phone, val) =>
    setDoc(doc(db, 'members', phone), { approved: val }, { merge: true });

  const saveName = async (phone) => {
    if (!editName.trim()) return;
    await setDoc(doc(db, 'members', phone), { name: editName.trim() }, { merge: true });
    setEditId(null);
  };

  const MemberCard = ({ m, showApprove }) => (
    <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
      <div className="flex items-center justify-between">
        <div className="flex-1 min-w-0">
          {editId === m.id ? (
            <input value={editName} onChange={e => setEditName(e.target.value)}
              className="w-full border border-blue-400 rounded-lg px-2 py-1 text-sm font-bold text-slate-800 mb-1"
              autoFocus onKeyDown={e => e.key === 'Enter' && saveName(m.phone)} />
          ) : (
            <p className="font-bold text-slate-800 truncate">{m.name}</p>
          )}
          <p className="text-xs text-slate-400">{m.phone}</p>
        </div>
        <div className="flex gap-2 ml-2 shrink-0">
          {editId === m.id ? (
            <>
              <button onClick={() => saveName(m.phone)}
                className="bg-blue-500 text-white text-xs font-bold px-3 py-1.5 rounded-lg">บันทึก</button>
              <button onClick={() => setEditId(null)}
                className="text-slate-400 text-xs border border-slate-200 px-2 py-1.5 rounded-lg">ยกเลิก</button>
            </>
          ) : (
            <>
              <button onClick={() => { setEditId(m.id); setEditName(m.name); }}
                className="text-xs text-blue-500 border border-blue-200 px-3 py-1.5 rounded-lg">แก้ไข</button>
              {showApprove
                ? <button onClick={() => setApproved(m.phone, true)}
                    className="bg-emerald-500 text-white text-xs font-bold px-3 py-1.5 rounded-lg">อนุมัติ</button>
                : <button onClick={() => setApproved(m.phone, false)}
                    className="text-xs text-red-400 border border-red-100 px-2 py-1.5 rounded-lg">ลบ</button>
              }
            </>
          )}
        </div>
      </div>
    </div>
  );

  const pending  = members.filter(m => !m.approved);
  const approved = members.filter(m =>  m.approved);

  return (
    <div className="p-4 space-y-4">
      <h2 className="text-lg font-black text-slate-800">จัดการสมาชิก</h2>
      {loading && <p className="text-slate-400 text-sm text-center py-8">กำลังโหลด...</p>}

      {pending.length > 0 && (
        <div>
          <p className="text-xs font-bold text-orange-500 uppercase tracking-wider mb-2">รออนุมัติ ({pending.length})</p>
          <div className="space-y-2">{pending.map(m => <MemberCard key={m.id} m={m} showApprove={true} />)}</div>
        </div>
      )}

      {approved.length > 0 && (
        <div>
          <p className="text-xs font-bold text-emerald-600 uppercase tracking-wider mb-2">สมาชิก ({approved.length})</p>
          <div className="space-y-2">{approved.map(m => <MemberCard key={m.id} m={m} showApprove={false} />)}</div>
        </div>
      )}

      {!loading && members.length === 0 && (
        <p className="text-slate-400 text-sm text-center py-12">ยังไม่มีสมาชิก</p>
      )}
    </div>
  );
}

// ─── POS Screen ───────────────────────────────────────────────────────────────

const POSMobile = ({ user, stock, updateMainStock, onSaveBill }) => {
  const [selectedCustomer, setSelectedCustomer] = useState('general');
  const [cart, setCart]             = useState([]);
  const [selectedProduct, setSelectedProduct] = useState(PRODUCTS[0].id);
  const [weight, setWeight]         = useState('');
  const [customPrice, setCustomPrice] = useState(PRODUCTS[0].price.toString());
  const [note, setNote]             = useState('');
  const [inputMode, setInputMode]   = useState('weight');
  const [saving, setSaving]         = useState(false);
  const [paymentType, setPaymentType] = useState('cash');
  const [paidAmount, setPaidAmount] = useState('');
  const [photoUrl, setPhotoUrl]     = useState(null);
  const [photoUploading, setPhotoUploading] = useState(false);
  const photoInputRef = useRef(null);
  const billNoRef     = useRef(`INV-${Date.now().toString().slice(-8)}`);

  const activeProduct    = PRODUCTS.find(p => p.id === selectedProduct);
  const isDeadShrimp     = activeProduct?.type === 'dead';
  const currentItemTotal = isDeadShrimp
    ? (parseFloat(customPrice) || 0)
    : (parseFloat(weight) || 0) * (parseFloat(customPrice) || 0);
  const cartTotal = cart.reduce((s, i) => s + i.total, 0);

  const paidAmt = paymentType === 'cash' || paymentType === 'transfer'
    ? cartTotal
    : paymentType === 'credit' ? 0 : (parseFloat(paidAmount) || 0);
  const remaining = cartTotal - paidAmt;

  const { listening: voiceListen, toggle: toggleVoice } = useVoice((num) => {
    if (inputMode === 'weight') setWeight(num);
    else setCustomPrice(num);
  });

  const handlePhotoChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoUploading(true);
    try {
      // Upload to Storage
      if (storage) {
        const r = stRef(storage, `billPhotos/${billNoRef.current}.jpg`);
        await uploadBytes(r, file);
        setPhotoUrl(await getDownloadURL(r));
      }

      // Gemini OCR: read bill → auto-fill weight & price
      const geminiKey = import.meta.env.VITE_GEMINI_API_KEY;
      if (geminiKey) {
        const toBase64 = (f) => new Promise((res, rej) => {
          const reader = new FileReader();
          reader.onload = () => res(reader.result.split(',')[1]);
          reader.onerror = rej;
          reader.readAsDataURL(f);
        });
        const b64 = await toBase64(file);
        const geminiRes = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{
                parts: [
                  { text: 'ดูรูปบิลนี้ บอกน้ำหนักกุ้ง (กก.) และราคาต่อกิโล (บาท/กก.) ตอบเฉพาะ JSON เท่านั้น ไม่ต้องอธิบาย รูปแบบ: {"weight":number|null,"pricePerKg":number|null}' },
                  { inlineData: { mimeType: file.type || 'image/jpeg', data: b64 } },
                ],
              }],
            }),
          }
        );
        if (geminiRes.ok) {
          const geminiJson = await geminiRes.json();
          const text = geminiJson.candidates?.[0]?.content?.parts?.[0]?.text || '';
          const match = text.match(/\{[\s\S]*\}/);
          if (match) {
            try {
              const { weight: w, pricePerKg: p } = JSON.parse(match[0]);
              if (w != null && !isNaN(w)) setWeight(String(w));
              if (p != null && !isNaN(p)) setCustomPrice(String(p));
            } catch { /* ignore parse errors */ }
          }
        }
      }
    } catch { /* storage or Gemini may not be available */ }
    finally { setPhotoUploading(false); }
  };

  const handleProductChange = (productId) => {
    setSelectedProduct(productId);
    const prod = PRODUCTS.find(p => p.id === productId);
    setWeight(''); setNote('');
    if (prod.type === 'dead') { setCustomPrice(''); setInputMode('price'); }
    else { setCustomPrice(prod.price.toString()); setInputMode('weight'); }
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
    if (!isDeadShrimp) setCustomPrice(activeProduct.price.toString());
    setInputMode('weight');
  };

  const handleSaveBill = async () => {
    if (cart.length === 0) return;
    if (paymentType === 'installment' && !paidAmount) return alert('ใส่จำนวนเงินที่ผ่อนมาด้วยครับ');
    const customer = CUSTOMERS.find(c => c.id === selectedCustomer);
    const billData = {
      billNo: billNoRef.current,
      customerName: customer.name, customerId: selectedCustomer, zone: customer.zone,
      items: cart, total: cartTotal,
      paymentType, paidAmount: paidAmt, remainingAmount: remaining,
      photoUrl: photoUrl || null,
      timestamp: new Date().toLocaleTimeString('th-TH'),
      recordedBy: user.name,
    };
    if (isFirebaseReady && db) {
      try {
        setSaving(true);
        const dateKey = new Date().toISOString().split('T')[0]; // "YYYY-MM-DD" partition key
        await addDoc(collection(db, 'sales'), {
          ...billData,
          dateKey,
          items: cart.map(i => ({
            productId: i.productId, productName: i.productName, type: i.type,
            weightKg: i.weight, pricePerKg: i.pricePerKg, lineTotal: i.total, note: i.note || '',
          })),
          createdAt: serverTimestamp(), source: 'koseafood-pos',
        });
        if (remaining > 0) {
          await setDoc(doc(db, 'customerDebts', selectedCustomer), {
            customerId: selectedCustomer, customerName: customer.name, zone: customer.zone,
            totalDebt: increment(remaining),
            lastBillNo: billNoRef.current,
            lastUpdated: serverTimestamp(),
          }, { merge: true });
        }
      } catch (err) { console.error(err); }
      finally { setSaving(false); }
    }
    let liveD = 0, deadD = 0;
    cart.forEach(i => { if (i.type === 'dead') deadD += i.weight; else liveD += i.weight; });
    updateMainStock(Math.max(0, stock.live - liveD), Math.max(0, stock.dead - deadD));
    onSaveBill(billData);
    const payLabel = PAY.find(p => p.id === paymentType)?.label || paymentType;
    alert(`✅ บันทึกบิลสำเร็จ!\nยอด: ฿${cartTotal.toLocaleString()} | ${payLabel}${remaining > 0 ? `\nค้าง ฿${remaining.toLocaleString()}` : ''}`);
    setCart([]); setSelectedCustomer('general');
    setPaymentType('cash'); setPaidAmount('');
    setPhotoUrl(null);
    billNoRef.current = `INV-${Date.now().toString().slice(-8)}`;
  };

  const groupedCustomers = CUSTOMERS.reduce((acc, c) => {
    if (!acc[c.zone]) acc[c.zone] = []; acc[c.zone].push(c); return acc;
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
  const [tab, setTab]           = useState('receive');
  const [rcvLive, setRcvLive]   = useState('');
  const [rcvDead, setRcvDead]   = useState('');
  const [rcvCost, setRcvCost]   = useState('');
  const [rcvTransport, setRcvTransport] = useState('');
  const [rcvNote, setRcvNote]   = useState('');
  const [deadWeight, setDeadWeight] = useState('');
  const [saving, setSaving]     = useState(false);

  const liveKg    = parseFloat(rcvLive) || 0;
  const deadKg    = parseFloat(rcvDead) || 0;
  const costPerKg = parseFloat(rcvCost) || 0;
  const transport = parseFloat(rcvTransport) || 0;
  const shrimpCost = (liveKg + deadKg) * costPerKg;
  const grandTotal = shrimpCost + transport;
  const effectiveCost = (liveKg + deadKg) > 0 ? grandTotal / (liveKg + deadKg) : 0;

  const handleReceive = async () => {
    if (!rcvLive && !rcvDead) return alert('ใส่น้ำหนักอย่างน้อย 1 ช่องครับ');
    if (!rcvCost) return alert('ใส่ราคาซื้อ/กก.ด้วยครับ');
    if (isFirebaseReady && db) {
      try {
        setSaving(true);
        await addDoc(collection(db, 'stockBatches'), {
          purchaseDate: serverTimestamp(),
          liveKg, deadKg, costPerKg, transport,
          totalCost: grandTotal, effectiveCostPerKg: effectiveCost,
          remainingLiveKg: liveKg, remainingDeadKg: deadKg,
          note: rcvNote,
        });
      } catch (err) { console.error(err); }
      finally { setSaving(false); }
    }
    updateMainStock(stock.live + liveKg, stock.dead + deadKg);
    alert(`✅ รับกุ้งเข้าสำเร็จ!\nต้นทุน: ฿${grandTotal.toLocaleString()} (฿${effectiveCost.toFixed(2)}/กก.)`);
    setRcvLive(''); setRcvDead(''); setRcvCost(''); setRcvTransport(''); setRcvNote('');
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
  const [dashTab, setDashTab]       = useState('today');
  const [firestoreSales, setFirestoreSales] = useState([]);
  const [customerDebts, setCustomerDebts]   = useState([]);
  const [stockBatches, setStockBatches]     = useState([]);
  const [loading, setLoading]       = useState(true);

  useEffect(() => {
    if (!db) { setLoading(false); return; }
    const unsubs = [];
    const todayKey = new Date().toISOString().split('T')[0];

    // Query today's sales by dateKey partition (composite index: dateKey ASC + createdAt DESC)
    const salesQ = query(
      collection(db, 'sales'),
      where('dateKey', '==', todayKey),
      orderBy('createdAt', 'desc'),
    );
    unsubs.push(onSnapshot(salesQ, snap => {
      setFirestoreSales(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    }, () => {
      // Fallback: load without dateKey filter if index not ready yet
      const fallbackQ = query(collection(db, 'sales'), orderBy('createdAt', 'desc'), limit(100));
      const unsub2 = onSnapshot(fallbackQ, snap => {
        const today = new Date(); today.setHours(0, 0, 0, 0);
        setFirestoreSales(snap.docs.map(d => ({ id: d.id, ...d.data() }))
          .filter(s => s.createdAt?.toDate?.() >= today));
        setLoading(false);
      }, () => setLoading(false));
      unsubs.push(unsub2);
    }));

    unsubs.push(onSnapshot(collection(db, 'customerDebts'), snap => {
      setCustomerDebts(snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(d => (d.totalDebt || 0) > 0));
    }, () => {}));

    const batchQ = query(collection(db, 'stockBatches'), orderBy('purchaseDate', 'desc'), limit(30));
    unsubs.push(onSnapshot(batchQ, snap => {
      setStockBatches(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, () => {}));

    return () => unsubs.forEach(u => u());
  }, []);

  const todaySales = firestoreSales; // already filtered by dateKey in query

  const todayTotal  = todaySales.reduce((s, t) => s + (t.total || 0), 0);
  const todayCash   = todaySales.filter(s => s.paymentType === 'cash').reduce((s, t) => s + t.total, 0);
  const todayTransfer = todaySales.filter(s => s.paymentType === 'transfer').reduce((s, t) => s + t.total, 0);
  const todayCredit = todaySales.filter(s => s.paymentType === 'credit').reduce((s, t) => s + t.total, 0);
  const todayInstall = todaySales.filter(s => s.paymentType === 'installment').reduce((s, t) => s + t.total, 0);
  const totalDebt   = customerDebts.reduce((s, c) => s + (c.totalDebt || 0), 0);

  const payBreakdown = [
    { ...PAY[0], amount: todayCash,     count: todaySales.filter(s => s.paymentType === 'cash').length },
    { ...PAY[1], amount: todayTransfer, count: todaySales.filter(s => s.paymentType === 'transfer').length },
    { ...PAY[2], amount: todayCredit,   count: todaySales.filter(s => s.paymentType === 'credit').length },
    { ...PAY[3], amount: todayInstall,  count: todaySales.filter(s => s.paymentType === 'installment').length },
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
          <p className="text-2xl font-black">{stock.live.toFixed(1)}<span className="text-sm font-normal"> กก.</span></p>
        </div>
        <div className="bg-gradient-to-br from-red-400 to-orange-500 rounded-[2rem] p-5 text-white">
          <p className="text-red-100 text-xs font-bold mb-1">กุ้งตาย</p>
          <p className="text-2xl font-black">{stock.dead.toFixed(1)}<span className="text-sm font-normal"> กก.</span></p>
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

// ─── Nav Button ───────────────────────────────────────────────────────────────

const NavButton = ({ icon, label, isActive, onClick }) => (
  <button onClick={onClick}
    className={`flex flex-col items-center justify-center w-full p-3 transition-all ${isActive ? 'text-blue-600 scale-110' : 'text-slate-400'}`}>
    {React.cloneElement(icon, { size: 24, strokeWidth: isActive ? 2.5 : 2, className: 'mb-1' })}
    <span className={`text-[10px] ${isActive ? 'font-bold' : 'font-medium'}`}>{label}</span>
  </button>
);

createRoot(document.getElementById('root')).render(<App />);
