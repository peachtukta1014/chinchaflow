import { useCallback, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { auth, fbReady } from './firebase';
import { fsGetDoc, fsPost, fsQueryOrders } from './lib/firestoreRest';
import { dateKeyBangkok, shiftDateKey } from './lib/constants';
import { useLang } from './lib/i18n';
import { useCatalog } from './lib/useCatalog';
import { LoginScreen } from './components/LoginScreen';
import { AdminPanel } from './components/AdminPanel';
import { OrderTab } from './components/OrderTab';
import { SummaryTab } from './components/SummaryTab';
import { RestockTab } from './components/RestockTab';

function App() {
  const { lang, setLang, t, isMy } = useLang();
  const [member, setMember] = useState(undefined);
  const [authPending, setAuthPending] = useState(false);
  const [tab, setTab] = useState('order');
  const [cart, setCart] = useState([]);
  const [modalItem, setModalItem] = useState(null);
  const [orders, setOrders] = useState([]);
  const [saving, setSaving] = useState(false);
  const [showCart, setShowCart] = useState(false);
  const [payType, setPayType] = useState('cash');

  const isAuthed = member && member.approved === true;
  const { menuItems, toppingsList, refreshCatalog } = useCatalog(!!isAuthed);
  const todayKey = dateKeyBangkok();
  const [viewDateKey, setViewDateKey] = useState(todayKey);

  const refreshOrders = useCallback(async () => {
    const docs = await fsQueryOrders(viewDateKey);
    setOrders(docs);
  }, [viewDateKey]);

  useEffect(() => {
    if (!fbReady) {
      setMember(null);
      return undefined;
    }
    if (!auth) {
      setMember(null);
      return undefined;
    }
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setMember(null);
        return;
      }
      try {
        const profile = await fsGetDoc(`users/${user.uid}`);
        if (!profile) {
          setAuthPending(true);
          setMember(null);
          return;
        }
        if (profile.approved !== true) {
          setAuthPending(true);
          setMember(null);
          return;
        }
        setAuthPending(false);
        setMember({ uid: user.uid, email: user.email, ...profile });
      } catch {
        setMember(null);
      }
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!isAuthed) return;
    refreshOrders();
  }, [isAuthed, refreshOrders]);

  const handleLogout = async () => {
    if (!window.confirm(`${t('logout')}?`)) return;
    if (auth) await signOut(auth);
    setMember(null);
    setCart([]);
  };

  const addToCart = (item) => setCart((c) => [...c, item]);
  const removeCart = (id) => setCart((c) => c.filter((i) => i.cartId !== id));
  const cartTotal = cart.reduce((s, i) => s + i.price * i.qty, 0);

  const saveOrder = async () => {
    if (!cart.length) return;
    setSaving(true);
    try {
      await fsPost('teaOrders', {
        dateKey: todayKey,
        items: cart,
        total: cartTotal,
        payType,
        createdBy: member?.name || 'ชินชา',
        createdByUid: member?.uid,
        lang,
        createdAt: new Date().toISOString(),
      });
      await refreshOrders();
      setCart([]);
      alert(t('saved'));
    } catch (e) {
      console.error(e);
      alert(`⚠️ ${t('saveFailed')}`);
    }
    setSaving(false);
  };

  if (member === undefined && fbReady) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#3d1f0f' }}>
        <p className="text-amber-300 text-sm">{t('loading')}</p>
      </div>
    );
  }

  if (!isAuthed) {
    return (
      <LoginScreen
        onAuthed={(profile) => { setAuthPending(false); setMember(profile); }}
        lang={lang}
        setLang={setLang}
        pending={authPending}
        setPending={setAuthPending}
      />
    );
  }

  const isAdmin = member.role === 'admin';
  const tabs = [
    ['order', t('orderTab')],
    ['history', t('historyTab')],
    ['summary', t('summaryTab')],
    ['restock', t('restockTab')],
    ...(isAdmin ? [['admin', t('adminTab')]] : []),
  ];

  return (
    <div className="max-w-md mx-auto h-screen flex flex-col relative overflow-hidden" style={{ background: '#fdf6f0' }}>
      <div className="absolute inset-0 pointer-events-none z-0 opacity-[0.04]" style={{ backgroundImage: 'url(/chincha-logo.jpg)', backgroundSize: '110px', backgroundRepeat: 'repeat' }} />

      <header className="z-10 shrink-0 px-4 pt-6 pb-3 flex items-center justify-between" style={{ background: '#3d1f0f' }}>
        <div className="flex items-center gap-3 min-w-0">
          <img src="/chincha-logo.jpg" alt="" className="w-10 h-10 rounded-full border-2 border-amber-300 shrink-0 object-cover" />
          <div className="min-w-0">
            <p className="font-black text-amber-300 leading-none">{t('appName')}</p>
            <p className="text-amber-700 text-[10px] truncate">{member.name}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <div className="flex rounded-xl overflow-hidden border border-amber-800" style={{ background: '#5a2d14' }}>
            {['th', 'my', 'en'].map((l) => (
              <button key={l} type="button" onClick={() => setLang(l)} className={`px-2 py-1.5 text-[10px] font-bold ${lang === l ? 'bg-amber-300 text-amber-900' : 'text-amber-500'}`}>
                {l === 'th' ? 'TH' : l === 'my' ? 'MY' : 'EN'}
              </button>
            ))}
          </div>
          <button type="button" onClick={handleLogout} className="w-9 h-9 rounded-full border border-amber-800 text-amber-500 flex items-center justify-center" style={{ background: '#5a2d14' }} aria-label={t('logout')}>
            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" d="M17 16l4-4m0 0l-4-4m4 4H7" /></svg>
          </button>
        </div>
      </header>

      {isMy && (
        <p className="z-10 shrink-0 mx-4 mt-1 px-3 py-2 rounded-xl text-[10px] font-bold text-amber-900 bg-amber-100 border border-amber-200 text-center leading-snug">
          {t('staffBanner')}
        </p>
      )}
      <nav className="z-10 shrink-0 flex px-2 pt-2 pb-1 gap-1 overflow-x-auto" style={{ background: '#fdf6f0', scrollbarWidth: 'none' }}>
        {tabs.map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => { setTab(id); if (id === 'admin') refreshCatalog(); }}
            className={`shrink-0 px-3 py-2 rounded-2xl font-bold text-[10px] whitespace-nowrap ${tab === id ? 'text-white' : 'text-stone-500 bg-stone-200'}`}
            style={tab === id ? { background: '#3d1f0f' } : {}}
          >
            {label}
          </button>
        ))}
      </nav>

      <main className="flex-1 overflow-y-auto z-10" style={{ scrollbarWidth: 'none' }}>
        {tab === 'order' && (
          <OrderTab
            menuItems={menuItems}
            toppingsList={toppingsList}
            lang={lang}
            t={t}
            onAddToCart={addToCart}
            setModalItem={setModalItem}
            modalItem={modalItem}
          />
        )}
        {tab === 'history' && (
          <div className="px-4 pt-3 pb-6 space-y-3">
            <div className="flex items-center gap-2 bg-white rounded-2xl p-2 border border-stone-200 mb-2">
              <button type="button" onClick={() => setViewDateKey(shiftDateKey(viewDateKey, -1))} className="w-9 h-9 rounded-xl bg-stone-100 font-black text-stone-600">‹</button>
              <p className="flex-1 text-center text-xs font-black text-stone-600">{viewDateKey === todayKey ? t('todaySales') : viewDateKey}</p>
              <button type="button" disabled={viewDateKey >= todayKey} onClick={() => setViewDateKey(shiftDateKey(viewDateKey, 1))} className="w-9 h-9 rounded-xl bg-stone-100 font-black disabled:opacity-30">›</button>
            </div>
            {orders.length === 0 ? (
              <p className="text-center text-stone-300 py-12">{t('noOrders')}</p>
            ) : (
              orders.map((o, i) => (
                <div key={o.id || i} className="bg-white rounded-2xl p-4 border border-stone-200">
                  <div className="flex justify-between mb-2">
                    <p className="text-xs text-stone-400">
                      {(() => { try { return new Date(o.createdAt).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }); } catch { return '—'; } })()}
                      {o.payType && <span className="ml-2 font-bold">{o.payType === 'cash' ? t('cash') : t('transfer')}</span>}
                    </p>
                    <p className="font-black" style={{ color: '#3d1f0f' }}>฿{(o.total || 0).toLocaleString()}</p>
                  </div>
                  {(o.items || []).map((it, j) => (
                    <p key={j} className="text-sm text-stone-600">
                      {it.emoji} {it.qty}× {it.nameSnapshot || it.nameEn}
                      {it.sweet ? ` · ${it.sweet}` : ''}
                    </p>
                  ))}
                </div>
              ))
            )}
          </div>
        )}
        {tab === 'summary' && (
          <SummaryTab
            orders={orders}
            t={t}
            viewDateKey={viewDateKey}
            setViewDateKey={setViewDateKey}
            member={member}
            menuItems={menuItems}
            isAdmin={isAdmin}
          />
        )}
        {tab === 'restock' && <RestockTab member={member} t={t} />}
        {tab === 'admin' && isAdmin && <AdminPanel t={t} onOrdersChanged={refreshOrders} />}
      </main>

      {cart.length > 0 && tab !== 'admin' && (
        <div className="z-20 shrink-0 px-4 pb-4 pt-2">
          <button type="button" onClick={() => setShowCart(true)} className="w-full flex justify-between px-5 py-3.5 rounded-2xl text-white shadow-xl" style={{ background: '#3d1f0f' }}>
            <span className="text-xl font-black">฿{cartTotal.toLocaleString()}</span>
            <span className="text-sm font-bold bg-white/20 px-3 py-1 rounded-xl">ดูตะกร้า →</span>
          </button>
        </div>
      )}

      {showCart && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center" onClick={() => setShowCart(false)}>
          <div className="bg-white w-full max-w-md rounded-t-3xl p-5" style={{ paddingBottom: 'max(1.5rem,env(safe-area-inset-bottom))' }} onClick={(e) => e.stopPropagation()}>
            <p className="font-black mb-3">{t('items')}</p>
            <div className="space-y-2 max-h-56 overflow-y-auto mb-4">
              {cart.map((item) => (
                <div key={item.cartId} className="flex justify-between text-sm">
                  <span>{item.emoji} {item.nameSnapshot} ×{item.qty}</span>
                  <div className="flex gap-2 items-center">
                    <span className="font-black">฿{item.price * item.qty}</span>
                    <button type="button" onClick={() => removeCart(item.cartId)} className="text-red-400 font-black">×</button>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex gap-2 mb-3">
              {[['cash', `💵 ${t('cash')}`], ['transfer', `📱 ${t('transfer')}`]].map(([v, label]) => (
                <button key={v} type="button" onClick={() => setPayType(v)} className={`flex-1 py-2 rounded-xl font-bold text-sm border-2 ${payType === v ? 'border-amber-400 bg-amber-50' : 'border-stone-200'}`}>{label}</button>
              ))}
            </div>
            <button type="button" disabled={saving} onClick={() => { saveOrder(); setShowCart(false); }} className="w-full py-3 rounded-2xl font-black text-white" style={{ background: '#3d1f0f' }}>
              {saving ? '⏳' : t('save')}
            </button>
          </div>
        </div>
      )}

      <style>{`
        body { background: #fdf6f0; }
        ::-webkit-scrollbar { display: none; }
        @keyframes ripple-anim { from { transform:scale(0); opacity:0.5; } to { transform:scale(4); opacity:0; } }
        .ripple-span { animation: ripple-anim 0.5s ease-out forwards; }
      `}</style>
    </div>
  );
}

createRoot(document.getElementById('root')).render(<App />);
