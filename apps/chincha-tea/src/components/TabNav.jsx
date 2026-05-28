export default function TabNav({ tabs, activeTab, onSelect, badges = {} }) {
  return (
    <nav className="z-10 shrink-0 flex px-2 pt-2 pb-1 gap-1 overflow-x-auto" style={{ background: '#fdf6f0', scrollbarWidth: 'none' }}>
      {tabs.map(([id, label]) => {
        const badge = badges[id];
        return (
          <button
            key={id}
            type="button"
            onClick={() => onSelect(id)}
            className={`relative shrink-0 px-3 py-2 rounded-2xl font-bold text-[10px] whitespace-nowrap ${activeTab === id ? 'text-white' : 'text-stone-500 bg-stone-200'}`}
            style={activeTab === id ? { background: '#3d1f0f' } : {}}
          >
            {label}
            {badge > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-0.5 rounded-full bg-red-500 text-white text-[9px] font-black flex items-center justify-center">
                {badge > 9 ? '9+' : badge}
              </span>
            )}
          </button>
        );
      })}
    </nav>
  );
}
