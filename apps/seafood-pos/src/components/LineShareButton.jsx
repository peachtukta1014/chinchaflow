import React, { useEffect, useState } from 'react';
import { Send, Share2 } from 'lucide-react';
import { generateBillImage } from '../lib/generateBillImage';
import { shareToLine } from '../lib/shareLine';
import { downloadBillImageBlob } from '../lib/generateBillImage';
import { pushBillToLineCustomer } from '../lib/linePushBill';
import { resolveLineUserId } from '../lib/resolveLineUserId';
import { isValidLineUserId } from '../lib/lineUserId';

/** ปุ่มแชร์/ส่งบิล LINE — ส่งอัตโนมัติถ้ามี LINE UID */
export default function LineShareButton({
  bill,
  customer,
  label = 'แชร์ LINE',
  className = '',
  variant = 'line',
}) {
  const [busy, setBusy] = useState(false);
  const [lineUserId, setLineUserId] = useState('');

  useEffect(() => {
    let cancelled = false;
    resolveLineUserId(customer, bill).then((id) => {
      if (!cancelled) setLineUserId(id || '');
    });
    return () => { cancelled = true; };
  }, [customer, bill]);

  const canAutoPush = isValidLineUserId(lineUserId);

  const handleClick = async () => {
    if (!bill?.items?.length && !bill?.total) {
      alert('ยังไม่มีรายการในบิล');
      return;
    }
    setBusy(true);
    try {
      const { blob, objectUrl } = await generateBillImage(bill, customer || {});

      if (canAutoPush) {
        await pushBillToLineCustomer({
          lineUserId,
          blob,
          billNo: bill.billNo,
          customerName: bill.customerName || customer?.name,
          paymentType: bill.paymentType,
        });
        URL.revokeObjectURL(objectUrl);
        alert('✅ ส่งใบส่งของให้ลูกค้าใน LINE แล้ว');
        return;
      }

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

  const displayLabel = busy
    ? 'กำลังส่ง…'
    : canAutoPush
      ? 'ส่งให้ลูกค้า'
      : label;

  return (
    <button
      type="button"
      disabled={busy}
      onClick={handleClick}
      className={`font-bold text-sm py-2.5 px-4 rounded-2xl flex items-center justify-center gap-2 disabled:opacity-50 active:scale-95 ${base} ${className}`}
    >
      {canAutoPush ? <Send size={16} /> : <Share2 size={16} />}
      {displayLabel}
    </button>
  );
}
