import React from 'react';

/** แถบแท็บย่อย — items: { id, label, activeClass? } */
export default function SubTabBar({ tab, onChange, items }) {
  return (
    <div className="flex flex-wrap bg-slate-100 p-1 rounded-xl gap-1">
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={() => onChange(item.id)}
          className={`flex-1 min-w-[4rem] py-2.5 font-bold text-[11px] rounded-lg ${
            tab === item.id
              ? item.activeClass || 'bg-white text-slate-800 shadow-sm'
              : 'text-slate-500'
          }`}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}
