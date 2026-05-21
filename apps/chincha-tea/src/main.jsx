import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { initializeApp } from 'firebase/app';
import {
  getFirestore, addDoc, collection, onSnapshot,
  orderBy, query, serverTimestamp, where,
} from 'firebase/firestore';
import { getAuth, signInAnonymously } from 'firebase/auth';

// ─── Firebase (chincha-tea app) ───────────────────────────────────────────────

const env = import.meta.env;
const fbConfig = {
  apiKey:            env.VITE_FIREBASE_API_KEY,
  authDomain:        env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId:         env.VITE_FIREBASE_PROJECT_ID,
  storageBucket:     env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId:             env.VITE_FIREBASE_APP_ID,
};
const fbReady = Object.values(fbConfig).every(Boolean);
const fbApp   = fbReady ? initializeApp(fbConfig, 'chincha-tea') : null;
const db      = fbApp ? getFirestore(fbApp, 'chincha') : null;
const auth    = fbApp ? getAuth(fbApp) : null;

// ─── Session management ───────────────────────────────────────────────────────

const SESSION_KEY  = 'chincha-tea-session';
const SESSION_DAYS = 30;

function getSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw);
    if (Date.now() - s.loginAt > SESSION_DAYS * 86400000) { localStorage.removeItem(SESSION_KEY); return null; }
    return s;
  } catch { return null; }
}
function saveSession(m) { localStorage.setItem(SESSION_KEY, JSON.stringify({ ...m, loginAt: Date.now() })); }
function clearSession() { localStorage.removeItem(SESSION_KEY); }

// ─── i18n ─────────────────────────────────────────────────────────────────────

const T = {
  th: {
    appName:'ชินชา', tagline:'คาเฟ่และเครื่องดื่ม',
    orderTab:'รับออเดอร์', historyTab:'ประวัติ', summaryTab:'สรุป', restockTab:'สั่งของ',
    loginTitle:'เข้าสู่ระบบ', phonePlaceholder:'เบอร์โทรศัพท์', namePlaceholder:'ชื่อของคุณ',
    loginBtn:'เข้าระบบ', registerBtn:'สมัครสมาชิก',
    pendingTitle:'รอการอนุมัติ', pendingMsg:'บัญชีของคุณรอการอนุมัติจากเจ้าของร้านครับ',
    menu:'เมนู', total:'ยอดรวม', save:'บันทึก', cancel:'ยกเลิก',
    qty:'จำนวน', size:'ขนาด', sweet:'ความหวาน', ice:'น้ำแข็ง', note:'หมายเหตุ',
    addToOrder:'เพิ่มออเดอร์', items:'รายการ',
    noOrders:'ยังไม่มีออเดอร์วันนี้', saved:'✅ บันทึกสำเร็จ!', loading:'กำลังโหลด...',
    todaySales:'ยอดขายวันนี้', orders:'ออเดอร์', topItems:'เมนูยอดนิยม',
    noice:'ไม่มี', lessice:'น้อย', normalice:'ปกติ', fullice:'เต็ม',
    s:'เล็ก', m:'กลาง', l:'ใหญ่', logout:'ออกจากระบบ',
    thaiTea:'ชาไทย', greenTea:'ชาเขียว', coffee:'กาแฟ', thaiCoffee:'โอเลี้ยง',
    milk:'นมสด', lemonTea:'ชามะนาว', matcha:'มัทฉะ', cocoa:'โกโก้',
    taro:'เผือก', strawberry:'สตรอว์เบอร์รี',
  },
  my: {
    appName:'ချင်ချာ', tagline:'ကော်ဖီဆိုင်',
    orderTab:'အော်ဒါ', historyTab:'မှတ်တမ်း', summaryTab:'အကျဉ်း', restockTab:'မှာမည်',
    loginTitle:'ဝင်ရောက်မည်', phonePlaceholder:'ဖုန်းနံပါတ်', namePlaceholder:'နာမည်',
    loginBtn:'ဝင်မည်', registerBtn:'မှတ်ပုံတင်မည်',
    pendingTitle:'ခွင့်ပြုချက်စောင့်ဆိုင်းနေသည်', pendingMsg:'ဆိုင်ရှင်၏ ခွင့်ပြုချက်ကို စောင့်ဆိုင်းပါ',
    menu:'မီနူး', total:'စုစုပေါင်း', save:'သိမ်းမည်', cancel:'ပယ်ဖျက်',
    qty:'အရေ', size:'အရွယ်', sweet:'ချိုမှု', ice:'ရေခဲ', note:'မှတ်ချက်',
    addToOrder:'ထည့်မည်', items:'ပစ္စည်း',
    noOrders:'အော်ဒါမရှိ', saved:'✅ သိမ်းပြီး!', loading:'ခဏစောင့်ပါ...',
    todaySales:'ယနေ့ဝင်ငွေ', orders:'အော်ဒါ', topItems:'လူကြိုက်မျှ',
    noice:'ရေခဲမပါ', lessice:'နည်း', normalice:'ပုံမှန်', fullice:'များ',
    s:'S', m:'M', l:'L', logout:'ထွက်မည်',
    thaiTea:'ထိုင်းချာ', greenTea:'ချာစိမ်း', coffee:'ကော်ဖီ', thaiCoffee:'ထိုင်းကော်ဖီ',
    milk:'နွားနို့', lemonTea:'သံပုရာချာ', matcha:'မပ်ချာ', cocoa:'ကိုကိုး',
    taro:'တာရို', strawberry:'စတော်ဘယ်ရီ',
  },
  en: {
    appName:'CHINCHA', tagline:'Café & Drinks',
    orderTab:'Order', historyTab:'History', summaryTab:'Summary', restockTab:'Restock',
    loginTitle:'Sign In', phonePlaceholder:'Phone number', namePlaceholder:'Your name',
    loginBtn:'Sign In', registerBtn:'Register',
    pendingTitle:'Waiting for Approval', pendingMsg:'Your account is pending approval from the owner.',
    menu:'Menu', total:'Total', save:'Save', cancel:'Cancel',
    qty:'Qty', size:'Size', sweet:'Sweet', ice:'Ice', note:'Note',
    addToOrder:'Add to Order', items:'items',
    noOrders:'No orders today', saved:'✅ Saved!', loading:'Loading...',
    todaySales:"Today's Sales", orders:'Orders', topItems:'Top Items',
    noice:'No Ice', lessice:'Less', normalice:'Normal', fullice:'Full',
    s:'S', m:'M', l:'L', logout:'Sign out',
    thaiTea:'Thai Tea', greenTea:'Green Tea', coffee:'Coffee', thaiCoffee:'Thai Iced Coffee',
    milk:'Fresh Milk', lemonTea:'Lemon Tea', matcha:'Matcha', cocoa:'Cocoa',
    taro:'Taro', strawberry:'Strawberry',
  },
};

// ─── Menu Data ────────────────────────────────────────────────────────────────

const MENU = [
  { id:'thai-tea',    key:'thaiTea',    basePrice:30, emoji:'🧋', bg:'bg-orange-50',  border:'border-orange-200'  },
  { id:'green-tea',   key:'greenTea',   basePrice:30, emoji:'🍵', bg:'bg-green-50',   border:'border-green-200'   },
  { id:'coffee',      key:'coffee',     basePrice:35, emoji:'☕', bg:'bg-amber-50',   border:'border-amber-200'   },
  { id:'thai-coffee', key:'thaiCoffee', basePrice:35, emoji:'🥤', bg:'bg-yellow-50',  border:'border-yellow-200'  },
  { id:'milk',        key:'milk',       basePrice:25, emoji:'🥛', bg:'bg-sky-50',     border:'border-sky-200'     },
  { id:'lemon-tea',   key:'lemonTea',   basePrice:30, emoji:'🍋', bg:'bg-lime-50',    border:'border-lime-200'    },
  { id:'matcha',      key:'matcha',     basePrice:35, emoji:'🍃', bg:'bg-emerald-50', border:'border-emerald-200' },
  { id:'cocoa',       key:'cocoa',      basePrice:35, emoji:'🍫', bg:'bg-stone-100',  border:'border-stone-300'   },
  { id:'taro',        key:'taro',       basePrice:50, emoji:'🫐', bg:'bg-purple-50',  border:'border-purple-200'  },
  { id:'strawberry',  key:'strawberry', basePrice:50, emoji:'🍓', bg:'bg-pink-50',    border:'border-pink-200'    },
];

const SIZES = [
  { id:'22oz', label:'22oz', addPrice:0  },
  { id:'32oz', label:'32oz', addPrice:15 },
];

const TOPPINGS = [
  { id:'pearl',       label:'ไข่มุก',       price:10 },
  { id:'coco-jelly',  label:'วุ้นมะพร้าว', price:10 },
  { id:'grass-jelly', label:'เฉาก๊วย',     price:10 },
  { id:'taro-ball',   label:'บัวลอย',       price:10 },
  { id:'popping',     label:'ไข่มุกป๊อบ',  price:15 },
];

// ─── Restock Static Data ──────────────────────────────────────────────────────

const RESTOCK_ITEMS = [
  {
    category: 'เครื่องปรุง & วัตถุดิบ',
    emoji: '🧂',
    items: [
      { id: 'thai-tea-powder',    name: 'ชาไทย (ผง)',    emoji: '🧡' },
      { id: 'fresh-milk',         name: 'นมสด (กล่อง)', emoji: '🥛' },
      { id: 'lemon-powder',       name: 'มะนาวผง',       emoji: '🍋' },
      { id: 'green-tea-powder',   name: 'ผงชาเขียว',     emoji: '🍵' },
      { id: 'matcha-powder',      name: 'ผงมัทฉะ',       emoji: '🍃' },
      { id: 'cocoa-powder',       name: 'โกโก้ (ผง)',    emoji: '🍫' },
      { id: 'ground-coffee',      name: 'กาแฟคั่วบด',    emoji: '☕' },
    ],
  },
  {
    category: 'อุปกรณ์บรรจุภัณฑ์',
    emoji: '📦',
    items: [
      { id: 'cup-22oz-95mm',      name: 'แก้ว (22oz) ปาก 95mm',     emoji: '🥤' },
      { id: 'lid-95mm-semidome',  name: 'ฝากึ่งโดมตัดเรียบ 95mm',   emoji: '🫙' },
      { id: 'bubble-straw',       name: 'หลอดไข่มุก',               emoji: '🫧' },
    ],
  },
];

// ─── useLang hook ─────────────────────────────────────────────────────────────

function useLang() {
  const [lang, _setLang] = useState(() => localStorage.getItem('chincha-lang') || 'th');
  const setLang = (l) => { _setLang(l); localStorage.setItem('chincha-lang', l); };
  const t = (key) => T[lang]?.[key] ?? T.th?.[key] ?? key;
  return { lang, setLang, t };
}

// ─── LoginScreen ──────────────────────────────────────────────────────────────

function LoginScreen({ onLogin, lang, setLang }) {
  const t = (key) => T[lang]?.[key] ?? T.th?.[key] ?? key;
  const [mode,    setMode]    = useState('login');
  const [phone,   setPhone]   = useState('');
  const [name,    setName]    = useState('');
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');

  const handleSubmit = async () => {
    const p = phone.trim().replace(/\D/g, '');
    if (p.length < 9) { setError('กรุณากรอกเบอร์โทรให้ถูกต้อง'); return; }
    if (mode === 'register' && !name.trim()) { setError('กรุณากรอกชื่อ'); return; }
    const projectId = env.VITE_FIREBASE_PROJECT_ID;
    if (!projectId) { setError('Firebase config ไม่ครบ'); return; }
    setLoading(true); setError('');
    const BASE = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/chincha/documents`;
    const mkT  = (ms) => new Promise((_, r) => setTimeout(() => r(new Error('timeout')), ms));
    try {
      const resp = await Promise.race([fetch(`${BASE}/members/${p}`), mkT(12000)]);
      if (resp.status === 403) throw new Error('ไม่มีสิทธิ์เข้าถึง');
      if (resp.status !== 200 && resp.status !== 404) throw new Error(`HTTP ${resp.status}`);
      if (resp.status === 404) {
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
        else { setMode('pending'); }
        return;
      }
      const json = await resp.json();
      const f    = json.fields || {};
      const memberName = f.name?.stringValue || 'สมาชิก';
      const approved   = f.approved?.booleanValue || false;
      if (!approved) { setMode('pending'); return; }
      onLogin({ name: memberName, phone: p });
    } catch (e) {
      setError(e?.message || 'เชื่อมต่อไม่ได้ ลองใหม่ครับ');
    } finally {
      setLoading(false);
    }
  };

  if (mode === 'pending') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-8 text-center"
        style={{ background:'linear-gradient(160deg,#3d1f0f 0%,#6b3a2a 60%,#3d1f0f 100%)' }}>
        <div className="text-6xl mb-6">⏳</div>
        <h2 className="text-2xl font-black text-amber-300 mb-3">{t('pendingTitle')}</h2>
        <p className="text-amber-500 text-sm leading-relaxed max-w-xs">{t('pendingMsg')}</p>
        <button onClick={() => setMode('login')} className="mt-8 px-6 py-3 rounded-2xl font-bold text-amber-900 bg-amber-300 active:scale-95">
          ← กลับ
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 max-w-md mx-auto relative overflow-hidden"
      style={{ background:'linear-gradient(160deg,#3d1f0f 0%,#6b3a2a 60%,#3d1f0f 100%)' }}>
      <div className="absolute inset-0 opacity-[0.06]"
        style={{ backgroundImage:'url(/chincha-logo.jpg)', backgroundSize:'110px', backgroundRepeat:'repeat' }} />

      <div className="relative z-10 text-center mb-10 w-full">
        <img src="/chincha-logo.jpg" alt="CHINCHA" className="w-44 h-44 rounded-full object-cover mx-auto mb-5 border-4 border-amber-300 shadow-2xl" />
        <h1 className="text-4xl font-black text-amber-300 tracking-widest">CHINCHA</h1>
        <p className="text-amber-500 text-sm mt-1">{t('tagline')}</p>
        <div className="flex justify-center gap-2 mt-5">
          {['th','my','en'].map(l => (
            <button key={l} onClick={() => setLang(l)}
              className={`px-4 py-1.5 rounded-full text-xs font-bold border-2 transition-all ${lang===l ? 'bg-amber-300 text-amber-900 border-amber-300' : 'text-amber-400 border-amber-700'}`}>
              {l==='th'?'ไทย':l==='my'?'မြန်မာ':'EN'}
            </button>
          ))}
        </div>
      </div>

      <div className="relative z-10 w-full space-y-3">
        <input
          type="tel" inputMode="numeric" value={phone} onChange={e => setPhone(e.target.value)}
          placeholder={t('phonePlaceholder')}
          className="w-full p-4 rounded-2xl text-stone-800 font-bold text-base outline-none bg-white/90"
        />
        {mode === 'register' && (
          <input
            type="text" value={name} onChange={e => setName(e.target.value)}
            placeholder={t('namePlaceholder')}
            className="w-full p-4 rounded-2xl text-stone-800 font-bold text-base outline-none bg-white/90"
          />
        )}
        {error && <p className="text-red-300 text-sm text-center font-bold">{error}</p>}
        <button onClick={handleSubmit} disabled={loading}
          className="w-full py-4 rounded-2xl font-black text-amber-900 text-lg bg-amber-300 shadow-lg active:scale-95 disabled:opacity-60 transition-all">
          {loading ? '⏳ กำลังตรวจสอบ...' : mode === 'register' ? t('registerBtn') : t('loginBtn')}
        </button>
        <button onClick={() => { setMode(m => m === 'login' ? 'register' : 'login'); setError(''); }}
          className="w-full py-3 text-amber-400 text-sm font-bold">
          {mode === 'login' ? '→ สมัครสมาชิกใหม่' : '← มีบัญชีแล้ว'}
        </button>
      </div>
    </div>
  );
}

// ─── App ──────────────────────────────────────────────────────────────────────

function App() {
  const { lang, setLang, t } = useLang();
  const [member, setMember] = useState(undefined);
  const [tab, setTab]       = useState('order');
  const [cart, setCart]     = useState([]);
  const [modal, setModal]   = useState(null);
  const [orders, setOrders] = useState([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const s = getSession();
    if (s) {
      if (auth) {
        signInAnonymously(auth).catch(() => {}).finally(() => setMember(s));
      } else {
        setMember(s);
      }
    } else {
      setMember(null);
    }
  }, []);

  useEffect(() => {
    if (!db || !member) return;
    const dateKey = new Date().toISOString().split('T')[0];
    const q = query(collection(db, 'teaOrders'), where('dateKey','==',dateKey), orderBy('createdAt','desc'));
    const unsub = onSnapshot(q, snap => {
      setOrders(snap.docs.map(d => ({ id:d.id, ...d.data() })));
    }, () => {
      const q2 = query(collection(db, 'teaOrders'), orderBy('createdAt','desc'));
      onSnapshot(q2, snap => setOrders(snap.docs.map(d => ({ id:d.id, ...d.data() })).slice(0,50)), () => {});
    });
    return unsub;
  }, [member]);

  const handleLogin = async (memberData) => {
    saveSession(memberData);
    if (auth) { try { await signInAnonymously(auth); } catch {} }
    setMember(memberData);
  };

  const handleLogout = () => {
    if (!window.confirm(t('logout') + '?')) return;
    clearSession();
    setMember(null);
  };

  const addToCart  = (item) => { setCart(c => [...c, { ...item, cartId: Date.now() }]); setModal(null); };
  const removeCart = (id)   => setCart(c => c.filter(i => i.cartId !== id));
  const cartTotal  = cart.reduce((s, i) => s + i.price * i.qty, 0);

  const saveOrder = async () => {
    if (!cart.length) return;
    setSaving(true);
    const dateKey = new Date().toISOString().split('T')[0];
    if (db) {
      try {
        await addDoc(collection(db, 'teaOrders'), {
          dateKey, items: cart, total: cartTotal,
          createdBy: member?.name || 'ชินชา', lang,
          createdAt: serverTimestamp(),
        });
      } catch (e) { console.error(e); }
    }
    alert(t('saved'));
    setCart([]);
    setSaving(false);
  };

  // Loading
  if (member === undefined) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background:'#3d1f0f' }}>
        <div className="text-center">
          <img src="/chincha-logo.jpg" alt="CHINCHA" className="w-28 h-28 rounded-full object-cover mx-auto mb-3 border-4 border-amber-300" />
          <p className="text-amber-300 text-sm">{t('loading')}</p>
        </div>
      </div>
    );
  }

  // Login
  if (!member) {
    return <LoginScreen onLogin={handleLogin} lang={lang} setLang={setLang} />;
  }

  // Main App
  return (
    <div className="max-w-md mx-auto h-screen flex flex-col relative overflow-hidden"
      style={{ background:'#fdf6f0' }}>

      {/* Watermark pattern */}
      <div className="absolute inset-0 pointer-events-none z-0 opacity-[0.04]"
        style={{ backgroundImage:'url(/chincha-logo.jpg)', backgroundSize:'110px', backgroundRepeat:'repeat' }} />

      {/* Header */}
      <div className="z-10 shrink-0 px-4 pt-6 pb-4 flex items-center justify-between"
        style={{ background:'#3d1f0f' }}>
        <div className="flex items-center gap-3">
          <img src="/chincha-logo.jpg" alt="CHINCHA" className="w-10 h-10 rounded-full object-cover border-2 border-amber-300 shrink-0" />
          <div>
            <p className="font-black text-amber-300 leading-none">{t('appName')}</p>
            <p className="text-amber-700 text-[10px] mt-0.5 truncate max-w-[140px]">{member.name}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-xl overflow-hidden border border-amber-800" style={{ background:'#5a2d14' }}>
            {['th','my','en'].map(l => (
              <button key={l} onClick={() => setLang(l)}
                className={`px-2 py-1.5 text-[10px] font-bold transition-all ${lang===l ? 'bg-amber-300 text-amber-900' : 'text-amber-500'}`}>
                {l==='th'?'TH':l==='my'?'MY':'EN'}
              </button>
            ))}
          </div>
          <button onClick={handleLogout}
            className="w-9 h-9 rounded-full border border-amber-800 flex items-center justify-center text-amber-500 active:scale-95"
            style={{ background:'#5a2d14' }}>
            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h6a2 2 0 012 2v1" />
            </svg>
          </button>
        </div>
      </div>

      {/* Tab bar */}
      <div className="z-10 shrink-0 flex px-4 pt-3 pb-1 gap-1.5" style={{ background:'#fdf6f0' }}>
        {[['order',t('orderTab')],['history',t('historyTab')],['summary',t('summaryTab')],['restock',t('restockTab')]].map(([id,label]) => (
          <button key={id} onClick={() => setTab(id)}
            className={`flex-1 py-2.5 rounded-2xl font-bold text-[11px] transition-all ${tab===id ? 'text-white' : 'text-stone-500 bg-stone-200'}`}
            style={tab===id ? { background:'#3d1f0f' } : {}}>
            {label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto z-10" style={{ scrollbarWidth:'none' }}>

        {/* ── ORDER TAB ─────────────────────────────────────────────── */}
        {tab === 'order' && (
          <div className="px-4 pb-6">
            <p className="text-[11px] font-bold text-stone-400 mt-3 mb-2 tracking-widest uppercase">{t('menu')}</p>
            <div className="grid grid-cols-2 gap-3 mb-5">
              {MENU.map(item => (
                <button key={item.id} onClick={() => setModal(item)}
                  className={`${item.bg} border-2 ${item.border} rounded-3xl p-4 text-left active:scale-95 transition-all shadow-sm`}>
                  <div className="text-4xl mb-2">{item.emoji}</div>
                  <p className="font-black text-stone-800 text-sm">{t(item.key)}</p>
                  <p className="text-stone-500 text-sm font-bold mt-0.5">฿{item.basePrice}</p>
                </button>
              ))}
            </div>

            {cart.length > 0 && (
              <div className="bg-white rounded-3xl shadow-sm p-4 border border-stone-200">
                <p className="font-bold text-stone-600 text-xs mb-3 uppercase tracking-wide">{t('items')}: {cart.length}</p>
                <div className="space-y-2 mb-4">
                  {cart.map(item => (
                    <div key={item.cartId} className="flex justify-between items-start pb-2 border-b border-stone-100">
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-stone-800 text-sm">{item.emoji} {t(item.key)}</p>
                        <p className="text-[11px] text-stone-400 mt-0.5">
                          {item.size}
                          {item.toppings?.length > 0 ? ` · ${item.toppings.map(tp => tp.label).join(', ')}` : ''}
                          {` · ×${item.qty}`}
                          {item.note ? <span className="text-orange-500 ml-1">*{item.note}</span> : null}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 ml-3 shrink-0">
                        <p className="font-black text-sm" style={{ color:'#6b3a2a' }}>฿{item.price * item.qty}</p>
                        <button onClick={() => removeCart(item.cartId)}
                          className="w-9 h-9 rounded-full bg-red-50 text-red-400 font-black flex items-center justify-center active:scale-90 text-base">×</button>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex justify-between items-center">
                  <div>
                    <p className="text-[10px] text-stone-400 font-bold uppercase tracking-wide">{t('total')}</p>
                    <p className="text-4xl font-black leading-none mt-0.5" style={{ color:'#3d1f0f' }}>฿{cartTotal.toLocaleString()}</p>
                    <p className="text-[10px] text-stone-400 mt-1">{cart.reduce((s,i) => s + i.qty, 0)} {t('items')}</p>
                  </div>
                  <button onClick={saveOrder} disabled={saving}
                    className="text-white font-black px-7 py-3.5 rounded-2xl shadow-lg active:scale-95 disabled:opacity-60 text-base"
                    style={{ background:'#3d1f0f' }}>
                    {saving ? '...' : t('save')}
                  </button>
                </div>
              </div>
            )}

            {cart.length === 0 && (
              <div className="text-center py-10 text-stone-300">
                <p className="text-6xl mb-3">🧋</p>
                <p className="font-bold text-sm">{t('noOrders')}</p>
              </div>
            )}
          </div>
        )}

        {/* ── HISTORY TAB ───────────────────────────────────────────── */}
        {tab === 'history' && (
          <div className="px-4 pt-3 pb-6 space-y-3">
            {orders.length === 0
              ? <div className="text-center py-12 text-stone-300"><p className="text-6xl mb-3">📋</p><p className="font-bold">{t('noOrders')}</p></div>
              : orders.map((o, i) => (
                <div key={o.id||i} className="bg-white rounded-2xl p-4 shadow-sm border border-stone-200">
                  <div className="flex justify-between mb-2">
                    <p className="text-xs text-stone-400">
                      {o.createdAt?.toDate?.()?.toLocaleTimeString('th-TH', { hour:'2-digit', minute:'2-digit' }) || '—'}
                      {o.createdBy && <span className="ml-2 text-stone-300">· {o.createdBy}</span>}
                    </p>
                    <p className="font-black text-base" style={{ color:'#3d1f0f' }}>฿{(o.total||0).toLocaleString()}</p>
                  </div>
                  {(o.items||[]).map((it, j) => (
                    <div key={j} className="text-sm text-stone-600">
                      <span className="font-medium">{it.emoji} {it.qty}× {it.nameSnapshot || it.key}</span>
                      {(it.size || it.toppings?.length > 0) && (
                        <span className="text-xs text-stone-400 ml-1">
                          ({[it.size, ...(it.toppings||[]).map(tp => tp.label)].filter(Boolean).join(' · ')})
                        </span>
                      )}
                      <span className="font-bold ml-1">— ฿{(it.price||0) * (it.qty||1)}</span>
                    </div>
                  ))}
                </div>
              ))
            }
          </div>
        )}

        {/* ── SUMMARY TAB ───────────────────────────────────────────── */}
        {tab === 'summary' && <SummaryTab orders={orders} t={t} />}

        {/* ── RESTOCK TAB ───────────────────────────────────────────── */}
        {tab === 'restock' && <RestockTab member={member} />}
      </div>

      {/* Customize Modal */}
      {modal && <CustomizeModal item={modal} t={t} onAdd={addToCart} onClose={() => setModal(null)} />}

      <style>{`
        body { background: #fdf6f0; }
        ::-webkit-scrollbar { display: none; }
      `}</style>
    </div>
  );
}

// ─── Customize Modal ──────────────────────────────────────────────────────────

function CustomizeModal({ item, t, onAdd, onClose }) {
  const [selectedSize,     setSelectedSize]     = useState(SIZES[0]);
  const [selectedToppings, setSelectedToppings] = useState([]);
  const [qty,              setQty]              = useState(1);
  const [note,             setNote]             = useState('');

  const toppingTotal = selectedToppings.reduce((s, tp) => s + tp.price, 0);
  const unitPrice    = item.basePrice + selectedSize.addPrice + toppingTotal;
  const lineTotal    = unitPrice * qty;

  const toggleTopping = (tp) => {
    setSelectedToppings(prev =>
      prev.find(x => x.id === tp.id) ? prev.filter(x => x.id !== tp.id) : [...prev, tp]
    );
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-end justify-center" onClick={onClose}>
      <div className="bg-white w-full max-w-md rounded-t-[2rem] p-6 space-y-5"
        style={{ paddingBottom:'max(1.5rem,env(safe-area-inset-bottom))' }}
        onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center gap-3">
          <span className="text-4xl">{item.emoji}</span>
          <div className="flex-1">
            <h2 className="font-black text-stone-800 text-xl">{t(item.key)}</h2>
            <p className="text-stone-400 text-sm">
              ฿{item.basePrice}
              {selectedSize.addPrice > 0 && <span className="text-amber-600"> +{selectedSize.addPrice}</span>}
              {toppingTotal > 0 && <span className="text-amber-600"> +{toppingTotal}</span>}
              {' = '}<strong style={{ color:'#3d1f0f' }}>฿{lineTotal}</strong>
            </p>
          </div>
          <button onClick={onClose} className="text-stone-300 text-3xl leading-none w-9 h-9 flex items-center justify-center">×</button>
        </div>

        {/* Size */}
        <div>
          <p className="text-[11px] font-bold text-stone-400 mb-2 uppercase tracking-wide">{t('size')}</p>
          <div className="flex gap-2">
            {SIZES.map(s => (
              <button key={s.id} onClick={() => setSelectedSize(s)}
                className={`flex-1 py-3 rounded-2xl font-black text-sm border-2 transition-all ${selectedSize.id === s.id ? 'text-white border-transparent' : 'text-stone-500 border-stone-200'}`}
                style={selectedSize.id === s.id ? { background:'#3d1f0f' } : {}}>
                {s.label}
                {s.addPrice > 0
                  ? <span className="block text-xs font-normal">+{s.addPrice} บ.</span>
                  : <span className="block text-xs font-normal">ราคาเริ่มต้น</span>
                }
              </button>
            ))}
          </div>
        </div>

        {/* Toppings */}
        <div>
          <p className="text-[11px] font-bold text-stone-400 mb-2 uppercase tracking-wide">ท็อปปิ้ง</p>
          <div className="grid grid-cols-2 gap-2">
            {TOPPINGS.map(tp => {
              const selected = !!selectedToppings.find(x => x.id === tp.id);
              return (
                <button key={tp.id} onClick={() => toggleTopping(tp)}
                  className={`flex items-center gap-2 px-3 py-2.5 rounded-2xl border-2 transition-all text-left ${
                    selected ? 'border-amber-400 bg-amber-50' : 'border-stone-200 bg-white'
                  }`}>
                  <div className={`w-4 h-4 rounded-md border-2 flex items-center justify-center shrink-0 transition-all ${
                    selected ? 'bg-amber-500 border-amber-500' : 'border-stone-300'
                  }`}>
                    {selected && <span className="text-white text-[10px] font-black leading-none">✓</span>}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-stone-700 truncate">{tp.label}</p>
                    <p className="text-[10px] text-amber-600 font-bold">+{tp.price} บ.</p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Qty */}
        <div className="flex items-center">
          <p className="text-[11px] font-bold text-stone-400 uppercase tracking-wide">{t('qty')}</p>
          <div className="flex items-center gap-4 ml-auto">
            <button onClick={() => setQty(q => Math.max(1,q-1))}
              className="w-10 h-10 rounded-full text-xl font-bold flex items-center justify-center bg-stone-100 text-stone-700 active:scale-90">−</button>
            <span className="text-2xl font-black text-stone-800 w-8 text-center">{qty}</span>
            <button onClick={() => setQty(q => q+1)}
              className="w-10 h-10 rounded-full text-xl font-bold flex items-center justify-center text-white active:scale-90"
              style={{ background:'#3d1f0f' }}>+</button>
          </div>
        </div>

        {/* Note */}
        <input type="text" value={note} onChange={e => setNote(e.target.value)} placeholder={t('note')}
          className="w-full p-3 bg-stone-50 border border-stone-200 rounded-2xl text-sm outline-none" />

        {/* Add button */}
        <button onClick={() => onAdd({
          key: item.key, emoji: item.emoji, nameSnapshot: t(item.key),
          size: selectedSize.label, toppings: selectedToppings,
          price: unitPrice, qty, note, cartId: Date.now(),
        })}
          className="w-full py-4 rounded-2xl font-black text-white text-lg shadow-lg active:scale-95"
          style={{ background:'#3d1f0f' }}>
          {t('addToOrder')} · ฿{lineTotal}
        </button>
      </div>
    </div>
  );
}

// ─── Summary Tab ──────────────────────────────────────────────────────────────

function SummaryTab({ orders, t }) {
  const total     = orders.reduce((s, o) => s + (o.total||0), 0);
  const allItems  = orders.flatMap(o => o.items||[]);
  const totalCups = allItems.reduce((s, i) => s + (i.qty||1), 0);
  const countMap  = {};
  allItems.forEach(i => { countMap[i.key] = (countMap[i.key]||0) + (i.qty||1); });
  const topItems  = Object.entries(countMap).sort((a,b) => b[1]-a[1]).slice(0,3);
  const maxCount  = topItems[0]?.[1] || 1;

  return (
    <div className="px-4 pt-3 pb-6 space-y-3">
      {/* Hero stats */}
      <div className="rounded-3xl p-5 text-white shadow-lg" style={{ background:'#3d1f0f' }}>
        <p className="text-amber-600 text-[10px] font-bold mb-3 uppercase tracking-widest">{t('todaySales')}</p>
        <div className="flex items-end gap-4">
          <div>
            <p className="text-[11px] text-amber-600 font-bold uppercase tracking-wide mb-0.5">ยอดรวม</p>
            <p className="text-5xl font-black text-amber-200 leading-none">฿{total.toLocaleString()}</p>
          </div>
          <div className="pb-1">
            <p className="text-[11px] text-amber-600 font-bold uppercase tracking-wide mb-0.5">แก้วทั้งหมด</p>
            <p className="text-4xl font-black text-amber-300 leading-none">{totalCups}<span className="text-lg font-bold text-amber-600 ml-1">แก้ว</span></p>
          </div>
        </div>
        <p className="text-amber-700 text-xs mt-3">{orders.length} {t('orders')}</p>
      </div>

      {/* Top 3 mini chart */}
      <div className="bg-white rounded-3xl p-4 shadow-sm border border-stone-200">
        <p className="font-bold text-stone-500 text-[10px] uppercase tracking-widest mb-3">{t('topItems')} · Top 3</p>
        {topItems.length === 0
          ? <p className="text-stone-300 text-sm text-center py-3">{t('noOrders')}</p>
          : topItems.map(([key, count], idx) => {
              const m = MENU.find(x => x.key === key);
              const medals = ['🥇','🥈','🥉'];
              return (
                <div key={key} className="flex items-center gap-2 mb-2.5 last:mb-0">
                  <span className="text-base w-6 text-center">{medals[idx]}</span>
                  <span className="text-xl">{m?.emoji || '☕'}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-center mb-1">
                      <p className="font-bold text-stone-700 text-xs truncate">{t(key)}</p>
                      <p className="font-black text-xs ml-2 shrink-0" style={{ color:'#6b3a2a' }}>{count} แก้ว</p>
                    </div>
                    <div className="h-1.5 bg-stone-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{ background:'#c87941', width:`${(count/maxCount*100).toFixed(0)}%` }} />
                    </div>
                  </div>
                </div>
              );
            })
        }
      </div>
    </div>
  );
}

// ─── Restock Tab ─────────────────────────────────────────────────────────────

function buildInitialRestockState() {
  const s = {};
  RESTOCK_ITEMS.forEach(cat => cat.items.forEach(item => {
    s[item.id] = { status: 'normal', qty: 1 };
  }));
  return s;
}

function RestockTab({ member }) {
  const [items,       setItems]       = useState(buildInitialRestockState);
  const [customItems, setCustomItems] = useState([]);
  const [customInput, setCustomInput] = useState('');
  const [saving,      setSaving]      = useState(false);
  const [flash,       setFlash]       = useState('');

  const STATUS_CFG = [
    { key: 'normal', label: 'ปกติ',      active: 'bg-emerald-100 text-emerald-700 border-emerald-300' },
    { key: 'low',    label: 'เหลือน้อย', active: 'bg-amber-100 text-amber-700 border-amber-300'     },
    { key: 'out',    label: 'หมดแล้ว',   active: 'bg-red-100 text-red-600 border-red-300'            },
  ];

  const setStatus = (id, status) =>
    setItems(prev => ({ ...prev, [id]: { ...prev[id], status } }));

  const adjQty = (id, delta) =>
    setItems(prev => ({ ...prev, [id]: { ...prev[id], qty: Math.max(1, (prev[id].qty||1) + delta) } }));

  const addCustomItem = () => {
    const name = customInput.trim();
    if (!name) return;
    setCustomItems(prev => [...prev, { cid: Date.now(), name, qty: 1, status: 'out' }]);
    setCustomInput('');
  };

  const setCustomStatus = (cid, status) =>
    setCustomItems(prev => prev.map(i => i.cid === cid ? { ...i, status } : i));

  const adjCustomQty = (cid, delta) =>
    setCustomItems(prev => prev.map(i => i.cid === cid ? { ...i, qty: Math.max(1, i.qty + delta) } : i));

  const removeCustom = (cid) =>
    setCustomItems(prev => prev.filter(i => i.cid !== cid));

  const handleSubmit = async () => {
    setSaving(true);
    const payload = [];
    RESTOCK_ITEMS.forEach(cat => cat.items.forEach(item => {
      payload.push({
        id: item.id, name: item.name, category: cat.category,
        status: items[item.id]?.status || 'normal',
        qty:    items[item.id]?.qty    || 1,
      });
    }));
    customItems.forEach(ci => {
      payload.push({ id: `custom-${ci.cid}`, name: ci.name, category: 'เพิ่มเติม', status: ci.status, qty: ci.qty });
    });
    if (db) {
      try {
        await addDoc(collection(db, 'restock_requests'), {
          uid: member?.phone || 'unknown',
          createdBy: member?.name || 'ชินชา',
          items: payload,
          createdAt: serverTimestamp(),
        });
      } catch (e) { console.error(e); }
    }
    setItems(buildInitialRestockState());
    setCustomItems([]);
    setSaving(false);
    setFlash('✅ ส่งรายการแล้ว!');
    setTimeout(() => setFlash(''), 3000);
  };

  return (
    <div className="px-4 pt-3 pb-8">
      {flash && (
        <div className="mb-4 py-3 rounded-2xl text-center font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 text-sm">
          {flash}
        </div>
      )}

      {RESTOCK_ITEMS.map(cat => (
        <div key={cat.category} className="mb-5">
          <p className="text-[11px] font-bold text-stone-400 uppercase tracking-widest mb-2">
            {cat.emoji} {cat.category}
          </p>
          <div className="bg-white rounded-3xl overflow-hidden shadow-sm border border-stone-200 divide-y divide-stone-100">
            {cat.items.map(item => {
              const st  = items[item.id]?.status || 'normal';
              const qty = items[item.id]?.qty    || 1;
              return (
                <div key={item.id} className="p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-2xl">{item.emoji}</span>
                    <p className="flex-1 font-bold text-stone-800 text-sm leading-snug">{item.name}</p>
                    <div className="flex items-center gap-2 shrink-0">
                      <button onClick={() => adjQty(item.id, -1)}
                        className="w-7 h-7 rounded-full bg-stone-100 text-stone-700 font-bold text-sm flex items-center justify-center active:scale-90">−</button>
                      <span className="w-5 text-center font-black text-stone-800 text-sm">{qty}</span>
                      <button onClick={() => adjQty(item.id, +1)}
                        className="w-7 h-7 rounded-full text-white font-bold text-sm flex items-center justify-center active:scale-90"
                        style={{ background:'#6b3a2a' }}>+</button>
                    </div>
                  </div>
                  <div className="flex gap-1.5">
                    {STATUS_CFG.map(s => (
                      <button key={s.key} onClick={() => setStatus(item.id, s.key)}
                        className={`flex-1 py-1.5 rounded-xl font-bold text-[11px] border-2 transition-all ${
                          st === s.key ? s.active : 'border-stone-200 text-stone-400 bg-white'
                        }`}>
                        {s.label}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {/* ── Custom items ── */}
      <div className="mb-5">
        <p className="text-[11px] font-bold text-stone-400 uppercase tracking-widest mb-2">✏️ เพิ่มรายการเอง</p>

        {/* Input row */}
        <div className="flex gap-2 mb-3">
          <input
            type="text" value={customInput} onChange={e => setCustomInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addCustomItem()}
            placeholder="ชื่อสินค้า เช่น ไซรัปวานิลลา..."
            className="flex-1 px-4 py-3 rounded-2xl border-2 border-stone-200 text-sm text-stone-800 outline-none focus:border-amber-400 bg-white"
          />
          <button onClick={addCustomItem}
            className="w-12 h-12 rounded-2xl font-black text-white text-xl flex items-center justify-center active:scale-90 shrink-0"
            style={{ background:'#3d1f0f' }}>+</button>
        </div>

        {customItems.length > 0 && (
          <div className="bg-white rounded-3xl overflow-hidden shadow-sm border border-stone-200 divide-y divide-stone-100">
            {customItems.map(ci => (
              <div key={ci.cid} className="p-4">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-xl">📝</span>
                  <p className="flex-1 font-bold text-stone-800 text-sm">{ci.name}</p>
                  <div className="flex items-center gap-2 shrink-0">
                    <button onClick={() => adjCustomQty(ci.cid, -1)}
                      className="w-7 h-7 rounded-full bg-stone-100 text-stone-700 font-bold text-sm flex items-center justify-center active:scale-90">−</button>
                    <span className="w-5 text-center font-black text-stone-800 text-sm">{ci.qty}</span>
                    <button onClick={() => adjCustomQty(ci.cid, +1)}
                      className="w-7 h-7 rounded-full text-white font-bold text-sm flex items-center justify-center active:scale-90"
                      style={{ background:'#6b3a2a' }}>+</button>
                    <button onClick={() => removeCustom(ci.cid)}
                      className="w-7 h-7 rounded-full bg-red-50 text-red-400 font-black text-base flex items-center justify-center active:scale-90 ml-1">×</button>
                  </div>
                </div>
                <div className="flex gap-1.5">
                  {STATUS_CFG.map(s => (
                    <button key={s.key} onClick={() => setCustomStatus(ci.cid, s.key)}
                      className={`flex-1 py-1.5 rounded-xl font-bold text-[11px] border-2 transition-all ${
                        ci.status === s.key ? s.active : 'border-stone-200 text-stone-400 bg-white'
                      }`}>
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <button onClick={handleSubmit} disabled={saving}
        className="w-full py-4 rounded-2xl font-black text-white text-base shadow-lg active:scale-95 disabled:opacity-60 transition-all"
        style={{ background:'#3d1f0f' }}>
        {saving ? '⏳ กำลังส่ง...' : '📋 ส่งรายการสั่งของ'}
      </button>
    </div>
  );
}

createRoot(document.getElementById('root')).render(<App />);
