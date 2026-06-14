import { TAB_ICONS } from '../lib/navConfig';

function TabIcon({ name }) {
  const paths = TAB_ICONS[name]?.d;
  if (!paths) return null;
  return (
    <svg
      width="18"
      height="18"
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

function TabButton({ id, label, icon, active, badge, onSelect, size = 'compact' }) {
  const isPrimary = size === 'primary';
  return (
    <button
      type="button"
      onClick={() => onSelect(id)}
      className={`relative flex flex-col items-center justify-center gap-0.5 rounded-xl font-bold transition-all ${
        isPrimary ? 'py-2 px-2 min-h-[44px]' : 'py-1.5 px-2 min-w-[52px] min-h-[38px]'
      } ${active ? 'text-white shadow-md' : 'text-stone-600 bg-white/80 border border-stone-200/90'}`}
      style={active ? { background: 'linear-gradient(145deg, #3d1f0f 0%, #5a2d14 100%)' } : {}}
    >
      <TabIcon name={icon} />
      <span className={`leading-tight text-center ${isPrimary ? 'text-[11px]' : 'text-[10px]'} whitespace-nowrap`}>
        {label}
      </span>
      {badge > 0 && (
        <span className="absolute -top-0.5 -right-0.5 min-w-[17px] h-[17px] px-0.5 rounded-full bg-red-500 text-white text-[9px] font-black flex items-center justify-center ring-2 ring-[#fdf6f0]">
          {badge > 9 ? '9+' : badge}
        </span>
      )}
    </button>
  );
}

/**
 * @param {{ groups: ReturnType<import('../lib/navConfig').getAppNavGroups>, activeTab: string, onSelect: (id: string) => void, badges?: Record<string, number> }} props
 */
export default function TabNav({ groups, activeTab, onSelect, badges = {} }) {
  const primaryGroup = groups.find((g) => g.layout === 'primary');
  const otherGroups = groups.filter((g) => g.layout !== 'primary');

  return (
    <>
      {otherGroups.length > 0 && (
        <nav className="z-10 shrink-0 px-3 pt-2 pb-2 space-y-1.5 border-b border-amber-900/10" style={{ background: '#fdf6f0' }}>
          {otherGroups.map((group) => (
            <section key={group.id} aria-label={group.label} className="space-y-1">
              <p className="text-[8px] font-black uppercase tracking-wider text-amber-900/50 px-1">
                {group.label}
              </p>
              <div className="flex gap-1.5 overflow-x-auto pb-0.5" style={{ scrollbarWidth: 'none' }}>
                {group.tabs.map((tab) => (
                  <TabButton
                    key={tab.id}
                    {...tab}
                    active={activeTab === tab.id}
                    badge={badges[tab.id]}
                    onSelect={onSelect}
                    size="compact"
                  />
                ))}
              </div>
            </section>
          ))}
        </nav>
      )}

      {primaryGroup && (
        <nav
          className="absolute bottom-0 left-0 right-0 z-50 px-3 pt-2 border-t border-stone-200 rounded-t-2xl shadow-[0_-10px_30px_rgba(61,31,15,0.08)]"
          style={{ background: '#fffaf5', paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))' }}
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
                size="primary"
              />
            ))}
          </div>
        </nav>
      )}
    </>
  );
}

/** แถบย่อยใน AdminPanel — สไตล์เดียวกับแท็บหลัก */
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
