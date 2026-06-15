import { TAB_ICONS } from '../lib/navConfig';

function TabIcon({ name }) {
  const paths = TAB_ICONS[name]?.d;
  if (!paths) return null;
  return (
    <svg
      width="16"
      height="16"
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

function TabButton({ id, label, icon, active, badge, onSelect }) {
  return (
    <button
      type="button"
      onClick={() => onSelect(id)}
      className={`relative flex flex-col items-center justify-center gap-0.5 rounded-xl font-bold transition-all py-2 px-1 min-h-[44px] ${
        active ? 'text-white shadow-md' : 'text-stone-600 bg-white/90 border border-stone-200/90'
      }`}
      style={active ? { background: 'linear-gradient(145deg, #3d1f0f 0%, #5a2d14 100%)' } : {}}
    >
      <TabIcon name={icon} />
      <span className="leading-tight text-center text-[10px] whitespace-nowrap">{label}</span>
      {badge > 0 && (
        <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-[16px] px-0.5 rounded-full bg-red-500 text-white text-[8px] font-black flex items-center justify-center ring-2 ring-[#fdf6f0]">
          {badge > 9 ? '9+' : badge}
        </span>
      )}
    </button>
  );
}

/**
 * แท็บหลัก 4 แท็บ — อยู่ด้านบนใต้แถบยอดขาย (แบบแอปกุ้ง)
 * @param {{ groups: ReturnType<import('../lib/navConfig').getAppNavGroups>, activeTab: string, onSelect: (id: string) => void, badges?: Record<string, number> }} props
 */
export default function TabNav({ groups, activeTab, onSelect, badges = {} }) {
  const primaryGroup = groups.find((g) => g.layout === 'primary');
  if (!primaryGroup) return null;

  return (
    <nav
      className="z-10 shrink-0 px-3 py-2 border-b border-amber-900/10"
      style={{ background: '#fdf6f0' }}
      aria-label={primaryGroup.label}
    >
      <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${primaryGroup.tabs.length}, minmax(0, 1fr))` }}>
        {primaryGroup.tabs.map((tab) => (
          <TabButton
            key={tab.id}
            {...tab}
            active={activeTab === tab.id}
            badge={badges[tab.id]}
            onSelect={onSelect}
          />
        ))}
      </div>
    </nav>
  );
}

/** แถบย่อยในแท็บ — สไตล์ lip แบบแอปกุ้ง */
export function SegmentedTabBar({ tabs, activeId, onSelect }) {
  return (
    <div className="rounded-2xl border border-amber-900/10 bg-stone-100/80 p-1 flex gap-1 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
      {tabs.map(([id, label]) => (
        <button
          key={id}
          type="button"
          onClick={() => onSelect(id)}
          className={`shrink-0 flex-1 min-w-[72px] px-2 py-2 rounded-xl font-bold text-[10px] text-center transition-all ${
            activeId === id ? 'text-white shadow-sm' : 'text-stone-500'
          }`}
          style={activeId === id ? { background: 'linear-gradient(145deg, #3d1f0f 0%, #5a2d14 100%)' } : {}}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
