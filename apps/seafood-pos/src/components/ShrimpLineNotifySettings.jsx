import React, { useEffect, useState } from 'react';
import { fsGetDoc, fsSetDoc } from '../lib/firestoreRest';
import {
  formatLineDeliveryWindowLabel,
  LINE_DELIVERY_WINDOW_DEFAULTS,
  normalizeLineDeliveryWindow,
  setLineDeliveryWindow,
} from '../lib/lineDeliveryWindow';

const DEFAULT = {
  notifyGroupId: '',
  notifyUserIds: '',
  instantOrderNotify: true,
  lineDefaultStartHour: LINE_DELIVERY_WINDOW_DEFAULTS.startHour,
  lineDefaultEndHour: LINE_DELIVERY_WINDOW_DEFAULTS.endHour,
};

export default function ShrimpLineNotifySettings() {
  const [form, setForm] = useState({ ...DEFAULT });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [flash, setFlash] = useState('');

  useEffect(() => {
    fsGetDoc('config/shrimpLine')
      .then((doc) => {
        const merged = { ...DEFAULT, ...doc };
        const window = normalizeLineDeliveryWindow(merged);
        setLineDeliveryWindow(window);
        setForm({
          ...merged,
          lineDefaultStartHour: window.startHour,
          lineDefaultEndHour: window.endHour,
        });
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      const window = normalizeLineDeliveryWindow(form);
      setLineDeliveryWindow(window);
      await fsSetDoc('config/shrimpLine', {
        notifyGroupId: (form.notifyGroupId || '').trim(),
        notifyUserIds: (form.notifyUserIds || '').trim(),
        instantOrderNotify: form.instantOrderNotify !== false,
        lineDefaultStartHour: window.startHour,
        lineDefaultEndHour: window.endHour,
        updatedAt: new Date().toISOString(),
      });
      setFlash('✅ บันทึกแล้ว');
      setTimeout(() => setFlash(''), 2500);
    } catch (e) {
      setFlash('❌ บันทึกไม่สำเร็จ');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <p className="text-slate-400 text-sm py-4">กำลังโหลด...</p>;

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
      <div>
        <h3 className="text-sm font-black text-slate-800">แจ้งเตือนออเดอร์ LINE</h3>
        <p className="text-[10px] text-slate-500 mt-1 leading-relaxed">
          เมื่อมีออเดอร์ใหม่ ระบบส่งข้อความไปกลุ่ม LINE ที่ตั้งไว้ (และแจ้งบนแอปถ้าอนุญาต)
        </p>
      </div>
      {flash && (
        <p className="text-xs font-bold text-emerald-600 bg-emerald-50 px-3 py-2 rounded-xl">{flash}</p>
      )}
      <label className="text-[10px] font-bold text-slate-500 block">LINE Group ID (กลุ่มพนักงาน)</label>
      <input
        className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-xs font-mono outline-none"
        placeholder="Cxxxxxxxx... (33 ตัว)"
        value={form.notifyGroupId || ''}
        onChange={(e) => setForm((p) => ({ ...p, notifyGroupId: e.target.value.trim() }))}
      />
      <label className="text-[10px] font-bold text-slate-500 block">User ID เพิ่มเติม (คั่นด้วย comma)</label>
      <input
        className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-xs font-mono outline-none"
        placeholder="Uxxxxxxxx..."
        value={form.notifyUserIds || ''}
        onChange={(e) => setForm((p) => ({ ...p, notifyUserIds: e.target.value }))}
      />
      <label className="flex items-center gap-2 text-xs font-bold text-slate-700">
        <input
          type="checkbox"
          checked={form.instantOrderNotify !== false}
          onChange={(e) => setForm((p) => ({ ...p, instantOrderNotify: e.target.checked }))}
          className="w-4 h-4 rounded"
        />
        แจ้งทันทีเมื่อมีออเดอร์ LINE ใหม่
      </label>

      <div className="pt-2 border-t border-slate-100 space-y-2">
        <h4 className="text-xs font-black text-slate-800">เวลา「ไม่ระบุวันส่ง」 (บอท LINE)</h4>
        <p className="text-[10px] text-slate-500 leading-relaxed">
          ลูกค้าไม่พิมพ์วันส่ง/วันนี้/พรุ่งนี้ — ระบบตั้งวันส่งอัตโนมัติตามช่วงเวลาไทย
          (ไม่ปิดรับออเดอร์)
        </p>
        <div className="grid grid-cols-2 gap-2">
          <label className="text-[10px] font-bold text-slate-500 block">
            เริ่มรอบ (เมื่อวาน) — ชม.
            <input
              type="number"
              min={0}
              max={23}
              className="mt-1 w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm outline-none"
              value={form.lineDefaultStartHour ?? DEFAULT.lineDefaultStartHour}
              onChange={(e) =>
                setForm((p) => ({
                  ...p,
                  lineDefaultStartHour: parseInt(e.target.value, 10) || 0,
                }))
              }
            />
          </label>
          <label className="text-[10px] font-bold text-slate-500 block">
            สิ้นสุดรอบ (วันนี้) — ชม.
            <input
              type="number"
              min={0}
              max={23}
              className="mt-1 w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm outline-none"
              value={form.lineDefaultEndHour ?? DEFAULT.lineDefaultEndHour}
              onChange={(e) =>
                setForm((p) => ({
                  ...p,
                  lineDefaultEndHour: parseInt(e.target.value, 10) || 0,
                }))
              }
            />
          </label>
        </div>
        <p className="text-[10px] text-slate-600 bg-slate-50 px-3 py-2 rounded-xl">
          ช่วงปัจจุบัน: {formatLineDeliveryWindowLabel(normalizeLineDeliveryWindow(form))}
          {' → ส่งวันนี้ · นอกช่วง → พรุ่งนี้'}
        </p>
      </div>

      <p className="text-[10px] text-slate-400">
        เชิญบอทกุ้ง (LINE OA) เข้ากลุ่มพนักงาน แล้ว copy Group ID จาก LINE Official Account Manager
      </p>
      <button
        type="button"
        disabled={saving}
        onClick={save}
        className="w-full py-3 rounded-xl bg-blue-600 text-white text-sm font-bold disabled:opacity-50"
      >
        {saving ? 'กำลังบันทึก...' : 'บันทึกการแจ้งเตือน'}
      </button>
    </div>
  );
}
