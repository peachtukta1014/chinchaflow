import { useCallback, useEffect, useState } from 'react';
import { signOut } from 'firebase/auth';
import { auth, fbReady } from './firebase';
import { fsQueryOrders } from './lib/firestoreRest';
import { dateKeyBangkok } from './lib/constants';
import { useLang } from './lib/i18n';
import { useCatalog } from './lib/useCatalog';
import { subscribeTeaMember } from './lib/authSession';
import { saveTeaOrder } from './lib/orderService';
import AppHeader from './components/AppHeader';
import TabNav from './components/TabNav';
import CartSheet from './components/CartSheet';
import { LoginScreen } from './screens/LoginScreen';
import { OrderTab } from './screens/OrderTab';
import HistoryScreen from './screens/HistoryScreen';
import { SummaryTab } from './screens/SummaryTab';
import { RestockTab } from './screens/RestockTab';
import { AdminPanel } from './screens/AdminPanel';

export default function App() {
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
    return subscribeTeaMember(setMember, setAuthPending);
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
    if (!cart.length) return false;
    setSaving(true);
    try {
      await saveTeaOrder({
        dateKey: todayKey,
        cart,
        cartTotal,
        payType,
        member,
        lang,
      });
      await refreshOrders();
      setCart([]);
      alert(t('saved'));
      return true;
    } catch (e) {
      console.error(e);
      alert(`⚠️ ${t('saveFailed')}`);
      return false;
    } finally {
      setSaving(false);
    }
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

      <AppHeader member={member} lang={lang} setLang={setLang} onLogout={handleLogout} t={t} />

      {isMy && (
        <p className="z-10 shrink-0 mx-4 mt-1 px-3 py-2 rounded-xl text-[10px] font-bold text-amber-900 bg-amber-100 border border-amber-200 text-center leading-snug">
          {t('staffBanner')}
        </p>
      )}

      <TabNav
        tabs={tabs}
        activeTab={tab}
        onSelect={(id) => {
          setTab(id);
          if (id === 'admin' || id === 'order') refreshCatalog();
          if (id === 'history' || id === 'summary') refreshOrders();
        }}
      />

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
            canVoiceCommit={cart.length > 0}
            onVoiceCommit={async () => {
              if (cart.length) await saveOrder();
            }}
          />
        )}
        {tab === 'history' && (
          <HistoryScreen
            orders={orders}
            viewDateKey={viewDateKey}
            setViewDateKey={setViewDateKey}
            todayKey={todayKey}
            t={t}
          />
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
        {tab === 'admin' && isAdmin && (
          <AdminPanel t={t} onOrdersChanged={refreshOrders} onCatalogChanged={refreshCatalog} />
        )}
      </main>

      {cart.length > 0 && tab !== 'admin' && (
        <div className="z-20 shrink-0 px-4 pb-4 pt-2">
          <button
            type="button"
            onClick={() => setShowCart(true)}
            className="w-full flex justify-between px-5 py-3.5 rounded-2xl text-white shadow-xl"
            style={{ background: '#3d1f0f' }}
          >
            <span className="text-xl font-black">฿{cartTotal.toLocaleString()}</span>
            <span className="text-sm font-bold bg-white/20 px-3 py-1 rounded-xl">ดูตะกร้า →</span>
          </button>
        </div>
      )}

      <CartSheet
        open={showCart}
        onClose={() => setShowCart(false)}
        cart={cart}
        cartTotal={cartTotal}
        payType={payType}
        setPayType={setPayType}
        removeCart={removeCart}
        saving={saving}
        onSave={async () => {
          const ok = await saveOrder();
          if (ok) setShowCart(false);
        }}
        t={t}
      />

      <style>{`
        body { background: #fdf6f0; }
        ::-webkit-scrollbar { display: none; }
        @keyframes ripple-anim { from { transform:scale(0); opacity:0.5; } to { transform:scale(4); opacity:0; } }
        .ripple-span { animation: ripple-anim 0.5s ease-out forwards; }
      `}</style>
    </div>
  );
}
