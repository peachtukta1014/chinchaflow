import React, { useState } from 'react';
import { PlusCircle } from 'lucide-react';
import {
  customRowsToCartItems,
  emptyCustomLineRow,
  MAX_CUSTOM_LINES,
} from '../lib/customCartItem';

/** รายการอื่นในบิล (ไม่ใช่กุ้งแม่น้ำ) — สูงสุด 3 แถว */
export default function PosCustomLinesPanel({ onAddItems }) {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState(
    () => Array.from({ length: MAX_CUSTOM_LINES }, emptyCustomLineRow),
  );

  const updateRow = (idx, field, value) => {
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, [field]: value } : r)));
  };

  const handleAdd = () => {
    const items = customRowsToCartItems(rows);
    if (items.length === 0) {
      alert('กรอกชื่อรายการและราคา (฿) อย่างน้อย 1 แถวครับ');
      return;
    }
    onAddItems(items);
    setRows(Array.from({ length: MAX_CUSTOM_LINES }, emptyCustomLineRow));
    setOpen(false);
  };

  return (
    <div className="px-3 pb-2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full py-2.5 rounded-xl border-2 border-dashed border-slate-300 text-slate-600 text-xs font-bold bg-white"
      >
        {open ? '▲ ซ่อนรายการอื่น' : '▼ รายการอื่น (ไม่ใช่กุ้งแม่น้ำ) — สูงสุด 3 รายการ'}
      </button>
      {open && (
        <div className="mt-2 bg-white border border-slate-200 rounded-2xl p-3 space-y-3 shadow-sm">
          <p className="text-[10px] text-slate-500 leading-relaxed">
            กรอกชื่อสิ่งที่ส่ง + ราคา (฿) · รวมในยอดบิลลูกค้าปกติ · ไม่ตัดสต๊อกกุ้งแม่น้ำ
          </p>
          {rows.map((row, idx) => (
            <div key={idx} className="space-y-1.5">
              <p className="text-[10px] font-bold text-slate-400">รายการ {idx + 1}</p>
              <input
                type="text"
                value={row.label}
                onChange={(e) => updateRow(idx, 'label', e.target.value)}
                placeholder="เช่น ปลาหมึก / ค่าขนส่งพิเศษ"
                className="w-full p-2.5 bg-slate-50 rounded-xl text-sm font-bold outline-none"
              />
              <input
                type="number"
                inputMode="decimal"
                value={row.price}
                onChange={(e) => updateRow(idx, 'price', e.target.value)}
                placeholder="ราคา (฿)"
                className="w-full p-2.5 bg-slate-50 rounded-xl text-sm font-black text-emerald-700 outline-none"
              />
            </div>
          ))}
          <button
            type="button"
            onClick={handleAdd}
            className="w-full py-3 rounded-xl bg-slate-800 text-white font-bold text-sm flex items-center justify-center gap-2"
          >
            <PlusCircle size={18} />
            เพิ่มลงตะกร้า
          </button>
        </div>
      )}
    </div>
  );
}
