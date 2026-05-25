export default function TabNav({ tabs, activeTab, onSelect }) {
  return (
    <nav className="z-10 shrink-0 flex px-2 pt-2 pb-1 gap-1 overflow-x-auto" style={{ background: '#fdf6f0', scrollbarWidth: 'none' }}>
      {tabs.map(([id, label]) => (
        <button
          key={id}
          type="button"
          onClick={() => onSelect(id)}
          className={`shrink-0 px-3 py-2 rounded-2xl font-bold text-[10px] whitespace-nowrap ${activeTab === id ? 'text-white' : 'text-stone-500 bg-stone-200'}`}
          style={activeTab === id ? { background: '#3d1f0f' } : {}}
        >
          {label}
        </button>
      ))}
    </nav>
  );
}
