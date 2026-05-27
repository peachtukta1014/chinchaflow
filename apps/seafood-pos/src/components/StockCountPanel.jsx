import React, { useState } from 'react';
import { reconcileStockToActual } from '../services/stockService';

export default function StockCountPanel({
  stock,
  stockBatches = [],
  updateMainStock,
  member,
  onDone,
}) {
  const [actualLive, setActualLive] = useState('');
  const [actualDead, setActualDead] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  const systemLive = stock?.live ?? 0;
  const systemDead = stock?.dead ?? 0;

  const handleSave = async () => {
    const live = actualLive === '' ? null : parseFloat(actualLive);
    const dead = actualDead === '' ? null : parseFloat(actualDead);
    if (!Number.isFinite(live) || !Number.isFinite(dead)) {
      alert('ใส่น้ำหนักชั่งจริงทั้งกุ้งเป็นและกุ้งตายครับ');
      return;
    }
    if (
      !window.confirm(
        `ยืนยันชั่งปิดสต๊อกทั้งระบบ?\n\nระบบตอนนี้: เป็น ${systemLive.toFixed(2)} · ตาย ${systemDead.toFixed(2)} กก.\nชั่งจริง: เป็น ${live.toFixed(2)} · ตาย ${dead.toFixed(2)} กก.`,
      )
    ) {
      return;
    }
    setSaving(true);
    try {
      const r = await reconcileStockToActual(
        stock,
        stockBatches,
        live,
        dead,
        updateMainStock,
        { note, recordedBy: member?.name || '' },
      );
      const msg = [
        '✅ บันทึกชั่งปิดแล้ว',
        r.shrinkKg > 0.001
          ? `ของหายจากระบบ (ตัดขาดทุนประมาณ): ${r.shrinkKg.toFixed(2)} กก. ≈ ฿${Math.round(r.estimatedLossBaht).toLocaleString()}`
          : 'ไม่มีส่วนต่างน้ำหนักหาย',
      ].join('\n');
      alert(msg);
      setActualLive('');
      setActualDead('');
      setNote('');
      onDone?.();
    } catch (e) {
      console.error(e);
      alert(e?.message || 'บันทึกไม่สำเร็จ');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="bg-white p-5 rounded-[2rem] shadow-sm space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h2 className="font-black text-slate-800 text-lg">ชั่งปิดสต๊อก (ทั้งบ่อ)</h2>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">
              ใช้เมื่อชั่งรวมทั้งบ่อ/ตู้ — ระบบจะปรับยอดและบันทึกของเสียที่หายไป
              {' '}
              (แอดมิน)
            </p>
          </div>
          <span className="text-[10px] font-bold text-purple-700 bg-purple-50 px-2 py-1 rounded-lg shrink-0">
            แผน C
          </span>
        </div>
        <div className="bg-slate-50 rounded-xl p-3 text-sm">
          <p className="text-slate-500 text-xs">ยอดในระบบตอนนี้</p>
          <p className="font-black text-slate-800 mt-0.5">
            เป็น {systemLive.toFixed(2)} กก. · ตาย {systemDead.toFixed(2)} กก.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-bold text-slate-500">ชั่งจริง — กุ้งเป็น (กก.)</label>
            <input
              type="number"
              inputMode="decimal"
              value={actualLive}
              onChange={(e) => setActualLive(e.target.value)}
              className="w-full mt-1 p-3 bg-slate-50 rounded-xl font-bold"
              placeholder={systemLive.toFixed(2)}
            />
          </div>
          <div>
            <label className="text-xs font-bold text-slate-500">ชั่งจริง — กุ้งตาย (กก.)</label>
            <input
              type="number"
              inputMode="decimal"
              value={actualDead}
              onChange={(e) => setActualDead(e.target.value)}
              className="w-full mt-1 p-3 bg-slate-50 rounded-xl font-bold"
              placeholder={systemDead.toFixed(2)}
            />
          </div>
        </div>
        <input
          type="text"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="หมายเหตุ (เช่น ปิดบ่อก่อนรับล็อตใหม่)"
          className="w-full p-3 bg-slate-50 rounded-xl text-sm"
        />
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="w-full py-4 rounded-2xl bg-purple-600 text-white font-bold disabled:opacity-60"
        >
          {saving ? 'กำลังบันทึก...' : 'บันทึกชั่งปิดสต๊อก'}
        </button>
      </div>
      <p className="text-[10px] text-slate-400 px-2 leading-relaxed">
        ปิดรอบล็อตเฉพาะรถ → แท็บบน「สรุป/ชั่งปิด」· ชั่งทั้งบ่อรวมทุกล็อต → ใช้หน้านี้
      </p>
    </div>
  );
}
