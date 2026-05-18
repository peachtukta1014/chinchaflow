import React, { useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Camera, Plus, Trash2, UserRound, Package, ReceiptText } from 'lucide-react';
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

function App() {
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [paymentType, setPaymentType] = useState('cash');
  const [items, setItems] = useState([
    { id: crypto.randomUUID(), type: 'กุ้งเป็น', weight: 1, price: 350 }
  ]);
  const [billImage, setBillImage] = useState(null);

  const selectedCustomer = customers.find((customer) => customer.id === selectedCustomerId);

  const total = useMemo(
    () => items.reduce((sum, item) => sum + Number(item.weight || 0) * Number(item.price || 0), 0),
    [items]
  );

  const updateItem = (id, key, value) => {
    setItems((current) => current.map((item) => (item.id === id ? { ...item, [key]: value } : item)));
  };

  const addItem = () => {
    setItems((current) => [
      ...current,
      { id: crypto.randomUUID(), type: 'กุ้งเป็น', weight: 1, price: 350 }
    ]);
  };

  const removeItem = (id) => {
    setItems((current) => current.filter((item) => item.id !== id));
  };

  const handleBillImage = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setBillImage({ name: file.name, url: URL.createObjectURL(file) });
  };

  return (
    <main className="app-shell">
      <section className="hero-card">
        <div>
          <p className="eyebrow">โกอ้วน คลังซีฟู๊ด</p>
          <h1>ขายกุ้งหน้าร้าน</h1>
          <p className="muted">POS มือถือ • พร้อมต่อ Firebase • พร้อมอัปโหลดรูปบิล</p>
        </div>
        <div className="stock-pill">
          <Package size={18} />
          <span>Live 125.500 กก.</span>
        </div>
      </section>

      <section className="card">
        <div className="section-title">
          <UserRound size={20} />
          <h2>เลือกลูกค้า</h2>
        </div>
        <select value={selectedCustomerId} onChange={(event) => setSelectedCustomerId(event.target.value)}>
          <option value="">กดเพื่อเลือกรายชื่อลูกค้า</option>
          {customers.map((customer) => (
            <option key={customer.id} value={customer.id}>
              {customer.zone} • {customer.name}
            </option>
          ))}
        </select>
        {selectedCustomer && (
          <p className="helper">โซน: {selectedCustomer.zone} / ลูกค้า: {selectedCustomer.name}</p>
        )}
      </section>

      <section className="card">
        <div className="section-title">
          <ReceiptText size={20} />
          <h2>รายการขาย</h2>
        </div>

        <div className="payment-tabs">
          <button className={paymentType === 'cash' ? 'active' : ''} onClick={() => setPaymentType('cash')}>
            เงินสด
          </button>
          <button className={paymentType === 'credit' ? 'active' : ''} onClick={() => setPaymentType('credit')}>
            เงินเชื่อ
          </button>
        </div>

        <div className="items-list">
          {items.map((item) => (
            <div className="item-row" key={item.id}>
              <select value={item.type} onChange={(event) => updateItem(item.id, 'type', event.target.value)}>
                <option>กุ้งเป็น</option>
                <option>กุ้งน็อค</option>
              </select>
              <input
                type="number"
                inputMode="decimal"
                value={item.weight}
                onChange={(event) => updateItem(item.id, 'weight', event.target.value)}
                placeholder="กก."
              />
              <input
                type="number"
                inputMode="decimal"
                value={item.price}
                onChange={(event) => updateItem(item.id, 'price', event.target.value)}
                placeholder="บาท/กก."
              />
              <button className="icon-button" onClick={() => removeItem(item.id)} aria-label="ลบรายการ">
                <Trash2 size={18} />
              </button>
            </div>
          ))}
        </div>

        <button className="secondary-button" onClick={addItem}>
          <Plus size={18} /> เพิ่มรายการ
        </button>
      </section>

      <section className="card">
        <div className="section-title">
          <Camera size={20} />
          <h2>อัปโหลดรูปบิล</h2>
        </div>
        <label className="upload-box">
          <input type="file" accept="image/*" capture="environment" onChange={handleBillImage} />
          {billImage ? (
            <img src={billImage.url} alt={billImage.name} />
          ) : (
            <span>แตะเพื่อถ่ายรูปหรือเลือกรูปจากเครื่อง</span>
          )}
        </label>
      </section>

      <section className="total-card">
        <div>
          <p className="muted">ยอดรวม</p>
          <strong>{money(total)} บาท</strong>
        </div>
        <button className="primary-button">บันทึกบิล</button>
      </section>
    </main>
  );
}

createRoot(document.getElementById('root')).render(<App />);
