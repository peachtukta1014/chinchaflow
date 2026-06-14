import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { signOut } from 'firebase/auth';
import { auth, fbReady } from './firebase';
import { fsQueryOrders, fsPatch } from './lib/firestoreRest';
import { fetchTeaDailySummary } from './lib/dailySummaryService';
import { dateKeyBangkok } from './lib/constants';
import { useLang } from './lib/i18n';
import { useCatalog } from './lib/useCatalog';
import { clearTeaMemberCache, subscribeTeaMember } from './lib/authSession';
import { saveTeaOrder } from './lib/orderService';
import AppHeader from './components/AppHeader';
import TabNav from './components/TabNav';
import { getAppNavGroups } from './lib/navConfig';
import { canAccessTeaTab, getDefaultTeaTabForMember, isTeaAdmin } from './lib/teaRoles';
import CartSheet from './components/CartSheet';
import { LoginScreen } from './screens/LoginScreen';
import { OrderTab } from './screens/OrderTab';
import HistoryScreen from './screens/HistoryScreen';
import { SummaryTab } from './screens/SummaryTab';
import { ExpensesTab } from './screens/ExpensesTab';
import { RestockTab } from './screens/RestockTab';
import { AdminPanel } from './screens/AdminPanel';
import { PayrollTab } from './screens/PayrollTab';
import { ProfitTab } from './screens/ProfitTab';
import { DashboardTab } from './screens/DashboardTab';
import StaffGuidePanel from './components/StaffGuidePanel';
import StaffLangNudge from './components/StaffLangNudge';
import MyProfileScreen from './screens/MyProfileScreen';
import { fetchPendingRestockCount, invalidatePendingRestockCache } from './lib/restockNotifyService';
import { setAppIconBadge } from './lib/appBadge';
import { ensureNotifyPermission, showWebNotify } from './lib/webNotify';
import { useAppShellChrome } from './lib/useAppShellChrome';

export default function App() {
  const { lang, setLang, t } = useLang();
  const [member, setMember] = useState(undefined);
  const [authPending, setAuthPending] = useState(false);
  const [tab, setTab] = useState('order');
  const [lastTab, setLastTab] = useState('order');
  const [cart, setCart] = useState([]);
  const [modalItem, setModalItem] = useState(null);
  const [orders, setOrders] = useState([]);
  const [saving, setSaving] = useState(false);
  const [showCart, setShowCart] = useState(false);
  const [payType, setPayType] = useState('cash');
  const [pendingRestocks, setPendingRestocks] = useState(0);
  const [headerSummary, setHeaderSummary] = useState(null);
  const prevPendingRestocksRef = useRef(null);
  const tabBootstrappedRef = useRef(false);

  const isAuthed = member && member.approved === true;
  const appShell = !fbReady
    ? 'login'
    : member === undefined
      ? 'loading'
      : !isAuthed
        ? 'login'
        : 'app';
  useAppShellChrome(appShell);
  const { menuItems, toppingsList, refreshCatalog } = useCatalog(!!isAuthed);
  const todayKey = dateKeyBangkok();
  const [viewDateKey, setViewDateKey] = useState(todayKey);
  const navGroups = useMemo(() => getAppNavGroups(member, t), [member, t]);

  const refreshOrders = useCallback(async () => {
    const docs = await fsQueryOrders(viewDateKey);
    setOrders(docs);
  }, [viewDateKey]);

  const refreshDailySummary = useCallback(async (dateKey = todayKey) => {
    if (!isAuthed) return null;
    try {
      const summary = await fetchTeaDailySummary(dateKey);
      if (dateKey === todayKey) setHeaderSummary(summary);
      return summary;
    } catch (e) {
      console.error(e);
      return null;
    }
  }, [isAuthed, todayKey]);

  useEffect(() => {
    if (!isAuthed) {
      setHeaderSummary(null);
      return;
    }
    refreshDailySummary(todayKey);
  }, [isAuthed, refreshDailySummary, todayKey]);

  useEffect(() => {
    if (!fbReady) {
      setMember(null);
      return undefined;
    }
    return subscribeTeaMember(setMember, setAuthPending);
  }, []);

  useEffect(() => {
    if (!isAuthed || tabBootstrappedRef.current) return;
    const defaultTab = getDefaultTeaTabForMember(member);
    setTab(defaultTab);
    setLastTab(defaultTab);
    tabBootstrappedRef.current = true;
  }, [isAuthed, member]);

  useEffect(() => {
    if (!isAuthed || !member) return;
    if (canAccessTeaTab(member, tab)) return;
    const fallbackTab = canAccessTeaTab(member, lastTab) ? lastTab : getDefaultTeaTabForMember(member);
    setTab(fallbackTab);
  }, [isAuthed, member, tab, lastTab]);

  // ภาษา: sync กับ Firestore เมื่อ login + migration staff 'th' → 'my'
  useEffect(() => {
    if (!member?.uid) return;
    let storedLang = null;
    try {
      storedLang = window.localStorage?.getItem('chincha-lang') ?? null;
    } catch {
      // Android WebView/old browsers may block localStorage; keep the main UI alive.
      storedLang = null;
    }
    if (member.preferredLang) {
      // cross-device: ดึงค่าจาก Firestore เป็น source of truth
      setLang(member.preferredLang);
      return;
    }
    // migration: staff ที่ยังเก็บ 'th' เก่าค้างใน localStorage → รีเซ็ตเป็น 'my'
    if (member.role === 'staff' && (!storedLang || storedLang === 'th')) {
      setLang('my');
      fsPatch(`users/${member.uid}`, { preferredLang: 'my' }).catch(() => {});
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [member?.uid]);

  useEffect(() => {
    if (!isAuthed) return;
    if (tab === 'summary' || tab === 'admin' || tab === 'history') refreshOrders();
  }, [isAuthed, tab, refreshOrders]);

  const refreshPendingRestocks = useCallback(async (force = false) => {
    if (!isAuthed || member?.role !== 'admin') return;
    try {
      if (force) invalidatePendingRestockCache(todayKey);
      const n = await fetchPendingRestockCount(todayKey, { force });
      setPendingRestocks(n);
    } catch {
      /* ignore */
    }
  }, [isAuthed, member?.role, todayKey]);

  useEffect(() => {
    if (!isAuthed || member.role !== 'admin') return undefined;
    ensureNotifyPermission();
    refreshPendingRestocks();
    const onVisible = () => {
      if (document.visibilityState === 'visible') refreshPendingRestocks();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [isAuthed, member?.role, refreshPendingRestocks]);

  useEffect(() => {
    if (!isAuthed || member.role !== 'admin') {
      setPendingRestocks(0);
      setAppIconBadge(0);
      prevPendingRestocksRef.current = null;
      return;
    }
    setAppIconBadge(pendingRestocks);
    const prev = prevPendingRestocksRef.current;
    if (prev !== null && pendingRestocks > prev) {
      showWebNotify(
        t('restockNotifyTitle'),
        t('restockNotifyBody').replace('{n}', String(pendingRestocks)),
        { tag: 'restock', onClick: () => setTab('restock') },
      );
    }
    prevPendingRestocksRef.current = pendingRestocks;
  }, [isAuthed, member?.role, pendingRestocks]);

  // เปลี่ยนภาษา: บันทึก localStorage + Firestore (cross-device sync)
  const handleSetLang = useCallback((l) => {
    setLang(l);
    if (member?.uid) {
      fsPatch(`users/${member.uid}`, { preferredLang: l }).catch(() => {});
    }
  }, [member?.uid, setLang]);

  const openProfile = useCallback(() => {
    setLastTab((prev) => (tab === 'my-profile' ? prev : tab));
    setTab('my-profile');
  }, [tab]);

  const goBackFromProfile = useCallback(() => {
    setTab(lastTab);
  }, [lastTab]);

  const onProfileUpdated = useCallback((next) => {
    setMember((prev) => (prev ? { ...prev, ...next } : prev));
  }, []);

  const openAdminFromHeader = useCallback(() => {
    if (!canAccessTeaTab(member, 'admin')) return;
    setTab('admin');
    setLastTab('admin');
    refreshCatalog();
    refreshOrders();
  }, [member, refreshCatalog, refreshOrders]);

  const handleLogout = async () => {
    if (!window.confirm(`${t('logout')}?`)) return;
    if (auth) await signOut(auth);
    clearTeaMemberCache();
    setMember(null);
    setCart([]);
  };

  const addToCart = (item) => setCart((c) => [...c, item]);
  const removeCart = (id) => setCart((c) => c.filter((i) => i.cartId !== id));
  const updateCartQty = (id, qty) => setCart((c) => c.map((i) => {
    if (i.cartId !== id) return i;
    const nextQty = Math.max(1, qty);
    if (!i.smartPrice) return { ...i, qty: nextQty };
    const toppingTotal = (i.toppings || []).reduce((sum, tp) => sum + Number(tp.price || 0) * Number(tp.qty || 1), 0);
    return { ...i, qty: nextQty, lineTotal: (Number(i.basePrice || i.price || 0) * nextQty) + toppingTotal };
  }));
  const cartTotal = cart.reduce((s, i) => s + (i.lineTotal ?? (i.price * i.qty)), 0);

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
      setCart([]);
      refreshOrders(); // fire-and-forget — อัปเดต list หลังบันทึก ไม่บล็อก UI
      refreshDailySummary(todayKey);
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
      <div
        key="shell-loading"
        className="fixed inset-0 z-[200] flex items-center justify-center"
        style={{ background: '#3d1f0f', isolation: 'isolate' }}
      >
        <p className="text-amber-300 text-sm">{t('loading')}</p>
      </div>
    );
  }

  if (!isAuthed) {
    return (
      <LoginScreen
        key="shell-login"
        onAuthed={(profile) => { setAuthPending(false); setMember(profile); }}
        lang={lang}
        setLang={setLang}
        pending={authPending}
        setPending={setAuthPending}
      />
    );
  }

  const isAdmin = isTeaAdmin(member);
  const isProfileTab = tab === 'my-profile';

  return (
    <div
      key="shell-app"
      className="max-w-md mx-auto h-screen h-[100dvh] flex flex-col relative overflow-hidden isolate"
      style={{ background: '#fdf6f0' }}
    >
      <div
        className="absolute inset-0 pointer-events-none z-0 opacity-[0.04]"
        style={{ backgroundImage: 'url(/chincha-logo.jpg)', backgroundSize: '110px', backgroundRepeat: 'repeat' }}
        aria-hidden
      />

      <AppHeader
        member={member}
        lang={lang}
        setLang={handleSetLang}
        onLogout={handleLogout}
        onOpenProfile={openProfile}
        profileMode={isProfileTab}
        onBackFromProfile={goBackFromProfile}
        onOpenAdmin={openAdminFromHeader}
        showAdminButton={canAccessTeaTab(member, 'admin')}
        t={t}
        dailySummary={headerSummary}
      />

      {member?.role === 'staff' && (
        <>
          <StaffLangNudge lang={lang} setLang={handleSetLang} t={t} />
          <StaffGuidePanel t={t} lang={lang} />
        </>
      )}

      {!isProfileTab && (
        <TabNav
          groups={navGroups}
          activeTab={tab}
          badges={isAdmin ? { restock: pendingRestocks } : {}}
          onSelect={(id) => {
            if (!canAccessTeaTab(member, id)) return;
            setTab(id);
            setLastTab(id);
            if (id === 'admin' || id === 'catalog') refreshCatalog();
            if (id === 'summary' || id === 'admin' || id === 'history') refreshOrders();
            if ((id === 'restock' || id === 'dashboard') && isAdmin) refreshPendingRestocks();
          }}
        />
      )}

      <main className="flex-1 overflow-y-auto z-10 bg-[#fdf6f0] pb-24" style={{ scrollbarWidth: 'none' }}>
        {tab === 'order' && (
          <OrderTab
            menuItems={menuItems}
            toppingsList={toppingsList}
            lang={lang}
            t={t}
            onAddToCart={addToCart}
            setModalItem={setModalItem}
            modalItem={modalItem}
            member={member}
            onBulkEntrySaved={(dateKey) => {
              if (dateKey === viewDateKey) refreshOrders();
              refreshDailySummary(dateKey);
            }}
            onVoiceCartReady={() => setShowCart(true)}
          />
        )}
        {tab === 'summary' && (
          <SummaryTab
            orders={orders}
            t={t}
            lang={lang}
            viewDateKey={viewDateKey}
            setViewDateKey={setViewDateKey}
            member={member}
            menuItems={menuItems}
            isAdmin={isAdmin}
            onSummaryChanged={refreshDailySummary}
          />
        )}
        {tab === 'cups' && (
          <ExpensesTab
            member={member}
            t={t}
            lang={lang}
            viewDateKey={viewDateKey}
            setViewDateKey={setViewDateKey}
            allowedModes={['cups']}
            defaultMode="cups"
            compactHeader
          />
        )}
        {tab === 'restock' && (
          <RestockTab
            member={member}
            t={t}
            lang={lang}
            onRestockListChange={isAdmin ? () => refreshPendingRestocks(true) : undefined}
          />
        )}
        {tab === 'dashboard' && canAccessTeaTab(member, 'dashboard') && (
          <DashboardTab t={t} todayKey={todayKey} pendingRestocks={pendingRestocks} member={member} onNavigate={(next) => {
            if (next === 'restock' && canAccessTeaTab(member, 'restock')) setTab('restock');
            else if (canAccessTeaTab(member, next)) setTab(next);
          }} />
        )}
        {tab === 'catalog' && canAccessTeaTab(member, 'catalog') && (
          <div className="px-4 pt-3 pb-8">
            <AdminPanel catalogOnly t={t} lang={lang} menuItems={menuItems} onOrdersChanged={() => { refreshOrders(); refreshDailySummary(todayKey); }} onCatalogChanged={refreshCatalog} />
          </div>
        )}
        {tab === 'profit' && canAccessTeaTab(member, 'profit') && (
          <ProfitTab t={t} lang={lang} viewDateKey={viewDateKey} setViewDateKey={setViewDateKey} todayKey={todayKey} />
        )}
        {tab === 'payroll' && canAccessTeaTab(member, 'payroll') && (
          <PayrollTab member={member} t={t} lang={lang} todayKey={todayKey} />
        )}
        {tab === 'history' && canAccessTeaTab(member, 'history') && (
          <HistoryScreen orders={orders} viewDateKey={viewDateKey} setViewDateKey={setViewDateKey} todayKey={todayKey} t={t} lang={lang} menuItems={menuItems} />
        )}
        {tab === 'admin' && canAccessTeaTab(member, 'admin') && (
          <div className="px-4 pt-3 pb-8">
            <AdminPanel catalogOnly={false} settingsOnly t={t} lang={lang} menuItems={menuItems} onOrdersChanged={() => { refreshOrders(); refreshDailySummary(todayKey); }} onCatalogChanged={refreshCatalog} />
          </div>
        )}
        {isProfileTab && (
          <MyProfileScreen member={member} onProfileUpdated={onProfileUpdated} t={t} />
        )}
      </main>

      {cart.length > 0 && tab === 'order' && (
        <div className="z-20 shrink-0 px-4 pb-4 pt-2">
          <button
            type="button"
            onClick={() => setShowCart(true)}
            className="w-full flex justify-between px-5 py-3.5 rounded-2xl text-white shadow-xl"
            style={{ background: '#3d1f0f' }}
          >
            <span className="text-xl font-black">฿{cartTotal.toLocaleString()}</span>
            <span className="text-sm font-bold bg-white/20 px-3 py-1 rounded-xl">{t('viewCart')} →</span>
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
        updateCartQty={updateCartQty}
        saving={saving}
        lang={lang}
        menuItems={menuItems}
        onSave={async () => {
          const ok = await saveOrder();
          if (ok) setShowCart(false);
        }}
        t={t}
      />

      <style>{`
        html, body {
          -webkit-text-size-adjust: 100%;
          -moz-text-size-adjust: 100%;
          text-size-adjust: 100%;
        }
        ::-webkit-scrollbar { display: none; }
        @keyframes ripple-anim { from { transform:scale(0); opacity:0.5; } to { transform:scale(4); opacity:0; } }
        .ripple-span { animation: ripple-anim 0.5s ease-out forwards; }
      `}</style>
    </div>
  );
}
