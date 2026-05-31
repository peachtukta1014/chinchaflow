import React, { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, PlusCircle } from 'lucide-react';
import {
  customRowsToCartItems,
  emptyCustomLineRow,
  MAX_CUSTOM_LINES,
  previewCustomLineTotal,
} from '../lib/customCartItem';

const EXPANDED_KEY = 'pos-custom-lines-expanded';

function readExpandedPreference() {
  try {
    return localStorage.getItem(EXPANDED_KEY) === '1';
  } catch {
    return false;
  }
}

/** รายการอื่นในบิล — พับได้ · วางใต้แป้นบันทึกหลัก */
export default function PosCustomLinesPanel({ onAddItems, defaultExpanded = false }) {
  const [open, setOpen] = useState(() => readExpandedPreference() || defaultExpanded);
  const [rows, setRows] = useState(
    () => Array.from({ length: MAX_CUSTOM_LINES }, emptyCustomLineRow),
  );

  useEffect(() => {
    try {
      localStorage.setItem(EXPANDED_KEY, open ? '1' : '0');
    } catch {
      /* ignore */
    }
  }, [open]);

  const updateRow = (idx, field, value) => {
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, [field]: value } : r)));
  };

  const handleAdd = () => {
    const items = customRowsToCartItems(rows);
    if (items.length === 0) {
      alert('กรอกชื่อรายการ + น้ำหนัก (กก.) + ราคา/กก. อย่างน้อย 1 แถวครับ');
      return;
    }
    onAddItems(items);
    setRows(Array.from({ length: MAX_CUSTOM_LINES }, emptyCustomLineRow));
  };

  const filledCount = rows.filter((r) => {
    const w = parseFloat(r.weight);
    const p = parseFloat(r.pricePerKg);
    return String(r.label || '').trim() && Number.isFinite(w) && w > 0 && Number.isFinite(p) && p > 0;
  }).length;

  return (
    <div className="mt-4 pt-3 border-t border-slate-200">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-2 py-2 px-1 text-left rounded-xl active:bg-slate-50"
        aria-expanded={open}
      >
        <div className="min-w-0">
          <p className="text-[11px] font-bold text-slate-700">รายการอื่น (ไม่ใช่กุ้งแม่น้ำ)</p>
          <p className="text-[10px] text-slate-500 leading-relaxed">
            {open
              ? 'กก. × โลละ · รวมบิล · ไม่ตัดสต๊อก · สูงสุด 3 แถว'
              : 'แตะเพื่อเปิด · กรอกใต้แป้นบันทึกหลัก'}
            {!open && filledCount > 0 && (
              <span className="ml-1 text-emerald-700 font-bold">· พร้อมเพิ่ม {filledCount} รายการ</span>
            )}
          </p>
        </div>
        {open ? (
          <ChevronUp className="text-slate-400 shrink-0" size={20} />
        ) : (
          <ChevronDown className="text-slate-400 shrink-0" size={20} />
        )}
      </button>

      {open && (
        <>
          <div className="space-y-2.5 mt-2 max-h-[min(42vh,320px)] overflow-y-auto">
            {rows.map((row, idx) => {
              const lineTotal = previewCustomLineTotal(row);
              return (
                <div key={idx} className="bg-slate-50 border border-slate-200 rounded-xl p-2.5 space-y-2">
                  <p className="text-[10px] font-bold text-slate-400">รายการ {idx + 1}</p>
                  <input
                    type="text"
                    value={row.label}
                    onChange={(e) => updateRow(idx, 'label', e.target.value)}
                    placeholder="เช่น แอนตี้โฟม / ปลาหมึก"
                    className="w-full p-2 bg-white rounded-lg text-sm font-bold outline-none border border-slate-100"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[9px] font-bold text-slate-400 block mb-0.5">น้ำหนัก (กก.)</label>
                      <input
                        type="number"
                        inputMode="decimal"
                        value={row.weight}
                        onChange={(e) => updateRow(idx, 'weight', e.target.value)}
                        placeholder="0.000"
                        className="w-full p-2 bg-white rounded-lg text-sm font-bold text-center outline-none border border-slate-100"
                      />
                    </div>
                    <div>
                      <label className="text-[9px] font-bold text-slate-400 block mb-0.5">โลละ (฿/กก.)</label>
                      <input
                        type="number"
                        inputMode="decimal"
                        value={row.pricePerKg}
                        onChange={(e) => updateRow(idx, 'pricePerKg', e.target.value)}
                        placeholder="0"
                        className="w-full p-2 bg-white rounded-lg text-sm font-bold text-center outline-none border border-slate-100"
                      />
                    </div>
                  </div>
                  {lineTotal > 0 && (
                    <p className="text-[10px] text-right font-bold text-emerald-700">
                      = ฿{lineTotal.toLocaleString()}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
          <button
            type="button"
            onClick={handleAdd}
            className="w-full mt-2 py-2.5 rounded-xl bg-slate-800 text-white font-bold text-xs flex items-center justify-center gap-2"
          >
            <PlusCircle size={16} />
            เพิ่มรายการที่กรอกแล้ว
          </button>
        </>
      )}
    </div>
  );
}
