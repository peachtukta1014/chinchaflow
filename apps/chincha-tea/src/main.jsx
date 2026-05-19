import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { initializeApp } from 'firebase/app';
import {
  getFirestore, addDoc, collection, onSnapshot,
  orderBy, query, serverTimestamp, where,
} from 'firebase/firestore';
import { getAuth, GoogleAuthProvider, getRedirectResult, onAuthStateChanged, signInWithPopup, signInWithRedirect, signOut } from 'firebase/auth';

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
const db      = fbApp ? getFirestore(fbApp) : null;
const auth    = fbApp ? getAuth(fbApp) : null;

// ─── i18n ─────────────────────────────────────────────────────────────────────

const T = {
  th: {
    appName:'ชินชา', tagline:'คาเฟ่และเครื่องดื่ม',
    orderTab:'รับออเดอร์', historyTab:'ประวัติ', summaryTab:'สรุป',
    loginBtn:'เข้าสู่ระบบด้วย Google',
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
    orderTab:'အော်ဒါ', historyTab:'မှတ်တမ်း', summaryTab:'အကျဉ်း',
    loginBtn:'Google ဖြင့် ဝင်ရောက်မည်',
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
    orderTab:'Order', historyTab:'History', summaryTab:'Summary',
    loginBtn:'Sign in with Google',
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
  { id:'thai-tea',    key:'thaiTea',    S:30, M:35, L:45, emoji:'🧋', bg:'bg-orange-50',  border:'border-orange-200' },
  { id:'green-tea',   key:'greenTea',   S:30, M:35, L:45, emoji:'🍵', bg:'bg-green-50',   border:'border-green-200'  },
  { id:'coffee',      key:'coffee',     S:35, M:40, L:50, emoji:'☕', bg:'bg-amber-50',   border:'border-amber-200'  },
  { id:'thai-coffee', key:'thaiCoffee', S:35, M:40, L:50, emoji:'🥤', bg:'bg-yellow-50',  border:'border-yellow-200' },
  { id:'milk',        key:'milk',       S:25, M:30, L:40, emoji:'🥛', bg:'bg-sky-50',     border:'border-sky-200'    },
  { id:'lemon-tea',   key:'lemonTea',   S:30, M:35, L:45, emoji:'🍋', bg:'bg-lime-50',    border:'border-lime-200'   },
  { id:'matcha',      key:'matcha',     S:35, M:45, L:55, emoji:'🍃', bg:'bg-emerald-50', border:'border-emerald-200'},
  { id:'cocoa',       key:'cocoa',      S:35, M:40, L:50, emoji:'🍫', bg:'bg-stone-100',  border:'border-stone-300'  },
  { id:'taro',        key:'taro',       S:35, M:45, L:55, emoji:'🫐', bg:'bg-purple-50',  border:'border-purple-200' },
  { id:'strawberry',  key:'strawberry', S:35, M:45, L:55, emoji:'🍓', bg:'bg-pink-50',    border:'border-pink-200'   },
];

const SIZES = ['S', 'M', 'L'];
const ICES  = ['noice', 'lessice', 'normalice', 'fullice'];

// ─── useLang hook ─────────────────────────────────────────────────────────────

function useLang() {
  const [lang, _setLang] = useState(() => localStorage.getItem('chincha-lang') || 'th');
  const setLang = (l) => { _setLang(l); localStorage.setItem('chincha-lang', l); };
  const t = (key) => T[lang]?.[key] ?? T.th?.[key] ?? key;
  return { lang, setLang, t };
}

// ─── App ──────────────────────────────────────────────────────────────────────

function App() {
  const { lang, setLang, t } = useLang();
  const [user, setUser]     = useState(undefined);
  const [tab, setTab]       = useState('order');
  const [cart, setCart]     = useState([]);
  const [modal, setModal]   = useState(null);
  const [orders, setOrders] = useState([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!auth) { setUser(null); return; }
    getRedirectResult(auth).catch(() => {});
    return onAuthStateChanged(auth, u => setUser(u ?? null));
  }, []);

  useEffect(() => {
    if (!db) return;
    const dateKey = new Date().toISOString().split('T')[0];
    const q = query(collection(db, 'teaOrders'), where('dateKey','==',dateKey), orderBy('createdAt','desc'));
    const unsub = onSnapshot(q, snap => {
      setOrders(snap.docs.map(d => ({ id:d.id, ...d.data() })));
    }, () => {
      const q2 = query(collection(db, 'teaOrders'), orderBy('createdAt','desc'));
      onSnapshot(q2, snap => setOrders(snap.docs.map(d => ({ id:d.id, ...d.data() })).slice(0,50)), () => {});
    });
    return unsub;
  }, []);

  const handleLogin = async () => {
    if (!auth) return;
    const provider = new GoogleAuthProvider();
    try {
      const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
      if (isMobile) {
        await signInWithRedirect(auth, provider);
      } else {
        await signInWithPopup(auth, provider);
      }
    } catch (err) {
      if (err?.code === 'auth/popup-blocked' || err?.code === 'auth/popup-cancelled-by-user') {
        try { await signInWithRedirect(auth, provider); } catch {}
      }
    }
  };
  const handleLogout = async () => { if (window.confirm(t('logout')+'?') && auth) await signOut(auth); };

  const addToCart    = (item) => { setCart(c => [...c, { ...item, cartId: Date.now() }]); setModal(null); };
  const removeCart   = (id)   => setCart(c => c.filter(i => i.cartId !== id));
  const cartTotal    = cart.reduce((s, i) => s + i.price * i.qty, 0);

  const saveOrder = async () => {
    if (!cart.length) return;
    setSaving(true);
    const dateKey = new Date().toISOString().split('T')[0];
    if (db) {
      try {
        await addDoc(collection(db, 'teaOrders'), {
          dateKey, items: cart, total: cartTotal,
          createdBy: user?.email || 'anon', lang,
          createdAt: serverTimestamp(),
        });
      } catch (e) { console.error(e); }
    }
    alert(t('saved'));
    setCart([]);
    setSaving(false);
  };

  // Loading
  if (user === undefined) {
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
  if (!user) {
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
        <div className="relative z-10 w-full">
          <button onClick={handleLogin}
            className="w-full flex items-center justify-center gap-3 bg-white text-stone-800 font-bold p-4 rounded-2xl shadow-lg active:scale-95 transition-all">
            <svg width="20" height="20" viewBox="0 0 48 48">
              <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
              <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
              <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
              <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
            </svg>
            {t('loginBtn')}
          </button>
        </div>
      </div>
    );
  }

  // Main App
  return (
    <div className="max-w-md mx-auto min-h-screen flex flex-col relative overflow-hidden"
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
            <p className="text-amber-700 text-[10px] mt-0.5 truncate max-w-[140px]">{user.displayName || user.email}</p>
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
      <div className="z-10 shrink-0 flex px-4 pt-3 pb-1 gap-2">
        {[['order',t('orderTab')],['history',t('historyTab')],['summary',t('summaryTab')]].map(([id,label]) => (
          <button key={id} onClick={() => setTab(id)}
            className={`flex-1 py-2.5 rounded-2xl font-bold text-xs transition-all ${tab===id ? 'text-white' : 'text-stone-500 bg-stone-200'}`}
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
                  <p className="text-stone-400 text-xs mt-0.5">฿{item.S} – ฿{item.L}</p>
                </button>
              ))}
            </div>

            {cart.length > 0 && (
              <div className="bg-white rounded-3xl shadow-sm p-4 border border-stone-200">
                <p className="font-bold text-stone-600 text-xs mb-3 uppercase tracking-wide">{t('items')}: {cart.length}</p>
                <div className="space-y-2 mb-4">
                  {cart.map(item => (
                    <div key={item.cartId} className="flex justify-between items-center pb-2 border-b border-stone-100">
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-stone-800 text-sm">{item.emoji} {t(item.key)}</p>
                        <p className="text-[11px] text-stone-400">
                          {t(item.sizeKey)} · {item.sweet} · {t(item.iceKey)} · ×{item.qty}
                          {item.note ? <span className="text-orange-500 ml-1">*{item.note}</span> : null}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 ml-2">
                        <p className="font-black" style={{ color:'#6b3a2a' }}>฿{item.price * item.qty}</p>
                        <button onClick={() => removeCart(item.cartId)}
                          className="w-6 h-6 rounded-full bg-red-100 text-red-500 text-sm font-black flex items-center justify-center">×</button>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex justify-between items-center">
                  <div>
                    <p className="text-[11px] text-stone-400 font-bold uppercase">{t('total')}</p>
                    <p className="text-3xl font-black" style={{ color:'#3d1f0f' }}>฿{cartTotal.toLocaleString()}</p>
                  </div>
                  <button onClick={saveOrder} disabled={saving}
                    className="text-white font-black px-6 py-3 rounded-2xl shadow-lg active:scale-95 disabled:opacity-60"
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
                      {o.createdBy && <span className="ml-2 text-stone-300">· {o.createdBy.split('@')[0]}</span>}
                    </p>
                    <p className="font-black text-base" style={{ color:'#3d1f0f' }}>฿{(o.total||0).toLocaleString()}</p>
                  </div>
                  {(o.items||[]).map((it, j) => (
                    <p key={j} className="text-sm text-stone-600">
                      {it.emoji} {it.qty}× {it.nameSnapshot || it.key} ({it.sizeKey?.toUpperCase()}) — ฿{it.price * it.qty}
                    </p>
                  ))}
                </div>
              ))
            }
          </div>
        )}

        {/* ── SUMMARY TAB ───────────────────────────────────────────── */}
        {tab === 'summary' && <SummaryTab orders={orders} t={t} />}
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
  const [size,  setSize]  = useState('M');
  const [sweet, setSweet] = useState('50%');
  const [ice,   setIce]   = useState('normalice');
  const [qty,   setQty]   = useState(1);
  const [note,  setNote]  = useState('');

  const priceMap = { S: item.S, M: item.M, L: item.L };
  const price    = priceMap[size];
  const sizeKey  = size === 'S' ? 's' : size === 'M' ? 'm' : 'l';

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-end justify-center" onClick={onClose}>
      <div className="bg-white w-full max-w-md rounded-t-[2rem] p-6 space-y-5"
        style={{ paddingBottom:'max(1.5rem,env(safe-area-inset-bottom))' }}
        onClick={e => e.stopPropagation()}>

        <div className="flex items-center gap-3">
          <span className="text-4xl">{item.emoji}</span>
          <div>
            <h2 className="font-black text-stone-800 text-xl">{t(item.key)}</h2>
            <p className="text-stone-400 text-sm">฿{price} × {qty} = <strong style={{ color:'#3d1f0f' }}>฿{price*qty}</strong></p>
          </div>
          <button onClick={onClose} className="ml-auto text-stone-300 text-3xl leading-none">×</button>
        </div>

        {/* Size */}
        <div>
          <p className="text-[11px] font-bold text-stone-400 mb-2 uppercase tracking-wide">{t('size')}</p>
          <div className="flex gap-2">
            {SIZES.map(s => (
              <button key={s} onClick={() => setSize(s)}
                className={`flex-1 py-3 rounded-2xl font-black text-base border-2 transition-all ${size===s ? 'text-white border-transparent' : 'text-stone-500 border-stone-200'}`}
                style={size===s ? { background:'#3d1f0f' } : {}}>
                {t(s.toLowerCase())}
                <span className="block text-xs font-normal">฿{priceMap[s]}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Sweetness */}
        <div>
          <p className="text-[11px] font-bold text-stone-400 mb-2 uppercase tracking-wide">{t('sweet')}</p>
          <div className="flex gap-1.5">
            {['0%','25%','50%','75%','100%'].map(s => (
              <button key={s} onClick={() => setSweet(s)}
                className={`flex-1 py-2.5 rounded-xl font-bold text-xs border-2 transition-all ${sweet===s ? 'text-white border-transparent' : 'text-stone-500 border-stone-200'}`}
                style={sweet===s ? { background:'#c87941' } : {}}>{s}</button>
            ))}
          </div>
        </div>

        {/* Ice */}
        <div>
          <p className="text-[11px] font-bold text-stone-400 mb-2 uppercase tracking-wide">{t('ice')}</p>
          <div className="flex gap-1.5">
            {ICES.map(ic => (
              <button key={ic} onClick={() => setIce(ic)}
                className={`flex-1 py-2.5 rounded-xl font-bold text-[11px] border-2 transition-all ${ice===ic ? 'text-white border-transparent' : 'text-stone-500 border-stone-200'}`}
                style={ice===ic ? { background:'#6ba3c8' } : {}}>{t(ic)}</button>
            ))}
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
        <button onClick={() => onAdd({ key:item.key, emoji:item.emoji, nameSnapshot:t(item.key), size, sizeKey, price, qty, sweet, iceKey:ice, note })}
          className="w-full py-4 rounded-2xl font-black text-white text-lg shadow-lg active:scale-95"
          style={{ background:'#3d1f0f' }}>
          {t('addToOrder')} · ฿{price*qty}
        </button>
      </div>
    </div>
  );
}

// ─── Summary Tab ──────────────────────────────────────────────────────────────

function SummaryTab({ orders, t }) {
  const total    = orders.reduce((s, o) => s + (o.total||0), 0);
  const allItems = orders.flatMap(o => o.items||[]);
  const countMap = {};
  allItems.forEach(i => { countMap[i.key] = (countMap[i.key]||0) + (i.qty||1); });
  const topItems = Object.entries(countMap).sort((a,b) => b[1]-a[1]).slice(0,6);
  const maxCount = topItems[0]?.[1] || 1;

  return (
    <div className="px-4 pt-3 pb-6 space-y-4">
      <div className="rounded-3xl p-6 text-white shadow-lg" style={{ background:'#3d1f0f' }}>
        <p className="text-amber-500 text-xs font-bold mb-1 uppercase tracking-wide">{t('todaySales')}</p>
        <p className="text-5xl font-black text-amber-200">฿{total.toLocaleString()}</p>
        <p className="text-amber-700 text-sm mt-2">{orders.length} {t('orders')}</p>
      </div>

      <div className="bg-white rounded-3xl p-5 shadow-sm border border-stone-200">
        <p className="font-bold text-stone-700 mb-4 text-sm uppercase tracking-wide">{t('topItems')}</p>
        {topItems.length === 0
          ? <p className="text-stone-400 text-sm text-center py-4">{t('noOrders')}</p>
          : topItems.map(([key, count]) => {
              const m = MENU.find(x => x.key === key);
              return (
                <div key={key} className="flex items-center gap-3 mb-3 last:mb-0">
                  <span className="text-2xl">{m?.emoji || '☕'}</span>
                  <div className="flex-1">
                    <div className="flex justify-between mb-1">
                      <p className="font-bold text-stone-800 text-sm">{t(key)}</p>
                      <p className="font-black text-sm" style={{ color:'#6b3a2a' }}>{count}</p>
                    </div>
                    <div className="h-2 bg-stone-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all" style={{ background:'#c87941', width:`${(count/maxCount*100).toFixed(0)}%` }} />
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

createRoot(document.getElementById('root')).render(<App />);
