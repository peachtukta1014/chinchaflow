import React, { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { collection, doc, limit, onSnapshot, orderBy, query } from 'firebase/firestore';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { Bell, Home, LogOut, Package, RefreshCw, ShoppingCart, Users, Wallet } from 'lucide-react';
import { auth, db } from './firebase';
import { FS_BASE, fsGetDoc, fsQueryStockBatches } from './lib/firestoreRest';
import { fetchPendingLineOrderCount } from './services/lineOrderService';
import {
  getEffectiveStock,
  normalizeStockValues,
  persistStock,
  syncMainStockFromBatches,
} from './services/stockService';
import { hardReloadApp } from './lib/reloadApp';
import { getAppBuildLabel } from './lib/appBuildInfo';
import { useIntervalWhen } from './lib/useIntervalWhen';
import NavButton from './components/NavButton';
import LoginScreen from './screens/LoginScreen';
import POSMobile from './screens/POSMobile';
import LiveStockStickyBar from './components/LiveStockStickyBar';

const Dashboard = lazy(() => import('./screens/Dashboard'));
const InventoryScreen = lazy(() => import('./screens/InventoryScreen'));
const MembersScreen = lazy(() => import('./screens/MembersScreen'));
const LineOrdersScreen = lazy(() => import('./screens/LineOrdersScreen'));
const CustomerAccountsScreen = lazy(() => import('./screens/CustomerAccountsScreen'));
const AdminUsersScreen = lazy(() => import('./screens/AdminUsersScreen'));
const ProductSettingsScreen = lazy(() => import('./screens/ProductSettingsScreen'));

function TabLoading() {
  return (
    <div className="flex items-center justify-center py-16 text-slate-400 text-sm font-medium">
      กำลังโหลด...
    </div>
  );
}

export default function App() {
  const [member, setMember]         = useState(undefined);
  const [activeTab, setActiveTab]   = useState('pos');
  const [stock, setStock]           = useState({ live: 0, dead: 0 });
  const [stockBatches, setStockBatches] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [salesRefresh, setSalesRefresh] = useState(0);
  const [stockRefresh, setStockRefresh] = useState(0);
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

  const loadStockFromRest = useCallback(async () => {
    if (!import.meta.env.VITE_FIREBASE_PROJECT_ID || !member) return;
    try {
      const [cfg, rows] = await Promise.all([
        fsGetDoc('config/stock'),
        fsQueryStockBatches(50),
      ]);
      if (cfg) {
        setStock(normalizeStockValues(cfg.live, cfg.dead));
      }
      setStockBatches(rows);
    } catch (e) {
      console.warn('loadStockFromRest', e);
    }
  }, [member]);

  // โหลดสต๊อกทันที (REST) + realtime — บางเครือข่ายมือถือ listen ไม่ติด
  useEffect(() => {
    if (!member) return;
    loadStockFromRest();
  }, [member, loadStockFromRest]);

  useEffect(() => {
    if (!member || stockRefresh === 0) return;
    loadStockFromRest();
  }, [member, stockRefresh, loadStockFromRest]);

  useIntervalWhen(Boolean(member), loadStockFromRest, 60000);

  useEffect(() => {
    if (!db || !member) return undefined;
    const unsubs = [
      onSnapshot(doc(db, 'config', 'stock'), (snap) => {
        if (snap.exists()) setStock(snap.data());
      }, () => {
        loadStockFromRest();
      }),
      onSnapshot(
        query(collection(db, 'stockBatches'), orderBy('purchaseDate', 'desc'), limit(50)),
        (snap) => setStockBatches(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
        (err) => {
          console.warn('stockBatches snapshot', err);
          loadStockFromRest();
        },
      ),
    ];
    return () => unsubs.forEach((u) => u());
  }, [member, loadStockFromRest]);

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

  // Badge ออเดอร์: โหลดครั้งแรก + poll เมื่อไม่อยู่หน้าออเดอร์ (หน้าออเดอร์มี refresh ของตัวเอง)
  const pollOrderBadge = Boolean(
    member && import.meta.env.VITE_FIREBASE_PROJECT_ID && activeTab !== 'orders',
  );

  useEffect(() => {
    if (!member || !import.meta.env.VITE_FIREBASE_PROJECT_ID) return;
    fetchPendingLineOrderCount().then(setPendingOrders);
  }, [member, activeTab]);

  useIntervalWhen(
    pollOrderBadge,
    () => {
      fetchPendingLineOrderCount().then(setPendingOrders);
    },
    45000,
  );

  const handleLogin  = (m) => setMember(m);
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
            <div className="min-w-0">
              <p className="text-sm font-black text-white leading-none">โกอ้วน คลังซีฟู้ด</p>
              <p className="text-[10px] text-slate-400 mt-0.5 truncate max-w-[180px]">
                {member.name}
                {isAdmin && <span className="ml-1.5 text-purple-400">· แอดมิน</span>}
              </p>
              {getAppBuildLabel() && (
                <p className="text-[9px] text-cyan-400/90 mt-0.5 truncate max-w-[200px]" title="เวอร์ชันที่โหลดอยู่ — กดปุ่มรีเฟรชถ้าไม่ตรง">
                  {getAppBuildLabel()}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
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
              className="w-10 h-10 rounded-full bg-slate-800 border-2 border-slate-700 flex items-center justify-center text-slate-400 active:scale-95"
            >
              <LogOut size={18} />
            </button>
          </div>
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

      <LiveStockStickyBar live={effectiveStock.live} dead={effectiveStock.dead} />

      <div className="flex-1 overflow-y-auto pb-24" style={{ scrollbarWidth: 'none' }}>
        {activeTab === 'home' && (
          <Suspense fallback={<TabLoading />}>
            <Dashboard
              localBills={transactions}
              refreshKey={salesRefresh}
              active={activeTab === 'home'}
              isAdmin={isAdmin}
              stock={stock}
              stockBatches={stockBatches}
              updateMainStock={updateMainStock}
              onSaleDeleted={() => {
                setSalesRefresh((n) => n + 1);
                setStockRefresh((n) => n + 1);
                fetchPendingLineOrderCount().then(setPendingOrders);
              }}
            />
          </Suspense>
        )}

        {activeTab === 'pos'            && <POSMobile user={member} stock={stock} stockBatches={stockBatches} updateMainStock={updateMainStock} onSaveBill={b => { setTransactions(prev => [b, ...prev]); setSalesRefresh(n => n + 1); }} />}
        {activeTab === 'stock'          && (
          <Suspense fallback={<TabLoading />}>
            <InventoryScreen
              stock={effectiveStock}
              stockBatches={stockBatches}
              updateMainStock={updateMainStock}
              member={member}
              onReceived={() => setStockRefresh((n) => n + 1)}
              onStockMoved={() => setStockRefresh((n) => n + 1)}
            />
          </Suspense>
        )}
        {activeTab === 'members' && (
          <Suspense fallback={<TabLoading />}>
            <MembersScreen isAdmin={isAdmin} />
          </Suspense>
        )}
        {activeTab === 'accounts' && (
          <Suspense fallback={<TabLoading />}>
            <CustomerAccountsScreen
              refreshKey={salesRefresh}
              isAdmin={isAdmin}
              stock={stock}
              stockBatches={stockBatches}
              updateMainStock={updateMainStock}
              onSaleDeleted={() => {
                setSalesRefresh((n) => n + 1);
                setStockRefresh((n) => n + 1);
                fetchPendingLineOrderCount().then(setPendingOrders);
              }}
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
              onSaleRecorded={() => {
                setSalesRefresh((n) => n + 1);
                setStockRefresh((n) => n + 1);
              }}
              onOrderDone={() => {
                fetchPendingLineOrderCount().then(setPendingOrders);
              }}
            />
          </Suspense>
        )}
        {activeTab === 'admin-users' && (
          <Suspense fallback={<TabLoading />}>
            <AdminUsersScreen />
          </Suspense>
        )}
        {activeTab === 'admin-products' && (
          <Suspense fallback={<TabLoading />}>
            <ProductSettingsScreen />
          </Suspense>
        )}
      </div>

      <div className="absolute bottom-0 left-0 right-0 bg-white border-t border-slate-200 flex justify-around p-2 z-50 rounded-t-2xl"
        style={{ paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))' }}>
        <NavButton icon={<ShoppingCart />} label="ขายของ"    isActive={activeTab === 'pos'}     onClick={() => setActiveTab('pos')} />
        <NavButton icon={<Home />}         label="ภาพรวม"    isActive={activeTab === 'home'}    onClick={() => setActiveTab('home')} />
        <NavButton icon={<Package />}      label="รับสต๊อก" isActive={activeTab === 'stock'}   onClick={() => setActiveTab('stock')} />
        <NavButton icon={<Bell />}         label="ออเดอร์"   isActive={activeTab === 'orders'}  onClick={() => setActiveTab('orders')} badge={pendingOrders} />
        <NavButton icon={<Users />}        label="ลูกค้า"    isActive={activeTab === 'members'} onClick={() => setActiveTab('members')} />
        <NavButton icon={<Wallet />}       label="บัญชี"    isActive={activeTab === 'accounts'} onClick={() => setActiveTab('accounts')} />
      </div>
    </div>
  );
}
