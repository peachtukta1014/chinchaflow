import React, { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { signOut } from 'firebase/auth';
import { ArrowLeft, BarChart2, LogOut, RefreshCw, ShoppingCart, Wallet } from 'lucide-react';
import { auth } from './firebase';
import { subscribeShrimpMember } from './lib/authSession';
import { fsGetDoc, fsQueryStockBatches } from './lib/firestoreRest';
import { fetchPendingLineOrderCount } from './services/lineOrderService';
import {
  getEffectiveStock,
  normalizeStockValues,
  persistStock,
  syncMainStockFromBatches,
} from './services/stockService';
import { hardReloadApp } from './lib/reloadApp';
import {
  canAccessShrimpMainTab,
  canAccessShrimpOverlay,
  getDefaultMainTabForMember,
  getShrimpRoleLabel,
  isShrimpAdmin,
  isShrimpStaff,
} from './lib/shrimpRoles';
import { getAppBuildLabel } from './lib/appBuildInfo';
import { FIREBASE_PROJECT_ID } from './lib/viteEnv.js';
import { useIntervalWhen } from './lib/useIntervalWhen';
import NavButton from './components/NavButton';
import AppHeaderMenu from './components/AppHeaderMenu';
import HeaderQuickLinks from './components/HeaderQuickLinks';
import LineTabIcon from './components/LineTabIcon';
import { setAppIconBadge } from './lib/appBadge';
import { registerBadgeServiceWorker } from './lib/registerBadgeWorker';
import { ensureNotifyPermission, showWebNotify } from './lib/webNotify';
import LoginScreen from './screens/LoginScreen';
import POSMobile from './screens/POSMobile';
import LiveStockStickyBar from './components/LiveStockStickyBar';
import OfflineBanner from './components/OfflineBanner';
import { stockLineFull } from './constants/stockLines';
import { isNetworkOnline, subscribeNetworkStatus } from './lib/networkStatus';
import { refreshPendingSummary, syncPendingSales } from './lib/offlineSaleQueue';
import { syncLineDeliveryWindowFromFirestore } from './lib/syncLineDeliveryWindow';
import { AppCredits } from '@chincha/app-credits';

const SalesHubScreen = lazy(() => import('./screens/SalesHubScreen'));
const InventoryScreen = lazy(() => import('./screens/InventoryScreen'));
const MembersScreen = lazy(() => import('./screens/MembersScreen'));
const LineOrdersScreen = lazy(() => import('./screens/LineOrdersScreen'));
const AdminUsersScreen = lazy(() => import('./screens/AdminUsersScreen'));
const ProductSettingsScreen = lazy(() => import('./screens/ProductSettingsScreen'));
const LotCloseScreen = lazy(() => import('./screens/LotCloseScreen'));
const ExpensesScreen = lazy(() => import('./screens/ExpensesScreen'));

const MAIN_TABS = new Set(['pos', 'sales', 'orders', 'expenses']);

const OVERLAY_TITLES = {
  stock: 'รับเข้า / คลัง',
  members: 'รายชื่อลูกค้า',
  'admin-users': 'สมาชิกแอป',
  'admin-products': 'ตั้งค่าราคากุ้ง',
  'lot-close': 'สรุป / ชั่งปิดล็อต',
};

function TabLoading() {
  return (
    <div className="flex items-center justify-center py-16 text-slate-400 text-sm font-medium">
      กำลังโหลด...
    </div>
  );
}

export default function App() {
  const [member, setMember] = useState(undefined);
  const [activeTab, setActiveTab] = useState('pos');
  const [lastMainTab, setLastMainTab] = useState('pos');
  const [stock, setStock] = useState({ live: 0, dead: 0 });
  const [stockBatches, setStockBatches] = useState([]);
  const [stockLoadError, setStockLoadError] = useState(false);
  const [transactions, setTransactions] = useState([]);
  const [salesRefresh, setSalesRefresh] = useState(0);
  const [stockRefresh, setStockRefresh] = useState(0);
  const [stockOverlayLine, setStockOverlayLine] = useState('live');
  const [pendingOrders, setPendingOrders] = useState(0);
  const prevPendingOrdersRef = useRef(null);
  const [isOnline, setIsOnline] = useState(() => isNetworkOnline());
  const [offlinePendingCount, setOfflinePendingCount] = useState(0);
  const [pendingStockDeduction, setPendingStockDeduction] = useState({ live: 0, dead: 0 });
  const [offlineSyncing, setOfflineSyncing] = useState(false);
  const offlineSyncInFlightRef = useRef(false);

  const isMainTab = MAIN_TABS.has(activeTab);
  const isOverlayTab = !isMainTab;

  const isAdmin = isShrimpAdmin(member);
  const isStaff = isShrimpStaff(member);

  const goMainTab = useCallback((tab) => {
    if (member && !canAccessShrimpMainTab(member, tab)) return;
    setActiveTab(tab);
    setLastMainTab(tab);
  }, [member]);

  const openOverlay = useCallback((tab) => {
    if (member && !canAccessShrimpOverlay(member, tab)) return;
    setLastMainTab((prev) => (MAIN_TABS.has(activeTab) ? activeTab : prev));
    setActiveTab(tab);
  }, [activeTab, member]);

  const goBackFromOverlay = useCallback(() => {
    setActiveTab(lastMainTab);
  }, [lastMainTab]);

  useEffect(() => subscribeShrimpMember(setMember), []);

  useEffect(() => {
    if (!member) return;
    const onMain = MAIN_TABS.has(activeTab);
    const allowed = onMain
      ? canAccessShrimpMainTab(member, activeTab)
      : canAccessShrimpOverlay(member, activeTab);
    if (!allowed) {
      const tab = getDefaultMainTabForMember(member);
      setActiveTab(tab);
      setLastMainTab(tab);
    }
  }, [member, activeTab]);

  const loadStockFromRest = useCallback(async () => {
    if (!FIREBASE_PROJECT_ID || !member) return;
    try {
      const [cfg, rows] = await Promise.all([
        fsGetDoc('config/stock'),
        fsQueryStockBatches(),
      ]);
      if (cfg) {
        setStock(normalizeStockValues(cfg.live, cfg.dead));
      }
      setStockBatches(rows);
      setStockLoadError(false);
    } catch (e) {
      console.warn('loadStockFromRest', e);
      setStockLoadError(true);
    }
  }, [member]);

  useEffect(() => {
    if (!member) return;
    loadStockFromRest();
    syncLineDeliveryWindowFromFirestore();
  }, [member, loadStockFromRest]);

  useEffect(() => {
    if (!member || stockRefresh === 0) return;
    loadStockFromRest();
  }, [member, stockRefresh, loadStockFromRest]);

  useIntervalWhen(Boolean(member), loadStockFromRest, 60000);

  useEffect(() => {
    if (!member || stockBatches.length === 0) return;
    syncMainStockFromBatches(stock, stockBatches)
      .then((val) => { if (val) setStock(val); })
      .catch(() => {});
  }, [member, stockBatches]);

  const effectiveStock = useMemo(
    () => getEffectiveStock(stock, stockBatches),
    [stock, stockBatches],
  );

  const canPollOrders = Boolean(member && FIREBASE_PROJECT_ID);

  const refreshPendingOrderBadge = useCallback(() => {
    if (!canPollOrders) return;
    fetchPendingLineOrderCount().then(setPendingOrders);
  }, [canPollOrders]);

  useEffect(() => {
    if (!member) return;
    ensureNotifyPermission();
  }, [member]);

  useEffect(() => {
    if (!canPollOrders) return undefined;
    registerBadgeServiceWorker();
    refreshPendingOrderBadge();
    const onVisible = () => {
      if (document.visibilityState === 'visible') refreshPendingOrderBadge();
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', refreshPendingOrderBadge);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', refreshPendingOrderBadge);
    };
  }, [canPollOrders, refreshPendingOrderBadge]);

  useIntervalWhen(canPollOrders, refreshPendingOrderBadge, 30000);

  useEffect(() => {
    if (!member) {
      setPendingOrders(0);
      setAppIconBadge(0);
      prevPendingOrdersRef.current = null;
      return;
    }
    setAppIconBadge(pendingOrders);
    const prev = prevPendingOrdersRef.current;
    if (prev !== null && pendingOrders > prev) {
      const added = pendingOrders - prev;
      showWebNotify(
        'ออเดอร์ LINE ใหม่',
        added === 1 ? 'มีออเดอร์รอจัดส่ง 1 รายการ' : `มีออเดอร์รอจัดส่ง ${pendingOrders} รายการ`,
        { tag: 'line-orders', onClick: () => goMainTab('orders') },
      );
    }
    prevPendingOrdersRef.current = pendingOrders;
  }, [member, pendingOrders, goMainTab]);

  const handleLogin = (m) => {
    setMember(m);
    const tab = getDefaultMainTabForMember(m);
    setActiveTab(tab);
    setLastMainTab(tab);
  };
  const handleLogout = async () => {
    if (!window.confirm('ออกจากระบบ?')) return;
    if (auth) await signOut(auth).catch(() => {});
  };

  const handleReloadApp = () => {
    if (!window.confirm('รีเฟรชแอปเพื่อโหลดเวอร์ชันล่าสุด?\n(ข้อมูลบนเซิร์ฟเวอร์ยังอยู่ครบ)')) return;
    hardReloadApp();
  };

  const updateMainStock = async (live, dead) => {
    const val = normalizeStockValues(live, dead);
    setStock(val);
    await persistStock(val);
  };

  const refreshOfflineQueue = useCallback(async () => {
    try {
      const summary = await refreshPendingSummary();
      setOfflinePendingCount(summary.pendingCount);
      setPendingStockDeduction(summary.pendingStock);
    } catch (e) {
      console.warn('refreshOfflineQueue', e);
    }
  }, []);

  const runOfflineSync = useCallback(async () => {
    if (!member || offlineSyncInFlightRef.current || !isNetworkOnline()) return;
    offlineSyncInFlightRef.current = true;
    setOfflineSyncing(true);
    try {
      const result = await syncPendingSales({
        loadStockContext: async () => {
          const [cfg, rows] = await Promise.all([
            fsGetDoc('config/stock'),
            fsQueryStockBatches(),
          ]);
          return {
            stock: cfg ? normalizeStockValues(cfg.live, cfg.dead) : { live: 0, dead: 0 },
            stockBatches: rows,
          };
        },
        updateMainStock,
        onItemSynced: (billData) => {
          setTransactions((prev) => [billData, ...prev]);
        },
      });
      if (result.synced > 0) {
        setSalesRefresh((n) => n + 1);
        setStockRefresh((n) => n + 1);
        showWebNotify(
          'ส่งบิล offline สำเร็จ',
          result.synced === 1 ? 'อัปโหลด 1 บิลแล้ว' : `อัปโหลด ${result.synced} บิลแล้ว`,
          { tag: 'offline-sync-ok' },
        );
      }
      if (result.failed > 0) {
        showWebNotify(
          'ส่งบิล offline ไม่ครบ',
          result.errors[0] || 'มีบิลที่ส่งไม่สำเร็จ — กด「ส่งเลย」เพื่อลองใหม่',
          { tag: 'offline-sync-fail' },
        );
      }
    } catch (e) {
      console.warn('runOfflineSync', e);
    } finally {
      offlineSyncInFlightRef.current = false;
      setOfflineSyncing(false);
      await refreshOfflineQueue();
    }
  }, [member, refreshOfflineQueue]);

  useEffect(() => subscribeNetworkStatus(setIsOnline), []);

  useEffect(() => {
    if (!member) {
      setOfflinePendingCount(0);
      setPendingStockDeduction({ live: 0, dead: 0 });
      return;
    }
    refreshOfflineQueue();
  }, [member, refreshOfflineQueue]);

  useEffect(() => {
    if (!member || !isOnline) return;
    runOfflineSync();
  }, [member, isOnline, runOfflineSync]);

  const bumpSalesAndStock = useCallback(() => {
    setSalesRefresh((n) => n + 1);
    setStockRefresh((n) => n + 1);
  }, []);

  const onSaleDeleted = useCallback(() => {
    bumpSalesAndStock();
    fetchPendingLineOrderCount().then(setPendingOrders);
  }, [bumpSalesAndStock]);

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

  const roleBadge = getShrimpRoleLabel(member.role, member.email);

  return (
    <div className="bg-slate-50 h-screen font-sans max-w-md mx-auto relative shadow-2xl overflow-hidden flex flex-col">
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-0">
        <img src="/logo.jpg" alt="" className="w-72 h-72 object-contain opacity-[0.04]" />
      </div>

      <div className="bg-slate-900 text-white z-30 shrink-0 overflow-visible relative">
        {isOverlayTab ? (
          <div className="px-4 pt-6 pb-3 flex items-center gap-2">
            <button
              type="button"
              onClick={goBackFromOverlay}
              className="w-10 h-10 rounded-full bg-slate-800 border-2 border-slate-700 flex items-center justify-center text-slate-200 active:scale-95 shrink-0"
              aria-label="กลับ"
            >
              <ArrowLeft size={20} />
            </button>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-black truncate">
                {activeTab === 'stock'
                  ? `คลัง — ${stockLineFull(stockOverlayLine)}`
                  : (OVERLAY_TITLES[activeTab] || 'เมนู')}
              </p>
              <p className="text-[10px] text-slate-400 truncate">{member.name}</p>
            </div>
          </div>
        ) : (
          <div className="px-4 pt-6 pb-3 flex items-center justify-between">
            <div className="flex items-center gap-3 min-w-0">
              <img src="/logo.jpg" alt="KOSEAFOOD" className="w-10 h-10 rounded-xl object-cover border border-slate-700 shrink-0" />
              <div className="min-w-0">
                <p className="text-sm font-black text-white leading-none">โกอ้วน คลังซีฟู้ด</p>
                <p className="text-[10px] text-slate-400 mt-0.5 truncate max-w-[160px]">
                  {member.name}
                  {!isAdmin && (
                    <span className="ml-1.5 text-amber-400">· {roleBadge}</span>
                  )}
                  {isAdmin && <span className="ml-1.5 text-purple-400">· แอดมิน</span>}
                </p>
                {getAppBuildLabel() && (
                  <p className="text-[9px] text-cyan-400/90 mt-0.5 truncate max-w-[180px]" title="เวอร์ชันที่โหลดอยู่">
                    {getAppBuildLabel()}
                  </p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <AppHeaderMenu
                isAdmin={isAdmin}
                activeTab={activeTab}
                onNavigate={openOverlay}
              />
              <button
                type="button"
                onClick={handleReloadApp}
                title="รีเฟรชแอป"
                aria-label="รีเฟรชแอป"
                className="w-10 h-10 rounded-full bg-slate-800 border-2 border-slate-700 flex items-center justify-center text-cyan-400 active:scale-95"
              >
                <RefreshCw size={18} />
              </button>
              <button
                type="button"
                onClick={handleLogout}
                title="ออกจากระบบ"
                aria-label="ออกจากระบบ"
                className="w-10 h-10 rounded-full bg-slate-800 border-2 border-slate-700 flex items-center justify-center text-slate-400 active:scale-95"
              >
                <LogOut size={18} />
              </button>
            </div>
          </div>
        )}
      </div>

      <OfflineBanner
        isOnline={isOnline}
        pendingCount={offlinePendingCount}
        syncing={offlineSyncing}
        onRetrySync={runOfflineSync}
      />

      {isAdmin && (
        <LiveStockStickyBar
          live={effectiveStock.live}
          dead={effectiveStock.dead}
          loadError={stockLoadError}
          pendingLive={pendingStockDeduction.live}
          pendingDead={pendingStockDeduction.dead}
        />
      )}

      {isMainTab && (
        <HeaderQuickLinks
          showCustomers={canAccessShrimpOverlay(member, 'members')}
          showAppMembers={isAdmin}
          onOpenCustomers={() => openOverlay('members')}
          onOpenAppMembers={() => openOverlay('admin-users')}
        />
      )}

      <div
        className={`flex-1 overflow-y-auto ${isMainTab ? 'pb-40' : 'pb-24'}`}
        style={{ scrollbarWidth: 'none' }}
      >
        {activeTab === 'pos' && (
          <POSMobile
            user={member}
            stock={stock}
            stockBatches={stockBatches}
            updateMainStock={updateMainStock}
            onOpenReceiveLive={!isStaff ? () => {
              setStockOverlayLine('live');
              openOverlay('stock');
            } : undefined}
            onOpenReceiveDead={!isStaff ? () => {
              setStockOverlayLine('dead');
              openOverlay('stock');
            } : undefined}
            onSaveBill={(b) => {
              setTransactions((prev) => [b, ...prev]);
              bumpSalesAndStock();
            }}
            onBillQueued={(b) => {
              setTransactions((prev) => [b, ...prev]);
              refreshOfflineQueue();
            }}
            pendingStockDeduction={pendingStockDeduction}
          />
        )}

        {activeTab === 'sales' && canAccessShrimpMainTab(member, 'sales') && (
          <Suspense fallback={<TabLoading />}>
            <SalesHubScreen
              localBills={transactions}
              refreshKey={salesRefresh}
              active={activeTab === 'sales'}
              isAdmin={isAdmin}
              member={member}
              stock={stock}
              stockBatches={stockBatches}
              updateMainStock={updateMainStock}
              onSaleDeleted={onSaleDeleted}
            />
          </Suspense>
        )}

        {activeTab === 'orders' && (
          <Suspense fallback={<TabLoading />}>
            <LineOrdersScreen
              user={member}
              stock={stock}
              stockBatches={stockBatches}
              updateMainStock={updateMainStock}
              onSaleRecorded={bumpSalesAndStock}
              onOrderDone={() => {
                fetchPendingLineOrderCount().then(setPendingOrders);
              }}
            />
          </Suspense>
        )}

        {activeTab === 'members' && canAccessShrimpOverlay(member, 'members') && (
          <Suspense fallback={<TabLoading />}>
            <MembersScreen isAdmin={isAdmin} readOnly={isStaff} />
          </Suspense>
        )}

        {activeTab === 'stock' && canAccessShrimpOverlay(member, 'stock') && (
          <Suspense fallback={<TabLoading />}>
            <InventoryScreen
              stock={effectiveStock}
              stockBatches={stockBatches}
              updateMainStock={updateMainStock}
              member={member}
              initialStockLine={stockOverlayLine}
              onReceived={() => setStockRefresh((n) => n + 1)}
              onStockMoved={() => setStockRefresh((n) => n + 1)}
            />
          </Suspense>
        )}

        {activeTab === 'admin-users' && isAdmin && (
          <Suspense fallback={<TabLoading />}>
            <AdminUsersScreen />
          </Suspense>
        )}

        {activeTab === 'admin-products' && isAdmin && (
          <Suspense fallback={<TabLoading />}>
            <ProductSettingsScreen />
          </Suspense>
        )}

        {activeTab === 'lot-close' && isAdmin && (
          <Suspense fallback={<TabLoading />}>
            <LotCloseScreen
              stock={effectiveStock}
              stockBatches={stockBatches}
              updateMainStock={updateMainStock}
              member={member}
              onStockMoved={() => setStockRefresh((n) => n + 1)}
            />
          </Suspense>
        )}

        {activeTab === 'expenses' && canAccessShrimpMainTab(member, 'expenses') && (
          <Suspense fallback={<TabLoading />}>
            <ExpensesScreen stockBatches={stockBatches} />
          </Suspense>
        )}
      </div>

      <div
        className={`absolute left-0 right-0 z-40 px-2 pointer-events-none ${
          isMainTab ? 'bottom-[calc(4.25rem+env(safe-area-inset-bottom,0px))]' : 'bottom-[env(safe-area-inset-bottom,0px)] pb-2'
        }`}
      >
        <AppCredits theme="shrimp" placement="bar" />
      </div>

      {isMainTab && (
        <div
          className="absolute bottom-0 left-0 right-0 bg-white border-t border-slate-200 flex justify-around p-2 z-50 rounded-t-2xl"
          style={{ paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))' }}
        >
          {canAccessShrimpMainTab(member, 'pos') && (
            <NavButton
              icon={<ShoppingCart size={22} strokeWidth={activeTab === 'pos' ? 2.5 : 2} />}
              label="บันทึกการขาย"
              compactLabel
              isActive={activeTab === 'pos'}
              onClick={() => goMainTab('pos')}
            />
          )}
          {canAccessShrimpMainTab(member, 'expenses') && (
            <NavButton
              icon={<Wallet size={22} strokeWidth={activeTab === 'expenses' ? 2.5 : 2} />}
              label="รายจ่าย"
              compactLabel
              isActive={activeTab === 'expenses'}
              onClick={() => goMainTab('expenses')}
            />
          )}
          {canAccessShrimpMainTab(member, 'sales') && (
            <NavButton
              icon={<BarChart2 size={22} strokeWidth={activeTab === 'sales' ? 2.5 : 2} />}
              label="ยอดขาย/ยอดค้าง"
              compactLabel
              isActive={activeTab === 'sales'}
              onClick={() => goMainTab('sales')}
            />
          )}
          {canAccessShrimpMainTab(member, 'orders') && (
            <NavButton
              icon={<LineTabIcon size={22} active={activeTab === 'orders'} />}
              label="LINE"
              isActive={activeTab === 'orders'}
              onClick={() => goMainTab('orders')}
              badge={pendingOrders}
            />
          )}
        </div>
      )}
    </div>
  );
}
