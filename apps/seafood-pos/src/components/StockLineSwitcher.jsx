import React from 'react';

/**
 * สลับสายงาน UI: กุ้งเป็น (live) / กุ้งตาย (dead) — ไม่เปลี่ยนโมเดลสต๊อกหลังบ้าน
 */
export default function StockLineSwitcher({ line, onChange, className = '' }) {
  return (
    <div className={`flex bg-slate-200 p-1.5 rounded-2xl gap-1 ${className}`}>
      <button
        type="button"
        onClick={() => onChange('live')}
        className={`flex-1 py-3 font-bold text-xs rounded-xl transition-all ${
          line === 'live' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500'
        }`}
      >
        สายกุ้งเป็น
      </button>
      <button
        type="button"
        onClick={() => onChange('dead')}
        className={`flex-1 py-3 font-bold text-xs rounded-xl transition-all ${
          line === 'dead' ? 'bg-white text-red-600 shadow-sm' : 'text-slate-500'
        }`}
      >
        สายกุ้งตาย
      </button>
    </div>
  );
}
