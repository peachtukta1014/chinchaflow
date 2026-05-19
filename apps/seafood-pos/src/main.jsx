import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import {
  Home, ShoppingCart, Package, LogOut, CheckCircle,
  Delete, Edit3, X, MapPin, PlusCircle, ChevronRight
} from 'lucide-react';
import { db, isFirebaseReady } from './firebase';

const CUSTOMERS = [
  { id: 'general', name: 'ลูกค้าทั่วไปและตลาดนัด', zone: 'ทั่วไป' },
  { id: 'c1',  name: 'เจ๊เขียด',           zone: 'ป่าตอง' },
  { id: 'c2',  name: 'ตาจุ้ย 1',           zone: 'ป่าตอง' },
  { id: 'c3',  name: 'ตาจุ้ย 2',           zone: 'ป่าตอง' },
  { id: 'c4',  name: 'น้องเล็ก 1',         zone: 'ป่าตอง' },
  { id: 'c5',  name: 'ปุ้ย',              zone: 'ป่าตอง' },
  { id: 'c6',  name: 'เจ๊แหวว',           zone: 'ป่าตอง' },
  { id: 'c7',  name: 'ร้านเฟิร์ส',         zone: 'ป่าตอง' },
  { id: 'c8',  name: 'ร้านสองพี่น้อง 1',   zone: 'ป่าตอง' },
  { id: 'c9',  name: 'ร้านสองพี่น้อง 2',   zone: 'ป่าตอง' },
  { id: 'c10', name: 'ร้านแสนสบาย',        zone: 'ป่าตอง' },
  { id: 'c11', name: 'น้องเล็ก 2',         zone: 'กะทู้'  },
  { id: 'c12', name: 'อีสานรสเด็ด',        zone: 'กะทู้'  },
  { id: 'c13', name: 'โบ๊ทซีฟู้ด',         zone: 'ภูเก็ต' },
  { id: 'c14', name: 'ร้านคุณเชษฐ์',       zone: 'ภูเก็ต' },
  { id: 'c15', name: 'ร้าน มุขมณี',        zone: 'ราไวย์' },
  { id: 'c16', name: 'ร้าน ฟาง',          zone: 'ราไวย์' },
  { id: 'c17', name: 'ร้าน ป้าก้อย',       zone: 'ราไวย์' },
  { id: 'c18', name: 'ร้าน มด',           zone: 'ราไวย์' },
  { id: 'c19', name: 'ร้าน อ้อม',         zone: 'ราไวย์' },
  { id: 'c20', name: 'ร้าน ป้าแมว',        zone: 'ราไวย์' },
  { id: 'c21', name: 'ร้าน เฮง 777',      zone: 'ราไวย์' },
  { id: 'c22', name: 'ร้าน โอเล่',        zone: 'ราไวย์' },
  { id: 'c23', name: 'ร้าน โกห้า',        zone: 'ราไวย์' },
  { id: 'c24', name: 'ร้าน วิทยาซีฟู้ด',  zone: 'ราไวย์' },
  { id: 'c25', name: 'ร้าน ฟลุ๊ค',        zone: 'ราไวย์' },
  { id: 'c26', name: 'ร้าน มุกอันดา',      zone: 'ราไวย์' },
  { id: 'c27', name: 'ร้าน สตูล',         zone: 'ราไวย์' },
];

const PRODUCTS = [
  { id: 'large',  name: 'ไซส์ใหญ่',  type: 'live', price: 1450 },
  { id: 'medium', name: 'ไซส์กลาง', type: 'live', price: 1100 },
  { id: 'small',  name: 'ไซส์เล็ก',  type: 'live', price: 850  },
  { id: 'dead',   name: 'กุ้งตาย',   type: 'dead', price: 0    },
];

function App() {
  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState('pos');
  const [stock, setStock] = useState({ live: 120.5, dead: 15.0 });
  const [transactions, setTransactions] = useState([]);

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col justify-center items-center p-6 text-white max-w-md mx-auto relative overflow-hidden">
        <div className="absolute top-[-10%] left-[-20%] w-64 h-64 bg-blue-600 rounded-full filter blur-3xl opacity-40" />
        <div className="absolute top-[20%] right-[-10%] w-64 h-64 bg-cyan-400 rounded-full filter blur-3xl opacity-40" />
        <div className="relative z-10 w-full text-center mb-10">
          <h1 className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-300 tracking-tighter mb-2">KOSEAFOOD</h1>
          <p className="text-slate-400 text-sm font-medium tracking-wide">ระบบจัดการสต๊อกและจุดขาย</p>
        </div>
        <form
          onSubmit={(e) => { e.preventDefault(); setUser({ displayName: 'เสี่ยพีช Koseafood', email: 'admin@ko-seafood.top' }); }}
          className="relative z-10 w-full space-y-4"
        >
          <input type="email" placeholder="อีเมล" required
            className="w-full bg-slate-800/80 border border-slate-700 rounded-2xl p-4 text-white focus:ring-2 focus:ring-blue-500 outline-none" />
          <input type="password" placeholder="รหัสผ่าน" required
            className="w-full bg-slate-800/80 border border-slate-700 rounded-2xl p-4 text-white focus:ring-2 focus:ring-blue-500 outline-none" />
          <button type="submit"
            className="w-full mt-4 bg-gradient-to-r from-blue-600 to-blue-500 font-bold p-4 rounded-2xl shadow-lg active:scale-95 text-lg">
            เข้าสู่ระบบ
          </button>
        </form>
      </div>
    );
  }

  const updateMainStock = (newLive, newDead) => setStock({ live: newLive, dead: newDead });

  return (
    <div className="bg-slate-50 min-h-screen pb-24 font-sans max-w-md mx-auto relative shadow-2xl overflow-hidden flex flex-col">
      <div className="bg-slate-900 text-white p-4 pt-6 rounded-b-3xl shadow-lg flex items-center justify-between z-10 shrink-0">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-blue-400 leading-none">KO<span className="text-white">SEAFOOD</span></h1>
          <p className="text-xs text-slate-400 mt-1 font-medium">แอดมิน: {user.displayName}</p>
        </div>
        <button
          onClick={() => { if (window.confirm('ออกจากระบบ?')) setUser(null); }}
          className="w-10 h-10 rounded-full bg-slate-800 border-2 border-slate-700 flex items-center justify-center text-slate-400 hover:text-red-400 active:scale-95 transition-all"
        >
          <LogOut size={18} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: 'none' }}>
        {activeTab === 'home'  && <Dashboard stock={stock} transactions={transactions} />}
        {activeTab === 'pos'   && <POSMobile user={user} stock={stock} updateMainStock={updateMainStock} onSaveBill={(bill) => setTransactions([bill, ...transactions])} />}
        {activeTab === 'stock' && <InventoryScreen stock={stock} updateMainStock={updateMainStock} />}
      </div>

      <div className="absolute bottom-0 left-0 right-0 bg-white border-t border-slate-200 flex justify-around p-2 z-50 rounded-t-2xl"
        style={{ paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))' }}>
        <NavButton icon={<ShoppingCart />} label="ขายของ"    isActive={activeTab === 'pos'}   onClick={() => setActiveTab('pos')} />
        <NavButton icon={<Home />}         label="ภาพรวม"    isActive={activeTab === 'home'}  onClick={() => setActiveTab('home')} />
        <NavButton icon={<Package />}      label="รับสต๊อก" isActive={activeTab === 'stock'} onClick={() => setActiveTab('stock')} />
      </div>

      <style>{`
        select optgroup { font-weight: 700; color: #475569; background: #f8fafc; }
        select option   { font-weight: 500; color: #0f172a; }
      `}</style>
    </div>
  );
}

const POSMobile = ({ user, stock, updateMainStock, onSaveBill }) => {
  const [selectedCustomer, setSelectedCustomer] = useState('general');
  const [cart, setCart] = useState([]);
  const [selectedProduct, setSelectedProduct] = useState(PRODUCTS[0].id);
  const [weight, setWeight] = useState('');
  const [customPrice, setCustomPrice] = useState(PRODUCTS[0].price.toString());
  const [note, setNote] = useState('');
  const [inputMode, setInputMode] = useState('weight');
  const [saving, setSaving] = useState(false);

  const activeProduct    = PRODUCTS.find(p => p.id === selectedProduct);
  const isDeadShrimp     = activeProduct?.type === 'dead';
  const currentItemTotal = isDeadShrimp
    ? (parseFloat(customPrice) || 0)
    : (parseFloat(weight) || 0) * (parseFloat(customPrice) || 0);

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
      setWeight(prev => prev + num);
    } else {
      if (num === '.' && customPrice.includes('.')) return;
      setCustomPrice(prev => prev + num);
    }
  };

  const addToCart = () => {
    if (!weight) return alert('ใส่น้ำหนักก่อนนะครับ');
    if (isDeadShrimp && !customPrice) return alert('ใส่ราคาเหมาก่อนครับ');
    if (!isDeadShrimp && !customPrice) return alert('ใส่ราคา/กิโล ก่อนครับ');
    setCart([...cart, {
      id: Date.now(),
      productId:   activeProduct.id,
      productName: activeProduct.name,
      type:        activeProduct.type,
      weight:      parseFloat(weight),
      pricePerKg:  isDeadShrimp ? 0 : parseFloat(customPrice),
      total:       currentItemTotal,
      note,
    }]);
    setWeight(''); setNote('');
    if (!isDeadShrimp) setCustomPrice(activeProduct.price.toString());
    setInputMode('weight');
  };

  const handleSaveBill = async () => {
    if (cart.length === 0) return;
    const customer    = CUSTOMERS.find(c => c.id === selectedCustomer);
    const totalAmount = cart.reduce((sum, item) => sum + item.total, 0);
    const billData = {
      billNo:       `INV-${Date.now().toString().slice(-6)}`,
      customerName: customer.name,
      zone:         customer.zone,
      items:        cart,
      total:        totalAmount,
      timestamp:    new Date().toLocaleTimeString('th-TH'),
      recordedBy:   user.email,
    };

    if (isFirebaseReady && db) {
      try {
        setSaving(true);
        await addDoc(collection(db, 'sales'), {
          ...billData,
          items: cart.map(item => ({
            productId:   item.productId,
            productName: item.productName,
            type:        item.type,
            weightKg:    item.weight,
            pricePerKg:  item.pricePerKg,
            lineTotal:   item.total,
            note:        item.note || '',
          })),
          createdAt: serverTimestamp(),
          source: 'koseafood-pos',
        });
      } catch (err) {
        console.error('Firebase save error:', err);
      } finally {
        setSaving(false);
      }
    }

    let liveDeduction = 0, deadDeduction = 0;
    cart.forEach(item => {
      if (item.type === 'dead') deadDeduction += item.weight;
      else liveDeduction += item.weight;
    });
    updateMainStock(stock.live - liveDeduction, stock.dead - deadDeduction);
    onSaveBill(billData);
    alert('✅ บันทึกบิลและตัดสต๊อกสำเร็จ!');
    setCart([]); setSelectedCustomer('general');
  };

  const groupedCustomers = CUSTOMERS.reduce((acc, c) => {
    if (!acc[c.zone]) acc[c.zone] = [];
    acc[c.zone].push(c);
    return acc;
  }, {});

  return (
    <div className="flex flex-col bg-slate-100" style={{ minHeight: 'calc(100vh - 120px)' }}>
      <div className="bg-white p-4 rounded-b-3xl shadow-sm z-10">
        <div className="flex items-center bg-slate-50 rounded-2xl p-2 border border-slate-200 mb-4">
          <MapPin className="text-blue-500 ml-2 shrink-0" size={20} />
          <select
            value={selectedCustomer}
            onChange={(e) => setSelectedCustomer(e.target.value)}
            className="bg-transparent text-slate-800 w-full outline-none p-2 font-bold text-base"
          >
            {Object.keys(groupedCustomers).map(zone => (
              <optgroup key={zone} label={`── ${zone} ──`}>
                {groupedCustomers[zone].map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </optgroup>
            ))}
          </select>
          <ChevronRight className="text-slate-400 mr-2 shrink-0" size={20} />
        </div>

        {cart.length > 0 && (
          <div className="max-h-40 overflow-y-auto mb-4 space-y-2 border-t border-slate-100 pt-4">
            {cart.map((item, idx) => (
              <div key={item.id} className="flex justify-between items-center bg-slate-50 p-3 rounded-2xl border border-slate-200">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-slate-800">{idx + 1}. {item.productName}</p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {item.weight} กก.{item.type === 'live' ? ` (โลละ ${item.pricePerKg}บ.)` : ' (เหมา)'}
                    {item.note && <span className="text-orange-500 ml-1">*{item.note}</span>}
                  </p>
                </div>
                <div className="flex items-center gap-2 ml-2">
                  <p className="font-bold text-blue-600">฿{item.total.toLocaleString()}</p>
                  <button onClick={() => setCart(cart.filter(i => i.id !== item.id))} className="text-red-400 bg-red-50 p-1.5 rounded-full">
                    <X size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="flex justify-between items-end border-t border-slate-100 pt-2">
          <div>
            <p className="text-slate-400 text-[11px] font-bold tracking-wide">ยอดรวมบิล ({cart.length} รายการ)</p>
            <h2 className="text-4xl font-black text-emerald-500 leading-none mt-1">
              ฿{cart.reduce((s, i) => s + i.total, 0).toLocaleString()}
            </h2>
          </div>
          {cart.length > 0 && (
            <button onClick={handleSaveBill} disabled={saving}
              className="bg-emerald-500 text-white px-5 py-3 rounded-2xl font-bold flex items-center gap-2 shadow-lg active:scale-95 disabled:opacity-60">
              <CheckCircle size={20} /> {saving ? 'กำลังบันทึก...' : 'จบบิล'}
            </button>
          )}
        </div>
      </div>

      <div className="px-4 py-3 overflow-x-auto whitespace-nowrap flex gap-3 shrink-0">
        {PRODUCTS.map(p => (
          <button key={p.id} onClick={() => handleProductChange(p.id)}
            className={`inline-block px-6 py-3 rounded-3xl font-bold text-sm transition-all ${
              selectedProduct === p.id
                ? (p.type === 'dead' ? 'bg-red-500 text-white shadow-lg' : 'bg-blue-600 text-white shadow-lg')
                : 'bg-white text-slate-500 border border-slate-200'
            }`}>
            {p.name}
          </button>
        ))}
      </div>

      <div className="flex-1 bg-white p-5 flex flex-col rounded-t-[2.5rem] shadow-[0_-10px_30px_rgba(0,0,0,0.04)]"
        style={{ paddingBottom: 'max(1.25rem, env(safe-area-inset-bottom))' }}>
        <div className="flex gap-2 mb-3">
          <button onClick={() => setInputMode('weight')}
            className={`flex-1 py-3 rounded-2xl font-bold text-xs border ${
              inputMode === 'weight' ? 'bg-slate-800 text-white' : 'bg-slate-50 text-slate-500'
            }`}>
            น้ำหนัก: {weight || '0.0'} กก.
          </button>
          <button onClick={() => setInputMode('price')}
            className={`flex-1 py-3 rounded-2xl font-bold text-xs border ${
              inputMode === 'price' ? 'bg-slate-800 text-white' : 'bg-slate-50 text-slate-500'
            }`}>
            {isDeadShrimp ? 'เหมา: ' : 'โลละ: '}{customPrice || '0'} บ.
          </button>
        </div>

        <div className="relative mb-3">
          <Edit3 className="absolute left-4 top-3 text-slate-400" size={16} />
          <input type="text" placeholder="หมายเหตุ (ถ้ามี)" value={note} onChange={(e) => setNote(e.target.value)}
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
                className="bg-slate-50 active:bg-slate-200 text-2xl font-bold text-slate-700 rounded-2xl py-4">
                {n}
              </button>
            ))}
            <button onClick={() => handleNumpad('.')} className="bg-slate-50 text-3xl font-bold text-slate-700 rounded-2xl py-4">.</button>
            <button onClick={() => handleNumpad('0')} className="bg-slate-50 text-2xl font-bold text-slate-700 rounded-2xl py-4">0</button>
            <button onClick={() => {
              if (inputMode === 'weight') setWeight(prev => prev.slice(0, -1));
              else setCustomPrice(prev => prev.slice(0, -1));
            }} className="bg-red-50 text-red-500 rounded-2xl flex items-center justify-center py-4">
              <Delete size={28} />
            </button>
          </div>
          <button onClick={addToCart}
            className="col-span-1 bg-blue-600 text-white rounded-2xl font-bold flex flex-col items-center justify-center gap-2 shadow-lg active:scale-95">
            <PlusCircle size={32} />
            <span className="text-sm">เพิ่ม</span>
          </button>
        </div>
      </div>
    </div>
  );
};

const InventoryScreen = ({ stock, updateMainStock }) => {
  const [tab, setTab] = useState('receive');
  const [rcvLive, setRcvLive]       = useState('');
  const [rcvDead, setRcvDead]       = useState('');
  const [rcvCost, setRcvCost]       = useState('');
  const [rcvTransport, setRcvTransport] = useState('');
  const [rcvNote, setRcvNote]       = useState('');
  const [deadWeight, setDeadWeight] = useState('');

  const liveKg    = parseFloat(rcvLive)     || 0;
  const deadKg    = parseFloat(rcvDead)     || 0;
  const costPerKg = parseFloat(rcvCost)     || 0;
  const transport = parseFloat(rcvTransport) || 0;
  const totalKg   = liveKg + deadKg;
  const shrimpCost = totalKg * costPerKg;
  const grandTotal = shrimpCost + transport;

  const handleReceive = () => {
    if (!rcvLive && !rcvDead) return alert('ใส่น้ำหนักกุ้งสดหรือกุ้งตายอย่างใดอย่างหนึ่งครับ');
    if (!rcvCost) return alert('ใส่ราคาซื้อ/กก.ด้วยครับ');
    updateMainStock(stock.live + liveKg, stock.dead + deadKg);
    alert(`รับกุ้งเข้าสำเร็จ! ต้นทุนทั้งหมด: ฿${grandTotal.toLocaleString()}`);
    setRcvLive(''); setRcvDead(''); setRcvCost(''); setRcvTransport(''); setRcvNote('');
  };

  const handleDead = () => {
    if (!deadWeight) return;
    const w = parseFloat(deadWeight);
    if (w > stock.live) return alert('ยอดกุ้งตายมากกว่ากุ้งเป็นครับ');
    updateMainStock(stock.live - w, stock.dead + w);
    alert('ย้ายยอดกุ้งตายสำเร็จ!');
    setDeadWeight('');
  };

  return (
    <div className="p-5 space-y-5">
      <div className="flex bg-slate-200 p-1.5 rounded-2xl">
        <button onClick={() => setTab('receive')}
          className={`flex-1 py-3 font-bold text-sm rounded-xl ${ tab === 'receive' ? 'bg-white text-blue-600' : 'text-slate-500'}`}>
          รับกุ้งเข้า
        </button>
        <button onClick={() => setTab('dead')}
          className={`flex-1 py-3 font-bold text-sm rounded-xl ${ tab === 'dead' ? 'bg-white text-red-600' : 'text-slate-500'}`}>
          กุ้งตายจากบ่อ
        </button>
      </div>

      {tab === 'receive' && (
        <div className="bg-white p-6 rounded-[2rem] shadow-sm space-y-4">
          <h2 className="font-black text-slate-800 text-xl">บันทึกรับกุ้งเข้าบ่อ</h2>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-slate-500 mb-1 block">น้ำหนักกุ้งสด (กก.)</label>
              <input type="number" inputMode="decimal" value={rcvLive} onChange={e => setRcvLive(e.target.value)}
                placeholder="0.000" className="w-full p-3 bg-slate-50 rounded-2xl outline-none text-lg font-bold" />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-500 mb-1 block">น้ำหนักกุ้งตาย (กก.)</label>
              <input type="number" inputMode="decimal" value={rcvDead} onChange={e => setRcvDead(e.target.value)}
                placeholder="0.000" className="w-full p-3 bg-slate-50 rounded-2xl outline-none text-lg font-bold" />
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-500 mb-1 block">ราคาซื้อ/กก. (฿/กก.)</label>
            <input type="number" inputMode="decimal" value={rcvCost} onChange={e => setRcvCost(e.target.value)}
              placeholder="0" className="w-full p-3 bg-slate-50 rounded-2xl outline-none text-lg font-bold" />
          </div>

          <div>
            <label className="text-xs font-bold text-slate-500 mb-1 block">ค่ารถ (฿)</label>
            <input type="number" inputMode="decimal" value={rcvTransport} onChange={e => setRcvTransport(e.target.value)}
              placeholder="0" className="w-full p-3 bg-slate-50 rounded-2xl outline-none text-lg font-bold" />
          </div>

          <div>
            <label className="text-xs font-bold text-slate-500 mb-1 block">หมายเหตุ</label>
            <input type="text" value={rcvNote} onChange={e => setRcvNote(e.target.value)}
              placeholder="เช่น รถทะเบียน กข-1234"
              className="w-full p-3 bg-slate-50 rounded-2xl outline-none" />
          </div>

          {/* Cost summary */}
          <div className="bg-slate-50 rounded-2xl p-4 space-y-2 border border-slate-200">
            <div className="flex justify-between text-sm text-slate-600">
              <span>น้ำหนักรวม</span>
              <span className="font-bold">{totalKg.toFixed(3)} กก.</span>
            </div>
            <div className="flex justify-between text-sm text-slate-600">
              <span>ค่ากุ้ง</span>
              <span className="font-bold">฿{shrimpCost.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-sm text-slate-600">
              <span>ค่ารถ</span>
              <span className="font-bold">฿{transport.toLocaleString()}</span>
            </div>
            <div className="flex justify-between font-black text-slate-800 text-base border-t border-slate-200 pt-2 mt-1">
              <span>ต้นทุนทั้งหมด</span>
              <span className="text-blue-600">฿{grandTotal.toLocaleString()}</span>
            </div>
          </div>

          <button onClick={handleReceive} className="w-full bg-slate-800 text-white font-bold py-5 rounded-2xl">
            บันทึกเข้าสต๊อก
          </button>
        </div>
      )}

      {tab === 'dead' && (
        <div className="bg-white p-6 rounded-[2rem] shadow-sm">
          <h2 className="font-black text-red-600 text-xl mb-4">บันทึกกุ้งตาย</h2>
          <div className="bg-red-50 p-4 rounded-2xl mb-4">
            <span className="text-sm text-red-800">กุ้งเป็นคงเหลือ: <span className="font-black text-xl">{stock.live.toFixed(1)} กก.</span></span>
          </div>
          <input type="number" inputMode="decimal" value={deadWeight} onChange={e => setDeadWeight(e.target.value)}
            placeholder="0.0"
            className="w-full p-5 bg-white border-2 border-red-200 text-red-600 font-black text-3xl text-center rounded-2xl outline-none" />
          <button onClick={handleDead} className="w-full mt-4 bg-red-500 text-white font-bold py-5 rounded-2xl">
            ย้ายสต๊อกไปกุ้งตาย
          </button>
        </div>
      )}
    </div>
  );
};

const Dashboard = ({ stock, transactions }) => {
  const todaySales = transactions.reduce((sum, tx) => sum + tx.total, 0);
  return (
    <div className="p-5 space-y-5">
      <div className="bg-white p-6 rounded-[2rem] shadow-sm">
        <h3 className="font-bold text-slate-500 text-sm mb-2">ยอดขายรวมวันนี้</h3>
        <h1 className="text-5xl font-black text-slate-800">฿{todaySales.toLocaleString()}</h1>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-gradient-to-br from-blue-500 to-blue-700 rounded-[2rem] p-6 text-white">
          <h3 className="text-blue-200 text-xs font-bold mb-2">กุ้งเป็น (ในบ่อ)</h3>
          <div className="text-3xl font-black">{stock.live.toFixed(1)} <span className="text-base font-normal">กก.</span></div>
        </div>
        <div className="bg-gradient-to-br from-red-400 to-orange-500 rounded-[2rem] p-6 text-white">
          <h3 className="text-red-200 text-xs font-bold mb-2">กุ้งตาย (รอขาย)</h3>
          <div className="text-3xl font-black">{stock.dead.toFixed(1)} <span className="text-base font-normal">กก.</span></div>
        </div>
      </div>
      <div className="bg-white p-6 rounded-[2rem] shadow-sm">
        <h3 className="font-bold text-slate-800 mb-5">บิลขายล่าสุด</h3>
        {transactions.length === 0
          ? <p className="text-center text-slate-400 py-5">ยังไม่มีรายการ</p>
          : (
            <div className="space-y-4">
              {transactions.slice(0, 10).map((tx, i) => (
                <div key={i} className="border-b border-slate-100 pb-4">
                  <div className="flex justify-between items-center">
                    <p className="font-bold text-slate-700">{tx.customerName}</p>
                    <p className="font-black text-emerald-600">฿{tx.total.toLocaleString()}</p>
                  </div>
                  <p className="text-xs text-slate-400 mt-1">{tx.items.length} รายการ • โซน: {tx.zone} • {tx.timestamp}</p>
                </div>
              ))}
            </div>
          )
        }
      </div>
    </div>
  );
};

const NavButton = ({ icon, label, isActive, onClick }) => (
  <button onClick={onClick}
    className={`flex flex-col items-center justify-center w-full p-3 transition-all ${
      isActive ? 'text-blue-600 scale-110' : 'text-slate-400'
    }`}>
    {React.cloneElement(icon, { size: 24, strokeWidth: isActive ? 2.5 : 2, className: 'mb-1' })}
    <span className={`text-[10px] ${isActive ? 'font-bold' : 'font-medium'}`}>{label}</span>
  </button>
);

createRoot(document.getElementById('root')).render(<App />);
