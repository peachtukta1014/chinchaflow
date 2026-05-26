import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { dateKeyBangkok, formatViewDateLabel, shiftDateKey } from '../lib/date';
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

function MetricRow({ label, value, sub, accent }) {
  return (
    <div className="flex justify-between items-start gap-3 py-2 border-b border-slate-100 last:border-0">
      <div className="min-w-0">
        <p className="text-xs text-slate-500">{label}</p>
        {sub && <p className="text-[10px] text-slate-400 mt-0.5">{sub}</p>}
      </div>
      <p className={`text-sm font-black shrink-0 ${accent || 'text-slate-800'}`}>{value}</p>
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
          : 'ไม่พบบิลในช่วงนี้ — ลองกด「สรุปถึงวันนี้」หรือดูแท็บภาพรวม/บัญชีว่ามียอดวันไหน',
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
      setSalesLoadNote('โหลดบิลไม่สำเร็จ — ลองกดรีเฟรชสรุปล็อต');
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

  return (
    <div className="space-y-4">
      <div className="bg-white p-5 rounded-[2rem] shadow-sm space-y-4">
        <div>
          <div className="flex items-start justify-between gap-2">
            <h2 className="font-black text-slate-800 text-lg">สรุปล็อต / ปิดรอบรถ</h2>
            <span className="text-[10px] font-bold text-purple-700 bg-purple-50 px-2 py-1 rounded-lg shrink-0">
              แอดมิน
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1 leading-relaxed">
            ดูภาพรวมล็อตแรก: รับเข้า → ขายได้เงินเท่าไหร่ → ของเสียตัดขาดทุน → สุทธิล็อต
            (บวก/ลบกับผลประกอบการรวม)
          </p>
        </div>

        <div>
          <label className="text-xs font-bold text-slate-500 mb-1 block">ล็อต (วันรับกุ้งเข้า)</label>
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
                  {' '}
                  · รับ
                  {' '}
                  {(d.remainingLive + d.remainingDead).toFixed(0)}
                  {' '}
                  กก.คงเหลือ
                </option>
              ))
            )}
          </select>
        </div>

        <DateNavBar
          dateKey={endDateKey}
          onDateChange={setEndDateKey}
          minDateKey={lotDateKey}
          subtitle={`สรุปถึง ${formatViewDateLabel(endDateKey)} (จากวันรับล็อต)`}
        />

        {endDateKey < todayKey && (
          <button
            type="button"
            onClick={() => setEndDateKey(todayKey)}
            className="w-full py-2.5 rounded-xl bg-emerald-50 text-emerald-800 text-xs font-bold border border-emerald-200"
          >
            รวมยอดขายถึงวันนี้ (
            {formatViewDateLabel(todayKey)}
            )
          </button>
        )}

        <button
          type="button"
          onClick={loadReportData}
          disabled={loading}
          className="w-full py-3 rounded-2xl bg-slate-800 text-white font-bold text-sm disabled:opacity-60"
        >
          {loading ? 'กำลังโหลดยอดขาย...' : 'รีเฟรชสรุปล็อต'}
        </button>
      </div>

      {(report.warnings.hasOtherLotStock || report.warnings.hasNewerLot) && (
        <div className="bg-amber-50 border border-amber-200 text-amber-900 text-xs rounded-2xl p-4 leading-relaxed space-y-1">
          {report.warnings.hasNewerLot && (
            <p>มีล็อตรับเข้าหลังวันนี้แล้ว — ยอดขายในช่วงนี้อาจตัดสต๊อกจากหลายล็อต (FIFO)</p>
          )}
          {report.warnings.hasOtherLotStock && (
            <p>ยังมียอดคงเหลือจากล็อตอื่น — ถ้าปิดเฉพาะล็อตนี้ ให้ดูคงเหลือของวันรับนี้ด้านล่าง</p>
          )}
        </div>
      )}

      <div className="bg-white p-5 rounded-[2rem] shadow-sm">
        <p className="text-xs font-bold text-blue-600 mb-2">
          รถ / ล็อต
          {' '}
          {lotLabel}
        </p>
        <MetricRow
          label="รับเข้ารวม"
          value={fmtKg(report.receivedTotalKg)}
          sub={`เป็น ${report.receivedLive.toFixed(2)} · ตายมากับรถ ${report.receivedDead.toFixed(2)}`}
        />
        <MetricRow
          label="ต้นทุนรวมล็อต"
          value={fmtBaht(report.totalCost)}
          sub={`เฉลี่ย ${report.avgCostPerKg.toFixed(2)} บ./กก.`}
        />
        <MetricRow
          label="ค่ารถ (ตอนรับเข้า)"
          value={report.transportTotal > 0 ? fmtBaht(report.transportTotal) : '—'}
          sub={
            report.transportTotal > 0
              ? `รวมในต้นทุนล็อตแล้ว · ซื้อกุ้ง ~${fmtBaht(report.shrimpPurchaseCost)}`
              : 'ใส่ช่องค่ารถตอนบันทึกรับเข้า (แท็บรับสต๊อก)'
          }
        />
      </div>

      <div className="bg-white p-5 rounded-[2rem] shadow-sm">
        <p className="text-xs font-bold text-emerald-600 mb-2">
          ขายในช่วง
          {' '}
          {formatViewDateLabel(lotDateKey)}
          {' '}
          →
          {' '}
          {formatViewDateLabel(endDateKey)}
          {' '}
          (
          {report.billCount}
          {' '}
          บิล)
        </p>
        <MetricRow label="รายได้รวม" value={fmtBaht(report.revenue)} accent="text-emerald-600" />
        <MetricRow
          label="ขายกุ้งเป็น"
          value={fmtBaht(report.liveRevenue)}
          sub={fmtKg(report.soldLiveKg)}
        />
        <MetricRow
          label="ขายกุ้งตาย"
          value={fmtBaht(report.deadRevenue)}
          sub={fmtKg(report.soldDeadKg)}
        />
        <MetricRow label="น้ำหนักขายรวม" value={fmtKg(report.soldTotalKg)} />
        {report.billCount === 0 && salesLoadNote && (
          <p className="text-[11px] text-amber-800 bg-amber-50 rounded-xl p-3 mt-2 leading-relaxed">
            {salesLoadNote}
          </p>
        )}
      </div>

      <div className="bg-white p-5 rounded-[2rem] shadow-sm">
        <p className="text-xs font-bold text-slate-600 mb-2">การเคลื่อนไหวในล็อต (ที่บันทึกแล้ว)</p>
        <p className="text-[10px] text-slate-400 mb-2 leading-relaxed">
          ย้ายบ่อ→ตาย = ยังอยู่ในกองทุน (รอขายตาย) · ตัดทิ้ง/เสียหาย = ขาดทุนทุนล็อต (ไม่ใช่ยอดขาย)
        </p>
        <MetricRow
          label="ย้ายบ่อ → ตาย (รอขาย)"
          value={fmtKg(report.pondToDeadKg)}
          sub="ไม่นับขาดทุน — ตัดขาดทุนตอนขายตายหรือของเสียเท่านั้น"
        />
        <MetricRow
          label="เสียหาย / ตัดทิ้ง (จดแล้ว)"
          value={fmtKg(report.spoilageKg)}
          sub="รวมใน「ของเสียล็อต」ด้านล่าง"
        />
        <MetricRow
          label="คงเหลือในล็อต (ระบบ)"
          value={fmtKg(report.remainingTotalKg)}
          sub={`เป็น ${report.remainingLive.toFixed(2)} · ตาย ${report.remainingDead.toFixed(2)}`}
        />
      </div>

      <div className="bg-red-50 border border-red-100 p-5 rounded-[2rem] shadow-sm">
        <p className="text-xs font-bold text-red-700 mb-2">กุ้งเสียหาย / หายจากล็อต (ขาดทุนทุนรับเข้า)</p>
        <p className="text-[10px] text-red-600/80 mb-3 leading-relaxed">
          กก. ที่ไม่กลายเป็นรายได้ขาย — ทั้งที่จด「เสียหาย」และที่หายเอง (ปูกิน / เน่าไม่จด)
          {' '}
          · สมดุล: รับเข้า − ขาย − คงเหลือ
        </p>
        <MetricRow label="น้ำหนักขาดทุนรวม" value={fmtKg(report.shrinkageKg)} accent="text-red-700" />
        <MetricRow label="มูลค่าขาดทุน (ทุนล็อต/กก.)" value={fmtBaht(report.shrinkageBaht)} accent="text-red-700" />
        {report.stockCountBaht > 0 && (
          <MetricRow
            label="จากชั่งปิดสต๊อก (บันทึกแล้ว)"
            value={fmtBaht(report.stockCountBaht)}
            accent="text-red-700"
          />
        )}
      </div>

      <LotExpensesPanel
        stockBatches={stockBatches}
        lotDateKey={lotDateKey}
        onLotDateKeyChange={setLotDateKey}
        onExpensesChange={setLotExpenses}
      />

      <div className="bg-slate-900 text-white p-5 rounded-[2rem] shadow-lg space-y-2">
        <p className="text-xs font-bold text-cyan-300">ผลล็อตสุทธิ (คำนวณในแอป)</p>
        <p className="text-[10px] text-slate-400 leading-relaxed">
          รายได้ − ต้นทุนขาย − ของเสีย = กำไรล็อต · หักค่าใช้จ่ายอื่นๆ = สุทธิสุดท้าย
        </p>
        <MetricRow
          label="ต้นทุนของที่ขาย (ประมาณ)"
          value={fmtBaht(report.cogsSold)}
          accent="text-slate-200"
        />
        <MetricRow
          label="กำไรขั้นต้น (รายได้ − ต้นทุนขาย)"
          value={fmtBaht(report.grossProfit)}
          accent={report.grossProfit >= 0 ? 'text-emerald-300' : 'text-red-300'}
        />
        <MetricRow
          label="หักของเสีย / เสียหายล็อต"
          value={`−${fmtBaht(report.totalLossBaht)}`}
          accent="text-red-300"
        />
        <MetricRow
          label="กำไรล็อต (ก่อนหักจิปาถะ)"
          value={fmtBaht(report.netLotProfit)}
          accent={report.netLotProfit >= 0 ? 'text-emerald-300' : 'text-red-300'}
        />
        {report.marketExpensesBaht > 0 && (
          <MetricRow
            label="หักรายจ่ายแผงตลาด"
            value={`−${fmtBaht(report.marketExpensesBaht)}`}
            sub={lotExpenses.marketNote || undefined}
            accent="text-orange-300"
          />
        )}
        {report.pondExpensesBaht > 0 && (
          <MetricRow
            label="หักรายจ่ายบ่อ/ส่งเป็น"
            value={`−${fmtBaht(report.pondExpensesBaht)}`}
            sub={lotExpenses.pondNote || undefined}
            accent="text-blue-300"
          />
        )}
        {report.miscExpensesBaht > 0
          && report.marketExpensesBaht <= 0
          && report.pondExpensesBaht <= 0 && (
          <MetricRow
            label="หักรายจ่ายอื่นๆ"
            value={`−${fmtBaht(report.miscExpensesBaht)}`}
            accent="text-orange-300"
          />
        )}
        <div className="pt-3 mt-2 border-t border-slate-700 flex justify-between items-center">
          <p className="font-bold text-sm">สุทธิสุดท้าย (ล็อตนี้)</p>
          <p className={`text-2xl font-black ${report.netAfterMisc >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {fmtBaht(report.netAfterMisc)}
          </p>
        </div>
        <p className="text-[10px] text-slate-400 leading-relaxed pt-1">
          พนักงานบันทึกขาย/รับเข้า/ย้ายบ่อ/เสียหาย · แอดมินใส่ค่าใช้จ่ายอื่นๆ · ลูกค้าค้างดูแท็บบัญชี
        </p>
      </div>

      <div className="bg-white p-5 rounded-[2rem] shadow-sm space-y-3">
        <p className="text-xs font-bold text-slate-600">ชั่งปิดจริง (เหลือล็อตนี้ ก่อนรับล็อตใหม่)</p>
        <p className="text-[10px] text-slate-400 leading-relaxed">
          ชั่งของที่เหลือจากล็อตนี้ทั้งหมดก่อนเอากุ้งล็อตถัดไปเข้าบ่อ
          {' '}
          — ถ้าในบ่อไม่เหลือกุ้งเป็นแล้ว ใส่
          {' '}
          <strong>เป็น 0</strong>
          {' '}
          (หรือเว้นว่าง) แล้วใส่แค่น้ำหนัก
          <strong>กุ้งตาย</strong>
          ที่เหลือ
        </p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[10px] font-bold text-slate-500">กุ้งเป็น คงเหลือจริง (กก.)</label>
            <input
              type="number"
              inputMode="decimal"
              value={countedLive}
              onChange={(e) => setCountedLive(e.target.value)}
              placeholder={report.remainingLive > 0.01 ? report.remainingLive.toFixed(2) : '0'}
              className="w-full mt-1 p-3 bg-slate-50 rounded-xl font-bold"
            />
          </div>
          <div>
            <label className="text-[10px] font-bold text-slate-500">กุ้งตาย คงเหลือจริง (กก.)</label>
            <input
              type="number"
              inputMode="decimal"
              value={countedDead}
              onChange={(e) => setCountedDead(e.target.value)}
              placeholder={report.remainingDead.toFixed(2)}
              className="w-full mt-1 p-3 bg-slate-50 rounded-xl font-bold"
            />
          </div>
        </div>
        {report.countVarianceKg != null && (
          <div className="bg-amber-50 rounded-xl p-3 text-xs text-amber-900 space-y-1">
            <p>
              ส่วนต่างรวม (ระบบ − ชั่งจริง)
              {' '}
              <strong>{report.countVarianceKg.toFixed(2)} กก.</strong>
              {' '}
              (
              {fmtBaht(report.countVarianceBaht)}
              )
            </p>
            {(Math.abs(report.countVarianceLiveKg) > 0.01 || Math.abs(report.countVarianceDeadKg) > 0.01) && (
              <p className="text-[10px] opacity-90">
                เป็น {report.countVarianceLiveKg.toFixed(2)} กก. · ตาย {report.countVarianceDeadKg.toFixed(2)} กก.
              </p>
            )}
            <p className="text-[10px] mt-1 opacity-80">
              ชั่งจริงน้อยกว่าในแอป = ของหายที่ยังไม่ได้จด · แล้วดู「ของเสียล็อต」ด้านบนเพื่อปิดรอบ
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
