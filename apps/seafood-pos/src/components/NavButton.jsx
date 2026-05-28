import React from 'react';

export default function NavButton({ icon, label, isActive, onClick, badge, compactLabel }) {
  const labelCls = compactLabel
    ? 'text-[8px] leading-tight max-w-[4.75rem] text-center'
    : 'text-[10px]';

  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-col items-center justify-center w-full px-1 py-2.5 transition-all relative min-w-0 ${
        isActive ? 'text-blue-600 scale-105' : 'text-slate-400'
      }`}
    >
      <div className="relative flex items-center justify-center min-h-[26px]">
        {icon}
        {badge > 0 && (
          <span className="absolute -top-1 -right-2 bg-red-500 text-white text-[9px] font-black min-w-[16px] h-4 px-0.5 rounded-full flex items-center justify-center">
            {badge > 9 ? '9+' : badge}
          </span>
        )}
      </div>
      <span className={`${labelCls} mt-0.5 ${isActive ? 'font-bold' : 'font-medium'}`}>{label}</span>
    </button>
  );
}
