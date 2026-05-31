import React from 'react';
import { STOCK_LINE } from '../constants/stockLines';

/**
 * สลับสายงาน UI: กุ้งแม่น้ำเป็น (Live) / กุ้งแม่น้ำตาย (Dead)
 */
export default function StockLineSwitcher({ line, onChange, className = '' }) {
  return (
    <div className={`flex bg-slate-200 p-1.5 rounded-2xl gap-1 ${className}`}>
      {(['live', 'dead']).map((id) => {
        const info = STOCK_LINE[id];
        const active = line === id;
        return (
          <button
            key={id}
            type="button"
            onClick={() => onChange(id)}
            className={`flex-1 py-2.5 px-1 rounded-xl transition-all ${
              active
                ? `bg-white shadow-sm ${id === 'live' ? 'text-blue-600' : 'text-red-600'}`
                : 'text-slate-500'
            }`}
          >
            <span className="block font-bold text-[11px] leading-tight">{info.label}</span>
            <span className={`block text-[10px] font-bold mt-0.5 ${active ? 'opacity-90' : 'opacity-70'}`}>
              (
              {info.tag}
              )
            </span>
          </button>
        );
      })}
    </div>
  );
}
