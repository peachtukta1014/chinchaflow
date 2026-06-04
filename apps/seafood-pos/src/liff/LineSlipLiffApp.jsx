import React, { useMemo, useRef, useState } from 'react';
import liff from '@line/liff';
import { useLiffSlipSession } from './useLiffSlipSession';
import { submitLiffSlip } from './liffSlipApi';

function readBillNoFromUrl() {
  const q = new URLSearchParams(window.location.search);
  return (q.get('billNo') || q.get('bill') || '').trim();
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('อ่านรูปไม่สำเร็จ'));
    reader.readAsDataURL(file);
  });
}

export default function LineSlipLiffApp() {
  const session = useLiffSlipSession();
  const billNo = useMemo(() => readBillNoFromUrl(), []);
  const inputRef = useRef(null);
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  const ready = session.status === 'ready' || session.status === 'preview';

  const onPick = () => {
    if (!ready || busy || done) return;
    inputRef.current?.click();
  };

  const onFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('เลือกไฟล์รูปภาพเท่านั้นครับ');
      return;
    }
    if (file.size > 9 * 1024 * 1024) {
      setError('รูปใหญ่เกินไป (สูงสุด 9 MB)');
      return;
    }
    setError('');
    try {
      const dataUrl = await fileToDataUrl(file);
      setPreview(dataUrl);
    } catch (err) {
      setError(err?.message || 'อ่านรูปไม่สำเร็จ');
    }
  };

  const onSubmit = async () => {
    if (!preview || !ready || busy) return;
    setBusy(true);
    setError('');
    try {
      if (session.status === 'preview') {
        setDone(true);
        return;
      }
      const result = await submitLiffSlip({
        idToken: session.idToken,
        imageBase64: preview,
        billNo: billNo || undefined,
      });
      try {
        if (liff.isInClient() && result?.message) {
          await liff.sendMessages([{ type: 'text', text: result.message }]);
        }
      } catch {
        /* optional */
      }
      setDone(true);
      if (liff.isInClient()) {
        setTimeout(() => liff.closeWindow(), 1200);
      }
    } catch (err) {
      setError(err?.message || 'ส่งสลิปไม่สำเร็จ');
    } finally {
      setBusy(false);
    }
  };

  if (session.status === 'loading') {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center p-6">
        <p className="text-sm font-bold">กำลังเปิด…</p>
      </div>
    );
  }

  if (session.status === 'error') {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center p-6 text-center gap-3">
        <p className="text-lg font-black">ฝากสลิป</p>
        <p className="text-sm text-red-300">{session.error}</p>
      </div>
    );
  }

  if (done) {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center p-6 text-center gap-3">
        <p className="text-4xl">✅</p>
        <p className="text-lg font-black">รับสลิปแล้วครับ</p>
        <p className="text-sm text-slate-300">
          ร้านจะตรวจยอดแล้วยืนยันให้
          {billNo ? (
            <>
              <br />
              บิล
              {' '}
              {billNo}
            </>
          ) : null}
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 text-white p-5 pb-10 flex flex-col gap-4">
      <header className="text-center pt-2">
        <p className="text-orange-400 text-xs font-bold">โกอ้วน คลังซีฟู้ด</p>
        <h1 className="text-2xl font-black mt-1">ฝากสลิปยืนยันการโอน</h1>
        {session.displayName ? (
          <p className="text-slate-400 text-sm mt-1">
            สวัสดี
            {' '}
            {session.displayName}
          </p>
        ) : null}
        {billNo ? (
          <p className="text-amber-300 text-sm font-bold mt-2">
            บิล
            {' '}
            {billNo}
          </p>
        ) : (
          <p className="text-slate-400 text-xs mt-2">ร้านจะจับคู่บิลค้างให้อัตโนมัติ</p>
        )}
      </header>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={onFile}
      />

      <button
        type="button"
        onClick={onPick}
        disabled={busy}
        className="w-full py-5 rounded-2xl bg-orange-500 text-white font-black text-lg active:scale-[0.98] disabled:opacity-50"
      >
        เลือกรูปสลิป / ถ่ายรูป
      </button>

      {preview ? (
        <div className="bg-slate-800 rounded-2xl p-3">
          <img src={preview} alt="ตัวอย่างสลิป" className="w-full rounded-xl max-h-[45vh] object-contain mx-auto" />
        </div>
      ) : (
        <p className="text-center text-slate-500 text-sm">ยังไม่ได้เลือกรูป</p>
      )}

      {error ? (
        <p className="text-center text-red-300 text-sm font-bold">{error}</p>
      ) : null}

      <button
        type="button"
        onClick={onSubmit}
        disabled={!preview || busy}
        className="w-full py-4 rounded-2xl bg-emerald-600 text-white font-black text-lg disabled:opacity-40 active:scale-[0.98]"
      >
        {busy ? 'กำลังส่ง…' : 'ส่งสลิปให้ร้าน'}
      </button>

      <p className="text-center text-slate-500 text-[11px] leading-relaxed">
        หรือส่งรูปในแชต LINE โดยตรงก็ได้
        <br />
        ร้านตรวจยอดแล้วยืนยันให้
      </p>
    </div>
  );
}
