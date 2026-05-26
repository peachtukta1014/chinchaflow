import React, { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { dateKeyBangkok, formatViewDateLabel, shiftDateKey } from '../lib/date';
import CalendarPickerModal from './CalendarPickerModal';

/**
 * เลื่อนวันทีละวัน + แตะวันที่เปิดปฏิทิน
 */
export default function DateNavBar({
  dateKey,
  onDateChange,
  maxDateKey = dateKeyBangkok(),
  minDateKey = null,
  subtitle = '',
}) {
  const [showCalendar, setShowCalendar] = useState(false);
  const canGoPrev = !minDateKey || dateKey > minDateKey;

  return (
    <>
      <div className="bg-white rounded-2xl p-3 flex items-center justify-between shadow-sm">
        <button
          type="button"
          onClick={() => canGoPrev && onDateChange(shiftDateKey(dateKey, -1))}
          disabled={!canGoPrev}
          className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-600 active:scale-95 disabled:opacity-30"
          aria-label="วันก่อนหน้า"
        >
          <ChevronLeft size={20} />
        </button>
        <button
          type="button"
          onClick={() => setShowCalendar(true)}
          className="text-center min-w-0 flex-1 px-2 active:opacity-70"
        >
          <p className="font-black text-slate-800">{formatViewDateLabel(dateKey)}</p>
          <p className="text-[10px] text-slate-400">
            {dateKey}
            {subtitle ? ` · ${subtitle}` : ''}
            {' · แตะเลือกวันที่'}
          </p>
        </button>
        <button
          type="button"
          onClick={() => onDateChange(shiftDateKey(dateKey, 1))}
          disabled={dateKey >= maxDateKey}
          className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-600 active:scale-95 disabled:opacity-30"
          aria-label="วันถัดไป"
        >
          <ChevronRight size={20} />
        </button>
      </div>
      {showCalendar && (
        <CalendarPickerModal
          key={dateKey}
          dateKey={dateKey}
          maxDateKey={maxDateKey}
          minDateKey={minDateKey}
          onSelect={onDateChange}
          onClose={() => setShowCalendar(false)}
        />
      )}
    </>
  );
}
