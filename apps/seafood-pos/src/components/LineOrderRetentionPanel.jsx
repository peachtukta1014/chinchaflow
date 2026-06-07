import React, { useState } from 'react';
import { LINE_ORDER_RETENTION_KEEP } from '../lib/lineOrderRetention';
import {
  previewLineOrderPrune,
  pruneOldLineOrders,
} from '../services/lineOrderRetentionService';

export default function LineOrderRetentionPanel() {
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState('');

  const loadPreview = async () => {
    setBusy(true);
    setFlash('');
    try {
      const result = await previewLineOrderPrune();
      setPreview(result);
    } catch (e) {
      console.error(e);
      setFlash('❌ โหลดข้อมูลไม่สำเร็จ');
    } finally {
      setBusy(false);
    }
  };

  const runPrune = async () => {
    if (!preview || preview.deleteCandidates.length === 0) return;
    const n = preview.deleteCandidates.length;
    const msg =
      `ลบออเดอร์ LINE เก่า ${n} รายการจากคลังข้อมูล?\n\n` +
      `· เก็บออเดอร์ปิดล่าสุด ${LINE_ORDER_RETENTION_KEEP} รายการ\n` +
      '· ไม่แตะออเดอร์รอส่ง / กำลังส่ง\n' +
      '· ยอดขายและบิลใน sales ไม่ถูกลบ\n\n' +
      'กู้คืนไม่ได้';
    if (!window.confirm(msg)) return;

    setBusy(true);
    setFlash('');
    try {
      const result = await pruneOldLineOrders({ dryRun: false });
      setPreview(result);
      if (result.errors > 0) {
        setFlash(`⚠️ ลบได้ ${result.deleted} รายการ · ล้มเหลว ${result.errors} รายการ`);
      } else {
        setFlash(`✅ ลบออเดอร์เก่า ${result.deleted} รายการแล้ว`);
      }
      setTimeout(() => setFlash(''), 5000);
    } catch (e) {
      console.error(e);
      setFlash('❌ ลบไม่สำเร็จ');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
      <div>
        <h3 className="text-sm font-black text-slate-800">ล้างออเดอร์ LINE เก่า</h3>
        <p className="text-[10px] text-slate-500 mt-1 leading-relaxed">
          เก็บออเดอร์ปิด (ส่งแล้ว/ยกเลิก) ล่าสุด
          {' '}
          {LINE_ORDER_RETENTION_KEEP}
          {' '}
          รายการ · ลบที่เก่ากว่าออกจากคลังข้อมูล
          · ออเดอร์รอส่งไม่ถูกแตะ · บิลใน sales ยังอยู่
        </p>
      </div>

      {flash && (
        <p className="text-xs font-bold text-emerald-600 bg-emerald-50 px-3 py-2 rounded-xl">{flash}</p>
      )}

      {preview && (
        <div className="text-[10px] text-slate-600 bg-slate-50 px-3 py-2 rounded-xl space-y-1">
          <p>
            ทั้งหมด
            {' '}
            {preview.total}
            {' '}
            รายการ · รอส่ง/กำลังส่ง
            {' '}
            {preview.activeCount}
            {' '}
            · ปิดแล้ว
            {' '}
            {preview.closedCount}
          </p>
          <p>
            จะลบ
            {' '}
            <span className="font-bold text-red-600">{preview.deleteCandidates.length}</span>
            {' '}
            รายการ
            {preview.skippedUnsafe.length > 0 && (
              <>
                {' '}
                · ข้าม (done ไม่มีบิล)
                {' '}
                {preview.skippedUnsafe.length}
              </>
            )}
          </p>
        </div>
      )}

      <div className="flex gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={loadPreview}
          className="flex-1 py-2.5 rounded-xl text-xs font-bold border border-slate-200 bg-slate-50 text-slate-700 disabled:opacity-50"
        >
          {busy && !preview ? 'กำลังเช็ก...' : 'เช็กจำนวนที่จะลบ'}
        </button>
        <button
          type="button"
          disabled={busy || !preview || preview.deleteCandidates.length === 0}
          onClick={runPrune}
          className="flex-1 py-2.5 rounded-xl text-xs font-bold bg-red-600 text-white disabled:opacity-50"
        >
          {busy && preview ? 'กำลังลบ...' : 'ลบออเดอร์เก่า'}
        </button>
      </div>
    </div>
  );
}
