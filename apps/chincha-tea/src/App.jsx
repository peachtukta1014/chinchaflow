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
import DailySummaryStickyBar from './components/DailySummaryStickyBar';
import TeaAppHeaderMenu from './components/TeaAppHeaderMenu';
import TabNav from './components/TabNav';
import { getAdminShortcutTabs, getAppNavGroups, TEA_OVERLAY_TITLES } from './lib/navConfig';
import {
  canAccessTeaTab,
  getDefaultTeaTabForMember,
  isMainTeaTab,
  isTeaAdmin,
  isTeaOverlayTab,
  resolveLegacyTeaTab,
} from './lib/teaRoles';
import CartSheet from './components/CartSheet';
import { LoginScreen } from './screens/LoginScreen';
import { OrderTab } from './screens/OrderTab';
import HistoryScreen from './screens/HistoryScreen';
import { CupsTab } from './screens/CupsTab';
import { RestockTab } from './screens/RestockTab';
import { AdminPanel } from './screens/AdminPanel';
import { ProfitTab } from './screens/ProfitTab';
import { StockTab } from './screens/StockTab';
import StaffGuidePanel from './components/StaffGuidePanel';
import StaffLangNudge from './components/StaffLangNudge';
import MyProfileScreen from './screens/MyProfileScreen';
import { fetchPendingRestockCount, invalidatePendingRestockCache } from './lib/restockNotifyService';
import { setAppIconBadge } from './lib/appBadge';
import { ensureNotifyPermission, showWebNotify } from './lib/webNotify';
import { useAppShellChrome } from './lib/useAppShellChrome';

export default function App() {

  const [appReady, setAppReady] = useState(false);
  const [loadingError, setLoadingError] = useState(null);

  useEffect(() => {
    const initApp = async () => {
      try {
        await fbReady;
        setAppReady(true);
      } catch (err) {
        setLoadingError(err.message);
        console.error('App init failed:', err);
      }
    };
    initApp();
  }, []);

  if (!appReady) {
    return (
      <div className="flex items-center justify-center h-screen bg-brown-100">
        {loadingError ? (
          <div className="text-center p-4 bg-white rounded-lg">
            <h2 className="text-red-500 font-bold">Error loading app</h2>
            <p className="text-gray-700">{loadingError}</p>
            <button 
              onClick={() => window.location.reload()} 
              className="mt-4 px-4 py-2 bg-brown-500 text-white rounded"
            >
              Retry
            </button>
          </div>
        ) : (
          <div className="text-brown-700">Loading...</div>
        )}
      </div>
    );
  }

  const [appReady, setAppReady] = useState(false);
  useEffect(() => {
    const init = async () => {
      await fbReady;
      setAppReady(true);
    };
    init();
  }, []);

  if (!appReady) return null;
  const { lang, setLang, t } = useLang();
  const [member, setMember] = useState(undefined);
  const [authPending, setAuthPending] = useState(false);
  const [tab, setTab] = useState('order');
  const [lastMainTab, setLastMainTab] = useState('order');
  const [orderSection, setOrderSection] = useState('order');
  const [cart, setCart] = useState([]);
  const [orders, setOrders] = useState([]);
  const [saving, setSaving] = useState(false);
  const [showCart, setShowCart] = useState(false);
  const [payType, setPayType] = useState('cash');
  const [pendingRestocks, setPendingRestocks] = useState(0);
  const [headerSummary, setHeaderSummary] = useState(null);
  const [summaryLoadError, setSummaryLoadError] = useState(false);
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
  const adminShortcuts = useMemo(() => getAdminShortcutTabs(member, t), [member, t]);

  const isMainTab = isMainTeaTab(tab);
  const isOverlayTab = isTeaOverlayTab(tab);
  const isProfileTab = tab === 'my-profile';

  const refreshOrders = useCallback(async () => {
    const docs = await fsQueryOrders(viewDateKey);
    setOrders(docs);
  }, [viewDateKey]);

  const refreshDailySummary = useCallback(async (dateKey = todayKey) => {
    if (!isAuthed) return null;
    try {
      const summary = await fetchTeaDailySummary(dateKey);
      if (dateKey === todayKey) {
        setHeaderSummary(summary);
        setSummaryLoadError(false);
      }
      return summary;
    } catch (e) {
      console.error(e);
      if (dateKey === todayKey) setSummaryLoadError(true);
      return null;
    }
  }, [isAuthed, todayKey]);

  useEffect(() => {
    if (!isAuthed) {
      setHeaderSummary(null);
      setSummaryLoadError(false);
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
    const resolvedTab = resolveLegacyTeaTab(defaultTab);
    if (isMainTeaTab(resolvedTab)) {
      setTab(resolvedTab);
      setLastMainTab(resolvedTab);
    } else if (canAccessTeaTab(member, resolvedTab)) {
      setTab(resolvedTab);
    } else {
      setTab('order');
      setLastMainTab('order');
    }
    if (defaultTab === 'summary') setOrderSection('close');
    tabBootstrappedRef.current = true;
  }, [isAuthed, member]);

  useEffect(() => {
    if (!isAuthed || !member) return;
    const resolvedTab = resolveLegacyTeaTab(tab);
    if (resolvedTab !== tab) {
      setTab(resolvedTab);
      if (tab === 'summary') setOrderSection('close');
      return;
    }
    if (canAccessTeaTab(member, tab)) return;
    const fallback = canAccessTeaTab(member, lastMainTab) ? lastMainTab : 'order';
    setTab(fallback);
  }, [isAuthed, member, tab, lastMainTab]);

  useEffect(() => {
    if (!member?.uid) return;
    let storedLang = null;
    try {
      storedLang = window.localStorage?.getItem('chincha-lang') ?? null;
    } catch {
      storedLang = null;
    }
    if (member.preferredLang) {
      setLang(member.preferredLang);
      return;
    }
    if (member.role === 'staff' && (!storedLang || storedLang === 'th')) {
      setLang('my');
      fsPatch(`users/${member.uid}`, { preferredLang: 'my' }).catch(() => {});
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [member?.uid]);

  useEffect(() => {
    if (!isAuthed) return;
    if (tab === 'history' || tab === 'admin' || tab === 'order') refreshOrders();
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
        { tag: 'restock', onClick: () => goMainTab('restock') },
      );
    }
    prevPendingRestocksRef.current = pendingRestocks;
  }, [isAuthed, member?.role, pendingRestocks, t]);

  const handleSetLang = useCallback((l) => {
    setLang(l);
    if (member?.uid) {
      fsPatch(`users/${member.uid}`, { preferredLang: l }).catch(() => {});
    }
  }, [member?.uid, setLang]);

  const goMainTab = useCallback((id) => {
    if (!canAccessTeaTab(member, id) || !isMainTeaTab(id)) return;
    setTab(id);
    setLastMainTab(id);
    if (id === 'history' || id === 'order') refreshOrders();
    if (id === 'restock' && isTeaAdmin(member)) refreshPendingRestocks();
  }, [member, refreshOrders, refreshPendingRestocks]);

  const openOverlay = useCallback((id) => {
    if (!canAccessTeaTab(member, id) || !isTeaOverlayTab(id)) return;
    setLastMainTab((prev) => (isMainTeaTab(tab) ? tab : prev));
    setTab(id);
    if (id === 'admin') refreshOrders();
    if (id === 'stock' && isTeaAdmin(member)) refreshPendingRestocks();
  }, [member, tab, refreshCatalog, refreshOrders, refreshPendingRestocks]);

  const goBackFromOverlay = useCallback(() => {
    setTab(lastMainTab);
  }, [lastMainTab]);

  const openProfile = useCallback(() => {
    setLastMainTab((prev) => (isMainTeaTab(tab) ? tab : prev));
    setTab('my-profile');
  }, [tab]);

  const goBackFromProfile = useCallback(() => {
    setTab(lastMainTab);
  }, [lastMainTab]);

  const onProfileUpdated = useCallback((next) => {
    setMember((prev) => (prev ? { ...prev, ...next } : prev));
  }, []);

  const selectTab = useCallback((id) => {
    if (!canAccessTeaTab(member, id)) return;
    const resolved = resolveLegacyTeaTab(id);
    if (resolved === 'order' && id === 'summary') {
      goMainTab('order');
      setOrderSection('close');
      return;
    }
    if (isMainTeaTab(resolved)) {
      goMainTab(resolved);
      return;
    }
    openOverlay(resolved);
  }, [member, goMainTab, openOverlay]);

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
      refreshOrders();
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

  const adminMenuItems = useMemo(() => adminShortcuts.map((item) => ({
    ...item,
    badge: item.id === 'restock' ? pendingRestocks : 0,
  })), [adminShortcuts, pendingRestocks]);

  const overlayTitleKey = TEA_OVERLAY_TITLES[tab];
  const overlayTitle = overlayTitleKey ? t(overlayTitleKey) : t('adminTabShort');

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
        overlayMode={isOverlayTab}
        overlayTitle={overlayTitle}
        onBackFromOverlay={goBackFromOverlay}
        adminMenu={adminMenuItems.length > 0 && !isProfileTab && !isOverlayTab ? (
          <TeaAppHeaderMenu
            items={adminMenuItems}
            activeTab={tab}
            onNavigate={openOverlay}
            t={t}
          />
        ) : null}
        t={t}
      />

      {isMainTab && !isProfileTab && (
        <DailySummaryStickyBar t={t} dailySummary={headerSummary} loadError={summaryLoadError} />
      )}

      {member?.role === 'staff' && isMainTab && (
        <>
          <StaffLangNudge lang={lang} setLang={handleSetLang} t={t} />
          <StaffGuidePanel t={t} lang={lang} />
        </>
      )}

      {isMainTab && !isProfileTab && (
        <TabNav
          groups={navGroups}
          activeTab={tab}
          badges={isAdmin ? { restock: pendingRestocks } : {}}
          onSelect={goMainTab}
        />
      )}

      <main className="flex-1 overflow-y-auto z-10 bg-[#fdf6f0] pb-4" style={{ scrollbarWidth: 'none' }}>
        {tab === 'order' && (
          <OrderTab
            toppingsList={toppingsList}
            lang={lang}
            t={t}
            onAddToCart={addToCart}
            member={member}
            viewDateKey={viewDateKey}
            setViewDateKey={setViewDateKey}
            section={orderSection}
            onSectionChange={setOrderSection}
            onSummaryChanged={refreshDailySummary}
            onVoiceCartReady={() => setShowCart(true)}
            onToppingsChanged={refreshCatalog}
          />
        )}
        {tab === 'cups' && (
          <CupsTab
            member={member}
            t={t}
            lang={lang}
            viewDateKey={viewDateKey}
            setViewDateKey={setViewDateKey}
            onSummaryChanged={refreshDailySummary}
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
        {tab === 'history' && (
          <HistoryScreen
            orders={orders}
            viewDateKey={viewDateKey}
            setViewDateKey={setViewDateKey}
            todayKey={todayKey}
            t={t}
            lang={lang}
            menuItems={menuItems}
            member={member}
          />
        )}
        {tab === 'profit' && canAccessTeaTab(member, 'profit') && (
          <ProfitTab
            t={t}
            lang={lang}
            member={member}
            viewDateKey={viewDateKey}
            setViewDateKey={setViewDateKey}
            todayKey={todayKey}
            pendingRestocks={pendingRestocks}
          />
        )}
        {tab === 'stock' && canAccessTeaTab(member, 'stock') && (
          <StockTab member={member} t={t} lang={lang} />
        )}
        {tab === 'admin' && canAccessTeaTab(member, 'admin') && (
          <div className="px-4 pt-3 pb-8">
            <AdminPanel t={t} lang={lang} menuItems={menuItems} onOrdersChanged={() => { refreshOrders(); refreshDailySummary(todayKey); }} />
          </div>
        )}
        {isProfileTab && (
          <MyProfileScreen member={member} onProfileUpdated={onProfileUpdated} t={t} />
        )}
      </main>

      {cart.length > 0 && tab === 'order' && orderSection === 'order' && (
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
