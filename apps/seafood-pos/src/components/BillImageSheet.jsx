import React, { useEffect, useState } from 'react';
import { Download, Send, Share2, X } from 'lucide-react';
import {
  downloadBillImageBlob,
  generateBillImage,
  revokeBillImageUrl,
} from '../lib/generateBillImage';
import { buildBillDataForCloud, fetchShrimpBillImage } from '../lib/shrimpBillApi';
import { shareToLine } from '../lib/shareLine';
import { pushBillToLineCustomer } from '../lib/linePushBill';
import { resolveLineUserIdDetails } from '../lib/resolveLineUserId';
import { isValidLineUserId } from '../lib/lineUserId';

export default function BillImageSheet({ bill, customer, staffName, onClose }) {
  const [previewUrl, setPreviewUrl] = useState(null);
  const [blob, setBlob] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lineUserId, setLineUserId] = useState('');
  const [lineUidMeta, setLineUidMeta] = useState({
    billUid: '',
    profileName: '',
    profileLinked: false,
    uidMismatch: false,
  });
  const [lineUidLoading, setLineUidLoading] = useState(true);
  const [pushBusy, setPushBusy] = useState(false);

  useEffect(() => {
    if (!bill) return undefined;
    let cancelled = false;
    setLoading(true);
    setError(null);
    const billForImage = {
      ...bill,
      recordedBy: bill?.recordedBy || staffName || '',
    };
    const load = async () => {
      try {
        const { blob: b, objectUrl } = await fetchShrimpBillImage(billForImage, customer || {});
        if (cancelled) {
          revokeBillImageUrl(objectUrl);
          return;
        }
        setBlob(b);
        setPreviewUrl(objectUrl);
      } catch (cloudErr) {
        console.warn('fetchShrimpBillImage fallback', cloudErr);
        const { blob: b, objectUrl } = await generateBillImage(billForImage, customer || {});
        if (cancelled) {
          revokeBillImageUrl(objectUrl);
          return;
        }
        setBlob(b);
        setPreviewUrl(objectUrl);
      }
    };
    load()
      .catch((e) => {
        if (!cancelled) setError(e.message || 'สร้างภาพไม่สำเร็จ');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [bill, customer, staffName]);

  const lookupLineUid = React.useCallback(async () => {
    setLineUidLoading(true);
    try {
      const details = await resolveLineUserIdDetails(customer, bill);
      setLineUserId(details.uid || '');
      const billUid = details.billUid || '';
      const profileUid = details.profileUid || details.uid || '';
      setLineUidMeta({
        billUid,
        profileName: details.profileName || '',
        profileLinked: isValidLineUserId(details.profileUid || details.uid),
        uidMismatch: Boolean(
          isValidLineUserId(billUid)
          && isValidLineUserId(profileUid)
          && billUid !== profileUid,
        ),
      });
    } finally {
      setLineUidLoading(false);
    }
  }, [customer, bill]);

  useEffect(() => {
    if (!bill) return undefined;
    lookupLineUid();
  }, [bill, lookupLineUid]);

  useEffect(() => () => revokeBillImageUrl(previewUrl), [previewUrl]);

  const handleShareLine = async () => {
    if (!blob) return;
    try {
      const res = await shareToLine({
        blob,
        title: `บิล ${bill?.billNo || ''}`,
        text: `บิล ${bill?.billNo || ''} · ${bill?.customerName || ''} · ฿${(bill?.total || 0).toLocaleString()}`,
      });
      if (!res.ok) {
        downloadBillImageBlob(blob, bill?.billNo);
        alert(res.message || 'บันทึกรูปแล้วเปิด LINE แนบรูปส่งเองนะครับ');
      }
    } catch {
      downloadBillImageBlob(blob, bill?.billNo);
      alert('บันทึกรูปลงเครื่องแล้ว — เปิดแชท LINE ลูกค้าแล้วแนบรูปส่งเองครับ');
    }
  };

  const handlePushToCustomer = async () => {
    if (!blob || !isValidLineUserId(lineUserId)) return;
    const nameOnBill = bill?.customerName || customer?.name || 'ลูกค้า';
    const ok = window.confirm(
      `ส่งใบส่งของชื่อ "${nameOnBill}" ไป LINE ลูกค้านี้?\n\n` +
        `ตรวจชื่อบนบิลให้ตรงกับคนที่ทัก LINE ก่อนกด OK\n` +
        `(UID …${lineUserId.slice(-6)})`,
    );
    if (!ok) return;
    setPushBusy(true);
    try {
      await pushBillToLineCustomer({
        lineUserId,
        billData: buildBillDataForCloud(
          { ...bill, recordedBy: bill?.recordedBy || staffName || '' },
          customer || {},
        ),
        billNo: bill?.billNo,
        customerName: bill?.customerName || customer?.name,
        paymentType: bill?.paymentType,
        remainingAmount: bill?.remainingAmount,
        total: bill?.total,
      });
      alert('✅ ส่งใบส่งของให้ลูกค้าใน LINE แล้ว');
    } catch (e) {
      alert(e.message || 'ส่งไม่สำเร็จ');
    } finally {
      setPushBusy(false);
    }
  };

  const canPush = isValidLineUserId(lineUserId);

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
            {lineUidLoading ? (
              <p className="text-[10px] text-slate-400 mt-0.5">กำลังตรวจ LINE UID…</p>
            ) : canPush ? (
              <>
                <p className="text-[10px] text-green-600 font-bold mt-0.5">
                  พร้อมส่งให้ลูกค้าใน LINE (UID …{lineUserId.slice(-6)})
                  {lineUidMeta.profileName
                    ? ` · รายชื่อ: ${lineUidMeta.profileName}`
                    : ''}
                </p>
                {lineUidMeta.uidMismatch && (
                  <p className="text-[10px] text-amber-700 mt-0.5 leading-relaxed">
                    ใช้ UID จากรายชื่อลูกค้าที่บันทึกแล้ว (…{lineUserId.slice(-6)})
                    {' '}
                    — ไม่ใช่ UID ในบิลเก่า (…{lineUidMeta.billUid.slice(-6)})
                  </p>
                )}
              </>
            ) : (
              <p className="text-[10px] text-amber-600 mt-0.5 leading-relaxed">
                {lineUidMeta.profileName && !lineUidMeta.profileLinked
                  ? `รายชื่อ「${lineUidMeta.profileName}」ยังไม่มี LINE UID — แก้ไขในแท็บสมาชิก → วาง UID → บันทึก (ระบบไม่ใช้ UID ในบิลเก่าเมื่อลบออกจากรายชื่อแล้ว)`
                  : 'ยังไม่มี LINE UID — แท็บลูกค้า → วาง UID ในรายชื่อ → บันทึก แล้วกดค้นหาด้านล่าง'}
              </p>
            )}
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
        <div className="p-4 flex flex-col gap-2 border-t border-slate-100">
          {!canPush && !lineUidLoading && (
            <button
              type="button"
              onClick={lookupLineUid}
              className="w-full py-2.5 rounded-xl border border-[#06C755] text-[#047857] text-xs font-bold"
            >
              ค้นหา LINE UID อีกครั้ง
            </button>
          )}
          {canPush && (
            <button
              type="button"
              disabled={!blob || loading || pushBusy}
              onClick={handlePushToCustomer}
              className="w-full py-3.5 rounded-2xl bg-[#06C755] text-white font-black flex items-center justify-center gap-2 disabled:opacity-50 shadow-md"
            >
              <Send size={18} />
              {pushBusy ? 'กำลังส่งให้ลูกค้า…' : 'ส่งให้ลูกค้า (LINE อัตโนมัติ)'}
            </button>
          )}
          <div className="flex gap-2">
            <button
              type="button"
              disabled={!blob || loading}
              onClick={handleShareLine}
              className="flex-1 py-3 rounded-2xl bg-slate-700 text-white font-bold flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <Share2 size={18} />
              แชร์เอง
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
    </div>
  );
}
