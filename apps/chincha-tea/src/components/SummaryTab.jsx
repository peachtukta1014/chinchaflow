import { useEffect, useState } from 'react';
import { fsPost, fsQueryExpenses } from '../lib/firestoreRest';

export function SummaryTab({ orders, t, dateKey, member, menuItems }) {
  const [expenses, setExpenses] = useState([]);
  const [expDesc, setExpDesc] = useState('');
  const [expAmount, setExpAmount] = useState('');
  const [savingExp, setSavingExp] = useState(false);
  const [expFlash, setExpFlash] = useState('');

  useEffect(() => { fsQueryExpenses(dateKey).then(setExpenses); }, [dateKey]);

  const cashOrders = orders.filter((o) => !o.payType || o.payType === 'cash');
  const transferOrders = orders.filter((o) => o.payType === 'transfer');
  const total = orders.reduce((s, o) => s + (o.total || 0), 0);
  const cashTotal = cashOrders.reduce((s, o) => s + (o.total || 0), 0);
  const transferTotal = transferOrders.reduce((s, o) => s + (o.total || 0), 0);
  const allItems = orders.flatMap((o) => o.items || []);
  const totalCups = allItems.reduce((s, i) => s + (i.qty || 1), 0);
  const totalExpenses = expenses.reduce((s, e) => s + (e.amount || 0), 0);
  const net = total - totalExpenses;

  const countMap = {};
  allItems.forEach((i) => { countMap[i.key] = (countMap[i.key] || 0) + (i.qty || 1); });
  const topItems = Object.entries(countMap).sort((a, b) => b[1] - a[1]).slice(0, 3);
  const maxCount = topItems[0]?.[1] || 1;

  const labelForKey = (key) => {
    const m = menuItems.find((x) => x.key === key || x.id === key);
    return m?.nameTh || t(key) || key;
  };

  const addExpense = async () => {
    const desc = expDesc.trim();
    const amount = parseInt(expAmount, 10);
    if (!desc || !amount || amount <= 0) return;
    setSavingExp(true);
    try {
      await fsPost('dailyExpenses', {
        dateKey,
        description: desc,
        amount,
        createdBy: member?.name || 'ชินชา',
        createdAt: new Date().toISOString(),
      });
      setExpenses(await fsQueryExpenses(dateKey));
      setExpDesc('');
      setExpAmount('');
      setExpFlash('✅ บันทึกแล้ว');
      setTimeout(() => setExpFlash(''), 2000);
    } catch (e) {
      console.error(e);
    }
    setSavingExp(false);
  };

  return (
    <div className="px-4 pt-3 pb-6 space-y-3">
      <div className="rounded-3xl p-5 text-white shadow-lg" style={{ background: '#3d1f0f' }}>
        <p className="text-amber-600 text-[10px] font-bold mb-3 uppercase tracking-widest">{t('todaySales')}</p>
        <p className="text-5xl font-black text-amber-200 leading-none">฿{total.toLocaleString()}</p>
        <p className="text-amber-700 text-xs mt-2">{totalCups} แก้ว · {orders.length} {t('orders')}</p>
        <div className="flex gap-3 pt-3 mt-3 border-t border-amber-900">
          <div className="flex-1 rounded-2xl p-3" style={{ background: 'rgba(16,185,129,0.15)' }}>
            <p className="text-[10px] text-emerald-400 font-bold">💵 สด</p>
            <p className="text-lg font-black text-emerald-300">฿{cashTotal.toLocaleString()}</p>
          </div>
          <div className="flex-1 rounded-2xl p-3" style={{ background: 'rgba(59,130,246,0.15)' }}>
            <p className="text-[10px] text-blue-400 font-bold">📱 โอน</p>
            <p className="text-lg font-black text-blue-300">฿{transferTotal.toLocaleString()}</p>
          </div>
        </div>
      </div>
      <div className="bg-white rounded-3xl p-4 shadow-sm border border-stone-200">
        <p className="font-bold text-stone-500 text-[10px] uppercase mb-3">💸 ค่าใช้จ่าย</p>
        {expFlash && <p className="text-emerald-600 text-xs font-bold mb-2">{expFlash}</p>}
        <div className="flex gap-2 mb-3">
          <input value={expDesc} onChange={(e) => setExpDesc(e.target.value)} placeholder="รายการ..." className="flex-1 px-3 py-2.5 rounded-xl border-2 border-stone-200 text-sm outline-none" />
          <input value={expAmount} onChange={(e) => setExpAmount(e.target.value.replace(/\D/g, ''))} placeholder="฿" className="w-20 px-3 py-2.5 rounded-xl border-2 border-stone-200 text-sm text-center font-bold" />
          <button type="button" onClick={addExpense} disabled={savingExp} className="px-3 py-2.5 rounded-xl font-black text-white text-sm" style={{ background: '#3d1f0f' }}>+</button>
        </div>
        {expenses.map((e, i) => (
          <div key={e.id || i} className="flex justify-between py-1.5 border-b border-stone-100 text-sm">
            <span>{e.description}</span>
            <span className="font-black text-red-500">-฿{(e.amount || 0).toLocaleString()}</span>
          </div>
        ))}
        {totalExpenses > 0 && (
          <div className="flex justify-between pt-2 mt-2 border-t">
            <span className="text-xs font-bold text-stone-400">กำไรสุทธิ</span>
            <span className={`font-black ${net >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>฿{net.toLocaleString()}</span>
          </div>
        )}
      </div>
      <div className="bg-white rounded-3xl p-4 border border-stone-200">
        <p className="font-bold text-stone-500 text-[10px] uppercase mb-3">{t('topItems')}</p>
        {topItems.length === 0 ? (
          <p className="text-stone-300 text-sm text-center">{t('noOrders')}</p>
        ) : (
          topItems.map(([key, count], idx) => (
            <div key={key} className="flex items-center gap-2 mb-2">
              <span>{['🥇', '🥈', '🥉'][idx]}</span>
              <div className="flex-1">
                <div className="flex justify-between text-xs font-bold">
                  <span>{labelForKey(key)}</span>
                  <span>{count} แก้ว</span>
                </div>
                <div className="h-1.5 bg-stone-100 rounded-full mt-1">
                  <div className="h-full rounded-full" style={{ background: '#c87941', width: `${(count / maxCount) * 100}%` }} />
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
