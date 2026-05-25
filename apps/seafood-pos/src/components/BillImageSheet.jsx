import React, { useEffect, useState } from 'react';
import { Download, Share2, X } from 'lucide-react';
import {
  downloadBillImageBlob,
  generateBillImage,
  revokeBillImageUrl,
} from '../lib/generateBillImage';
import { shareToLine } from '../lib/shareLine';

export default function BillImageSheet({ bill, customer, onClose }) {
  const [previewUrl, setPreviewUrl] = useState(null);
  const [blob, setBlob] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!bill) return undefined;
    let cancelled = false;
    setLoading(true);
    setError(null);
    generateBillImage(bill, customer || {})
      .then(({ blob: b, objectUrl }) => {
        if (cancelled) {
          revokeBillImageUrl(objectUrl);
          return;
        }
        setBlob(b);
        setPreviewUrl(objectUrl);
      })
      .catch((e) => {
        if (!cancelled) setError(e.message || 'สร้างภาพไม่สำเร็จ');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [bill, customer]);

  useEffect(() => () => revokeBillImageUrl(previewUrl), [previewUrl]);

  const handleShareLine = async () => {
    if (!blob) return;
    const res = await shareToLine({
      blob,
      title: `บิล ${bill?.billNo || ''}`,
      text: `บิล ${bill?.billNo || ''} · ${bill?.customerName || ''} · ฿${(bill?.total || 0).toLocaleString()}`,
    });
    if (!res.ok) {
      downloadBillImageBlob(blob, bill?.billNo);
      alert(res.message || 'บันทึกรูปแล้วส่งใน LINE เองนะครับ');
    }
  };

  if (!bill) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-black/70 flex items-end sm:items-center justify-center p-3">
      <div className="bg-white rounded-3xl w-full max-w-lg max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
          <div>
            <p className="font-black text-slate-800">ภาพบิล (ฟอร์มดิจิทัล)</p>
            <p className="text-xs text-slate-400">
              {bill.billNo} · ลูกค้า: <span className="font-bold text-slate-700">{bill.customerName}</span>
              {' · '}
              {(bill.items || []).length} รายการ
            </p>
          </div>
          <button type="button" onClick={onClose} className="p-2 rounded-xl bg-slate-100">
            <X size={20} />
          </button>
        </div>
        <div className="flex-1 overflow-auto bg-slate-50 p-3 min-h-[200px]">
          {loading && <p className="text-center text-slate-400 py-16 text-sm">กำลังสร้างภาพบิล…</p>}
          {error && <p className="text-center text-red-500 py-16 text-sm">{error}</p>}
          {previewUrl && !loading && (
            <img src={previewUrl} alt="บิล" className="w-full rounded-xl shadow-md" />
          )}
        </div>
        <div className="p-4 flex gap-2 border-t border-slate-100">
          <button
            type="button"
            disabled={!blob || loading}
            onClick={handleShareLine}
            className="flex-1 py-3 rounded-2xl bg-[#06C755] text-white font-bold flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <Share2 size={18} />
            แชร์ LINE
          </button>
          <button
            type="button"
            disabled={!blob || loading}
            onClick={() => blob && downloadBillImageBlob(blob, bill?.billNo)}
            className="flex-1 py-3 rounded-2xl bg-slate-800 text-white font-bold flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <Download size={18} />
            บันทึกรูป
          </button>
        </div>
      </div>
    </div>
  );
}
