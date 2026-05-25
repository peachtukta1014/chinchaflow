import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { collection, doc, limit, onSnapshot, orderBy, query } from 'firebase/firestore';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { Bell, Home, LogOut, Package, ShoppingCart, Users } from 'lucide-react';
import { auth, db } from './firebase';
import { FS_BASE, fsQueryStockBatches } from './lib/firestoreRest';
import { fetchPendingLineOrderCount } from './services/lineOrderService';
import {
  getEffectiveStock,
  normalizeStockValues,
  persistStock,
  syncMainStockFromBatches,
} from './services/stockService';
import NavButton from './components/NavButton';
import LoginScreen from './screens/LoginScreen';
import Dashboard from './screens/Dashboard';
import POSMobile from './screens/POSMobile';
import InventoryScreen from './screens/InventoryScreen';
import MembersScreen from './screens/MembersScreen';
import LineOrdersScreen from './screens/LineOrdersScreen';
import AdminUsersScreen from './screens/AdminUsersScreen';
import ProductSettingsScreen from './screens/ProductSettingsScreen';

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

  const loadStockBatchesRest = useCallback(async () => {
    if (!import.meta.env.VITE_FIREBASE_PROJECT_ID || !member) return;
    try {
      const rows = await fsQueryStockBatches(50);
      if (rows.length > 0) setStockBatches(rows);
    } catch (e) {
      console.warn('fsQueryStockBatches', e);
    }
  }, [member]);

  // Real-time shared stock + ล็อต (REST + snapshot — หน้าขายต้องเห็นล็อตเหมือนภาพรวม)
  useEffect(() => {
    if (!member) return undefined;
    loadStockBatchesRest();
    const iv = setInterval(loadStockBatchesRest, 20000);
    return () => clearInterval(iv);
  }, [member, stockRefresh, loadStockBatchesRest]);

  useEffect(() => {
    if (!db || !member) return undefined;
    const unsubs = [
      onSnapshot(doc(db, 'config', 'stock'), (snap) => {
        if (snap.exists()) setStock(snap.data());
      }, () => {}),
      onSnapshot(
        query(collection(db, 'stockBatches'), orderBy('purchaseDate', 'desc'), limit(50)),
        (snap) => setStockBatches(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
        (err) => {
          console.warn('stockBatches snapshot', err);
          loadStockBatchesRest();
        },
      ),
    ];
    return () => unsubs.forEach((u) => u());
  }, [member, loadStockBatchesRest]);

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

  // Badge: pending LINE orders
  useEffect(() => {
    if (!member || !import.meta.env.VITE_FIREBASE_PROJECT_ID) return;
    const load = async () => {
      setPendingOrders(await fetchPendingLineOrderCount());
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
        {activeTab === 'home'           && <Dashboard stock={stock} stockBatches={stockBatches} localBills={transactions} refreshKey={salesRefresh} stockRefreshKey={stockRefresh} active={activeTab === 'home'} />}
        {activeTab === 'pos'            && <POSMobile user={member} stock={stock} stockBatches={stockBatches} updateMainStock={updateMainStock} onSaveBill={b => { setTransactions(prev => [b, ...prev]); setSalesRefresh(n => n + 1); }} />}
        {activeTab === 'stock'          && (
          <InventoryScreen
            stock={effectiveStock}
            stockBatches={stockBatches}
            updateMainStock={updateMainStock}
            onReceived={() => setStockRefresh((n) => n + 1)}
            onStockMoved={() => setStockRefresh((n) => n + 1)}
          />
        )}
        {activeTab === 'members'        && <MembersScreen />}
        {activeTab === 'orders'         && (
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
        )}
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
