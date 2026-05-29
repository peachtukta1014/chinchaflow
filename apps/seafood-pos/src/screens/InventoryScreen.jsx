import React, { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { dateKeyBangkok, formatViewDateLabel } from '../lib/date';
import { fsQueryStockAdjustments } from '../lib/firestoreRest';
import {
  countReceivesOnDate,
  formatReceiveDayLabel,
  receiveDateKeyOf,
} from '../lib/stockBatchUtils';
import {
  createStockBatchRecord,
  recordSpoilageLoss,
  transferPondDeath,
} from '../services/stockService';
import DateNavBar from '../components/DateNavBar';
import StockLotTimeline from '../components/StockLotTimeline';

const LotExpensesPanel = lazy(() => import('../components/LotExpensesPanel'));

function PanelLoading() {
  return (
    <div className="py-10 text-center text-slate-400 text-sm font-medium">กำลังโหลด...</div>
  );
}

const ADJUST_LABELS = {
  pond_to_dead: { title: 'ย้ายเป็นขายได้', emoji: '🔄', cls: 'text-red-700 bg-red-50' },
  spoilage_loss: { title: 'เสียหายตัดทิ้ง', emoji: '⚠️', cls: 'text-amber-800 bg-amber-50' },
};

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
}) {
  const todayKey = dateKeyBangkok();
  const [lotViewDate, setLotViewDate] = useState(todayKey);
  const [deadViewDate, setDeadViewDate] = useState(todayKey);
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
  const [deadMode, setDeadMode] = useState('pond_to_dead');
  const [deadWeight, setDeadWeight] = useState('');
  const [deadNote, setDeadNote] = useState('');
  const [deadHistory, setDeadHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const liveKg = parseFloat(rcvLive) || 0;
  const deadKg = parseFloat(rcvDead) || 0;
  const costPerKg = parseFloat(rcvCost) || 0;
  const transport = parseFloat(rcvTransport) || 0;
  const shrimpCost = (liveKg + deadKg) * costPerKg;
  const grandTotal = shrimpCost + transport;
  const effectiveCost = (liveKg + deadKg) > 0 ? grandTotal / (liveKg + deadKg) : 0;

  const sizeAKg = parseFloat(sizeA) || 0;
  const sizeBKg = parseFloat(sizeB) || 0;
  const sizeCKg = parseFloat(sizeC) || 0;
  const sizeTotalKg = sizeAKg + sizeBKg + sizeCKg;
  const sizeWarning = sizeMode === 'by_size' && liveKg > 0 && Math.abs(sizeTotalKg - liveKg) > 0.001;

  function buildSizeBreakdown() {
    if (sizeMode === 'mixed') return { mode: 'mixed' };
    return { mode: 'by_size', A: sizeAKg, B: sizeBKg, C: sizeCKg };
  }
  const todayReceiveCount = useMemo(
    () => countReceivesOnDate(stockBatches, todayKey),
    [stockBatches, todayKey],
  );

  useEffect(() => {
    onReceived?.();
  }, []);

  const lotDateBootstrapped = useRef(false);

  const pickLatestReceiveDateKey = useCallback(() => {
    const latest = [...stockBatches].sort(
      (a, b) => new Date(b.purchaseDate || 0).getTime() - new Date(a.purchaseDate || 0).getTime(),
    )[0];
    return latest ? receiveDateKeyOf(latest) : todayKey;
  }, [stockBatches, todayKey]);

  useEffect(() => {
    if (tab !== 'lots' || stockBatches.length === 0 || lotDateBootstrapped.current) return;
    lotDateBootstrapped.current = true;
    if (countReceivesOnDate(stockBatches, lotViewDate) > 0) return;
    setLotViewDate(pickLatestReceiveDateKey());
  }, [tab, stockBatches, lotViewDate, pickLatestReceiveDateKey]);

  const loadDeadHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      setDeadHistory(await fsQueryStockAdjustments(deadViewDate));
    } catch (e) {
      console.warn('fsQueryStockAdjustments', e);
      setDeadHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  }, [deadViewDate]);

  useEffect(() => {
    if (tab !== 'dead') return;
    loadDeadHistory();
  }, [tab, deadViewDate, loadDeadHistory]);

  const handleReceive = async () => {
    if (!rcvLive && !rcvDead) return alert('ใส่น้ำหนักอย่างน้อย 1 ช่องครับ');
    if (!rcvCost) return alert('ใส่ราคาซื้อ/กก.ด้วยครับ');
    if (sizeWarning) return alert(`ยอดรวมไซต์ (${sizeTotalKg.toFixed(3)} กก.) ไม่ตรงกับกุ้งสด (${liveKg.toFixed(3)} กก.) ครับ`);
    setSaving(true);
    try {
      const { grandTotal: savedTotal, effectiveCost: savedCost } = await createStockBatchRecord({
        liveKg,
        deadKg,
        costPerKg,
        transport,
        note: rcvNote,
        sizeBreakdown: buildSizeBreakdown(),
      });
      await updateMainStock(stock.live + liveKg, stock.dead + deadKg);
      alert(
        `✅ บันทึกรายการรับเข้าแล้ว (ล็อตวันนี้รวม ${todayReceiveCount + 1} รายการ)\n` +
          `ต้นทุน: ฿${savedTotal.toLocaleString()} (฿${savedCost.toFixed(2)}/กก.)`,
      );
      onReceived?.();
      setRcvLive('');
      setRcvDead('');
      setRcvCost('');
      setRcvTransport('');
      setRcvNote('');
      setSizeMode('mixed');
      setSizeA('');
      setSizeB('');
      setSizeC('');
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
          return `${i + 1}. ล็อตรับ ${day}${note}: เป็น −${a.liveTaken.toFixed(2)} → ตาย +${a.deadAdded.toFixed(2)} กก.`;
        }
        return `${i + 1}. ล็อตรับ ${day}${note}: ตัดทิ้ง ${a.liveTaken.toFixed(2)} กก.`;
      })
      .join('\n');
  };

  const handleDeadSave = async () => {
    if (!deadWeight) return;
    const w = parseFloat(deadWeight);
    if (!Number.isFinite(w) || w <= 0) return alert('ใส่น้ำหนักครับ');
    if (w > stock.live) return alert('ยอดมากกว่ากุ้งเป็นคงเหลือครับ');

    const meta = { note: deadNote, recordedBy: member?.name || '' };
    setSaving(true);
    try {
      let allocations = [];
      if (deadMode === 'pond_to_dead') {
        allocations = await transferPondDeath(stock, w, updateMainStock, stockBatches, meta);
        alert(
          `✅ ย้าย ${w} กก. จากกุ้งเป็น → กุ้งตาย (ขายได้)\n\nหักจากล็อต (เก่าก่อน):\n${formatAllocationLines(allocations)}`,
        );
      } else {
        allocations = await recordSpoilageLoss(stock, w, updateMainStock, stockBatches, meta);
        alert(
          `✅ บันทึกเสียหาย ${w} กก. (ไม่เพิ่มกุ้งตายขาย)\n\nหักจากล็อต (เก่าก่อน):\n${formatAllocationLines(allocations)}`,
        );
      }
      setDeadWeight('');
      setDeadNote('');
      onStockMoved?.();
      await loadDeadHistory();
    } catch (e) {
      console.error(e);
      alert(e?.message || 'บันทึกไม่สำเร็จ');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-5 space-y-5">
      <div className="flex flex-wrap bg-slate-200 p-1.5 rounded-2xl gap-1">
        <button
          type="button"
          onClick={() => setTab('receive')}
          className={`flex-1 min-w-[4.5rem] py-3 font-bold text-xs rounded-xl ${tab === 'receive' ? 'bg-white text-blue-600' : 'text-slate-500'}`}
        >
          รับกุ้งเข้า
        </button>
        <button
          type="button"
          onClick={() => setTab('dead')}
          className={`flex-1 min-w-[4.5rem] py-3 font-bold text-xs rounded-xl ${tab === 'dead' ? 'bg-white text-red-600' : 'text-slate-500'}`}
        >
          กุ้งตายในบ่อ
        </button>
        <button
          type="button"
          onClick={() => setTab('expenses')}
          className={`flex-1 min-w-[4.5rem] py-3 font-bold text-xs rounded-xl ${tab === 'expenses' ? 'bg-white text-violet-600' : 'text-slate-500'}`}
        >
          รายจ่าย
        </button>
        <button
          type="button"
          onClick={() => setTab('lots')}
          className={`flex-1 min-w-[4.5rem] py-3 font-bold text-xs rounded-xl ${tab === 'lots' ? 'bg-white text-amber-600' : 'text-slate-500'}`}
        >
          ล็อตกุ้ง
        </button>
      </div>

      {tab === 'expenses' && (
        <Suspense fallback={<PanelLoading />}>
          <LotExpensesPanel stockBatches={stockBatches} standalone />
        </Suspense>
      )}

      {tab === 'lots' && (
        <StockLotTimeline
          stockBatches={stockBatches}
          viewDate={lotViewDate}
          onViewDateChange={setLotViewDate}
        />
      )}

      {tab === 'receive' && (
        <div className="bg-white p-6 rounded-[2rem] shadow-sm space-y-4">
          <h2 className="font-black text-slate-800 text-xl">บันทึกรายการรับเข้า</h2>
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
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-slate-500 mb-1 block">น้ำหนักกุ้งสด (กก.)</label>
              <input
                type="number"
                inputMode="decimal"
                value={rcvLive}
                onChange={(e) => setRcvLive(e.target.value)}
                placeholder="0.000"
                className="w-full p-3 bg-slate-50 rounded-2xl outline-none text-lg font-bold"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-500 mb-1 block">น้ำหนักกุ้งตาย (กก.)</label>
              <input
                type="number"
                inputMode="decimal"
                value={rcvDead}
                onChange={(e) => setRcvDead(e.target.value)}
                placeholder="0.000"
                className="w-full p-3 bg-slate-50 rounded-2xl outline-none text-lg font-bold"
              />
            </div>
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
              placeholder="เช่น รถทะเบียน กข-1234"
              className="w-full p-3 bg-slate-50 rounded-2xl outline-none"
            />
          </div>

          {/* ── ไซต์กุ้ง ── */}
          <div className="border border-slate-200 rounded-2xl p-4 space-y-3">
            <p className="text-xs font-bold text-slate-500">ไซต์กุ้งสด</p>
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
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { label: 'A ใหญ่ (กก.)', val: sizeA, set: setSizeA },
                    { label: 'B กลาง (กก.)', val: sizeB, set: setSizeB },
                    { label: 'C เล็ก (กก.)', val: sizeC, set: setSizeC },
                  ].map(({ label, val, set }) => (
                    <div key={label}>
                      <label className="text-[10px] font-bold text-slate-400 mb-1 block">{label}</label>
                      <input
                        type="number"
                        inputMode="decimal"
                        value={val}
                        onChange={(e) => set(e.target.value)}
                        placeholder="0.000"
                        className="w-full p-2 bg-white border border-slate-200 rounded-xl outline-none text-sm font-bold text-center"
                      />
                    </div>
                  ))}
                </div>
                <div className={`flex justify-between text-xs font-bold px-1 ${sizeWarning ? 'text-red-600' : 'text-emerald-600'}`}>
                  <span>รวม A+B+C</span>
                  <span>
                    {sizeTotalKg.toFixed(3)} กก.
                    {sizeWarning && ` ≠ ${liveKg.toFixed(3)} กก. (กุ้งสด)`}
                  </span>
                </div>
              </div>
            )}
          </div>

          <div className="bg-slate-50 rounded-2xl p-4 space-y-2 border border-slate-200">
            <div className="flex justify-between text-sm text-slate-600">
              <span>น้ำหนักรวม</span>
              <span className="font-bold">{(liveKg + deadKg).toFixed(3)} กก.</span>
            </div>
            <div className="flex justify-between text-sm text-slate-600">
              <span>ค่ากุ้ง</span>
              <span className="font-bold">฿{shrimpCost.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-sm text-slate-600">
              <span>ค่ารถ</span>
              <span className="font-bold">฿{transport.toLocaleString()}</span>
            </div>
            <div className="flex justify-between font-black text-slate-800 text-base border-t border-slate-200 pt-2">
              <span>ต้นทุนทั้งหมด</span>
              <span className="text-blue-600">฿{grandTotal.toLocaleString()}</span>
            </div>
            {effectiveCost > 0 && (
              <div className="flex justify-between text-sm text-emerald-600 font-bold">
                <span>ต้นทุนจริง/กก. (FIFO)</span>
                <span>฿{effectiveCost.toFixed(2)}</span>
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={handleReceive}
            disabled={saving}
            className="w-full bg-slate-800 text-white font-bold py-5 rounded-2xl disabled:opacity-60"
          >
            {saving ? 'กำลังบันทึก...' : 'บันทึกรายการรับเข้า'}
          </button>
        </div>
      )}

      {tab === 'dead' && (
        <div className="space-y-4">
          <div className="bg-white p-6 rounded-[2rem] shadow-sm space-y-4">
            <h2 className="font-black text-red-600 text-xl">บันทึกกุ้งจากบ่อ</h2>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              ระบบหักจาก<strong>ล็อตรับเข้าเก่าก่อน</strong> (FIFO) แล้วบันทึกประวัติว่าหักวันรับไหน — ไม่ต้องเดาว่ามาจากล็อตไหน
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
                ย้ายเป็นขายได้
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
                เสียหายตัดทิ้ง
              </button>
            </div>
            <p className="text-[10px] text-slate-400">
              {deadMode === 'pond_to_dead'
                ? 'กุ้งเป็นลด · กุ้งตายเพิ่ม (นำไปขายได้)'
                : 'กุ้งเป็นลดเท่านั้น · ไม่เพิ่มกุ้งตายขาย (เน่า/เสียหาย)'}
            </p>
            <div className="bg-red-50 p-4 rounded-2xl">
              <span className="text-sm text-red-800">
                กุ้งเป็นคงเหลือ:{' '}
                <span className="font-black text-xl">{stock.live.toFixed(1)} กก.</span>
              </span>
            </div>
            <input
              type="number"
              inputMode="decimal"
              value={deadWeight}
              onChange={(e) => setDeadWeight(e.target.value)}
              placeholder="0.000"
              className="w-full p-5 bg-white border-2 border-red-200 text-red-600 font-black text-3xl text-center rounded-2xl outline-none"
            />
            <input
              type="text"
              value={deadNote}
              onChange={(e) => setDeadNote(e.target.value)}
              placeholder="หมายเหตุ เช่น บ่อ 2 / เน่าหลังรับเข้า"
              className="w-full p-3 bg-slate-50 rounded-2xl outline-none text-sm"
            />
            <button
              type="button"
              onClick={handleDeadSave}
              disabled={saving}
              className={`w-full font-bold py-5 rounded-2xl text-white disabled:opacity-60 ${
                deadMode === 'pond_to_dead' ? 'bg-red-500' : 'bg-amber-600'
              }`}
            >
              {saving ? 'กำลังบันทึก...' : deadMode === 'pond_to_dead' ? 'บันทึกย้ายเป็นขายได้' : 'บันทึกเสียหายตัดทิ้ง'}
            </button>
          </div>

          <div className="bg-white p-5 rounded-[2rem] shadow-sm">
            <h3 className="font-bold text-slate-800 mb-2">ประวัติรายการ — ตามวัน</h3>
            <DateNavBar
              dateKey={deadViewDate}
              onDateChange={setDeadViewDate}
              subtitle={historyLoading ? 'โหลด...' : `${deadHistory.length} รายการ`}
            />
            {historyLoading ? (
              <p className="text-center text-slate-400 py-6 text-sm">กำลังโหลด...</p>
            ) : deadHistory.length === 0 ? (
              <p className="text-center text-slate-400 py-6 text-sm">
                ไม่มีรายการ
                {' '}
                {formatViewDateLabel(deadViewDate)}
              </p>
            ) : (
              <div className="space-y-3 max-h-[40vh] overflow-y-auto pr-1">
                {deadHistory.map((row) => {
                  const info = ADJUST_LABELS[row.type] || ADJUST_LABELS.pond_to_dead;
                  return (
                    <div key={row.id} className="border border-slate-100 rounded-xl p-3">
                      <div className="flex justify-between items-start gap-2">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${info.cls}`}>
                          {info.emoji} {info.title}
                        </span>
                        <span className="text-[10px] text-slate-400">{formatTime(row.createdAt)}</span>
                      </div>
                      <p className="font-black text-red-600 text-lg mt-1">
                        {(parseFloat(row.weightKg) || 0).toFixed(2)} กก.
                      </p>
                      {row.note && <p className="text-xs text-slate-500 mt-0.5">{row.note}</p>}
                      {(row.allocations || []).length > 0 && (
                        <ul className="mt-2 space-y-1 text-[10px] text-slate-600">
                          {row.allocations.map((a, idx) => (
                            <li key={`${row.id}-${idx}`}>
                              · ล็อตรับ {formatReceiveDayLabel(a.receiveDateKey)}
                              {a.batchNote ? ` (${a.batchNote})` : ''}
                              {' — '}
                              {a.deadAdded > 0
                                ? `เป็น −${a.liveTaken?.toFixed?.(2) ?? a.liveTaken} → ตาย +${a.deadAdded?.toFixed?.(2) ?? a.deadAdded} กก.`
                                : `ตัดทิ้ง ${a.liveTaken?.toFixed?.(2) ?? a.liveTaken} กก.`}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
