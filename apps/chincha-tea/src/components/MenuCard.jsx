import { useState } from 'react';

export function MenuCard({ item, cat, t, onAdd }) {
  const [ripples, setRipples] = useState([]);
  const handleClick = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const id = Date.now();
    setRipples((prev) => [...prev, { id, x: e.clientX - rect.left, y: e.clientY - rect.top }]);
    setTimeout(() => setRipples((prev) => prev.filter((r) => r.id !== id)), 500);
    onAdd();
  };
  const name = item.nameDisplay || item.nameTh || t(item.key) || item.nameEn;
  const sub = item.nameSub || item.nameEn;
  return (
    <button
      type="button"
      onClick={handleClick}
      className="relative overflow-hidden text-left bg-white rounded-2xl border border-stone-100 p-3.5 shadow-sm active:scale-95 transition-transform"
    >
      {ripples.map((r) => (
        <span
          key={r.id}
          className="ripple-span absolute rounded-full pointer-events-none"
          style={{ left: r.x - 40, top: r.y - 40, width: 80, height: 80, background: `${cat.accent}33` }}
        />
      ))}
      {item.star && <span className="absolute top-2.5 right-2.5 text-amber-400 text-xs leading-none">★</span>}
      <span
        className="inline-block text-[10px] font-bold px-2 py-0.5 rounded-full mb-2 leading-tight"
        style={{ background: cat.accentBg, color: cat.accent }}
      >
        {item.tag || cat.label}
      </span>
      <p className="font-black text-stone-800 text-sm leading-tight">{name}</p>
      {sub && <p className="text-[10px] text-stone-400 mb-2 leading-tight">{sub}</p>}
      <div className="flex items-center justify-between mt-1">
        <span className="font-black text-sm" style={{ color: '#3d1f0f' }}>฿{item.basePrice}</span>
        <div
          className="w-7 h-7 rounded-full flex items-center justify-center text-white font-black text-base shrink-0"
          style={{ background: cat.accent }}
        >
          +
        </div>
      </div>
    </button>
  );
}
