import React, { useEffect, useRef, useState } from 'react';
import { Menu, Package, Settings, Users, BarChart3, X } from 'lucide-react';

/**
 * เมนูรองใน header — รับสต๊อก (ทุกคน) + แอดมิน
 */
export default function AppHeaderMenu({ isAdmin, activeTab, onNavigate }) {
  const [open, setOpen] = useState(false);
  const panelRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const items = [
    { id: 'stock', label: 'รับสต๊อก / คลัง', icon: Package, adminOnly: false },
    ...(isAdmin
      ? [
          { id: 'lot-close', label: 'สรุป / ชั่งปิดล็อต', icon: BarChart3, adminOnly: true },
          { id: 'admin-products', label: 'ตั้งค่าราคากุ้ง', icon: Settings, adminOnly: true },
          { id: 'admin-users', label: 'สมาชิกระบบ', icon: Users, adminOnly: true },
        ]
      : []),
  ];

  const pick = (id) => {
    onNavigate(id);
    setOpen(false);
  };

  return (
    <div className="relative" ref={panelRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        title="เมนูเพิ่มเติม"
        aria-label="เมนูเพิ่มเติม"
        aria-expanded={open}
        className={`w-10 h-10 rounded-full border-2 flex items-center justify-center active:scale-95 ${
          open || items.some((i) => i.id === activeTab)
            ? 'bg-blue-600 border-blue-500 text-white'
            : 'bg-slate-800 border-slate-700 text-slate-300'
        }`}
      >
        {open ? <X size={18} /> : <Menu size={18} />}
      </button>

      {open && (
        <div
          className="absolute right-0 top-12 w-56 rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl py-2 z-50"
          role="menu"
        >
          <p className="px-4 py-1.5 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
            เมนูเพิ่มเติม
          </p>
          {items.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              role="menuitem"
              onClick={() => pick(id)}
              className={`w-full px-4 py-3 flex items-center gap-3 text-left text-sm font-bold transition-colors ${
                activeTab === id ? 'bg-blue-600/20 text-cyan-300' : 'text-slate-200 hover:bg-slate-800'
              }`}
            >
              <Icon size={18} className="shrink-0 opacity-80" />
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
