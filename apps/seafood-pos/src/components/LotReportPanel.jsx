import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { dateKeyBangkok, formatViewDateLabel } from '../lib/date';
import { formatReceiveDayLabel, groupBatchesByReceiveDay } from '../lib/stockBatchUtils';
import { computeLotReport } from '../lib/lotReport';
import {
  fsListStockAdjustments,
  fsQuerySalesBetween,
} from '../lib/firestoreRest';
import DateNavBar from './DateNavBar';
import LotExpensesPanel from './LotExpensesPanel';
import { closeLotAndCarryForward, pickCarryTarget } from '../services/lotCloseService';

/** Returns the dateKey of the oldest lot that is not closed and not excluded. */
function getOldestActiveLot(lotDays, closedLotKeys, excluding = null) {
  // lotDays is sorted newest→oldest; iterate from end to get oldest first
  for (let i = lotDays.length - 1; i >= 0; i--) {
    const d = lotDays[i];
    if (d.dateKey === excluding) continue;
    if (!closedLotKeys.has(d.dateKey)) return d.dateKey;
  }
  return null;
}

function fmtKg(n) {
  return `${(parseFloat(n) || 0).toFixed(2)} กก.`;
}

function fmtBaht(n) {
  return `฿${Math.round(parseFloat(n) || 0).toLocaleString()}`;
}

function StepRow({ label, value, sign, accent }) {
  const prefix = sign === 'plus' ? '+ ' : sign === 'minus' ? '− ' : '';
  return (
    <div className="flex justify-between items-start gap-2 py-1.5 text-sm">
      <span className="text-slate-600 text-xs leading-snug min-w-0">{label}</span>
      <span className={`font-bold shrink-0 tabular-nums ${accent || 'text-slate-800'}`}>
        {prefix}
        {value}
      </span>
    </div>
  );
}

function LineSummaryCard({
  title,
  emoji,
  borderCls,
  headerCls,
  report,
  line,
  expenseLineItems,
}) {
  const isLive = line === 'live';
  const receivedKg = isLive ? report.receivedLive : report.receivedDead;
  const costBaht = isLive ? report.liveCostBaht : report.deadCostBaht;
  const costPerKg = isLive ? report.liveCostPerKg : report.deadCostPerKg;
  const costPerKgLabel = isLive
    ? costPerKg
    : (report.receivedDead > 0 ? report.deadCostPerKg : report.deadCostPerKgForCogs);
  const revenue = isLive ? report.liveRevenue : report.deadRevenue;
  const soldKg = isLive ? report.soldLiveKg : report.soldDeadKg;
  const cogs = isLive ? report.liveCogs : report.deadCogs;
  const expenses = isLive ? report.pondExpensesBaht : report.marketExpensesBaht;
  const expenseLines = isLive ? expenseLineItems?.pondLines : expenseLineItems?.marketLines;
  const expenseLabel = isLive ? 'รายจ่ายบ่อ / ส่งเป็น' : 'รายจ่ายแผงตลาด';
  const lineNet = isLive ? report.liveLineNetBaht : report.deadLineNetBaht;
  const gross = isLive ? report.liveGrossProfit : report.deadGrossProfit;
  const weightLossKg = isLive ? report.liveWeightLossKg : report.deadWeightLossKg;
  const weightLossBaht = isLive ? report.liveWeightLossBaht : report.deadWeightLossBaht;

  return (
    <div className={`bg-white p-5 rounded-[2rem] shadow-sm border-2 ${borderCls}`}>
      <p className={`text-sm font-black mb-3 ${headerCls}`}>
        {emoji}
        {' '}
        {title}
      </p>

      <div className="bg-slate-50 rounded-xl p-3 mb-3 text-[11px] text-slate-600 leading-relaxed">
        รับเข้า
        {' '}
        <strong className="text-slate-800">{receivedKg.toFixed(2)} กก.</strong>
        {' '}
        · ทุนรับเข้า
        {' '}
        <strong className="text-slate-800">{fmtBaht(costBaht)}</strong>
        {receivedKg > 0 && (
          <>
            {' '}
            (
            {costPerKgLabel.toFixed(2)}
            {' '}
            บ./กก.)
          </>
        )}
        {!isLive && report.receivedDead <= 0 && report.pondToDeadKg > 0 && (
          <span className="block mt-1 text-orange-700">
            ตายมากับรถ 0 กก. — ตายจากบ่อใช้ทุนเป็น
          </span>
        )}
      </div>

      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1">เงิน (สายนี้)</p>
      <StepRow label="ขายได้" value={fmtBaht(revenue)} sign="plus" accent="text-emerald-700" />
      <StepRow
        label={`ต้นทุนขาย${soldKg > 0 ? ` (${soldKg.toFixed(2)} กก.)` : ''}`}
        value={fmtBaht(cogs)}
        sign="minus"
      />
      <StepRow
        label="= กำไรจากขาย"
        value={fmtBaht(gross)}
        accent={gross >= 0 ? 'text-emerald-700' : 'text-red-600'}
      />
      {expenses > 0 && (
        <>
          <StepRow label={expenseLabel} value={fmtBaht(expenses)} sign="minus" />
          {expenseLines?.length > 0 && (
            <ul className="text-[10px] text-slate-500 pl-1 mb-1 space-y-0.5">
              {expenseLines.map((row) => (
                <li key={`${row.label}-${row.amount}`} className="flex justify-between gap-2">
                  <span className="truncate">{row.label}</span>
                  <span className="shrink-0 tabular-nums">{fmtBaht(row.amount)}</span>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
      {weightLossKg > 0.01 && (
        <StepRow
          label={`กุ้งหายปริศนา สายนี้ ${weightLossKg.toFixed(2)} กก.`}
          value={fmtBaht(weightLossBaht)}
          sign="minus"
          accent="text-red-600"
        />
      )}
      <div className="mt-3 pt-3 border-t-2 border-dashed border-slate-200 flex justify-between items-center">
        <span className="text-xs font-bold text-slate-700">สุทธิสายนี้</span>
        <span className={`text-lg font-black tabular-nums ${lineNet >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
          {fmtBaht(lineNet)}
        </span>
      </div>
    </div>
  );
}

export default function LotReportPanel({
  stockBatches = [],
  active = true,
  member = null,
  onLotClosed = null,
  closedLotKeys = new Set(),
}) {
  const todayKey = dateKeyBangkok();
  const lotDays = useMemo(() => groupBatchesByReceiveDay(stockBatches), [stockBatches]);
  const defaultLotKey = lotDays.length ? lotDays[lotDays.length - 1].dateKey : todayKey;

  const [lotDateKey, setLotDateKey] = useState(defaultLotKey);
  const [endDateKey, setEndDateKey] = useState(todayKey);
  const [sales, setSales] = useState([]);
  const [adjustments, setAdjustments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [countedLive, setCountedLive] = useState('');
  const [countedDead, setCountedDead] = useState('');
  const [salesLoadNote, setSalesLoadNote] = useState('');
  const [closingLot, setClosingLot] = useState(false);
  const [carryTargetKey, setCarryTargetKey] = useState(null);
  const [lotExpenses, setLotExpenses] = useState({
    marketExpenses: 0,
    marketNote: '',
    marketLines: [],
    pondExpenses: 0,
    pondNote: '',
    pondLines: [],
  });

  // Fallback: if the current lot disappears from the list entirely
  useEffect(() => {
    if (lotDays.some((d) => d.dateKey === lotDateKey)) return;
    if (defaultLotKey) setLotDateKey(defaultLotKey);
  }, [lotDays, lotDateKey, defaultLotKey]);

  // On initial closedLotKeys load: if the default selection is already closed,
  // auto-advance to the oldest active (non-closed) lot.
  const didInitAutoSelect = useRef(false);
  useEffect(() => {
    if (didInitAutoSelect.current) return;
    if (closedLotKeys.size === 0) return;
    didInitAutoSelect.current = true;
    if (!closedLotKeys.has(lotDateKey)) return;
    const next = getOldestActiveLot(lotDays, closedLotKeys);
    if (next) setLotDateKey(next);
  }, [closedLotKeys, lotDateKey, lotDays]);

  const loadReportData = useCallback(async () => {
    if (!lotDateKey || lotDateKey > endDateKey) return;
    setLoading(true);
    try {
      const [saleRows, adjRows] = await Promise.all([
        fsQuerySalesBetween(lotDateKey, endDateKey),
        fsListStockAdjustments(200),
      ]);
      setSales(saleRows);
      setSalesLoadNote(
        saleRows.length > 0
          ? ''
          : 'ไม่พบบิลในช่วงนี้ — ลองกด「สรุปถึงวันนี้」',
      );
      setAdjustments(
        adjRows.filter((a) => {
          const dk = a.dateKey || String(a.createdAt || '').slice(0, 10);
          return dk >= lotDateKey && dk <= endDateKey;
        }),
      );
    } catch (e) {
      console.warn('LotReportPanel load', e);
      setSales([]);
      setSalesLoadNote('โหลดบิลไม่สำเร็จ — กดรีเฟรชสรุปล็อต');
      setAdjustments([]);
    } finally {
      setLoading(false);
    }
  }, [lotDateKey, endDateKey]);

  useEffect(() => {
    if (endDateKey >= lotDateKey) return;
    setEndDateKey(lotDateKey);
  }, [lotDateKey, endDateKey]);

  // ── auto-pick carry target when lot changes ───────────────────────────────
  useEffect(() => {
    setCarryTargetKey(pickCarryTarget(stockBatches, lotDateKey));
  }, [stockBatches, lotDateKey]);

  useEffect(() => {
    if (!active) return;
    loadReportData();
  }, [loadReportData, active]);

  const report = useMemo(() => {
    const cLive = countedLive === '' ? null : parseFloat(countedLive);
    const cDead = countedDead === '' ? null : parseFloat(countedDead);
    return computeLotReport({
      lotDateKey,
      endDateKey,
      batches: stockBatches,
      sales,
      adjustments,
      countedLive: Number.isFinite(cLive) ? cLive : null,
      countedDead: Number.isFinite(cDead) ? cDead : null,
      marketExpenses: lotExpenses.marketExpenses,
      pondExpenses: lotExpenses.pondExpenses,
    });
  }, [
    lotDateKey,
    endDateKey,
    stockBatches,
    sales,
    adjustments,
    countedLive,
    countedDead,
    lotExpenses,
  ]);

  const handleCloseLot = async () => {
    const remaining = report.remainingLive + report.remainingDead;
    const carry = remaining > 0.001;
    const targetLabel = carryTargetKey ? formatViewDateLabel(carryTargetKey) : '—';
    const msg = carry
      ? `ปิดล็อต ${formatReceiveDayLabel(lotDateKey)}?\n\nยอดคงเหลือ ${remaining.toFixed(2)} กก. จะยกไปล็อต ${targetLabel}\n\n⚠️ ไม่สามารถยกเลิกได้ หลังปิดแล้ว`
      : `ปิดล็อต ${formatReceiveDayLabel(lotDateKey)}?\n\nไม่มีคงเหลือที่ต้องยก\n\n⚠️ ไม่สามารถยกเลิกได้ หลังปิดแล้ว`;
    if (!window.confirm(msg)) return;
    setClosingLot(true);
    try {
      await closeLotAndCarryForward({
        lotDateKey,
        batches: stockBatches,
        report,
        targetLotDateKey: carry ? carryTargetKey : null,
        closedBy: member?.name || '',
      });
      alert(`✅ ปิดล็อต ${formatReceiveDayLabel(lotDateKey)} แล้ว${carry ? `\nยกยอด ${remaining.toFixed(2)} กก. → ล็อต ${targetLabel}` : ''}`);
      onLotClosed?.(lotDateKey);
      await loadReportData();

      // Auto-advance to the next oldest active lot (exclude the one just closed)
      const next = getOldestActiveLot(lotDays, closedLotKeys, lotDateKey);
      if (next) setLotDateKey(next);
    } catch (e) {
      console.error(e);
      alert(e?.message || 'ปิดล็อตไม่สำเร็จ');
    } finally {
      setClosingLot(false);
    }
  };

  const isAlreadyClosed = closedLotKeys.has(lotDateKey);

  const lotLabel = formatReceiveDayLabel(lotDateKey);
  const periodLabel = `${formatViewDateLabel(lotDateKey)} → ${formatViewDateLabel(endDateKey)}`;

  return (
    <div className="space-y-4">
      <div className="bg-white p-5 rounded-[2rem] shadow-sm space-y-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h2 className="font-black text-slate-800 text-lg">สรุปล็อต</h2>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">
              แยก 2 สาย (เป็น / ตาย) · บวกในแต่ละสาย แล้วหักทีเดียวตอนท้าย
            </p>
          </div>
          <span className="text-[10px] font-bold text-purple-700 bg-purple-50 px-2 py-1 rounded-lg shrink-0">
            แอดมิน
          </span>
        </div>

        <label className="text-xs font-bold text-slate-500 block">ล็อต (วันรับรถ)</label>
        <select
          value={lotDateKey}
          onChange={(e) => {
            const dk = e.target.value;
            setLotDateKey(dk);
            if (endDateKey < dk) setEndDateKey(todayKey);
          }}
          className="w-full p-3 bg-slate-50 rounded-2xl font-bold text-slate-800 outline-none"
        >
          {lotDays.length === 0 ? (
            <option value={todayKey}>ยังไม่มีรับเข้า</option>
          ) : (
            lotDays.map((d) => (
              <option key={d.dateKey} value={d.dateKey}>
                {d.label}
              </option>
            ))
          )}
        </select>

        <DateNavBar
          dateKey={endDateKey}
          onDateChange={setEndDateKey}
          minDateKey={lotDateKey}
          subtitle={`สรุปถึง ${formatViewDateLabel(endDateKey)}`}
        />

        {endDateKey < todayKey && (
          <button
            type="button"
            onClick={() => setEndDateKey(todayKey)}
            className="w-full py-2.5 rounded-xl bg-emerald-50 text-emerald-800 text-xs font-bold border border-emerald-200"
          >
            รวมยอดขายถึงวันนี้
          </button>
        )}

        <button
          type="button"
          onClick={loadReportData}
          disabled={loading}
          className="w-full py-3 rounded-2xl bg-slate-800 text-white font-bold text-sm disabled:opacity-60"
        >
          {loading ? 'กำลังโหลด...' : 'รีเฟรชสรุปล็อต'}
        </button>
      </div>

      {(report.warnings.hasOtherLotStock || report.warnings.hasNewerLot) && (
        <div className="bg-amber-50 border border-amber-200 text-amber-900 text-xs rounded-2xl p-4 leading-relaxed space-y-1">
          {report.warnings.hasNewerLot && <p>มีล็อตรับเข้าหลังวันนี้แล้ว — ยอดขายอาจตัดหลายล็อต (FIFO)</p>}
          {report.warnings.hasOtherLotStock && <p>ยังมียอดคงเหลือจากล็อตอื่น — ดูคงเหลือเฉพาะวันรับนี้</p>}
        </div>
      )}

      <div className="bg-gradient-to-br from-slate-800 to-slate-900 text-white p-4 rounded-2xl text-[11px] leading-relaxed space-y-2">
        <p className="font-bold text-cyan-300 text-xs">วิธีคิด — ล็อต {lotLabel}</p>
        <p>
          <strong className="text-white">กำไร/ขาดทุน:</strong>
          {' '}
          ขายได้ − ต้นทุนขาย (COGS) − รายจ่ายสาย − กุ้งหายปริศนา = สุทธิสาย
        </p>
        <p>
          <strong className="text-white">สุทธิสุดท้าย</strong>
          {' '}
          = รวมสองสาย − เสียหาย(จด) − ชั่งปิด(จด)
        </p>
        <p>
          <strong className="text-white">น้ำหนัก:</strong>
          {' '}
          รับ − ขาย − คงเหลือ = สูญเสียรวม
          {' '}
          (แยก: ปริศนา / เสียหาย / ชั่งปิด)
          {' '}
          · ย้ายบ่อ→ตาย ≠ สูญหาย
        </p>
        <p className="text-slate-400">
          {periodLabel}
          {' '}
          ·
          {' '}
          {report.billCount}
          {' '}
          บิล · ทุนรวม
          {' '}
          {fmtBaht(report.totalCost)}
          {report.transportTotal > 0 && ` (รวมค่ารถ ${fmtBaht(report.transportTotal)})`}
        </p>
      </div>

      {report.billCount === 0 && salesLoadNote && (
        <p className="text-[11px] text-amber-800 bg-amber-50 rounded-xl p-3 leading-relaxed">
          {salesLoadNote}
        </p>
      )}

      <LineSummaryCard
        title="สายกุ้งเป็น"
        emoji="🔵"
        borderCls="border-blue-200"
        headerCls="text-blue-700"
        report={report}
        line="live"
        expenseLineItems={lotExpenses}
      />

      <LineSummaryCard
        title="สายกุ้งตาย"
        emoji="🟠"
        borderCls="border-orange-200"
        headerCls="text-orange-700"
        report={report}
        line="dead"
        expenseLineItems={lotExpenses}
      />

      <div className="bg-red-50 border-2 border-red-100 p-5 rounded-[2rem] shadow-sm">
        <p className="text-sm font-black text-red-800 mb-2">น้ำหนัก — สมดุลมวลล็อต</p>
        <div className="bg-white/80 rounded-xl p-3 space-y-2 text-xs text-slate-700">
          <div className="flex justify-between gap-2">
            <span>รับเข้ารวม (เป็น + ตาย)</span>
            <span className="font-bold">{fmtKg(report.receivedTotalKg)}</span>
          </div>
          <div className="flex justify-between gap-2 text-blue-700">
            <span>− ขายรวม (บิลเป็น + บิลตาย)</span>
            <span className="font-bold">{fmtKg(report.soldTotalKg)}</span>
          </div>
          <div className="flex justify-between gap-2 text-blue-700">
            <span>− คงเหลือในระบบ</span>
            <span className="font-bold">{fmtKg(report.remainingTotalKg)}</span>
          </div>
          {report.pondToDeadKg > 0.01 && (
            <div className="flex justify-between gap-2 text-slate-500 text-[10px] italic">
              <span>ย้ายบ่อ→ตาย (เปลี่ยนประเภท ไม่ใช่สูญหาย)</span>
              <span>{fmtKg(report.pondToDeadKg)}</span>
            </div>
          )}
          <div className="flex justify-between gap-2 pt-2 border-t border-red-200 font-black text-red-800">
            <span>= น้ำหนักสูญเสียรวม</span>
            <span>{fmtKg(report.shrinkageKg)}</span>
          </div>
        </div>

        {report.shrinkageKg > 0.01 && (
          <div className="mt-3 bg-white/60 rounded-xl p-3 space-y-1.5 text-[11px]">
            <p className="font-bold text-slate-600 mb-1">แยกประเภทการสูญเสีย</p>
            {report.unaccountedShrinkageKg > 0.01 && (
              <div className="flex justify-between gap-2 text-red-700 font-bold">
                <span>❓ หายปริศนา (ไม่ได้จด)</span>
                <span>{fmtKg(report.unaccountedShrinkageKg)}</span>
              </div>
            )}
            {report.spoilageKg > 0.01 && (
              <div className="flex justify-between gap-2 text-amber-700">
                <span>📋 เสียหาย/ตัดทิ้ง (จดแล้ว)</span>
                <span className="font-bold">{fmtKg(report.spoilageKg)}</span>
              </div>
            )}
            {report.stockCountKg > 0.01 && (
              <div className="flex justify-between gap-2 text-amber-700">
                <span>📋 ชั่งปิดสต๊อก (จดแล้ว)</span>
                <span className="font-bold">{fmtKg(report.stockCountKg)}</span>
              </div>
            )}
            {report.unaccountedShrinkageKg <= 0.01 && (
              <p className="text-emerald-700 font-bold text-[10px]">
                ✅ กุ้งหายทั้งหมดมีที่มาอธิบายได้ (ไม่มีปริศนา)
              </p>
            )}
          </div>
        )}

        {report.shrinkageBaht > 0.01 && (
          <p className="text-[10px] text-red-600/90 mt-2 leading-relaxed">
            มูลค่าสูญเสียรวมโดยประมาณ
            {' '}
            <strong>{fmtBaht(report.shrinkageBaht)}</strong>
            {' '}
            (ปริศนา {fmtBaht(report.liveWeightLossBaht + report.deadWeightLossBaht)}
            {report.spoilageTotalBaht > 0 ? ` · เสียหาย ${fmtBaht(report.spoilageTotalBaht)}` : ''}
            {report.stockCountBaht > 0 ? ` · ชั่งปิด ${fmtBaht(report.stockCountBaht)}` : ''})
          </p>
        )}
      </div>

      <LotExpensesPanel
        stockBatches={stockBatches}
        lotDateKey={lotDateKey}
        onLotDateKeyChange={setLotDateKey}
        onExpensesChange={setLotExpenses}
      />

      <div className="bg-slate-900 text-white p-5 rounded-[2rem] shadow-lg space-y-3">
        <p className="text-xs font-bold text-cyan-300">สุทธิรวมล็อต</p>

        <div className="flex justify-between items-center text-sm">
          <span className="text-slate-400">สุทธิสายเป็น</span>
          <span className={`font-bold ${report.liveLineNetBaht >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {fmtBaht(report.liveLineNetBaht)}
          </span>
        </div>
        <div className="flex justify-between items-center text-sm">
          <span className="text-slate-400">สุทธิสายตาย</span>
          <span className={`font-bold ${report.deadLineNetBaht >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {fmtBaht(report.deadLineNetBaht)}
          </span>
        </div>

        <div className="flex justify-between items-center text-sm border-t border-slate-700 pt-2">
          <span className="text-slate-300 font-bold">รวมสองสาย</span>
          <span className={`font-black ${report.combinedLineNetBaht >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {fmtBaht(report.combinedLineNetBaht)}
          </span>
        </div>

        {/* รายการหักเพิ่มเติม (ที่จดแล้ว — ไม่รวมอยู่ใน per-line แล้ว) */}
        {report.spoilageTotalBaht > 0 && (
          <div className="flex justify-between items-center text-sm text-amber-300">
            <span>− เสียหาย/ตัดทิ้ง {fmtKg(report.spoilageKg)} (จดแล้ว)</span>
            <span>{fmtBaht(report.spoilageTotalBaht)}</span>
          </div>
        )}
        {report.stockCountBaht > 0 && (
          <div className="flex justify-between items-center text-sm text-amber-300">
            <span>− ชั่งปิดสต๊อก {fmtKg(report.stockCountKg)} (จดแล้ว)</span>
            <span>{fmtBaht(report.stockCountBaht)}</span>
          </div>
        )}

        <div className="pt-3 border-t border-slate-600 flex justify-between items-center">
          <div>
            <p className="font-bold">สุทธิสุดท้าย</p>
            <p className="text-[10px] text-slate-400 mt-0.5">
              กำไร/(ขาดทุน) หลังหักต้นทุนทั้งหมด
            </p>
          </div>
          <p className={`text-2xl font-black ${report.netAfterMisc >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {fmtBaht(report.netAfterMisc)}
          </p>
        </div>
      </div>

      {report.carryForwardTotalKg > 0.001 && (
        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 flex justify-between items-center text-xs">
          <span className="font-bold text-blue-800">ยกยอดไปล็อตถัดไปแล้ว</span>
          <span className="font-black text-blue-700">
            {(report.carryForwardLiveKg + report.carryForwardDeadKg).toFixed(2)} กก.
          </span>
        </div>
      )}

      <details className="bg-white rounded-[2rem] shadow-sm overflow-hidden">
        <summary className="p-4 text-xs font-bold text-slate-500 cursor-pointer">
          รายละเอียดเพิ่ม (ชั่งปิดจริง · ย้ายบ่อ · เสียหายจดแล้ว)
        </summary>
        <div className="px-5 pb-5 space-y-4 border-t border-slate-100">
          <div className="pt-3 space-y-2 text-xs">
            <p className="font-bold text-slate-600">การเคลื่อนไหวที่บันทึกแล้ว</p>
            <p className="flex justify-between">
              <span className="text-slate-500">ย้ายบ่อ → ตาย (เปลี่ยนประเภท)</span>
              <span className="font-bold">{fmtKg(report.pondToDeadKg)}</span>
            </p>
            <p className="flex justify-between">
              <span className="text-slate-500">เสียหาย / ตัดทิ้ง (จดแล้ว)</span>
              <span className="font-bold">{fmtKg(report.spoilageKg)}</span>
            </p>
            {report.stockCountKg > 0 && (
              <p className="flex justify-between">
                <span className="text-slate-500">ชั่งปิดสต๊อก (จดแล้ว)</span>
                <span className="font-bold">{fmtKg(report.stockCountKg)}</span>
              </p>
            )}
            {report.carryForwardTotalKg > 0.001 && (
              <p className="flex justify-between">
                <span className="text-blue-600 font-bold">ยกยอดไปล็อตถัดไป</span>
                <span className="font-bold text-blue-600">{fmtKg(report.carryForwardTotalKg)}</span>
              </p>
            )}
            <p className="flex justify-between">
              <span className="text-slate-500">กุ้งหายปริศนา (ไม่ได้จดไว้)</span>
              <span className={`font-bold ${report.unaccountedShrinkageKg > 0.01 ? 'text-red-600' : 'text-emerald-600'}`}>
                {fmtKg(report.unaccountedShrinkageKg)}
              </span>
            </p>
            <p className="flex justify-between">
              <span className="text-slate-500">คงเหลือในล็อต</span>
              <span className="font-bold">
                {fmtKg(report.remainingTotalKg)}
                {' '}
                (เป็น {report.remainingLive.toFixed(2)} · ตาย {report.remainingDead.toFixed(2)})
              </span>
            </p>
          </div>

          <div className="space-y-3">
            <p className="text-xs font-bold text-slate-600">ชั่งปิดจริง (ก่อนรับล็อตใหม่)</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] font-bold text-slate-500">กุ้งเป็น คงเหลือจริง</label>
                <input
                  type="number"
                  inputMode="decimal"
                  value={countedLive}
                  onChange={(e) => setCountedLive(e.target.value)}
                  placeholder={report.remainingLive > 0.01 ? report.remainingLive.toFixed(2) : '0'}
                  className="w-full mt-1 p-3 bg-slate-50 rounded-xl font-bold text-sm"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-500">กุ้งตาย คงเหลือจริง</label>
                <input
                  type="number"
                  inputMode="decimal"
                  value={countedDead}
                  onChange={(e) => setCountedDead(e.target.value)}
                  placeholder={report.remainingDead.toFixed(2)}
                  className="w-full mt-1 p-3 bg-slate-50 rounded-xl font-bold text-sm"
                />
              </div>
            </div>
            {report.countVarianceKg != null && (
              <p className="text-[11px] text-amber-800 bg-amber-50 rounded-xl p-3">
                ส่วนต่างชั่งจริง vs ระบบ:
                {' '}
                <strong>{report.countVarianceKg.toFixed(2)} กก.</strong>
                {' '}
                (
                {fmtBaht(report.countVarianceBaht)}
                )
              </p>
            )}
          </div>
        </div>
      </details>

      {/* ── ปิดล็อต ─────────────────────────────────────────────────────── */}
      {isAlreadyClosed ? (
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 text-center">
          <p className="text-emerald-700 font-bold text-sm">✅ ล็อตนี้ปิดแล้ว</p>
          <p className="text-emerald-600 text-xs mt-1">ดูผลสุทธิได้ที่แท็บ「ประวัติล็อต」</p>
        </div>
      ) : (
        <div className="bg-white border-2 border-dashed border-slate-300 rounded-[2rem] p-5 space-y-3">
          <div>
            <h3 className="font-black text-slate-800">ปิดล็อตนี้</h3>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">
              บันทึก P&L สุดท้าย · ยอดคงเหลือยกไปล็อตถัดไปอัตโนมัติ
            </p>
          </div>

          {report.remainingTotalKg > 0.001 && (
            <div className="bg-blue-50 rounded-xl p-3 text-xs space-y-2">
              <p className="font-bold text-blue-800">
                คงเหลือที่จะยกไป: เป็น {report.remainingLive.toFixed(2)} + ตาย {report.remainingDead.toFixed(2)} กก.
              </p>
              {lotDays.filter((d) => d.dateKey !== lotDateKey).length > 0 ? (
                <>
                  <label className="text-slate-600 font-bold block">ยกไปล็อต</label>
                  <select
                    value={carryTargetKey || ''}
                    onChange={(e) => setCarryTargetKey(e.target.value || null)}
                    className="w-full p-2.5 bg-white rounded-xl font-bold text-slate-800 outline-none border border-slate-200"
                  >
                    {lotDays
                      .filter((d) => d.dateKey !== lotDateKey)
                      .map((d) => (
                        <option key={d.dateKey} value={d.dateKey}>
                          {d.label}
                        </option>
                      ))}
                  </select>
                </>
              ) : (
                <p className="text-amber-700">
                  ⚠️ ไม่มีล็อตอื่นให้ยก — รับกุ้งล็อตใหม่ก่อน หรือยืนยันเพื่อตัดทิ้งยอดคงเหลือ
                </p>
              )}
            </div>
          )}

          <button
            type="button"
            onClick={handleCloseLot}
            disabled={closingLot || (report.remainingTotalKg > 0.001 && !carryTargetKey && lotDays.filter((d) => d.dateKey !== lotDateKey).length > 0)}
            className="w-full py-3 rounded-2xl bg-slate-900 text-white font-bold text-sm disabled:opacity-50"
          >
            {closingLot ? 'กำลังปิดล็อต...' : `ปิดล็อต ${lotLabel}`}
          </button>
        </div>
      )}
    </div>
  );
}
