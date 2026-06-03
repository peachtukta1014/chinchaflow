import React from 'react';

/** ช่อง UID โอน/รับบิล + UID คนสั่งใน LINE (หลายคนได้) */
export default function LineUidFields({
  lineUserId,
  lineOrderUserIds,
  onLineUserId,
  onLineOrderUserIds,
  onSuggest,
  suggestBusy,
  suggestLabel = 'ดึง LINE ID จากออเดอร์ล่าสุด',
  nameFilled = true,
}) {
  return (
    <div className="space-y-2 rounded-xl border border-green-100 bg-green-50/40 p-3">
      <p className="text-[10px] font-bold text-green-800">LINE — ร้านนี้</p>
      <label className="text-[10px] font-bold text-slate-600 block">
        เจ้าของ / โอนจ่าย (รับบิล · สลิป)
        <input
          value={lineUserId}
          onChange={(e) => onLineUserId(e.target.value)}
          placeholder="LINE User ID (U...)"
          className="mt-1 w-full bg-white border border-green-200 rounded-xl px-3 py-2.5 text-sm font-mono outline-none"
        />
      </label>
      <label className="text-[10px] font-bold text-slate-600 block">
        คนสั่งใน LINE (ไม่รับบิล — คั่นด้วย comma)
        <textarea
          value={lineOrderUserIds}
          onChange={(e) => onLineOrderUserIds(e.target.value)}
          placeholder="Uxxxxxxxx... , Uxxxxxxxx..."
          rows={2}
          className="mt-1 w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-mono outline-none resize-y"
        />
      </label>
      <p className="text-[10px] text-slate-500 leading-snug">
        คนสั่งในร้านเดิมจะถูกเพิ่มอัตโนมัติเมื่อสั่งผ่าน LINE (ถ้ามีเจ้าของ/โอนแล้ว)
      </p>
      {onSuggest && (
        <button
          type="button"
          disabled={suggestBusy || !nameFilled}
          onClick={onSuggest}
          className="w-full text-xs font-bold text-green-700 border border-green-300 py-2.5 rounded-xl disabled:opacity-40 bg-white"
        >
          {suggestBusy ? 'กำลังค้นหา...' : suggestLabel}
        </button>
      )}
    </div>
  );
}
