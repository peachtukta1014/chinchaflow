import React, { useState } from 'react';
import { Share2 } from 'lucide-react';
import { generateBillImage } from '../lib/generateBillImage';
import { shareToLine } from '../lib/shareLine';
import { downloadBillImageBlob } from '../lib/generateBillImage';

/** ปุ่มแชร์ LINE จากข้อมูลบิล — ใช้ท้ายรายการหรือในรายการ */
export default function LineShareButton({
  bill,
  customer,
  label = 'แชร์ LINE',
  className = '',
  variant = 'line',
}) {
  const [busy, setBusy] = useState(false);

  const handleClick = async () => {
    if (!bill?.items?.length && !bill?.total) {
      alert('ยังไม่มีรายการในบิล');
      return;
    }
    setBusy(true);
    try {
      const { blob, objectUrl } = await generateBillImage(bill, customer || {});
      const res = await shareToLine({
        blob,
        title: bill.billNo,
        text: `บิล ${bill.billNo || ''} · ${bill.customerName || ''} · ฿${(bill.total || 0).toLocaleString()}`,
      });
      URL.revokeObjectURL(objectUrl);
      if (!res.ok) {
        downloadBillImageBlob(blob, bill.billNo);
        alert(res.message || 'บันทึกรูปแล้วส่งใน LINE เองนะครับ');
      }
    } catch (e) {
      console.error(e);
      alert(e.message || 'สร้างภาพบิลไม่สำเร็จ');
    } finally {
      setBusy(false);
    }
  };

  const base =
    variant === 'line'
      ? 'bg-[#06C755] text-white'
      : 'bg-slate-100 text-slate-700 border border-slate-200';

  return (
    <button
      type="button"
      disabled={busy}
      onClick={handleClick}
      className={`font-bold text-sm py-2.5 px-4 rounded-2xl flex items-center justify-center gap-2 disabled:opacity-50 active:scale-95 ${base} ${className}`}
    >
      <Share2 size={16} />
      {busy ? 'กำลังสร้างภาพ…' : label}
    </button>
  );
}
