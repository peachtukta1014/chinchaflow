import React from 'react';

export default function NavButton({ icon, label, isActive, onClick, badge }) {
  return (
  <button onClick={onClick}
    className={`flex flex-col items-center justify-center w-full p-3 transition-all relative ${isActive ? 'text-blue-600 scale-110' : 'text-slate-400'}`}>
    <div className="relative">
      {React.cloneElement(icon, { size: 22, strokeWidth: isActive ? 2.5 : 2, className: 'mb-1' })}
      {badge > 0 && (
        <span className="absolute -top-1 -right-2 bg-red-500 text-white text-[9px] font-black w-4 h-4 rounded-full flex items-center justify-center">
          {badge > 9 ? '9+' : badge}
        </span>
      )}
    </div>
    <span className={`text-[10px] ${isActive ? 'font-bold' : 'font-medium'}`}>{label}</span>
  </button>
  );
}
