import React from 'react';

/** สต๊อกปัจจุบันแบบ real-time — ไม่ผูกกับวันที่เลือกในประวัติ */
export default function LiveStockStickyBar({ live = 0, dead = 0 }) {
  return (
    <div className="px-4 py-2 bg-slate-800 border-b border-slate-700 shrink-0 z-20">
      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
        กุ้งคงเหลือในสต๊อก (ปัจจุบัน)
      </p>
      <div className="grid grid-cols-2 gap-2">
        <div className="bg-blue-600/90 rounded-xl px-3 py-2 flex justify-between items-center">
          <span className="text-[11px] font-bold text-blue-100">กุ้งเป็น</span>
          <span className="text-lg font-black text-white">{Number(live).toFixed(1)} กก.</span>
        </div>
        <div className="bg-orange-600/90 rounded-xl px-3 py-2 flex justify-between items-center">
          <span className="text-[11px] font-bold text-orange-100">กุ้งตาย</span>
          <span className="text-lg font-black text-white">{Number(dead).toFixed(1)} กก.</span>
        </div>
      </div>
    </div>
  );
}
