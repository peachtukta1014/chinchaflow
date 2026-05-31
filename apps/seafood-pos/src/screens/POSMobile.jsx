import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  CheckCircle, ChevronDown, Delete, Edit3, MapPin, Mic, MicOff, Package, PlusCircle, X,
} from 'lucide-react';
import {
  hasVoiceCommitCommand,
  isVoiceOrderComplete,
  parseShrimpVoice,
} from '../lib/voiceParse';
import { CUSTOMERS, DEFAULT_PAYMENT_TYPE, PAY, PRODUCTS } from '../constants';
import { FS_BASE, fsAuthHeaders } from '../lib/firestoreRest';
import { useVoice } from '../hooks/useVoice';
import { subscribeCustomers, mergeCustomerLists } from '../services/customerService';
import { formatFirestoreSaveError } from '../lib/firestoreRest';
import { saveBillWithCart as saveBillWithCartService } from '../services/salesService';
import { buildPreviewBill } from '../lib/buildPreviewBill';
import BillImageSheet from '../components/BillImageSheet';
import LineShareButton from '../components/LineShareButton';
import StockLineSwitcher from '../components/StockLineSwitcher';
import { STOCK_LINE } from '../constants/stockLines';

export default function POSMobile({
  user,
  stock,
  stockBatches = [],
  updateMainStock,
  onSaveBill,
  onOpenReceiveLive,
  onOpenReceiveDead,
}) {
  const [selectedCustomer, setSelectedCustomer] = useState('general');
  const [fsCustomers, setFsCustomers] = useState({});
  const [cart, setCart]             = useState([]);
  const [salesLine, setSalesLine] = useState('live');
  const lineProducts = useMemo(
    () => PRODUCTS.filter((p) => p.type === salesLine),
    [salesLine],
  );
  const defaultProductId = lineProducts[0]?.id || PRODUCTS[0].id;
  const [selectedProduct, setSelectedProduct] = useState(defaultProductId);
  const [weight, setWeight]         = useState('');
  const [customPrice, setCustomPrice] = useState(PRODUCTS[0].price.toString());
  const [loadedPrices, setLoadedPrices] = useState({});
  const [note, setNote]             = useState('');
  const [inputMode, setInputMode]   = useState('weight');
  const [saving, setSaving]         = useState(false);
  const [paymentType, setPaymentType] = useState(DEFAULT_PAYMENT_TYPE);
  const [paidAmount, setPaidAmount] = useState('');
  const [billSheet, setBillSheet] = useState(null);
  const billNoRef     = useRef(`INV-${Date.now().toString().slice(-8)}`);

  const allCustomers = useMemo(() => mergeCustomerLists(fsCustomers), [fsCustomers]);

  const activeProduct    = PRODUCTS.find(p => p.id === selectedProduct);
  const isDeadShrimp     = activeProduct?.type === 'dead';
  const currentItemTotal = isDeadShrimp
    ? (parseFloat(customPrice) || 0)
    : (parseFloat(weight) || 0) * (parseFloat(customPrice) || 0);
  const cartTotal = cart.reduce((s, i) => s + i.total, 0);
  const cartHasLive = cart.some((i) => i.type !== 'dead');
  const cartHasDead = cart.some((i) => i.type === 'dead');
  const cartIsMixed = cartHasLive && cartHasDead;

  const paidAmt = paymentType === 'cash' || paymentType === 'transfer'
    ? cartTotal
    : paymentType === 'credit' ? 0 : (parseFloat(paidAmount) || 0);
  const remaining = cartTotal - paidAmt;

  const [voiceResult, setVoiceResult] = useState('');
  const voiceTimerRef = useRef(null);

  useEffect(() => subscribeCustomers(setFsCustomers, () => {}), []);

  useEffect(() => {
    fsAuthHeaders().then(h => fetch(`${FS_BASE}/productSettings/shrimp`, { headers: h }))
      .then(r => r.ok ? r.json() : null)
      .then(j => {
        if (!j?.fields) return;
        const p = {};
        ['large','medium','small'].forEach(k => {
          const v = j.fields[k];
          if (v) p[k] = parseInt(v.integerValue ?? v.doubleValue ?? 0);
        });
        setLoadedPrices(p);
      })
      .catch(() => {});
  }, []);

  const priceOf = (productId) => loadedPrices[productId] ?? PRODUCTS.find(p => p.id === productId)?.price ?? 0;

  const handleProductChange = (productId) => {
    setSelectedProduct(productId);
    const prod = PRODUCTS.find(p => p.id === productId);
    if (!prod || prod.type !== salesLine) return;
    setWeight(''); setNote('');
    if (prod.type === 'dead') { setCustomPrice(''); setInputMode('price'); }
    else { setCustomPrice(priceOf(productId).toString()); setInputMode('weight'); }
  };

  /** สลับสายเพื่อเลือกสินค้าเพิ่ม — ตะกร้า/บิลลูกค้ารวมเป็น+ตายในบิลเดียวได้ */
  const switchSalesLine = (line) => {
    if (line === salesLine) return;
    setSalesLine(line);
    const first = PRODUCTS.find((p) => p.type === line);
    if (first) {
      setSelectedProduct(first.id);
      setWeight('');
      setNote('');
      if (first.type === 'dead') {
        setCustomPrice('');
        setInputMode('price');
      } else {
        setCustomPrice(priceOf(first.id).toString());
        setInputMode('weight');
      }
    }
  };

  const handleNumpad = (num) => {
    if (inputMode === 'weight') {
      if (num === '.' && weight.includes('.')) return;
      setWeight(p => p + num);
    } else {
      if (num === '.' && customPrice.includes('.')) return;
      setCustomPrice(p => p + num);
    }
  };

  const addToCart = () => {
    if (!isDeadShrimp && !weight) return alert('ใส่น้ำหนักก่อนนะครับ');
    if (!customPrice) return alert('ใส่ราคาก่อนครับ');
    setCart([...cart, {
      id: Date.now(), productId: activeProduct.id, productName: activeProduct.name,
      type: activeProduct.type, weight: parseFloat(weight) || 0,
      pricePerKg: isDeadShrimp ? 0 : parseFloat(customPrice),
      total: currentItemTotal, note,
    }]);
    setWeight(''); setNote('');
    if (!isDeadShrimp) setCustomPrice(priceOf(activeProduct.id).toString());
    setInputMode('weight');
  };

  const saveBillWithCart = async (cartItems) => {
    if (cartItems.length === 0 || saving) return;
    if (paymentType === 'installment' && !paidAmount) { alert('ใส่จำนวนเงินที่ผ่อนมาด้วยครับ'); return; }
    const customer = allCustomers.find(c => c.id === selectedCustomer) || CUSTOMERS.find(c => c.id === selectedCustomer);
    setSaving(true);
    try {
      const result = await saveBillWithCartService({
        cartItems,
        stock,
        stockBatches,
        customer,
        selectedCustomer,
        paymentType,
        paidAmount,
        billNo: billNoRef.current,
        recordedBy: user.name,
        photoUrl: null,
        updateMainStock,
      });
      if (!result.ok) {
        alert(result.message);
        return;
      }
      const { billData, total, remain } = result;
      onSaveBill(billData);
      const payLabel = PAY.find(p => p.id === paymentType)?.label || paymentType;
      alert(`✅ บันทึกบิลสำเร็จ!\nยอด: ฿${total.toLocaleString()} | ${payLabel}${remain > 0 ? `\nค้าง ฿${remain.toLocaleString()}` : ''}`);
      setCart([]); setSelectedCustomer('general');
      setPaymentType(DEFAULT_PAYMENT_TYPE); setPaidAmount('');
      billNoRef.current = `INV-${Date.now().toString().slice(-8)}`;
    } catch (err) {
      console.error(err);
      alert(formatFirestoreSaveError(err));
    } finally {
      setSaving(false);
    }
  };
  const handleSaveBill = () => saveBillWithCart(cart);

  const cartRef = useRef(cart);
  cartRef.current = cart;

  const applyVoiceDraft = (draft) => {
    if (draft.customerId) setSelectedCustomer(draft.customerId);
    if (draft.productId) {
      const prod = PRODUCTS.find((p) => p.id === draft.productId);
      if (prod && prod.type !== salesLine) switchSalesLine(prod.type);
      setSelectedProduct(draft.productId);
      setNote('');
      if (prod?.type === 'dead') {
        setCustomPrice(draft.weight != null ? String(draft.weight) : '');
        setWeight('');
        setInputMode('price');
      } else {
        setCustomPrice(String(priceOf(draft.productId)));
        setInputMode('weight');
        setWeight(draft.weight != null ? String(draft.weight) : '');
      }
    } else if (draft.weight != null) {
      const prod = PRODUCTS.find((p) => p.id === selectedProduct);
      if (prod?.type === 'dead') setCustomPrice(String(draft.weight));
      else setWeight(String(draft.weight));
    }
  };

  const buildCartItemsFromVoice = (complete) => complete.map((o) => {
    const prod = PRODUCTS.find((p) => p.id === o.productId);
    if (!prod) return null;
    const w = parseFloat(o.weight) || 0;
    const ppk = prod.type === 'dead' ? 0 : priceOf(prod.id);
    const total = prod.type === 'dead' ? w : w * ppk;
    return {
      id: Date.now() + Math.random(),
      productId: prod.id,
      productName: prod.name,
      type: prod.type,
      weight: w,
      pricePerKg: ppk,
      total,
      note: '',
    };
  }).filter(Boolean);

  const onVoiceText = (text) => {
    setVoiceResult(text);
    clearTimeout(voiceTimerRef.current);
    voiceTimerRef.current = setTimeout(() => setVoiceResult(''), 6000);
    const parsed = parseShrimpVoice(text, allCustomers, selectedCustomer);
    const complete = parsed.filter(isVoiceOrderComplete);
    const commit = hasVoiceCommitCommand(text);

    if (complete.length > 0) {
      applyVoiceDraft(complete[complete.length - 1]);
      const newItems = buildCartItemsFromVoice(complete);
      if (newItems.length) {
        setSelectedCustomer(complete[0].customerId);
        if (commit) {
          saveBillWithCart([...cartRef.current, ...newItems]);
          setVoiceResult(`${text} · ✅ บันทึกแล้ว`);
        } else {
          setCart((prev) => [...prev, ...newItems]);
          setVoiceResult(`${text} · ✅ เพิ่ม ${newItems.length} รายการ`);
        }
      }
      return;
    }

    if (parsed.length > 0) {
      applyVoiceDraft(parsed[0]);
      const miss = [];
      if (!parsed[0].productId) miss.push('ขนาดกุ้ง (ใหญ่/กลาง/เล็ก/ตาย)');
      if (!parsed[0].weight) miss.push('น้ำหนัก (กก.)');
      setVoiceResult(miss.length ? `${text} · ยังขาด: ${miss.join(', ')}` : `${text} · ตรวจสอบแล้วกด + เพิ่มตะกร้า`);
      return;
    }

    const m = text.match(/\d+(?:\.\d+)?/);
    if (m) {
      if (inputMode === 'weight') setWeight(m[0]);
      else setCustomPrice(m[0]);
      setVoiceResult(`${text} · ใส่ตัวเลขในช่องที่เลือก`);
    } else {
      setVoiceResult(`${text} · ลอง: "กุ้งใหญ่ 2 กิโล" หรือ "จ๊ะขียด กุ้งกลาง 1.5 กก."`);
    }
  };

  const { listening: voiceListen, toggle: toggleVoice, liveText } = useVoice(onVoiceText);

  const groupedCustomers = allCustomers.reduce((acc, c) => {
    const zone = c.zone || 'อื่นๆ';
    if (!acc[zone]) acc[zone] = [];
    acc[zone].push(c);
    return acc;
  }, {});

  const activeCustomer =
    allCustomers.find((c) => c.id === selectedCustomer) ||
    CUSTOMERS.find((c) => c.id === selectedCustomer);

  const previewBill =
    cart.length > 0
      ? buildPreviewBill({
          cartItems: cart,
          customer: activeCustomer,
          selectedCustomer,
          paymentType,
          paidAmount,
          billNo: billNoRef.current,
          recordedBy: user.name,
        })
      : null;

  return (
    <div className="flex flex-col bg-slate-100" style={{ minHeight: 'calc(100vh - 120px)' }}>
      {billSheet && (
        <BillImageSheet
          bill={billSheet.bill}
          customer={billSheet.customer}
          staffName={user?.name}
          onClose={() => setBillSheet(null)}
        />
      )}
      <div className="bg-white p-4 rounded-b-3xl shadow-sm z-10">
        <StockLineSwitcher line={salesLine} onChange={switchSalesLine} className="mb-2" />
        <p className="text-[10px] text-slate-500 mb-3 leading-relaxed px-0.5">
          สลับสายเพื่อเลือกสินค้าเพิ่ม · บิลลูกค้า
          <strong>
            {' '}
            รวม
            {STOCK_LINE.live.tag}
            +
            {STOCK_LINE.dead.tag}
            {' '}
            ในบิลเดียว
          </strong>
          ได้
          {cartIsMixed && (
            <span className="ml-1 text-emerald-700 font-bold">· ตะกร้ามีทั้ง Live และ Dead แล้ว</span>
          )}
        </p>

        {(onOpenReceiveLive || onOpenReceiveDead) && (
          <div className="flex gap-2 mb-3">
            {onOpenReceiveLive && (
              <button
                type="button"
                onClick={onOpenReceiveLive}
                className="flex-1 flex items-center justify-center gap-1.5 py-3 rounded-2xl bg-blue-600 text-white font-bold text-xs shadow-md active:scale-[0.98]"
              >
                <Package size={18} />
                รับเข้า Live
              </button>
            )}
            {onOpenReceiveDead && (
              <button
                type="button"
                onClick={onOpenReceiveDead}
                className="flex-1 flex items-center justify-center gap-1.5 py-3 rounded-2xl bg-red-500 text-white font-bold text-xs shadow-md active:scale-[0.98]"
              >
                <Package size={18} />
                รับเข้า Dead
              </button>
            )}
          </div>
        )}

        {/* Cart items */}
        {cart.length > 0 && (
          <div className="max-h-40 overflow-y-auto mb-3 space-y-2 border-t border-slate-100 pt-3">
            {cart.map((item, idx) => (
              <div
                key={item.id}
                className={`flex justify-between items-center p-3 rounded-2xl border-2 ${
                  item.type === 'dead'
                    ? 'bg-red-50 border-red-100'
                    : 'bg-blue-50 border-blue-100'
                }`}
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-slate-800">
                    {idx + 1}. {item.productName}
                    <span className={`ml-1.5 text-[10px] font-bold ${item.type === 'dead' ? 'text-red-600' : 'text-blue-600'}`}>
                      ({item.type === 'dead' ? STOCK_LINE.dead.tag : STOCK_LINE.live.tag})
                    </span>
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {item.weight} กก.{item.type === 'live' ? ` × ฿${item.pricePerKg}` : ' (เหมา)'}
                    {item.note && <span className="text-orange-500 ml-1">*{item.note}</span>}
                  </p>
                </div>
                <div className="flex items-center gap-2 ml-2">
                  <p className="font-bold text-blue-600">฿{item.total.toLocaleString()}</p>
                  <button onClick={() => setCart(cart.filter(i => i.id !== item.id))}
                    className="text-red-400 bg-red-50 p-1.5 rounded-full"><X size={14} /></button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Payment type row */}
        {cart.length > 0 && (
          <div className="border-t border-slate-100 pt-3 space-y-2 mb-2">
            <div className="flex gap-2">
              {PAY.map(pt => (
                <button key={pt.id}
                  onClick={() => { setPaymentType(pt.id); if (pt.id !== 'installment') setPaidAmount(''); }}
                  className={`flex-1 py-2 rounded-xl font-bold text-xs transition-all ${
                    paymentType === pt.id ? pt.cls + ' text-white shadow-md' : 'bg-slate-100 text-slate-500'
                  }`}>{pt.label}</button>
              ))}
            </div>
            {paymentType === 'installment' && (
              <input type="number" inputMode="decimal" value={paidAmount}
                onChange={e => setPaidAmount(e.target.value)} placeholder="จ่ายมาแล้ว (฿)"
                className="w-full p-3 bg-purple-50 border border-purple-200 rounded-2xl text-base font-bold outline-none" />
            )}
            {remaining > 0 && (
              <p className="text-xs text-orange-500 font-bold text-right">ค้างจ่าย ฿{remaining.toLocaleString()}</p>
            )}
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setBillSheet({ bill: previewBill, customer: activeCustomer })}
                className="flex-1 py-2.5 rounded-xl bg-slate-800 text-white text-xs font-bold"
              >
                ดูภาพบิล
              </button>
              <LineShareButton
                bill={previewBill}
                customer={activeCustomer}
                className="flex-1"
              />
            </div>
          </div>
        )}

        {/* Total + save */}
        <div className="flex justify-between items-end border-t border-slate-100 pt-3 gap-3">
          <div className="min-w-0">
            <p className="text-slate-400 text-[11px] font-bold tracking-wide">ยอดรวมบิล ({cart.length} รายการ)</p>
            <h2 className="text-4xl font-black text-emerald-500 leading-none mt-1">฿{cartTotal.toLocaleString()}</h2>
            {cart.length > 0 && (
              <p className="text-[10px] text-slate-400 mt-1 leading-relaxed">
                บิลดิจิทัล — กด「ดูภาพบิล」หรือส่ง LINE หลังจบบิล
              </p>
            )}
          </div>
          {cart.length > 0 && (
            <button
              type="button"
              onClick={handleSaveBill}
              disabled={saving}
              className="bg-emerald-500 text-white px-5 py-3 rounded-2xl font-bold flex items-center gap-2 shadow-lg active:scale-95 disabled:opacity-60 shrink-0"
            >
              <CheckCircle size={20} />
              {saving ? 'กำลังบันทึก...' : 'จบบิล'}
            </button>
          )}
        </div>
      </div>

      {/* ลูกค้า + ขนาดกุ้ง (แถวเดียว) */}
      <div className="px-3 py-3 flex gap-2 items-stretch shrink-0 min-h-[52px]">
        <div className="flex items-center bg-white rounded-2xl border border-slate-200 shadow-sm shrink-0 w-[38%] max-w-[9.5rem] min-w-[7.5rem]">
          <MapPin className="text-blue-500 ml-2 shrink-0" size={16} />
          <select
            value={selectedCustomer}
            onChange={(e) => setSelectedCustomer(e.target.value)}
            className="bg-transparent text-slate-800 w-full outline-none py-2.5 pr-1 pl-1 font-bold text-xs truncate"
            aria-label="เลือกลูกค้า"
          >
            {Object.keys(groupedCustomers).map((zone) => (
              <optgroup key={zone} label={`── ${zone} ──`}>
                {groupedCustomers[zone].map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </optgroup>
            ))}
          </select>
          <ChevronDown className="text-slate-400 mr-1.5 shrink-0" size={16} />
        </div>
        <div className="flex-1 overflow-x-auto whitespace-nowrap flex gap-2 items-center">
          {lineProducts.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => handleProductChange(p.id)}
              className={`inline-block px-4 py-2.5 rounded-2xl font-bold text-xs transition-all shrink-0 ${
                selectedProduct === p.id
                  ? (p.type === 'dead' ? 'bg-red-500 text-white shadow-lg' : 'bg-blue-600 text-white shadow-lg')
                  : 'bg-white text-slate-500 border border-slate-200'
              }`}
            >
              {p.name}
            </button>
          ))}
        </div>
      </div>

      {/* Numpad */}
      <div className="flex-1 bg-white p-5 flex flex-col rounded-t-[2.5rem] shadow-[0_-10px_30px_rgba(0,0,0,0.04)]"
        style={{ paddingBottom: 'max(1.25rem, env(safe-area-inset-bottom))' }}>
        <div className="flex gap-2 mb-3">
          <button onClick={() => setInputMode('weight')}
            className={`flex-1 py-3 rounded-2xl font-bold text-xs border ${inputMode === 'weight' ? 'bg-slate-800 text-white' : 'bg-slate-50 text-slate-500'}`}>
            น้ำหนัก: {weight || '0.0'} กก.
          </button>
          <button onClick={() => setInputMode('price')}
            className={`flex-1 py-3 rounded-2xl font-bold text-xs border ${inputMode === 'price' ? 'bg-slate-800 text-white' : 'bg-slate-50 text-slate-500'}`}>
            {isDeadShrimp ? 'เหมา: ' : 'โลละ: '}{customPrice || '0'} บ.
          </button>
          <button onClick={toggleVoice}
            className={`w-12 rounded-2xl flex items-center justify-center border-2 transition-all shrink-0 ${
              voiceListen ? 'bg-red-500 border-red-400 text-white' : 'bg-slate-50 border-slate-200 text-slate-400'
            }`}>
            {voiceListen ? <MicOff size={20} /> : <Mic size={20} />}
          </button>
        </div>

        {/* Voice transcript bar */}
        {(voiceListen || liveText || voiceResult) && (
          <div className={`mb-3 px-4 py-3 rounded-2xl flex items-center gap-3 transition-all ${
            voiceListen ? 'bg-red-50 border border-red-200' : 'bg-slate-50 border border-slate-200'
          }`}>
            {voiceListen && (
              <div className="flex gap-0.5 items-end shrink-0 h-5">
                {[6,10,8,12,7].map((h, i) => (
                  <div key={i} className="w-1 rounded-full bg-red-400 animate-bounce"
                    style={{ height: `${h}px`, animationDelay: `${i * 0.1}s` }} />
                ))}
              </div>
            )}
            <p className={`flex-1 text-sm font-medium truncate ${voiceListen ? 'text-red-600' : 'text-slate-500'}`}>
              {liveText || voiceResult || 'กำลังฟัง...'}
            </p>
          </div>
        )}

        <div className="relative mb-3">
          <Edit3 className="absolute left-4 top-3 text-slate-400" size={16} />
          <input type="text" placeholder="หมายเหตุ (ถ้ามี)" value={note} onChange={e => setNote(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 pl-11 pr-4 py-3 rounded-2xl text-sm outline-none" />
        </div>

        <div className="flex justify-between items-center mb-3">
          <p className="text-slate-400 font-bold text-sm">ยอดรายการนี้</p>
          <p className={`text-2xl font-black ${salesLine === 'dead' ? 'text-red-600' : 'text-blue-600'}`}>
            ฿{currentItemTotal.toLocaleString()}
          </p>
        </div>

        <div className="grid grid-cols-4 gap-2 flex-1">
          <div className="col-span-3 grid grid-cols-3 gap-2">
            {[1,2,3,4,5,6,7,8,9].map(n => (
              <button key={n} onClick={() => handleNumpad(n.toString())}
                className="bg-slate-50 active:bg-slate-200 text-2xl font-bold text-slate-700 rounded-2xl py-4">{n}</button>
            ))}
            <button onClick={() => handleNumpad('.')} className="bg-slate-50 text-3xl font-bold text-slate-700 rounded-2xl py-4">.</button>
            <button onClick={() => handleNumpad('0')} className="bg-slate-50 text-2xl font-bold text-slate-700 rounded-2xl py-4">0</button>
            <button onClick={() => {
              if (inputMode === 'weight') setWeight(p => p.slice(0, -1));
              else setCustomPrice(p => p.slice(0, -1));
            }} className="bg-red-50 text-red-500 rounded-2xl flex items-center justify-center py-4">
              <Delete size={28} />
            </button>
          </div>
          <button onClick={addToCart}
            className={`col-span-1 text-white rounded-2xl font-bold flex flex-col items-center justify-center gap-2 shadow-lg active:scale-95 ${
              salesLine === 'dead' ? 'bg-red-500' : 'bg-blue-600'
            }`}>
            <PlusCircle size={32} /><span className="text-sm">เพิ่ม</span>
          </button>
        </div>
      </div>
    </div>
  );
};
