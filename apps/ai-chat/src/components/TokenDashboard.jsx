import { useState } from 'react';

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
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
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
      )}
    </div>
  );
}
