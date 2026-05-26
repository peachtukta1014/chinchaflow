import React, { useState } from 'react';
import { X } from 'lucide-react';
import { dateKeyBangkok } from '../lib/date';

export default function CalendarPickerModal({
  dateKey,
  maxDateKey,
  minDateKey = null,
  onSelect,
  onClose,
}) {
  const max = maxDateKey || dateKeyBangkok();
  const min = minDateKey || undefined;
  const [picked, setPicked] = useState(dateKey);

  return (
    <div className="fixed inset-0 z-[110] bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl w-full max-w-sm p-5 shadow-2xl">
        <div className="flex justify-between items-center mb-4">
          <p className="font-black text-slate-800">เลือกวันที่</p>
          <button type="button" onClick={onClose} className="p-2 rounded-xl bg-slate-100">
            <X size={18} />
          </button>
        </div>
        <input
          type="date"
          value={picked}
          min={min}
          max={max}
          onChange={(e) => setPicked(e.target.value)}
          className="w-full p-4 border border-slate-200 rounded-2xl text-lg font-bold text-slate-800"
        />
        <p className="text-[10px] text-slate-400 mt-2">
          เลือกวันย้อนหลังเพื่อดูยอดขาย / บิล / รับเข้า / ประวัติบ่อ
        </p>
        <button
          type="button"
          onClick={() => {
            if (!picked || picked > max) return;
            if (min && picked < min) return;
            onSelect(picked);
            onClose();
          }}
          className="w-full mt-4 py-3 rounded-2xl bg-blue-600 text-white font-bold"
        >
          ดูข้อมูลวันนี้
        </button>
      </div>
    </div>
  );
}
