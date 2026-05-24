import { useEffect, useState } from 'react';
import { Bell } from 'lucide-react';
import { dateKeyBangkok, tomorrowDateKeyBangkok } from '../lib/date';
import { fsPatch, fsRunQuery } from '../lib/firestoreRest';

// ─── LINE Orders Screen ───────────────────────────────────────────────────────

export function LineOrdersScreen() {
  const [orders,  setOrders]  = useState([]);
  const [loading, setLoading] = useState(true);

  const todayBKK = dateKeyBangkok;

  useEffect(() => {
    fsRunQuery({ from: [{ collectionId: 'lineOrders' }], orderBy: [{ field: { fieldPath: 'createdAt' }, direction: 'DESCENDING' }], limit: 100 })
      .then(rows => { setOrders(rows); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const markDone = (id) => {
    fsPatch(`lineOrders/${id}`, { status: 'done' });
    setOrders(prev => prev.map(o => o.id === id ? { ...o, status: 'done' } : o));
  };

  const today    = todayBKK();
  const tomorrow = tomorrowDateKeyBangkok();
  const dateLabel = (k) => k === today ? 'วันนี้' : k === tomorrow ? 'พรุ่งนี้' : k;

  // Group by deliveryDate, show today + future only
  const upcoming = orders.filter(o => (o.deliveryDate || '') >= today);
  const grouped  = upcoming.reduce((acc, o) => {
    const k = o.deliveryDate || 'ไม่ระบุ';
    (acc[k] = acc[k] || []).push(o);
    return acc;
  }, {});

  if (loading) return <div className="flex items-center justify-center h-40 text-slate-400 text-sm">กำลังโหลด...</div>;

  if (upcoming.length === 0) return (
    <div className="flex flex-col items-center justify-center h-60 text-slate-300">
      <Bell size={48} strokeWidth={1} className="mb-3" />
      <p className="font-bold text-sm">ยังไม่มีออเดอร์</p>
      <p className="text-xs mt-1">ออเดอร์จาก LINE จะขึ้นที่นี่</p>
    </div>
  );

  return (
    <div className="px-4 pt-4 pb-6 space-y-5">
      {Object.entries(grouped).sort().map(([date, items]) => (
        <div key={date}>
          <p className="text-xs font-bold text-slate-500 mb-2 uppercase tracking-wide">
            📅 ส่ง{dateLabel(date)} · {items.length} ออเดอร์
            {items.filter(o => o.status !== 'done').length > 0 && (
              <span className="ml-2 bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full">
                {items.filter(o => o.status !== 'done').length} รอ
              </span>
            )}
          </p>
          <div className="space-y-2">
            {items.map(o => (
              <div key={o.id}
                className={`bg-white rounded-2xl p-4 shadow-sm border transition-all ${o.status === 'done' ? 'border-green-200 opacity-50' : 'border-slate-200'}`}>
                <div className="flex justify-between items-start mb-2">
                  <div className="flex-1 min-w-0 mr-2">
                    <p className="text-[11px] text-slate-400">LINE · {o.lineUserId?.slice(-6) || '—'}</p>
                    <p className="text-xs text-slate-500 mt-0.5 truncate italic">"{o.rawText}"</p>
                  </div>
                  {o.status === 'done'
                    ? <span className="text-xs bg-green-100 text-green-600 font-bold px-2 py-1 rounded-xl shrink-0">✓ เสร็จ</span>
                    : <button onClick={() => markDone(o.id)}
                        className="text-xs bg-green-500 text-white font-bold px-3 py-1 rounded-xl active:scale-95 shrink-0">
                        ✓ เสร็จ
                      </button>
                  }
                </div>
                <div className="space-y-1">
                  {(o.items || []).map((item, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-blue-400 shrink-0" />
                      <p className="text-sm font-bold text-slate-700">{item.product}</p>
                      <p className="text-sm text-slate-500 ml-auto">{item.qty} {item.unit}</p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
