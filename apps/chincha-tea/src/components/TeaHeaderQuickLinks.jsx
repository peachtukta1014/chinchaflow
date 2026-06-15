import { TAB_ICONS } from '../lib/navConfig';

function LinkIcon({ name }) {
  const paths = TAB_ICONS[name]?.d;
  if (!paths) return null;
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="shrink-0" aria-hidden>
      <path d={paths} />
    </svg>
  );
}

/**
 * ทางลัดแอดมิน/เมเนเจอร์ — แถบลิปใต้แท็บหลัก (แบบแอปกุ้ง)
 */
export default function TeaHeaderQuickLinks({ links, activeTab, onNavigate }) {
  if (!links.length) return null;

  return (
    <div className="bg-stone-100/90 border-b border-stone-200 px-3 py-2 flex gap-1.5 overflow-x-auto shrink-0 z-10" style={{ scrollbarWidth: 'none' }}>
      {links.map(({ id, label, icon, badge }) => (
        <button
          key={id}
          type="button"
          onClick={() => onNavigate(id)}
          className={`relative shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-bold active:scale-[0.98] ${
            activeTab === id
              ? 'bg-[#3d1f0f] border-[#3d1f0f] text-white shadow-sm'
              : 'bg-white border-stone-200 text-stone-700'
          }`}
        >
          <LinkIcon name={icon} />
          {label}
          {badge > 0 && (
            <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[9px] font-black flex items-center justify-center">
              {badge > 9 ? '9+' : badge}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
