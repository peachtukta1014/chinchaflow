import { useState } from 'react';

// Approximate OpenRouter pricing per 1M tokens (USD)
const COST_PER_M = {
  flash:  { in: 0.14, out: 0.28 },
  vision: { in: 0.15, out: 0.60 },
  pro:    { in: 0.55, out: 2.19 },
};

function computeStats(logs) {
  const now = Date.now();
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;

  let todayCount = 0;
  let sevenDaysCount = 0;
  let proCount = 0;
  let totalCost = 0;

  for (const log of logs) {
    const ts = log.createdAt || 0;
    if (ts >= todayStart.getTime()) todayCount++;
    if (ts >= sevenDaysAgo) sevenDaysCount++;

    const f = log.flash || {};
    const v = log.vision || {};
    const p = log.pro || {};

    const fIn = f.input || 0, fOut = f.output || 0;
    const vIn = v.input || 0, vOut = v.output || 0;
    const pIn = p.input || 0, pOut = p.output || 0;

    if (pIn + pOut > 0) proCount++;

    totalCost +=
      (fIn * COST_PER_M.flash.in + fOut * COST_PER_M.flash.out) / 1e6 +
      (vIn * COST_PER_M.vision.in + vOut * COST_PER_M.vision.out) / 1e6 +
      (pIn * COST_PER_M.pro.in + pOut * COST_PER_M.pro.out) / 1e6;
  }

  const total = logs.length;
  const proRate = total > 0 ? Math.round((proCount / total) * 100) : 0;
  const avgCost = total > 0 ? totalCost / total : 0;
  const sevenDaysAvg = (sevenDaysCount / 7).toFixed(1);

  return { todayCount, sevenDaysAvg, proRate, totalCost, avgCost, proCount, total };
}

function StatCard({ label, value, sub }) {
  return (
    <div className="bg-ai-card border border-ai-border rounded-xl px-3 py-2 text-center">
      <p className="text-[10px] text-ai-muted leading-tight">{label}</p>
      <p className="text-xs font-semibold text-ai-text mt-0.5">{value}</p>
      {sub && <p className="text-[10px] text-ai-muted/70 mt-0.5">{sub}</p>}
    </div>
  );
}

export default function TokenDashboard({ logs, loading, onRefresh }) {
  const [expandedDay, setExpandedDay] = useState(null);

  const fmt = n => (n || 0).toLocaleString();

  const sumTokens = (log) => {
    const f = log.flash || {};
    const v = log.vision || {};
    const p = log.pro || {};
    return {
      input: (f.input || 0) + (v.input || 0) + (p.input || 0),
      output: (f.output || 0) + (v.output || 0) + (p.output || 0),
      flashIn: f.input || 0, flashOut: f.output || 0,
      visionIn: v.input || 0, visionOut: v.output || 0,
      proIn: p.input || 0, proOut: p.output || 0,
      proIters: p.iterations || 0,
    };
  };

  const grouped = logs.reduce((acc, log) => {
    const d = log.createdAt ? new Date(log.createdAt) : new Date();
    const key = d.toLocaleDateString('th-TH', { year: 'numeric', month: '2-digit', day: '2-digit' });
    if (!acc[key]) acc[key] = { label: key, ts: log.createdAt || 0, items: [] };
    acc[key].items.push(log);
    return acc;
  }, {});

  const days = Object.values(grouped).sort((a, b) => b.ts - a.ts);

  const daySum = (items) => items.reduce((acc, log) => {
    const t = sumTokens(log);
    return {
      input: acc.input + t.input, output: acc.output + t.output,
      flashIn: acc.flashIn + t.flashIn, flashOut: acc.flashOut + t.flashOut,
      visionIn: acc.visionIn + t.visionIn, visionOut: acc.visionOut + t.visionOut,
      proIn: acc.proIn + t.proIn, proOut: acc.proOut + t.proOut,
    };
  }, { input: 0, output: 0, flashIn: 0, flashOut: 0, visionIn: 0, visionOut: 0, proIn: 0, proOut: 0 });

  const stats = !loading && logs.length > 0 ? computeStats(logs) : null;

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2 border-b border-ai-border shrink-0">
        <span className="text-xs text-ai-muted">{logs.length} requests · {days.length} วัน</span>
        <button onClick={onRefresh} className="text-xs text-ai-accent hover:brightness-110 transition-colors">รีเฟรช</button>
      </div>

      {loading ? (
        <div className="flex-1 flex items-center justify-center text-ai-muted text-sm">กำลังโหลด...</div>
      ) : logs.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-ai-muted text-sm">ยังไม่มีข้อมูล Token</div>
      ) : (
        <div className="flex-1 overflow-y-auto">

          {/* ── Monitoring stats ──────────────────────────────────────── */}
          {stats && (
            <div className="px-4 pt-3 pb-2 border-b border-ai-border space-y-2 shrink-0">
              <p className="text-[10px] font-semibold text-ai-muted tracking-wider uppercase">📊 ภาพรวม</p>
              <div className="grid grid-cols-3 gap-2">
                <StatCard label="วันนี้" value={`${stats.todayCount} tasks`} />
                <StatCard label="7 วัน avg" value={`${stats.sevenDaysAvg}/วัน`} />
                <StatCard
                  label="Pro rate"
                  value={`${stats.proRate}%`}
                  sub={`${stats.proCount}/${stats.total} tasks`}
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <StatCard
                  label="ต้นทุนรวม ~"
                  value={`$${stats.totalCost.toFixed(3)}`}
                  sub="ประเมิน OpenRouter"
                />
                <StatCard
                  label="เฉลี่ย/task ~"
                  value={`$${stats.avgCost.toFixed(4)}`}
                  sub={stats.proCount > 0 ? `Pro avg $${(stats.totalCost / stats.proCount).toFixed(3)}` : 'Flash only'}
                />
              </div>
            </div>
          )}

          {/* ── Per-day grouped list ──────────────────────────────────── */}
          <div className="px-4 py-3 space-y-2">
            {days.map(day => {
              const s = daySum(day.items);
              const isOpen = expandedDay === day.label;
              return (
                <div key={day.label} className="bg-ai-card border border-ai-border rounded-xl overflow-hidden">
                  <button
                    className="w-full px-3 py-2.5 flex items-center gap-2 text-left hover:bg-ai-bg/50 transition-colors"
                    onClick={() => setExpandedDay(isOpen ? null : day.label)}
                  >
                    <span className="text-xs">{isOpen ? '▾' : '▸'}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-ai-text">📅 {day.label}</span>
                        <span className="text-[10px] text-ai-muted">{day.items.length} requests</span>
                      </div>
                      <div className="flex gap-3 mt-0.5 flex-wrap">
                        <span className="text-[10px] text-ai-muted">⚡ {fmt(s.flashIn + s.flashOut)}</span>
                        {s.visionIn + s.visionOut > 0 && <span className="text-[10px] text-ai-muted">👁 {fmt(s.visionIn + s.visionOut)}</span>}
                        {s.proIn + s.proOut > 0 && <span className="text-[10px] text-ai-muted">🤖 {fmt(s.proIn + s.proOut)}</span>}
                        <span className="text-[10px] font-semibold text-ai-accent">รวม {fmt(s.input + s.output)} tokens</span>
                      </div>
                    </div>
                  </button>

                  {isOpen && (
                    <div className="border-t border-ai-border divide-y divide-ai-border/50">
                      <div className="px-3 py-2 bg-ai-bg/30">
                        <div className="grid grid-cols-3 gap-1.5 text-center">
                          {[
                            { label: '⚡ Flash', inT: s.flashIn, outT: s.flashOut },
                            { label: '👁 Vision', inT: s.visionIn, outT: s.visionOut },
                            { label: '🤖 Pro', inT: s.proIn, outT: s.proOut },
                          ].map(({ label, inT, outT }) => (
                            <div key={label} className={`rounded-lg px-2 py-1.5 bg-ai-card ${inT + outT === 0 ? 'opacity-30' : ''}`}>
                              <p className="text-[10px] text-ai-muted">{label}</p>
                              <p className="text-[11px] text-ai-text">{fmt(inT)}↑ {fmt(outT)}↓</p>
                            </div>
                          ))}
                        </div>
                      </div>

                      {day.items.map((log, idx) => {
                        const t = sumTokens(log);
                        const time = log.createdAt ? new Date(log.createdAt).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) : '';
                        return (
                          <div key={log.id} className="px-3 py-2 flex items-center gap-2">
                            <span className="text-[10px] text-ai-muted w-5 shrink-0">{idx + 1}.</span>
                            <span className="text-[10px] text-ai-muted w-10 shrink-0">{time}</span>
                            <div className="flex-1 flex gap-2 flex-wrap">
                              {t.flashIn + t.flashOut > 0 && <span className="text-[10px] text-ai-muted">⚡{fmt(t.flashIn + t.flashOut)}</span>}
                              {t.visionIn + t.visionOut > 0 && <span className="text-[10px] text-ai-muted">👁{fmt(t.visionIn + t.visionOut)}</span>}
                              {t.proIn + t.proOut > 0 && <span className="text-[10px] text-ai-muted">🤖{fmt(t.proIn + t.proOut)}{t.proIters ? ` (${t.proIters}i)` : ''}</span>}
                            </div>
                            <span className="text-[10px] font-medium text-ai-accent shrink-0">{fmt(t.input + t.output)}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
