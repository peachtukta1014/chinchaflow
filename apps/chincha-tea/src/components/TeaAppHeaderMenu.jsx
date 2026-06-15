import { useEffect, useRef, useState } from 'react';
import { TAB_ICONS } from '../lib/navConfig';

function MenuIcon({ name }) {
  const paths = TAB_ICONS[name]?.d;
  if (!paths) return null;
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={paths} />
    </svg>
  );
}

/**
 * เมนูแอดมินใน header — เปิด overlay แทนแท็บล่าง
 */
export default function TeaAppHeaderMenu({ items, activeTab, onNavigate, t }) {
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

  if (!items.length) return null;

  const pick = (id) => {
    onNavigate(id);
    setOpen(false);
  };

  const menuActive = open || items.some((item) => item.id === activeTab);

  return (
    <div className="relative" ref={panelRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        title={t('navGroupAdmin')}
        aria-label={t('navGroupAdmin')}
        aria-expanded={open}
        className={`w-8 h-8 rounded-full border flex items-center justify-center ${
          menuActive ? 'border-amber-300 text-amber-900 bg-amber-300' : 'border-amber-800 text-amber-300'
        }`}
        style={menuActive ? {} : { background: '#5a2d14' }}
      >
        {open ? (
          <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
            <path strokeLinecap="round" d="M6 6l12 12M18 6L6 18" />
          </svg>
        ) : (
          <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        )}
      </button>

      {open && (
        <div
          className="absolute right-0 top-10 w-56 rounded-2xl border border-amber-900/30 bg-[#fffaf5] shadow-xl py-2 z-[100]"
          role="menu"
        >
          <p className="px-4 py-1.5 text-[10px] font-black text-amber-900/50 uppercase tracking-wider">
            {t('navGroupAdmin')}
          </p>
          {items.map(({ id, label, icon, badge }) => (
            <button
              key={id}
              type="button"
              role="menuitem"
              onClick={() => pick(id)}
              className={`w-full px-4 py-2.5 flex items-center gap-3 text-left text-sm font-bold transition-colors ${
                activeTab === id ? 'bg-amber-100 text-amber-900' : 'text-stone-700 hover:bg-stone-50'
              }`}
            >
              <MenuIcon name={icon} />
              <span className="flex-1">{label}</span>
              {badge > 0 && (
                <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[9px] font-black flex items-center justify-center">
                  {badge > 9 ? '9+' : badge}
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
