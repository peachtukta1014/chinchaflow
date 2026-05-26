import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { dateKeyBangkok, formatViewDateLabel } from '../lib/date';
import { formatReceiveDayLabel, groupBatchesByReceiveDay } from '../lib/stockBatchUtils';
import { computeLotReport } from '../lib/lotReport';
import {
  fsListStockAdjustments,
  fsQuerySalesBetween,
} from '../lib/firestoreRest';
import DateNavBar from './DateNavBar';
import LotExpensesPanel from './LotExpensesPanel';

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
        <StepRow label={expenseLabel} value={fmtBaht(expenses)} sign="minus" />
      )}
      {weightLossKg > 0.01 && (
        <StepRow
          label={`กุ้งหาย (ส่วนสายนี้ ${weightLossKg.toFixed(2)} กก.)`}
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

export default function LotReportPanel({ stockBatches = [], active = true }) {
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
  const [lotExpenses, setLotExpenses] = useState({
    marketExpenses: 0,
    marketNote: '',
    pondExpenses: 0,
    pondNote: '',
  });

  useEffect(() => {
    if (lotDays.some((d) => d.dateKey === lotDateKey)) return;
    if (defaultLotKey) setLotDateKey(defaultLotKey);
  }, [lotDays, lotDateKey, defaultLotKey]);

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
        <p className="font-bold text-cyan-300 text-xs">อ่านง่ายๆ — ล็อต {lotLabel}</p>
        <p>
          <strong className="text-white">เงิน:</strong>
          {' '}
          ขายได้ − ต้นทุนขาย − รายจ่ายสาย = สุทธิแต่ละสาย → รวมสองสาย
        </p>
        <p>
          <strong className="text-white">น้ำหนัก:</strong>
          {' '}
          รับรวม (เป็น+ตาย) − ขาย − คงเหลือ = กุ้งหาย
          {' '}
          · ย้ายบ่อ→ตายไม่นับเป็นหาย
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
      />

      <LineSummaryCard
        title="สายกุ้งตาย"
        emoji="🟠"
        borderCls="border-orange-200"
        headerCls="text-orange-700"
        report={report}
        line="dead"
      />

      <div className="bg-red-50 border-2 border-red-100 p-5 rounded-[2rem] shadow-sm">
        <p className="text-sm font-black text-red-800 mb-2">น้ำหนัก — กุ้งหายจากล็อต</p>
        <div className="bg-white/80 rounded-xl p-3 space-y-2 text-xs text-slate-700">
          <div className="flex justify-between gap-2">
            <span>รับเข้ารวม (เป็น + ตาย)</span>
            <span className="font-bold">{fmtKg(report.receivedTotalKg)}</span>
          </div>
          <div className="flex justify-between gap-2 text-red-700">
            <span>− ขายรวม (บิลเป็น + บิลตาย)</span>
            <span className="font-bold">{fmtKg(report.soldTotalKg)}</span>
          </div>
          <div className="flex justify-between gap-2 text-red-700">
            <span>− คงเหลือในระบบ</span>
            <span className="font-bold">{fmtKg(report.remainingTotalKg)}</span>
          </div>
          <div className="flex justify-between gap-2 pt-2 border-t border-red-200 font-black text-red-800">
            <span>= กุ้งหาย</span>
            <span>{fmtKg(report.shrinkageKg)}</span>
          </div>
        </div>
        <p className="text-[10px] text-red-600/90 mt-3 leading-relaxed">
          มูลค่าขาดทุนโดยประมาณ
          {' '}
          <strong>{fmtBaht(report.shrinkageBaht)}</strong>
          {report.pondToDeadKg > 0.01 && (
            <>
              {' '}
              · ย้ายบ่อ→ตาย
              {' '}
              {fmtKg(report.pondToDeadKg)}
              {' '}
              (ไม่นับเป็นหาย)
            </>
          )}
        </p>
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
        {report.stockCountBaht > 0 && (
          <div className="flex justify-between items-center text-sm text-red-300">
            <span>หักชั่งปิดสต๊อก (บันทึกแล้ว)</span>
            <span>−{fmtBaht(report.stockCountBaht)}</span>
          </div>
        )}
        <div className="pt-3 border-t border-slate-600 flex justify-between items-center">
          <p className="font-bold">สุทธิสุดท้าย</p>
          <p className={`text-2xl font-black ${report.netAfterMisc >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {fmtBaht(report.netAfterMisc)}
          </p>
        </div>
      </div>

      <details className="bg-white rounded-[2rem] shadow-sm overflow-hidden">
        <summary className="p-4 text-xs font-bold text-slate-500 cursor-pointer">
          รายละเอียดเพิ่ม (ชั่งปิดจริง · ย้ายบ่อ · เสียหายจดแล้ว)
        </summary>
        <div className="px-5 pb-5 space-y-4 border-t border-slate-100">
          <div className="pt-3 space-y-2 text-xs">
            <p className="font-bold text-slate-600">การเคลื่อนไหวที่บันทึกแล้ว</p>
            <p className="flex justify-between">
              <span className="text-slate-500">ย้ายบ่อ → ตาย</span>
              <span className="font-bold">{fmtKg(report.pondToDeadKg)}</span>
            </p>
            <p className="flex justify-between">
              <span className="text-slate-500">เสียหาย / ตัดทิ้ง (จดแล้ว)</span>
              <span className="font-bold">{fmtKg(report.spoilageKg)}</span>
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
    </div>
  );
}
