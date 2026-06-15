import { TAB_ICONS } from '../lib/navConfig';

function ShortcutIcon({ name }) {
  const paths = TAB_ICONS[name]?.d;
  if (!paths) return null;
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="shrink-0"
      aria-hidden
    >
      <path d={paths} />
    </svg>
  );
}

/**
 * ปุ่มลัดแอดมินแบบแอปกุ้ง — แสดงเฉพาะเมื่ออยู่แท็บงานหลัก
 * @param {{ shortcuts: ReturnType<import('../lib/navConfig').getAdminShortcutTabs>, activeTab: string, onSelect: (id: string) => void, badges?: Record<string, number>, t: (key: string) => string }} props
 */
export default function AdminShortcutBar({ shortcuts, activeTab, onSelect, badges = {}, t }) {
  if (!shortcuts.length) return null;

  return (
    <nav
      className="z-10 shrink-0 px-3 pt-1.5 pb-2 border-b border-amber-900/10"
      style={{ background: '#fdf6f0' }}
      aria-label={t('navGroupAdmin')}
    >
      <p className="text-[8px] font-black uppercase tracking-wider text-amber-900/50 px-1 mb-1">
        {t('navGroupAdmin')}
      </p>
      <div className="flex gap-1.5 overflow-x-auto pb-0.5" style={{ scrollbarWidth: 'none' }}>
        {shortcuts.map((tab) => {
          const active = activeTab === tab.id;
          const badge = badges[tab.id] || 0;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onSelect(tab.id)}
              className={`relative shrink-0 flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl font-bold text-[10px] transition-all ${
                active ? 'text-white shadow-sm' : 'text-stone-600 bg-white/80 border border-stone-200/90'
              }`}
              style={active ? { background: 'linear-gradient(145deg, #3d1f0f 0%, #5a2d14 100%)' } : {}}
            >
              <ShortcutIcon name={tab.icon} />
              <span className="whitespace-nowrap">{tab.label}</span>
              {badge > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-[15px] h-[15px] px-0.5 rounded-full bg-red-500 text-white text-[8px] font-black flex items-center justify-center ring-2 ring-[#fdf6f0]">
                  {badge > 9 ? '9+' : badge}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
