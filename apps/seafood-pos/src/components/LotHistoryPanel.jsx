import React, { useCallback, useEffect, useState } from 'react';
import { formatViewDateLabel } from '../lib/date';
import { fetchLotSummaries } from '../services/lotCloseService';

function fmtBaht(n) {
  return `฿${Math.round(parseFloat(n) || 0).toLocaleString()}`;
}

function fmtKg(n) {
  return `${(parseFloat(n) || 0).toFixed(2)} กก.`;
}

function NetBadge({ value }) {
  const v = parseFloat(value) || 0;
  return (
    <span
      className={`text-base font-black tabular-nums ${
        v >= 0 ? 'text-emerald-600' : 'text-red-600'
      }`}
    >
      {v >= 0 ? '+' : ''}
      {fmtBaht(v)}
    </span>
  );
}

function SummaryCard({ summary }) {
  const [open, setOpen] = useState(false);
  const carry = (parseFloat(summary.carryLiveKg) || 0) + (parseFloat(summary.carryDeadKg) || 0);

  return (
    <div className="bg-white rounded-[1.5rem] shadow-sm border border-slate-200 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full text-left p-4 flex items-start justify-between gap-3"
      >
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-black text-slate-800">
              ล็อต {formatViewDateLabel(summary.lotDateKey)}
            </span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">
              ปิดแล้ว
            </span>
            {carry > 0.001 && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700">
                ยกยอด {fmtKg(carry)}
              </span>
            )}
          </div>
          <p className="text-[11px] text-slate-500 mt-0.5">
            รับ {fmtKg(summary.receivedTotalKg)}
            {' · '}
            ขาย {fmtKg(summary.soldTotalKg)}
            {' · '}
            ทุน {fmtBaht(summary.totalCost)}
          </p>
          {summary.closedBy && (
            <p className="text-[10px] text-slate-400 mt-0.5">
              ปิดโดย {summary.closedBy}
              {summary.closedAt
                ? ` · ${new Date(summary.closedAt).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit' })}`
                : ''}
            </p>
          )}
        </div>
        <div className="shrink-0 text-right">
          <NetBadge value={summary.netLotProfit} />
          <p className="text-[10px] text-slate-400 mt-0.5">{open ? '▲' : '▼'} ดูรายละเอียด</p>
        </div>
      </button>

      {open && (
        <div className="border-t border-slate-100 px-4 pb-4 pt-3 space-y-3">
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="bg-slate-50 rounded-xl p-3">
              <p className="text-slate-500 mb-1">รายได้</p>
              <p className="font-black text-emerald-700 text-base">{fmtBaht(summary.revenue)}</p>
            </div>
            <div className="bg-slate-50 rounded-xl p-3">
              <p className="text-slate-500 mb-1">ต้นทุนขาย (COGS)</p>
              <p className="font-black text-slate-800 text-base">{fmtBaht(summary.cogsSold)}</p>
            </div>
            <div className="bg-slate-50 rounded-xl p-3">
              <p className="text-slate-500 mb-1">กำไรขั้นต้น</p>
              <p
                className={`font-black text-base ${
                  (parseFloat(summary.grossProfit) || 0) >= 0
                    ? 'text-emerald-700'
                    : 'text-red-600'
                }`}
              >
                {fmtBaht(summary.grossProfit)}
              </p>
            </div>
            <div className="bg-slate-50 rounded-xl p-3">
              <p className="text-slate-500 mb-1">รายจ่ายดำเนิน</p>
              <p className="font-black text-slate-800 text-base">
                {fmtBaht(summary.miscExpensesBaht)}
              </p>
            </div>
          </div>

          {(parseFloat(summary.shrinkageKg) || 0) > 0.01 && (
            <div className="bg-red-50 rounded-xl p-3 text-xs space-y-1">
              <p className="font-bold text-red-700">น้ำหนักสูญเสีย</p>
              <div className="flex justify-between">
                <span className="text-slate-600">น้ำหนักหาย</span>
                <span className="font-bold">{fmtKg(summary.shrinkageKg)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">มูลค่าสูญเสีย</span>
                <span className="font-bold text-red-600">{fmtBaht(summary.shrinkageBaht)}</span>
              </div>
            </div>
          )}

          {carry > 0.001 && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-xs space-y-1">
              <p className="font-bold text-blue-700">ยกยอดไปล็อตถัดไป</p>
              <div className="flex justify-between">
                <span className="text-slate-600">เป็น</span>
                <span className="font-bold">{fmtKg(summary.carryLiveKg)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">ตาย</span>
                <span className="font-bold">{fmtKg(summary.carryDeadKg)}</span>
              </div>
              {summary.targetLotDateKey && (
                <p className="text-blue-600 text-[10px]">
                  → ล็อต {formatViewDateLabel(summary.targetLotDateKey)}
                </p>
              )}
            </div>
          )}

          <div className="bg-slate-900 rounded-xl p-3 flex justify-between items-center">
            <span className="text-slate-400 text-xs font-bold">สุทธิล็อตนี้</span>
            <NetBadge value={summary.netLotProfit} />
          </div>
        </div>
      )}
    </div>
  );
}

export default function LotHistoryPanel() {
  const [summaries, setSummaries] = useState([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await fetchLotSummaries(30);
      setSummaries(rows);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-black text-slate-800 text-lg">ประวัติล็อตที่ปิดแล้ว</h2>
          <p className="text-xs text-slate-500 mt-0.5">กดแถบเพื่อดูรายละเอียด P&amp;L แต่ละล็อต</p>
        </div>
        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="text-xs font-bold text-blue-600 bg-blue-50 px-3 py-2 rounded-xl disabled:opacity-50"
        >
          {loading ? 'กำลังโหลด...' : 'รีเฟรช'}
        </button>
      </div>

      {loading && summaries.length === 0 && (
        <p className="text-center text-slate-400 text-sm py-10">กำลังโหลด...</p>
      )}

      {!loading && summaries.length === 0 && (
        <div className="bg-white rounded-[1.5rem] p-8 text-center shadow-sm border border-slate-200">
          <p className="text-slate-400 text-sm font-medium">ยังไม่มีล็อตที่ปิดแล้ว</p>
          <p className="text-slate-400 text-xs mt-1">
            ปิดล็อตได้จากแท็บ「สรุปล็อต」ด้านบน
          </p>
        </div>
      )}

      {summaries.map((s) => (
        <SummaryCard key={s.lotDateKey || s.id} summary={s} />
      ))}
    </div>
  );
}
