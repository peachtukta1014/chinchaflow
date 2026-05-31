import React from 'react';
import { STOCK_LINE } from '../constants/stockLines';

/** สต๊อกปัจจุบันแบบ real-time — ไม่ผูกกับวันที่เลือกในประวัติ */
export default function LiveStockStickyBar({ live = 0, dead = 0, loadError = false }) {
  return (
    <div className="px-4 py-2 bg-slate-800 border-b border-slate-700 shrink-0 z-10">
      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
        กุ้งคงเหลือในสต๊อก (ปัจจุบัน)
        {loadError && (
          <span className="ml-2 text-yellow-400 normal-case">⚠ โหลดไม่ได้ — ยอดอาจไม่ตรง</span>
        )}
      </p>
      <div className="grid grid-cols-2 gap-2">
        <div className={`${loadError ? 'bg-blue-600/40' : 'bg-blue-600/90'} rounded-xl px-3 py-2 flex justify-between items-center`}>
          <span className="text-[11px] font-bold text-blue-100 leading-tight">
            {STOCK_LINE.live.label}
            <span className="font-medium opacity-90"> ({STOCK_LINE.live.tag})</span>
          </span>
          <span className="text-lg font-black text-white">{Number(live).toFixed(1)} กก.</span>
        </div>
        <div className={`${loadError ? 'bg-orange-600/40' : 'bg-orange-600/90'} rounded-xl px-3 py-2 flex justify-between items-center`}>
          <span className="text-[11px] font-bold text-orange-100 leading-tight">
            {STOCK_LINE.dead.label}
            <span className="font-medium opacity-90"> ({STOCK_LINE.dead.tag})</span>
          </span>
          <span className="text-lg font-black text-white">{Number(dead).toFixed(1)} กก.</span>
        </div>
      </div>
    </div>
  );
}
