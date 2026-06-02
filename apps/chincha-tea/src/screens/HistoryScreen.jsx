import { shiftDateKey } from '../lib/constants';
import { cartItemDisplayName } from '../lib/displayNames';
import { formatDateKeyLabel, formatTimeLabel } from '../lib/localeFormat';

export default function HistoryScreen({ orders, viewDateKey, setViewDateKey, todayKey, t, lang = 'th', menuItems = [] }) {
  return (
    <div className="px-4 pt-3 pb-6 space-y-3">
      <div className="flex items-center gap-2 bg-white rounded-2xl p-2 border border-stone-200 mb-2">
        <button type="button" onClick={() => setViewDateKey(shiftDateKey(viewDateKey, -1))} className="w-9 h-9 rounded-xl bg-stone-100 font-black text-stone-600">‹</button>
        <p className="flex-1 text-center text-xs font-black text-stone-600">
          {viewDateKey === todayKey ? t('todaySales') : formatDateKeyLabel(viewDateKey, lang)}
        </p>
        <button type="button" disabled={viewDateKey >= todayKey} onClick={() => setViewDateKey(shiftDateKey(viewDateKey, 1))} className="w-9 h-9 rounded-xl bg-stone-100 font-black disabled:opacity-30">›</button>
      </div>
      {orders.length === 0 ? (
        <p className="text-center text-stone-300 py-12">{t('noOrders')}</p>
      ) : (
        orders.map((o, i) => (
          <div key={o.id || i} className="bg-white rounded-2xl p-4 border border-stone-200">
            <div className="flex justify-between mb-2">
              <p className="text-xs text-stone-400">
                {formatTimeLabel(o.createdAt, lang)}
                {o.payType && <span className="ml-2 font-bold">{o.payType === 'cash' ? t('cash') : t('transfer')}</span>}
              </p>
              <p className="font-black" style={{ color: '#3d1f0f' }}>฿{(o.total || 0).toLocaleString()}</p>
            </div>
            {(o.items || []).map((it, j) => {
              const { primary, sub } = cartItemDisplayName(it, lang, t, menuItems);
              return (
              <p key={j} className="text-sm text-stone-600">
                {it.emoji} {it.qty}× {primary}
                {sub ? <span className="block text-[10px] text-stone-400">{sub}</span> : null}
                {it.sweet ? ` · ${it.sweet}` : ''}
              </p>
            );})}
          </div>
        ))
      )}
    </div>
  );
}
