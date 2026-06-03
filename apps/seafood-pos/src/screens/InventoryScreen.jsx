import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { dateKeyBangkok, formatViewDateLabel } from '../lib/date';
import { fsQueryStockAdjustments } from '../lib/firestoreRest';
import { batchVisibleOnStockLine } from '../lib/lotCostSplit';
import {
  countReceivesOnDate,
  countReceivesOnDateForLine,
  formatReceiveDayLabel,
  receiveDateKeyOf,
} from '../lib/stockBatchUtils';
import {
  createStockBatchRecord,
  recordDeadSpoilageLoss,
  recordSpoilageLoss,
  transferPondDeath,
} from '../services/stockService';
import DateNavBar from '../components/DateNavBar';
import StockLotTimeline from '../components/StockLotTimeline';
import StockLineSwitcher from '../components/StockLineSwitcher';
import SubTabBar from '../components/SubTabBar';
import { SHRIMP_DAMAGE, STOCK_LINE } from '../constants/stockLines';
import {
  buildBySizeBreakdown,
  calcBySizeShrimpCost,
  missingSizePriceLabel,
  sizeLineCost,
} from '../lib/stockReceiveCost';

const ADJUST_LABELS = {
  pond_to_dead: { title: 'ส่งยอดจากบ่อ (ขายได้)', emoji: '🔄', cls: 'text-red-700 bg-red-50' },
  spoilage_loss: { title: SHRIMP_DAMAGE.full, emoji: '⚠️', cls: 'text-amber-800 bg-amber-50' },
};

const BY_SIZE_RECEIVE_ROWS = [
  { key: 'A', label: 'A ใหญ่', accent: 'text-blue-700 bg-blue-50 border-blue-100' },
  { key: 'B', label: 'B กลาง', accent: 'text-emerald-700 bg-emerald-50 border-emerald-100' },
  { key: 'C', label: 'C เล็ก', accent: 'text-amber-800 bg-amber-50 border-amber-100' },
];

const LIVE_SUB_TABS = [
  { id: 'receive', label: 'รับเข้า', activeClass: 'bg-white text-blue-600 shadow-sm' },
  { id: 'pond', label: 'ในบ่อ → ส่งยอดตาย', activeClass: 'bg-white text-blue-600 shadow-sm' },
  { id: 'lots', label: 'ล็อตกุ้ง', activeClass: 'bg-white text-amber-600 shadow-sm' },
];

const DEAD_SUB_TABS = [
  { id: 'receive', label: 'รับตายตรง', activeClass: 'bg-white text-red-600 shadow-sm' },
  { id: 'spoilage', label: 'กุ้งตายเสียหาย', activeClass: 'bg-white text-amber-700 shadow-sm' },
  { id: 'history', label: 'ประวัติรับ', activeClass: 'bg-white text-red-600 shadow-sm' },
  { id: 'lots', label: 'ล็อตกุ้ง', activeClass: 'bg-white text-amber-600 shadow-sm' },
];

function formatTime(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '—';
  }
}

export default function InventoryScreen({
  stock,
  stockBatches = [],
  updateMainStock,
  onReceived,
  onStockMoved,
  member,
  initialStockLine = 'live',
}) {
  const todayKey = dateKeyBangkok();
  const [stockLine, setStockLine] = useState(initialStockLine);
  const [lotViewDate, setLotViewDate] = useState(todayKey);
  const [historyViewDate, setHistoryViewDate] = useState(todayKey);
  const [tab, setTab] = useState('receive');
  const [rcvLive, setRcvLive] = useState('');
  const [rcvDead, setRcvDead] = useState('');
  const [rcvCost, setRcvCost] = useState('');
  const [rcvTransport, setRcvTransport] = useState('');
  const [rcvNote, setRcvNote] = useState('');
  const [sizeMode, setSizeMode] = useState('mixed');
  const [sizeA, setSizeA] = useState('');
  const [sizeB, setSizeB] = useState('');
  const [sizeC, setSizeC] = useState('');
  const [priceA, setPriceA] = useState('');
  const [priceB, setPriceB] = useState('');
  const [priceC, setPriceC] = useState('');
  const [deadMode, setDeadMode] = useState('pond_to_dead');
  const [deadWeight, setDeadWeight] = useState('');
  const [deadNote, setDeadNote] = useState('');
  const [deadSpoilWeight, setDeadSpoilWeight] = useState('');
  const [deadSpoilNote, setDeadSpoilNote] = useState('');
  const [pondHistory, setPondHistory] = useState([]);
  const [deadInboundHistory, setDeadInboundHistory] = useState([]);
  const [lotPondTransfers, setLotPondTransfers] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const liveKg = parseFloat(rcvLive) || 0;
  const deadKg = parseFloat(rcvDead) || 0;
  const costPerKg = parseFloat(rcvCost) || 0;
  const transport = parseFloat(rcvTransport) || 0;

  const sizeAKg = parseFloat(sizeA) || 0;
  const sizeBKg = parseFloat(sizeB) || 0;
  const sizeCKg = parseFloat(sizeC) || 0;
  const sizeTotalKg = sizeAKg + sizeBKg + sizeCKg;
  /** โหมดแยกไซซ์ — น้ำหนักรวมมาจาก A+B+C (เหมือนบิลหลายบรรทัด) */
  const receiveLiveKg = sizeMode === 'by_size' ? sizeTotalKg : liveKg;

  const bySizeShrimpCost =
    sizeMode === 'by_size'
      ? calcBySizeShrimpCost({
          A: sizeAKg,
          B: sizeBKg,
          C: sizeCKg,
          priceA,
          priceB,
          priceC,
        })
      : 0;
  const lineCostA = sizeLineCost(sizeAKg, priceA);
  const lineCostB = sizeLineCost(sizeBKg, priceB);
  const lineCostC = sizeLineCost(sizeCKg, priceC);

  const bySizeReceiveRows = useMemo(
    () => [
      { key: 'A', label: 'A ใหญ่', kg: sizeA, setKg: setSizeA, price: priceA, setPrice: setPriceA, kgNum: sizeAKg, lineCost: lineCostA },
      { key: 'B', label: 'B กลาง', kg: sizeB, setKg: setSizeB, price: priceB, setPrice: setPriceB, kgNum: sizeBKg, lineCost: lineCostB },
      { key: 'C', label: 'C เล็ก', kg: sizeC, setKg: setSizeC, price: priceC, setPrice: setPriceC, kgNum: sizeCKg, lineCost: lineCostC },
    ],
    [sizeA, sizeB, sizeC, priceA, priceB, priceC, sizeAKg, sizeBKg, sizeCKg, lineCostA, lineCostB, lineCostC],
  );

  const liveReceiveCost =
    sizeMode === 'by_size' ? bySizeShrimpCost + transport : liveKg * costPerKg + transport;
  const liveEffectiveCost = receiveLiveKg > 0 ? liveReceiveCost / receiveLiveKg : 0;

  const deadReceiveCost = deadKg * costPerKg + transport;
  const deadEffectiveCost = deadKg > 0 ? deadReceiveCost / deadKg : 0;

  function buildSizeBreakdown() {
    if (sizeMode === 'mixed') return { mode: 'mixed' };
    return buildBySizeBreakdown({
      A: sizeAKg,
      B: sizeBKg,
      C: sizeCKg,
      priceA,
      priceB,
      priceC,
    });
  }

  const todayReceiveCount = useMemo(
    () => countReceivesOnDate(stockBatches, todayKey),
    [stockBatches, todayKey],
  );

  useEffect(() => {
    onReceived?.();
  }, []);

  useEffect(() => {
    setStockLine(initialStockLine);
    setTab('receive');
  }, [initialStockLine]);

  const handleStockLineChange = (line) => {
    setStockLine(line);
    setTab('receive');
  };

  const lotDateBootstrapped = useRef(false);
  const lotLineTabRef = useRef({ line: stockLine, tab });

  const pickLatestReceiveDateKey = useCallback(() => {
    const latest = [...stockBatches].sort(
      (a, b) => new Date(b.purchaseDate || 0).getTime() - new Date(a.purchaseDate || 0).getTime(),
    )[0];
    return latest ? receiveDateKeyOf(latest) : todayKey;
  }, [stockBatches, todayKey]);

  useEffect(() => {
    if (tab !== 'lots' || stockBatches.length === 0 || lotDateBootstrapped.current) return;
    lotDateBootstrapped.current = true;
    if (countReceivesOnDateForLine(stockBatches, lotViewDate, stockLine) > 0) return;
    setLotViewDate(pickLatestReceiveDateKey());
  }, [tab, stockBatches, lotViewDate, pickLatestReceiveDateKey, stockLine]);

  useEffect(() => {
    if (stockLine !== 'dead' || tab !== 'lots') {
      setLotPondTransfers([]);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const rows = await fsQueryStockAdjustments(lotViewDate);
        if (!cancelled) {
          setLotPondTransfers(rows.filter((r) => r.type === 'pond_to_dead'));
        }
      } catch (e) {
        console.warn('lot pond transfers', e);
        if (!cancelled) setLotPondTransfers([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [stockLine, tab, lotViewDate]);

  useEffect(() => {
    const switched =
      lotLineTabRef.current.line !== stockLine || lotLineTabRef.current.tab !== tab;
    lotLineTabRef.current = { line: stockLine, tab };
    if (tab !== 'lots' || !switched || stockBatches.length === 0) return;
    if (countReceivesOnDateForLine(stockBatches, lotViewDate, stockLine) > 0) return;
    const dateKeys = [
      ...new Set(
        stockBatches
          .filter((b) => batchVisibleOnStockLine(b, stockLine))
          .map((b) => receiveDateKeyOf(b)),
      ),
    ].sort()
      .reverse();
    if (dateKeys[0]) setLotViewDate(dateKeys[0]);
  }, [tab, stockLine, stockBatches, lotViewDate]);

  const loadPondHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const rows = await fsQueryStockAdjustments(historyViewDate);
      setPondHistory(rows.filter((r) => r.type === 'pond_to_dead' || r.type === 'spoilage_loss'));
    } catch (e) {
      console.warn('fsQueryStockAdjustments', e);
      setPondHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  }, [historyViewDate]);

  const loadDeadInboundHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const [adjustRows, batchesOnDay] = await Promise.all([
        fsQueryStockAdjustments(historyViewDate),
        Promise.resolve(
          stockBatches.filter(
            (b) => receiveDateKeyOf(b) === historyViewDate && (parseFloat(b.deadKg) || 0) > 0,
          ),
        ),
      ]);
      const spoilageDead = adjustRows.filter((r) => {
        if (r.type !== 'spoilage_loss') return false;
        return (r.allocations || []).some((a) => (parseFloat(a.deadTaken) || 0) > 0);
      });
      setDeadInboundHistory({
        fromPond: adjustRows.filter((r) => r.type === 'pond_to_dead'),
        spoilageDead,
        directReceives: batchesOnDay,
      });
    } catch (e) {
      console.warn('loadDeadInboundHistory', e);
      setDeadInboundHistory({ fromPond: [], spoilageDead: [], directReceives: [] });
    } finally {
      setHistoryLoading(false);
    }
  }, [historyViewDate, stockBatches]);

  useEffect(() => {
    if (stockLine !== 'live' || tab !== 'pond') return;
    loadPondHistory();
  }, [stockLine, tab, historyViewDate, loadPondHistory]);

  useEffect(() => {
    if (stockLine !== 'dead' || tab !== 'history') return;
    loadDeadInboundHistory();
  }, [stockLine, tab, historyViewDate, loadDeadInboundHistory]);

  useEffect(() => {
    if (stockLine !== 'dead' || tab !== 'spoilage') return;
    loadDeadInboundHistory();
  }, [stockLine, tab, historyViewDate, loadDeadInboundHistory]);

  const resetReceiveFields = () => {
    setRcvLive('');
    setRcvDead('');
    setRcvCost('');
    setRcvTransport('');
    setRcvNote('');
    setSizeMode('mixed');
    setSizeA('');
    setSizeB('');
    setSizeC('');
    setPriceA('');
    setPriceB('');
    setPriceC('');
  };

  const handleReceiveLive = async () => {
    if (receiveLiveKg <= 0) {
      return alert(
        sizeMode === 'by_size'
          ? 'ใส่น้ำหนักแต่ละไซซ์ (A / B / C) ครับ — แต่ละไซซ์กก. ไม่เท่ากันได้'
          : `ใส่น้ำหนัก${STOCK_LINE.live.full} (กก.) ครับ`,
      );
    }
    if (sizeMode === 'mixed' && !rcvCost) return alert('ใส่ราคาซื้อ/กก.ด้วยครับ');
    if (sizeMode === 'by_size') {
      const missing = missingSizePriceLabel({
        A: sizeA,
        B: sizeB,
        C: sizeC,
        priceA,
        priceB,
        priceC,
      });
      if (missing) return alert(`ใส่ราคา/กก. ของไซซ์ ${missing} ด้วยครับ`);
      if (bySizeShrimpCost <= 0) return alert('ใส่กก. และราคา/กก. ของไซซ์ที่รับเข้าครับ');
    }
    setSaving(true);
    try {
      const { grandTotal: savedTotal, effectiveCost: savedCost } = await createStockBatchRecord({
        liveKg: receiveLiveKg,
        deadKg: 0,
        costPerKg:
          sizeMode === 'by_size' && receiveLiveKg > 0 ? bySizeShrimpCost / receiveLiveKg : costPerKg,
        transport,
        note: rcvNote,
        sizeBreakdown: buildSizeBreakdown(),
        shrimpCost: sizeMode === 'by_size' ? bySizeShrimpCost : null,
      });
      await updateMainStock(stock.live + liveKg, stock.dead);
      alert(
        `✅ บันทึกรับเข้า — ${STOCK_LINE.live.full}\n` +
          `${receiveLiveKg.toFixed(3)} กก. · ล็อตวันนี้รวม ${todayReceiveCount + 1} รายการ\n` +
          `ต้นทุน: ฿${savedTotal.toLocaleString()} (฿${savedCost.toFixed(2)}/กก.)`,
      );
      onReceived?.();
      resetReceiveFields();
    } catch (err) {
      console.error(err);
      alert('⚠️ บันทึกไม่สำเร็จ กรุณาลองอีกครั้งครับ');
    } finally {
      setSaving(false);
    }
  };

  const handleReceiveDead = async () => {
    if (!rcvDead || deadKg <= 0) return alert(`ใส่น้ำหนัก${STOCK_LINE.dead.full} (กก.) ครับ`);
    if (!rcvCost) return alert('ใส่ราคาซื้อ/กก.ด้วยครับ');
    setSaving(true);
    try {
      const { grandTotal: savedTotal, effectiveCost: savedCost } = await createStockBatchRecord({
        liveKg: 0,
        deadKg,
        costPerKg,
        transport,
        note: rcvNote,
        sizeBreakdown: { mode: 'mixed' },
      });
      await updateMainStock(stock.live, stock.dead + deadKg);
      alert(
        `✅ บันทึกรับเข้า — ${STOCK_LINE.dead.full} (รับตรง)\n` +
          `${deadKg.toFixed(3)} กก. · ล็อตวันนี้รวม ${todayReceiveCount + 1} รายการ\n` +
          `ต้นทุน: ฿${savedTotal.toLocaleString()} (฿${savedCost.toFixed(2)}/กก.)`,
      );
      onReceived?.();
      resetReceiveFields();
    } catch (err) {
      console.error(err);
      alert('⚠️ บันทึกไม่สำเร็จ กรุณาลองอีกครั้งครับ');
    } finally {
      setSaving(false);
    }
  };

  const formatAllocationLines = (allocations = []) => {
    if (!allocations.length) return '— ไม่มีล็อต (อัปเดตยอดรวมอย่างเดียว)';
    return allocations
      .map((a, i) => {
        const day = formatReceiveDayLabel(a.receiveDateKey);
        const note = a.batchNote ? ` · ${a.batchNote}` : '';
        if (a.deadAdded > 0) {
          return `${i + 1}. ล็อตรับ ${day}${note}: ${STOCK_LINE.live.tag} −${a.liveTaken.toFixed(2)} → ${STOCK_LINE.dead.tag} +${a.deadAdded.toFixed(2)} กก.`;
        }
        if ((a.deadTaken || 0) > 0) {
          return `${i + 1}. ล็อตรับ ${day}${note}: ${SHRIMP_DAMAGE.full} · ${STOCK_LINE.dead.tag} −${a.deadTaken.toFixed(2)} กก.`;
        }
        return `${i + 1}. ล็อตรับ ${day}${note}: ${SHRIMP_DAMAGE.full} · ${STOCK_LINE.live.tag} −${a.liveTaken.toFixed(2)} กก.`;
      })
      .join('\n');
  };

  const handlePondSave = async () => {
    if (!deadWeight) return;
    const w = parseFloat(deadWeight);
    if (!Number.isFinite(w) || w <= 0) return alert('ใส่น้ำหนักครับ');
    if (w > stock.live) return alert(`ยอดมากกว่า${STOCK_LINE.live.label}คงเหลือครับ`);

    const meta = { note: deadNote, recordedBy: member?.name || '' };
    setSaving(true);
    try {
      let allocations = [];
      if (deadMode === 'pond_to_dead') {
        allocations = await transferPondDeath(stock, w, updateMainStock, stockBatches, meta);
        alert(
          `✅ ส่งยอด ${w} กก. จาก ${STOCK_LINE.live.full} → ${STOCK_LINE.dead.full}\n\nหักจากล็อต (เก่าก่อน):\n${formatAllocationLines(allocations)}`,
        );
      } else {
        allocations = await recordSpoilageLoss(stock, w, updateMainStock, stockBatches, meta);
        alert(
          `✅ บันทึก${SHRIMP_DAMAGE.full} ${w} กก. (ไม่เพิ่ม${STOCK_LINE.dead.label})\n\nหักจากล็อต (เก่าก่อน):\n${formatAllocationLines(allocations)}`,
        );
      }
      setDeadWeight('');
      setDeadNote('');
      onStockMoved?.();
      await loadPondHistory();
    } catch (e) {
      console.error(e);
      alert(e?.message || 'บันทึกไม่สำเร็จ');
    } finally {
      setSaving(false);
    }
  };

  const handleDeadSpoilSave = async () => {
    if (!deadSpoilWeight) return;
    const w = parseFloat(deadSpoilWeight);
    if (!Number.isFinite(w) || w <= 0) return alert('ใส่น้ำหนักครับ');
    if (w > stock.dead) return alert(`ยอดมากกว่า${STOCK_LINE.dead.label}คงเหลือครับ`);

    setSaving(true);
    try {
      const allocations = await recordDeadSpoilageLoss(
        stock,
        w,
        updateMainStock,
        stockBatches,
        { note: deadSpoilNote, recordedBy: member?.name || '' },
      );
      alert(
        `✅ บันทึก${SHRIMP_DAMAGE.full} · ${STOCK_LINE.dead.tag} ${w} กก.\n\nหักจากล็อต (เก่าก่อน):\n${formatAllocationLines(allocations)}`,
      );
      setDeadSpoilWeight('');
      setDeadSpoilNote('');
      onStockMoved?.();
      await loadDeadInboundHistory();
    } catch (e) {
      console.error(e);
      alert(e?.message || 'บันทึกไม่สำเร็จ');
    } finally {
      setSaving(false);
    }
  };

  const subTabs = stockLine === 'live' ? LIVE_SUB_TABS : DEAD_SUB_TABS;

  return (
    <div className="p-5 space-y-4">
      <StockLineSwitcher line={stockLine} onChange={handleStockLineChange} />

      <p className="text-[11px] text-slate-500 leading-relaxed px-1">
        {stockLine === 'live'
          ? `${STOCK_LINE.live.full} — รับเข้า · ตัดในบ่อแล้วส่งยอดไป${STOCK_LINE.dead.label} · ขายที่หน้าบันทึกการขาย`
          : `${STOCK_LINE.dead.full} — รับตายตรง · ดูยอดจากบ่อ · ขายที่หน้าบันทึกการขาย`}
      </p>

      <SubTabBar tab={tab} onChange={setTab} items={subTabs} />

      {tab === 'lots' && (
        <StockLotTimeline
          stockBatches={stockBatches}
          stockLine={stockLine}
          viewDate={lotViewDate}
          onViewDateChange={setLotViewDate}
          pondTransfers={stockLine === 'dead' ? lotPondTransfers : []}
        />
      )}

      {stockLine === 'live' && tab === 'receive' && (
        <div className="bg-white p-6 rounded-[2rem] shadow-sm space-y-4">
          <h2 className="font-black text-blue-700 text-xl">รับเข้า — {STOCK_LINE.live.full}</h2>
          <p className="text-xs text-slate-500 leading-relaxed">
            บันทึกลง
            <strong> วันนี้</strong>
            {' '}
            (
            {formatViewDateLabel(todayKey)}
            )
            {' '}
            · ดูย้อนหลังที่แท็บ「ล็อตกุ้ง」
          </p>
          {todayReceiveCount > 0 && (
            <p className="text-[11px] text-blue-700 bg-blue-50 rounded-xl px-3 py-2">
              วันนี้มีรับเข้าแล้ว
              {' '}
              {todayReceiveCount}
              {' '}
              รายการ
            </p>
          )}
          {sizeMode === 'mixed' && (
            <div>
              <label className="text-xs font-bold text-slate-500 mb-1 block">น้ำหนัก {STOCK_LINE.live.full} (กก.)</label>
              <input
                type="number"
                inputMode="decimal"
                value={rcvLive}
                onChange={(e) => setRcvLive(e.target.value)}
                placeholder="0.000"
                className="w-full p-4 bg-blue-50 rounded-2xl outline-none text-2xl font-black text-blue-800 text-center"
              />
            </div>
          )}
          {sizeMode === 'mixed' && (
            <div>
              <label className="text-xs font-bold text-slate-500 mb-1 block">ราคาซื้อ/กก. (฿/กก.)</label>
              <input
                type="number"
                inputMode="decimal"
                value={rcvCost}
                onChange={(e) => setRcvCost(e.target.value)}
                placeholder="0"
                className="w-full p-3 bg-slate-50 rounded-2xl outline-none text-lg font-bold"
              />
            </div>
          )}
          <div>
            <label className="text-xs font-bold text-slate-500 mb-1 block">ค่ารถ (฿)</label>
            <input
              type="number"
              inputMode="decimal"
              value={rcvTransport}
              onChange={(e) => setRcvTransport(e.target.value)}
              placeholder="0"
              className="w-full p-3 bg-slate-50 rounded-2xl outline-none text-lg font-bold"
            />
          </div>
          <div>
            <label className="text-xs font-bold text-slate-500 mb-1 block">หมายเหตุ</label>
            <input
              type="text"
              value={rcvNote}
              onChange={(e) => setRcvNote(e.target.value)}
              placeholder="เช่น รถทะเบียน กข-1234"
              className="w-full p-3 bg-slate-50 rounded-2xl outline-none"
            />
          </div>

          <div className="border border-slate-200 rounded-2xl p-4 space-y-3">
            <p className="text-xs font-bold text-slate-500">ไซต์ {STOCK_LINE.live.label}</p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setSizeMode('mixed')}
                className={`flex-1 py-2 rounded-xl text-xs font-bold border-2 ${
                  sizeMode === 'mixed'
                    ? 'border-blue-400 bg-blue-50 text-blue-700'
                    : 'border-slate-200 text-slate-500'
                }`}
              >
                รวมไซต์
              </button>
              <button
                type="button"
                onClick={() => setSizeMode('by_size')}
                className={`flex-1 py-2 rounded-xl text-xs font-bold border-2 ${
                  sizeMode === 'by_size'
                    ? 'border-emerald-400 bg-emerald-50 text-emerald-700'
                    : 'border-slate-200 text-slate-500'
                }`}
              >
                แยก A / B / C
              </button>
            </div>
            {sizeMode === 'by_size' && (
              <div className="space-y-2">
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  แบบบิลเงินสด — แต่ละไซซ์กก. ไม่เท่ากัน ราคา/กก. ไม่เท่ากัน · ระบบคำนวณจำนวนเงินให้
                </p>
                <div className="rounded-2xl border border-slate-200 overflow-hidden bg-white">
                  <div className="grid grid-cols-[0.55fr_1fr_1fr_1.15fr] gap-1 bg-slate-100 px-2 py-2 text-[10px] font-bold text-slate-500">
                    <span>ไซซ์</span>
                    <span className="text-center">จำนวน (กก.)</span>
                    <span className="text-center">หน่วยละ (฿)</span>
                    <span className="text-right">จำนวนเงิน</span>
                  </div>
                  {bySizeReceiveRows.map((row, i) => {
                    const accent = BY_SIZE_RECEIVE_ROWS[i]?.accent || 'text-slate-700';
                    return (
                      <div
                        key={row.key}
                        className="grid grid-cols-[0.55fr_1fr_1fr_1.15fr] gap-1 items-center px-2 py-2 border-t border-slate-100"
                      >
                        <span className={`text-[11px] font-black leading-tight ${accent.split(' ')[0]}`}>
                          {row.key}
                          <br />
                          <span className="font-bold text-slate-500 text-[10px]">
                            {row.label.replace(/^A |^B |^C /, '')}
                          </span>
                        </span>
                        <input
                          type="number"
                          inputMode="decimal"
                          value={row.kg}
                          onChange={(e) => row.setKg(e.target.value)}
                          placeholder="0"
                          className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg outline-none text-sm font-bold text-center"
                        />
                        <input
                          type="number"
                          inputMode="decimal"
                          value={row.price}
                          onChange={(e) => row.setPrice(e.target.value)}
                          placeholder="0"
                          className="w-full p-2 bg-amber-50 border border-amber-200 rounded-lg outline-none text-sm font-bold text-center"
                        />
                        <p className="text-right text-sm font-black text-amber-900 tabular-nums pr-1">
                          {row.lineCost > 0 ? `฿${row.lineCost.toLocaleString()}` : '—'}
                        </p>
                      </div>
                    );
                  })}
                  <div className="grid grid-cols-2 gap-2 border-t-2 border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-bold">
                    <span className="text-blue-800">รวมน้ำหนัก</span>
                    <span className="text-right text-blue-800 tabular-nums">{sizeTotalKg.toFixed(3)} กก.</span>
                    <span className="text-amber-800">รวมซื้อกุ้ง</span>
                    <span className="text-right text-amber-800 tabular-nums">
                      {bySizeShrimpCost > 0 ? `฿${bySizeShrimpCost.toLocaleString()}` : '—'}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="bg-slate-50 rounded-2xl p-4 space-y-2 border border-slate-200">
            <div className="flex justify-between text-sm text-slate-600">
              <span>น้ำหนัก</span>
              <span className="font-bold">{receiveLiveKg.toFixed(3)} กก.</span>
            </div>
            {sizeMode === 'by_size' &&
              bySizeReceiveRows.map(
                (row) =>
                  row.kgNum > 0 && (
                    <div key={`sum-${row.key}`} className="flex justify-between text-xs text-slate-600">
                      <span>
                        {row.key}
                        {' '}
                        {row.kgNum.toFixed(3)}
                        {' '}
                        กก.
                        {(parseFloat(row.price) || 0) > 0 && (
                          <>
                            {' '}
                            @ ฿
                            {(parseFloat(row.price) || 0).toLocaleString()}
                            /กก.
                          </>
                        )}
                      </span>
                      <span className="font-bold tabular-nums">
                        {row.lineCost > 0 ? `฿${row.lineCost.toLocaleString()}` : '—'}
                      </span>
                    </div>
                  ),
              )}
            {sizeMode === 'by_size' && bySizeShrimpCost > 0 && (
              <div className="flex justify-between text-sm text-slate-600 border-t border-slate-200 pt-2">
                <span>ซื้อกุ้งรวม (A+B+C)</span>
                <span className="font-bold">฿{bySizeShrimpCost.toLocaleString()}</span>
              </div>
            )}
            {transport > 0 && (
              <div className="flex justify-between text-sm text-slate-600">
                <span>ค่ารถ</span>
                <span className="font-bold">฿{transport.toLocaleString()}</span>
              </div>
            )}
            <div className="flex justify-between font-black text-slate-800 text-base border-t border-slate-200 pt-2">
              <span>ต้นทุนทั้งหมด</span>
              <span className="text-blue-600">฿{liveReceiveCost.toLocaleString()}</span>
            </div>
            {liveEffectiveCost > 0 && (
              <div className="flex justify-between text-sm text-emerald-600 font-bold">
                <span>ต้นทุน/กก.</span>
                <span>฿{liveEffectiveCost.toFixed(2)}</span>
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={handleReceiveLive}
            disabled={saving}
            className="w-full bg-blue-600 text-white font-bold py-5 rounded-2xl disabled:opacity-60"
          >
            {saving ? 'กำลังบันทึก...' : `บันทึกรับเข้า — ${STOCK_LINE.live.label}`}
          </button>
        </div>
      )}

      {stockLine === 'live' && tab === 'pond' && (
        <div className="space-y-4">
          <div className="bg-white p-6 rounded-[2rem] shadow-sm space-y-4">
            <h2 className="font-black text-blue-700 text-xl">ในบ่อ — ส่งยอดไประบบตาย</h2>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              ยังอยู่<strong>{STOCK_LINE.live.full}</strong> จนกดบันทึก · หักล็อตเก่าก่อน (FIFO) แล้วส่งยอดไป{STOCK_LINE.dead.full} เมื่อเลือก「ขายได้」
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setDeadMode('pond_to_dead')}
                className={`flex-1 py-2.5 rounded-xl text-xs font-bold border-2 ${
                  deadMode === 'pond_to_dead'
                    ? 'border-red-400 bg-red-50 text-red-700'
                    : 'border-slate-200 text-slate-500'
                }`}
              >
                ส่งยอดขายได้ → ตาย
              </button>
              <button
                type="button"
                onClick={() => setDeadMode('spoilage_loss')}
                className={`flex-1 py-2.5 rounded-xl text-xs font-bold border-2 ${
                  deadMode === 'spoilage_loss'
                    ? 'border-amber-400 bg-amber-50 text-amber-800'
                    : 'border-slate-200 text-slate-500'
                }`}
              >
                {SHRIMP_DAMAGE.full}
                {' '}
                (สายเป็น)
              </button>
            </div>
            <p className="text-[10px] text-slate-400">
              {deadMode === 'pond_to_dead'
                ? `${STOCK_LINE.live.label} ลด · ${STOCK_LINE.dead.label} เพิ่ม (ขายได้)`
                : `${STOCK_LINE.live.label} ลดเท่านั้น · ในบ่อ/สายเป็น — สายตายใช้แท็บ「กุ้งตายเสียหาย」`}
            </p>
            <div className="bg-blue-50 p-4 rounded-2xl">
              <span className="text-sm text-blue-900">
                {STOCK_LINE.live.label} คงเหลือ:{' '}
                <span className="font-black text-xl">{stock.live.toFixed(1)} กก.</span>
              </span>
            </div>
            <input
              type="number"
              inputMode="decimal"
              value={deadWeight}
              onChange={(e) => setDeadWeight(e.target.value)}
              placeholder="0.000"
              className="w-full p-5 bg-white border-2 border-blue-200 text-blue-700 font-black text-3xl text-center rounded-2xl outline-none"
            />
            <input
              type="text"
              value={deadNote}
              onChange={(e) => setDeadNote(e.target.value)}
              placeholder="หมายเหตุ เช่น บ่อ 2"
              className="w-full p-3 bg-slate-50 rounded-2xl outline-none text-sm"
            />
            <button
              type="button"
              onClick={handlePondSave}
              disabled={saving}
              className={`w-full font-bold py-5 rounded-2xl text-white disabled:opacity-60 ${
                deadMode === 'pond_to_dead' ? 'bg-red-500' : 'bg-amber-600'
              }`}
            >
              {saving
                ? 'กำลังบันทึก...'
                : deadMode === 'pond_to_dead'
                  ? 'บันทึก — ส่งยอดไประบบตาย'
                  : `บันทึก — ${SHRIMP_DAMAGE.full}`}
            </button>
          </div>

          <div className="bg-white p-5 rounded-[2rem] shadow-sm">
            <h3 className="font-bold text-slate-800 mb-2">ประวัติในบ่อ — ตามวัน</h3>
            <DateNavBar
              dateKey={historyViewDate}
              onDateChange={setHistoryViewDate}
              subtitle={historyLoading ? 'โหลด...' : `${pondHistory.length} รายการ`}
            />
            {historyLoading ? (
              <p className="text-center text-slate-400 py-6 text-sm">กำลังโหลด...</p>
            ) : pondHistory.length === 0 ? (
              <p className="text-center text-slate-400 py-6 text-sm">
                ไม่มีรายการ
                {' '}
                {formatViewDateLabel(historyViewDate)}
              </p>
            ) : (
              <div className="space-y-3 max-h-[40vh] overflow-y-auto pr-1">
                {pondHistory.map((row) => {
                  const info = ADJUST_LABELS[row.type] || ADJUST_LABELS.pond_to_dead;
                  return (
                    <div key={row.id} className="border border-slate-100 rounded-xl p-3">
                      <div className="flex justify-between items-start gap-2">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${info.cls}`}>
                          {info.emoji} {info.title}
                        </span>
                        <span className="text-[10px] text-slate-400">{formatTime(row.createdAt)}</span>
                      </div>
                      <p className={`font-black text-lg mt-1 ${row.type === 'spoilage_loss' ? 'text-amber-700' : 'text-red-600'}`}>
                        {(parseFloat(row.weightKg) || 0).toFixed(2)} กก.
                      </p>
                      {row.note && <p className="text-xs text-slate-500 mt-0.5">{row.note}</p>}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {stockLine === 'dead' && tab === 'spoilage' && (
        <div className="bg-white p-6 rounded-[2rem] shadow-sm space-y-4">
          <h2 className="font-black text-amber-800 text-xl">
            {SHRIMP_DAMAGE.full}
            {' '}
            ·
            {' '}
            {STOCK_LINE.dead.full}
          </h2>
          <p className="text-xs text-slate-500 leading-relaxed">
            เน่า/ทิ้งในสายตายโดยตรง — หักเฉพาะ{STOCK_LINE.dead.label} ไม่แตะ{STOCK_LINE.live.label}
            {' '}
            (ต่างจากในบ่อที่หักสายเป็น)
          </p>
          <div className="bg-red-50 p-3 rounded-xl text-[11px] text-red-800">
            {STOCK_LINE.dead.label} คงเหลือ:{' '}
            <strong>{stock.dead.toFixed(1)} กก.</strong>
          </div>
          <input
            type="number"
            inputMode="decimal"
            value={deadSpoilWeight}
            onChange={(e) => setDeadSpoilWeight(e.target.value)}
            placeholder="0.000"
            className="w-full p-5 bg-amber-50 border-2 border-amber-200 text-amber-900 font-black text-3xl text-center rounded-2xl outline-none"
          />
          <input
            type="text"
            value={deadSpoilNote}
            onChange={(e) => setDeadSpoilNote(e.target.value)}
            placeholder="หมายเหตุ เช่น เน่าในตลาด"
            className="w-full p-3 bg-slate-50 rounded-2xl outline-none text-sm"
          />
          <button
            type="button"
            onClick={handleDeadSpoilSave}
            disabled={saving}
            className="w-full font-bold py-5 rounded-2xl text-white bg-amber-600 disabled:opacity-60"
          >
            {saving ? 'กำลังบันทึก...' : `บันทึก — ${SHRIMP_DAMAGE.full} (${STOCK_LINE.dead.tag})`}
          </button>
          <div className="border-t border-slate-100 pt-4">
            <h3 className="font-bold text-slate-800 mb-2 text-sm">ประวัติวันนี้ (สายตาย)</h3>
            <DateNavBar
              dateKey={historyViewDate}
              onDateChange={setHistoryViewDate}
              subtitle={historyLoading ? 'โหลด...' : ''}
            />
            {historyLoading ? (
              <p className="text-center text-slate-400 py-4 text-sm">กำลังโหลด...</p>
            ) : (deadInboundHistory.spoilageDead?.length ?? 0) === 0 ? (
              <p className="text-center text-slate-400 py-4 text-sm">ยังไม่มีรายการ</p>
            ) : (
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {deadInboundHistory.spoilageDead.map((row) => (
                  <div key={row.id} className="border border-amber-100 rounded-xl p-3">
                    <p className="text-[10px] font-bold text-amber-800">{SHRIMP_DAMAGE.full}</p>
                    <p className="font-black text-amber-900 text-lg">
                      {(parseFloat(row.weightKg) || 0).toFixed(2)} กก.
                    </p>
                    {row.note && <p className="text-xs text-slate-500">{row.note}</p>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {stockLine === 'dead' && tab === 'receive' && (
        <div className="bg-white p-6 rounded-[2rem] shadow-sm space-y-4">
          <h2 className="font-black text-red-600 text-xl">รับเข้า — {STOCK_LINE.dead.full} (รับตรง)</h2>
          <p className="text-xs text-slate-500 leading-relaxed">
            รับตายจากแหล่งอื่นโดยตรง (ไม่ผ่านบ่อ) · วันนี้ (
            {formatViewDateLabel(todayKey)}
            )
          </p>
          <div className="bg-red-50 p-3 rounded-xl text-[11px] text-red-800">
            {STOCK_LINE.dead.label} คงเหลือ: <strong>{stock.dead.toFixed(1)} กก.</strong>
            {' '}
            · ยอดจากบ่อดูที่แท็บ「ประวัติรับ」
          </div>
          <div>
            <label className="text-xs font-bold text-slate-500 mb-1 block">น้ำหนัก {STOCK_LINE.dead.full} (กก.)</label>
            <input
              type="number"
              inputMode="decimal"
              value={rcvDead}
              onChange={(e) => setRcvDead(e.target.value)}
              placeholder="0.000"
              className="w-full p-4 bg-red-50 rounded-2xl outline-none text-2xl font-black text-red-700 text-center"
            />
          </div>
          <div>
            <label className="text-xs font-bold text-slate-500 mb-1 block">ราคาซื้อ/กก. (฿/กก.)</label>
            <input
              type="number"
              inputMode="decimal"
              value={rcvCost}
              onChange={(e) => setRcvCost(e.target.value)}
              placeholder="0"
              className="w-full p-3 bg-slate-50 rounded-2xl outline-none text-lg font-bold"
            />
          </div>
          <div>
            <label className="text-xs font-bold text-slate-500 mb-1 block">ค่ารถ (฿)</label>
            <input
              type="number"
              inputMode="decimal"
              value={rcvTransport}
              onChange={(e) => setRcvTransport(e.target.value)}
              placeholder="0"
              className="w-full p-3 bg-slate-50 rounded-2xl outline-none text-lg font-bold"
            />
          </div>
          <div>
            <label className="text-xs font-bold text-slate-500 mb-1 block">หมายเหตุ</label>
            <input
              type="text"
              value={rcvNote}
              onChange={(e) => setRcvNote(e.target.value)}
              placeholder="เช่น รับจากแหล่ง X"
              className="w-full p-3 bg-slate-50 rounded-2xl outline-none"
            />
          </div>
          <div className="bg-slate-50 rounded-2xl p-4 space-y-2 border border-slate-200">
            <div className="flex justify-between text-sm text-slate-600">
              <span>น้ำหนัก</span>
              <span className="font-bold">{deadKg.toFixed(3)} กก.</span>
            </div>
            <div className="flex justify-between font-black text-slate-800 text-base border-t border-slate-200 pt-2">
              <span>ต้นทุนทั้งหมด</span>
              <span className="text-red-600">฿{deadReceiveCost.toLocaleString()}</span>
            </div>
            {deadEffectiveCost > 0 && (
              <div className="flex justify-between text-sm text-emerald-600 font-bold">
                <span>ต้นทุน/กก.</span>
                <span>฿{deadEffectiveCost.toFixed(2)}</span>
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={handleReceiveDead}
            disabled={saving}
            className="w-full bg-red-500 text-white font-bold py-5 rounded-2xl disabled:opacity-60"
          >
            {saving ? 'กำลังบันทึก...' : `บันทึกรับเข้า — ${STOCK_LINE.dead.label}`}
          </button>
        </div>
      )}

      {stockLine === 'dead' && tab === 'history' && (
        <div className="bg-white p-5 rounded-[2rem] shadow-sm space-y-4">
          <h3 className="font-bold text-red-700">ประวัติรับ — {STOCK_LINE.dead.label}</h3>
          <p className="text-[11px] text-slate-500">รับตรง + ยอดจากบ่อ ({STOCK_LINE.live.tag})</p>
          <DateNavBar
            dateKey={historyViewDate}
            onDateChange={setHistoryViewDate}
            subtitle={historyLoading ? 'โหลด...' : 'ตามวัน'}
          />
          {historyLoading ? (
            <p className="text-center text-slate-400 py-6 text-sm">กำลังโหลด...</p>
          ) : (
            <div className="space-y-4 max-h-[50vh] overflow-y-auto pr-1">
              {deadInboundHistory.directReceives?.length > 0 && (
                <div>
                  <p className="text-xs font-bold text-slate-500 mb-2">รับตายตรง</p>
                  {deadInboundHistory.directReceives.map((b) => (
                    <div key={b.id} className="border border-red-100 rounded-xl p-3 mb-2">
                      <p className="text-[10px] text-red-600 font-bold">📥 รับตรง</p>
                      <p className="font-black text-red-600 text-lg">
                        {(parseFloat(b.deadKg) || 0).toFixed(2)} กก.
                      </p>
                      {b.note && <p className="text-xs text-slate-500">{b.note}</p>}
                    </div>
                  ))}
                </div>
              )}
              {deadInboundHistory.spoilageDead?.length > 0 && (
                <div>
                  <p className="text-xs font-bold text-slate-500 mb-2">{SHRIMP_DAMAGE.full}</p>
                  {deadInboundHistory.spoilageDead.map((row) => (
                    <div key={row.id} className="border border-amber-100 rounded-xl p-3 mb-2">
                      <p className="text-[10px] font-bold text-amber-800">⚠️ สายตาย</p>
                      <p className="font-black text-amber-900 text-lg">
                        {(parseFloat(row.weightKg) || 0).toFixed(2)} กก.
                      </p>
                      {row.note && <p className="text-xs text-slate-500">{row.note}</p>}
                    </div>
                  ))}
                </div>
              )}
              {deadInboundHistory.fromPond?.length > 0 && (
                <div>
                  <p className="text-xs font-bold text-slate-500 mb-2">ส่งมาจากบ่อ (สายเป็น)</p>
                  {deadInboundHistory.fromPond.map((row) => (
                    <div key={row.id} className="border border-slate-100 rounded-xl p-3 mb-2">
                      <div className="flex justify-between">
                        <span className="text-[10px] font-bold text-red-700 bg-red-50 px-2 py-0.5 rounded-full">
                          🔄 จากบ่อ
                        </span>
                        <span className="text-[10px] text-slate-400">{formatTime(row.createdAt)}</span>
                      </div>
                      <p className="font-black text-red-600 text-lg mt-1">
                        {(parseFloat(row.weightKg) || 0).toFixed(2)} กก.
                      </p>
                      {row.note && <p className="text-xs text-slate-500">{row.note}</p>}
                    </div>
                  ))}
                </div>
              )}
              {!deadInboundHistory.directReceives?.length
                && !deadInboundHistory.fromPond?.length
                && !deadInboundHistory.spoilageDead?.length && (
                <p className="text-center text-slate-400 py-6 text-sm">
                  ไม่มีรายการ
                  {' '}
                  {formatViewDateLabel(historyViewDate)}
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
