import React, { useMemo, useState } from 'react';
import { dateKeyBangkok } from '../lib/date';
import { countReceivesOnDate } from '../lib/stockBatchUtils';
import { createStockBatchRecord } from '../services/stockService';

export default function InventoryScreen({ stock, stockBatches = [], updateMainStock, onReceived }) {
  const [tab, setTab]           = useState('receive');
  const [rcvLive, setRcvLive]   = useState('');
  const [rcvDead, setRcvDead]   = useState('');
  const [rcvCost, setRcvCost]   = useState('');
  const [rcvTransport, setRcvTransport] = useState('');
  const [rcvNote, setRcvNote]   = useState('');
  const [deadWeight, setDeadWeight] = useState('');
  const [saving, setSaving]     = useState(false);

  const liveKg    = parseFloat(rcvLive) || 0;
  const deadKg    = parseFloat(rcvDead) || 0;
  const costPerKg = parseFloat(rcvCost) || 0;
  const transport = parseFloat(rcvTransport) || 0;
  const shrimpCost = (liveKg + deadKg) * costPerKg;
  const grandTotal = shrimpCost + transport;
  const effectiveCost = (liveKg + deadKg) > 0 ? grandTotal / (liveKg + deadKg) : 0;
  const todayKey = dateKeyBangkok();
  const todayReceiveCount = useMemo(
    () => countReceivesOnDate(stockBatches, todayKey),
    [stockBatches, todayKey],
  );

  const handleReceive = async () => {
    if (!rcvLive && !rcvDead) return alert('ใส่น้ำหนักอย่างน้อย 1 ช่องครับ');
    if (!rcvCost) return alert('ใส่ราคาซื้อ/กก.ด้วยครับ');
    setSaving(true);
    try {
      const { grandTotal: savedTotal, effectiveCost: savedCost } = await createStockBatchRecord({
        liveKg,
        deadKg,
        costPerKg,
        transport,
        note: rcvNote,
      });
      await updateMainStock(stock.live + liveKg, stock.dead + deadKg);
      alert(`✅ บันทึกรายการรับเข้าแล้ว (ล็อตวันนี้รวม ${todayReceiveCount + 1} รายการ)\nต้นทุน: ฿${savedTotal.toLocaleString()} (฿${savedCost.toFixed(2)}/กก.)`);
      onReceived?.();
      setRcvLive(''); setRcvDead(''); setRcvCost(''); setRcvTransport(''); setRcvNote('');
    } catch (err) {
      console.error(err);
      alert('⚠️ บันทึกไม่สำเร็จ กรุณาลองอีกครั้งครับ');
    } finally {
      setSaving(false);
    }
  };

  const handleDead = () => {
    if (!deadWeight) return;
    const w = parseFloat(deadWeight);
    if (w > stock.live) return alert('ยอดกุ้งตายมากกว่ากุ้งเป็นครับ');
    updateMainStock(stock.live - w, stock.dead + w);
    alert('ย้ายยอดกุ้งตายสำเร็จ!'); setDeadWeight('');
  };

  return (
    <div className="p-5 space-y-5">
      <div className="flex bg-slate-200 p-1.5 rounded-2xl">
        <button onClick={() => setTab('receive')}
          className={`flex-1 py-3 font-bold text-sm rounded-xl ${tab === 'receive' ? 'bg-white text-blue-600' : 'text-slate-500'}`}>
          รับกุ้งเข้า
        </button>
        <button onClick={() => setTab('dead')}
          className={`flex-1 py-3 font-bold text-sm rounded-xl ${tab === 'dead' ? 'bg-white text-red-600' : 'text-slate-500'}`}>
          กุ้งตายจากบ่อ
        </button>
      </div>

      {tab === 'receive' && (
        <div className="bg-white p-6 rounded-[2rem] shadow-sm space-y-4">
          <h2 className="font-black text-slate-800 text-xl">บันทึกรายการรับเข้า (วันนี้)</h2>
          <p className="text-xs text-slate-500 leading-relaxed">
            แต่ละครั้งที่กดบันทึก = 1 รายการ (ราคา/รถต่างกัน) รวมอยู่ล็อตวันที่เดียวกัน
            {todayReceiveCount > 0 && (
              <span className="block mt-1 font-bold text-blue-600">
                วันนี้บันทึกแล้ว {todayReceiveCount} รายการ
              </span>
            )}
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-slate-500 mb-1 block">น้ำหนักกุ้งสด (กก.)</label>
              <input type="number" inputMode="decimal" value={rcvLive}
                onChange={e => setRcvLive(e.target.value)} placeholder="0.000"
                className="w-full p-3 bg-slate-50 rounded-2xl outline-none text-lg font-bold" />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-500 mb-1 block">น้ำหนักกุ้งตาย (กก.)</label>
              <input type="number" inputMode="decimal" value={rcvDead}
                onChange={e => setRcvDead(e.target.value)} placeholder="0.000"
                className="w-full p-3 bg-slate-50 rounded-2xl outline-none text-lg font-bold" />
            </div>
          </div>
          <div>
            <label className="text-xs font-bold text-slate-500 mb-1 block">ราคาซื้อ/กก. (฿/กก.)</label>
            <input type="number" inputMode="decimal" value={rcvCost}
              onChange={e => setRcvCost(e.target.value)} placeholder="0"
              className="w-full p-3 bg-slate-50 rounded-2xl outline-none text-lg font-bold" />
          </div>
          <div>
            <label className="text-xs font-bold text-slate-500 mb-1 block">ค่ารถ (฿)</label>
            <input type="number" inputMode="decimal" value={rcvTransport}
              onChange={e => setRcvTransport(e.target.value)} placeholder="0"
              className="w-full p-3 bg-slate-50 rounded-2xl outline-none text-lg font-bold" />
          </div>
          <div>
            <label className="text-xs font-bold text-slate-500 mb-1 block">หมายเหตุ</label>
            <input type="text" value={rcvNote} onChange={e => setRcvNote(e.target.value)}
              placeholder="เช่น รถทะเบียน กข-1234"
              className="w-full p-3 bg-slate-50 rounded-2xl outline-none" />
          </div>
          <div className="bg-slate-50 rounded-2xl p-4 space-y-2 border border-slate-200">
            <div className="flex justify-between text-sm text-slate-600">
              <span>น้ำหนักรวม</span><span className="font-bold">{(liveKg+deadKg).toFixed(3)} กก.</span>
            </div>
            <div className="flex justify-between text-sm text-slate-600">
              <span>ค่ากุ้ง</span><span className="font-bold">฿{shrimpCost.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-sm text-slate-600">
              <span>ค่ารถ</span><span className="font-bold">฿{transport.toLocaleString()}</span>
            </div>
            <div className="flex justify-between font-black text-slate-800 text-base border-t border-slate-200 pt-2">
              <span>ต้นทุนทั้งหมด</span><span className="text-blue-600">฿{grandTotal.toLocaleString()}</span>
            </div>
            {effectiveCost > 0 && (
              <div className="flex justify-between text-sm text-emerald-600 font-bold">
                <span>ต้นทุนจริง/กก. (FIFO)</span><span>฿{effectiveCost.toFixed(2)}</span>
              </div>
            )}
          </div>
          <button onClick={handleReceive} disabled={saving}
            className="w-full bg-slate-800 text-white font-bold py-5 rounded-2xl disabled:opacity-60">
            {saving ? 'กำลังบันทึก...' : 'บันทึกรายการรับเข้า'}
          </button>
        </div>
      )}

      {tab === 'dead' && (
        <div className="bg-white p-6 rounded-[2rem] shadow-sm">
          <h2 className="font-black text-red-600 text-xl mb-4">บันทึกกุ้งตาย</h2>
          <div className="bg-red-50 p-4 rounded-2xl mb-4">
            <span className="text-sm text-red-800">กุ้งเป็นคงเหลือ: <span className="font-black text-xl">{stock.live.toFixed(1)} กก.</span></span>
          </div>
          <input type="number" inputMode="decimal" value={deadWeight}
            onChange={e => setDeadWeight(e.target.value)} placeholder="0.0"
            className="w-full p-5 bg-white border-2 border-red-200 text-red-600 font-black text-3xl text-center rounded-2xl outline-none" />
          <button onClick={handleDead}
            className="w-full mt-4 bg-red-500 text-white font-bold py-5 rounded-2xl">
            ย้ายสต๊อกไปกุ้งตาย
          </button>
        </div>
      )}
    </div>
  );
};
