import { useState } from 'react';

const GUIDE_OPEN_KEY = 'chincha-staff-guide-open';

/** คำอธิบายแท็บเป็นภาษาพม่า — สำหรับพนักงานที่อ่านไทยไม่ถนัด */
export default function StaffGuidePanel({ t, lang }) {
  const [open, setOpen] = useState(() => {
    try {
      const stored = localStorage.getItem(GUIDE_OPEN_KEY);
      return stored === null ? true : stored !== 'false';
    } catch {
      return true;
    }
  });

  if (lang !== 'my') return null;

  const rows = [
    { icon: '🛒', text: t('staffGuideOrder') },
    { icon: '📋', text: t('staffGuideHistory') },
    { icon: '📊', text: t('staffGuideSummary') },
    { icon: '💸', text: t('staffGuideExpenses') },
    { icon: '📦', text: t('staffGuideRestock') },
    { icon: '☕', text: t('staffGuideCatalog') },
  ];

  const toggle = () => {
    setOpen((v) => {
      const next = !v;
      try { localStorage.setItem(GUIDE_OPEN_KEY, String(next)); } catch { /* ignore */ }
      return next;
    });
  };

  return (
    <div className="z-10 shrink-0 mx-4 mt-1 rounded-2xl border-2 border-amber-300 bg-gradient-to-b from-amber-50 to-white overflow-hidden shadow-sm">
      <button
        type="button"
        onClick={toggle}
        className="w-full px-3 py-2.5 flex items-center justify-between text-left"
      >
        <span className="text-[11px] font-black text-amber-950 leading-snug">
          🇲🇲 {t('staffGuideTitle')}
        </span>
        <span className="text-amber-800 text-xs font-bold">{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <ul className="px-3 pb-3 space-y-2 border-t border-amber-200/80">
          {rows.map((r) => (
            <li key={r.icon} className="flex gap-2 text-[11px] text-amber-950 leading-relaxed">
              <span className="shrink-0">{r.icon}</span>
              <span>{r.text}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
