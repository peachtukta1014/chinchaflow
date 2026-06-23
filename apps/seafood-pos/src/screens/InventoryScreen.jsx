import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { dateKeyBangkok } from '../lib/date';
import { fsQueryStockAdjustments } from '../lib/firestoreRest';
import { batchVisibleOnStockLine } from '../lib/lotCostSplit';
import {
  countReceivesOnDate,
  countReceivesOnDateForLine,
  receiveDateKeyOf,
} from '../lib/stockBatchUtils';
import StockLineSwitcher from '../components/StockLineSwitcher';
import SubTabBar from '../components/SubTabBar';
import { STOCK_LINE } from '../constants/stockLines';
import StockFilter from './StockFilter';
import StockBatchList from './StockBatchList';

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
  const [pondHistory, setPondHistory] = useState([]);
  const [deadInboundHistory, setDeadInboundHistory] = useState([]);
  const [lotPondTransfers, setLotPondTransfers] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

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

      <StockFilter
        stock={stock}
        stockLine={stockLine}
        tab={tab}
        todayKey={todayKey}
        todayReceiveCount={todayReceiveCount}
        stockBatches={stockBatches}
        updateMainStock={updateMainStock}
        onReceived={onReceived}
        onStockMoved={onStockMoved}
        loadPondHistory={loadPondHistory}
        loadDeadInboundHistory={loadDeadInboundHistory}
        member={member}
        pondHistory={pondHistory}
        historyLoading={historyLoading}
        historyViewDate={historyViewDate}
        setHistoryViewDate={setHistoryViewDate}
        deadInboundHistory={deadInboundHistory}
      />

      <StockBatchList
        stockBatches={stockBatches}
        stockLine={stockLine}
        tab={tab}
        lotViewDate={lotViewDate}
        setLotViewDate={setLotViewDate}
        lotPondTransfers={lotPondTransfers}
        deadInboundHistory={deadInboundHistory}
        historyLoading={historyLoading}
        historyViewDate={historyViewDate}
        setHistoryViewDate={setHistoryViewDate}
      />
    </div>
  );
}
