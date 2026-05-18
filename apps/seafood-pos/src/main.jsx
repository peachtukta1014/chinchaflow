import React, { useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { Camera, ImagePlus, Mic, Plus, Trash2, UserRound, Package, ReceiptText } from 'lucide-react';
import { db, firebaseMissingKeys, isFirebaseReady, storage } from './firebase';
import './styles.css';

const customers = [
  { id: 'rawai-001', name: 'ร้านป้าหน่อย', zone: 'ราไวย์' },
  { id: 'patong-001', name: 'ร้านซีฟู้ดป่าตอง', zone: 'ป่าตอง' },
  { id: 'kathu-001', name: 'ร้านครัวกะทู้', zone: 'กะทู้' },
  { id: 'town-001', name: 'ตลาดเมืองภูเก็ต', zone: 'เมืองภูเก็ต' }
];

function money(value) {
  return Number(value || 0).toLocaleString('th-TH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function parseThaiVoiceCommand(text) {
  const normalized = text.replace(/,/g, '').toLowerCase();
  const type = normalized.includes('น็อค') || normalized.includes('ตาย') ? 'กุ้งน็อค' : 'กุ้งเป็น';
  const numbers = normalized.match(/\d+(?:\.\d+)?/g) || [];
  return { type, weight: numbers[0] || 1, price: numbers[1] || 350 };
}

function App() {
  const fileInputRef = useRef(null);
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [paymentType, setPaymentType] = useState('cash');
  const [items, setItems] = useState([{ id: crypto.randomUUID(), type: 'กุ้งเป็น', weight: 1, price: 350 }]);
  const [billImage, setBillImage] = useState(null);
  const [billFile, setBillFile] = useState(null);
  const [saveStatus, setSaveStatus] = useState('idle');
  const [statusMessage, setStatusMessage] = useState('');
  const [voiceText, setVoiceText] = useState('');

  const selectedCustomer = customers.find((customer) => customer.id === selectedCustomerId);
  const total = useMemo(() => items.reduce((sum, item) => sum + Number(item.weight || 0) * Number(item.price || 0), 0), [items]);

  const updateItem = (id, key, value) => setItems((current) => current.map((item) => (item.id === id ? { ...item, [key]: value } : item)));
  const addItem = (nextItem = { type: 'กุ้งเป็น', weight: 1, price: 350 }) => setItems((current) => [...current, { id: crypto.randomUUID(), ...nextItem }]);
  const removeItem = (id) => setItems((current) => current.filter((item) => item.id !== id));
  const openImagePicker = () => fileInputRef.current?.click();

  const handleBillImage = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setBillFile(file);
    setBillImage({ name: file.name, url: URL.createObjectURL(file) });
    setStatusMessage('เลือกรูปบิลแล้ว กดบันทึกบิลเพื่ออัปโหลดเข้า Firebase');
    setSaveStatus('idle');
  };

  const startVoiceCommand = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setSaveStatus('error');
      setStatusMessage('เครื่องนี้ยังไม่รองรับปุ่มเสียง ลองใช้ Chrome หรือ Safari เวอร์ชันใหม่');
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.lang = 'th-TH';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    setVoiceText('กำลังฟังเสียง...');
    recognition.onresult = (event) => {
      const text = event.results?.[0]?.[0]?.transcript || '';
      const parsed = parseThaiVoiceCommand(text);
      setVoiceText(text);
      addItem(parsed);
      setSaveStatus('idle');
      setStatusMessage(`เพิ่มจากเสียงแล้ว: ${parsed.type} ${parsed.weight} กก. ราคา ${parsed.price}`);
    };
    recognition.onerror = () => {
      setSaveStatus('error');
      setStatusMessage('รับเสียงไม่สำเร็จ ลองกดปุ่มเสียงใหม่อีกครั้ง');
    };
    recognition.start();
  };

  const saveBill = async () => {
    if (!isFirebaseReady) {
      setSaveStatus('error');
      setStatusMessage(`Firebase config ยังไม่ครบ: ${firebaseMissingKeys.join(', ')}`);
      return;
    }
    if (!selectedCustomer) {
      setSaveStatus('error');
      setStatusMessage('กรุณาเลือกลูกค้าก่อนบันทึกบิล');
      return;
    }
    try {
      setSaveStatus('saving');
      setStatusMessage('กำลังบันทึกบิล...');
      const saleRef = await addDoc(collection(db, 'sales'), {
        customerId: selectedCustomer.id,
        customerName: selectedCustomer.name,
        zone: selectedCustomer.zone,
        paymentType,
        items: items.map((item) => ({ type: item.type, weightKg: Number(item.weight || 0), pricePerKg: Number(item.price || 0), lineTotal: Number(item.weight || 0) * Number(item.price || 0) })),
        totalAmount: total,
        status: paymentType === 'credit' ? 'debt' : 'paid',
        createdAt: serverTimestamp(),
        source: 'seafood-pos-pwa'
      });
      let billImageUrl = '';
      if (billFile) {
        const safeName = billFile.name.replace(/[^a-zA-Z0-9._-]/g, '_');
        const imageRef = ref(storage, `bill-images/${saleRef.id}/${Date.now()}-${safeName}`);
        await uploadBytes(imageRef, billFile);
        billImageUrl = await getDownloadURL(imageRef);
        await addDoc(collection(db, 'billImages'), { saleId: saleRef.id, imageUrl: billImageUrl, fileName: billFile.name, createdAt: serverTimestamp() });
      }
      setSaveStatus('success');
      setStatusMessage(`บันทึกบิลสำเร็จ เลขที่: ${saleRef.id}${billImageUrl ? ' พร้อมรูปบิล' : ''}`);
    } catch (error) {
      console.error(error);
      setSaveStatus('error');
      setStatusMessage(`บันทึกไม่สำเร็จ: ${error.message}`);
    }
  };

  return (
    <main className="app-shell">
      <section className="hero-card">
        <div>
          <p className="eyebrow">โกอ้วน คลังซีฟู๊ด</p>
          <h1>ขายกุ้งหน้าร้าน</h1>
          <p className="muted">POS มือถือ • Firebase พร้อมบันทึกบิล • อัปโหลดรูปบิล</p>
        </div>
        <div className="stock-pill"><Package size={18} /><span>Live 125.500 กก.</span></div>
      </section>

      <section className="card action-grid">
        <button className="secondary-button" onClick={startVoiceCommand}><Mic size={18} /> ปุ่มเสียง</button>
        <button className="secondary-button" onClick={openImagePicker}><ImagePlus size={18} /> ถ่าย/เลือกรูปบิล</button>
      </section>
      {voiceText && <p className="helper">เสียงล่าสุด: {voiceText}</p>}

      <section className="card">
        <div className="section-title"><UserRound size={20} /><h2>เลือกลูกค้า</h2></div>
        <select value={selectedCustomerId} onChange={(event) => setSelectedCustomerId(event.target.value)}>
          <option value="">กดเพื่อเลือกรายชื่อลูกค้า</option>
          {customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.zone} • {customer.name}</option>)}
        </select>
        {selectedCustomer && <p className="helper">โซน: {selectedCustomer.zone} / ลูกค้า: {selectedCustomer.name}</p>}
      </section>

      <section className="card">
        <div className="section-title"><ReceiptText size={20} /><h2>รายการขาย</h2></div>
        <div className="payment-tabs">
          <button className={paymentType === 'cash' ? 'active' : ''} onClick={() => setPaymentType('cash')}>เงินสด</button>
          <button className={paymentType === 'credit' ? 'active' : ''} onClick={() => setPaymentType('credit')}>เงินเชื่อ</button>
        </div>
        <div className="items-list">
          {items.map((item) => (
            <div className="item-row" key={item.id}>
              <select value={item.type} onChange={(event) => updateItem(item.id, 'type', event.target.value)}><option>กุ้งเป็น</option><option>กุ้งน็อค</option></select>
              <input type="number" inputMode="decimal" value={item.weight} onChange={(event) => updateItem(item.id, 'weight', event.target.value)} placeholder="กก." />
              <input type="number" inputMode="decimal" value={item.price} onChange={(event) => updateItem(item.id, 'price', event.target.value)} placeholder="บาท/กก." />
              <button className="icon-button" onClick={() => removeItem(item.id)} aria-label="ลบรายการ"><Trash2 size={18} /></button>
            </div>
          ))}
        </div>
        <button className="secondary-button" onClick={() => addItem()}><Plus size={18} /> เพิ่มรายการ</button>
      </section>

      <section className="card">
        <div className="section-title"><Camera size={20} /><h2>อัปโหลดรูปบิล</h2></div>
        <input ref={fileInputRef} className="hidden-file-input" type="file" accept="image/*" capture="environment" onChange={handleBillImage} />
        <button type="button" className="upload-box" onClick={openImagePicker}>{billImage ? <img src={billImage.url} alt={billImage.name} /> : <span>แตะเพื่อถ่ายรูปหรือเลือกรูปจากเครื่อง</span>}</button>
      </section>

      {statusMessage && <p className={`status-message ${saveStatus}`}>{statusMessage}</p>}
      <section className="total-card">
        <div><p className="muted">ยอดรวม</p><strong>{money(total)} บาท</strong></div>
        <button className="primary-button" onClick={saveBill} disabled={saveStatus === 'saving'}>{saveStatus === 'saving' ? 'กำลังบันทึก...' : 'บันทึกบิล'}</button>
      </section>
    </main>
  );
}

createRoot(document.getElementById('root')).render(<App />);
