import React, { useState } from 'react';
import { PlusCircle } from 'lucide-react';
import {
  customRowsToCartItems,
  emptyCustomLineRow,
  MAX_CUSTOM_LINES,
  previewCustomLineTotal,
} from '../lib/customCartItem';

/** รายการอื่นในบิล — ใต้ปุ่มกุ้งแม่น้ำ · น้ำหนัก + โลละ เหมือนกุ้งเป็น */
export default function PosCustomLinesPanel({ onAddItems }) {
  const [rows, setRows] = useState(
    () => Array.from({ length: MAX_CUSTOM_LINES }, emptyCustomLineRow),
  );

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

  return (
    <div className="px-3 py-2 border-t border-slate-200 bg-slate-50/80">
      <p className="text-[11px] font-bold text-slate-600 mb-1">รายการอื่น (ไม่ใช่กุ้งแม่น้ำ)</p>
      <p className="text-[10px] text-slate-500 mb-2 leading-relaxed">
        อยู่ใต้รายการกุ้ง · กรอกเหมือนกุ้งเป็น (กก. × โลละ) · รวมบิล · ไม่ตัดสต๊อก
      </p>
      <div className="space-y-2.5">
        {rows.map((row, idx) => {
          const lineTotal = previewCustomLineTotal(row);
          return (
            <div key={idx} className="bg-white border border-slate-200 rounded-xl p-2.5 space-y-2">
              <p className="text-[10px] font-bold text-slate-400">รายการ {idx + 1}</p>
              <input
                type="text"
                value={row.label}
                onChange={(e) => updateRow(idx, 'label', e.target.value)}
                placeholder="เช่น แอนตี้โฟม / ปลาหมึก"
                className="w-full p-2 bg-slate-50 rounded-lg text-sm font-bold outline-none"
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
                    className="w-full p-2 bg-slate-50 rounded-lg text-sm font-bold text-center outline-none"
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
                    className="w-full p-2 bg-slate-50 rounded-lg text-sm font-bold text-center outline-none"
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
    </div>
  );
}
