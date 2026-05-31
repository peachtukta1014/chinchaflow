import { useCallback, useEffect, useState } from 'react';
import { STAFF_DAILY_WAGE } from '../lib/constants';
import {
  getAttendanceForDate,
  getMonthlyAttendanceSummary,
  isStaffPresentOnDate,
  listAttendanceStaff,
  setStaffPresent,
  yearMonthFromDateKey,
} from '../lib/staffAttendanceService';

export function StaffAttendancePanel({ viewDateKey, member, t, isAdmin }) {
  const [staffList, setStaffList] = useState([]);
  const [dayRows, setDayRows] = useState([]);
  const [monthSummary, setMonthSummary] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyUid, setBusyUid] = useState('');
  const [flash, setFlash] = useState('');

  const yearMonth = yearMonthFromDateKey(viewDateKey);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [staff, rows, month] = await Promise.all([
        listAttendanceStaff(),
        getAttendanceForDate(viewDateKey),
        getMonthlyAttendanceSummary(yearMonth),
      ]);
      setStaffList(staff);
      setDayRows(rows);
      setMonthSummary(month);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  }, [viewDateKey, yearMonth]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const toggle = async (staff, checked) => {
    if (!isAdmin) return;
    setBusyUid(staff.id);
    setFlash('');
    try {
      await setStaffPresent({
        dateKey: viewDateKey,
        staffUid: staff.id,
        staffName: staff.name,
        present: checked,
        markedBy: member?.name || member?.email,
        markedByUid: member?.uid || member?.id,
      });
      await refresh();
      setFlash(checked ? t('attendanceSaved') : t('attendanceRemoved'));
      setTimeout(() => setFlash(''), 2000);
    } catch (e) {
      console.error(e);
      setFlash(`⚠️ ${e.message || t('saveFailed')}`);
    }
    setBusyUid('');
  };

  const presentToday = dayRows.filter((r) => r.present).length;
  const monthTotalWage = monthSummary.reduce((s, x) => s + x.wage, 0);

  if (loading && !staffList.length) {
    return (
      <div className="bg-white rounded-3xl p-4 border border-stone-200 text-center text-stone-400 text-sm">
        {t('loading')}
      </div>
    );
  }

  if (!staffList.length) {
    return (
      <div className="bg-white rounded-3xl p-4 border border-stone-200">
        <p className="font-bold text-stone-500 text-[10px] uppercase mb-2">👷 {t('staffAttendanceTitle')}</p>
        <p className="text-sm text-stone-400">{t('staffAttendanceNoStaff')}</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-3xl p-4 shadow-sm border border-violet-200 space-y-3">
      <div>
        <p className="font-bold text-stone-500 text-[10px] uppercase">👷 {t('staffAttendanceTitle')}</p>
        <p className="text-[10px] text-stone-400 mt-1">{t('staffAttendanceHint')} (฿{STAFF_DAILY_WAGE}/{t('staffAttendancePerDay')})</p>
      </div>

      {flash && (
        <p className={`text-center text-xs font-bold py-1.5 rounded-xl ${flash.startsWith('✅') ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'}`}>
          {flash}
        </p>
      )}

      <div className="space-y-2">
        {staffList.map((s) => {
          const on = isStaffPresentOnDate(s.id, dayRows);
          return (
            <label
              key={s.id}
              className={`flex items-center gap-3 p-3 rounded-2xl border-2 ${on ? 'border-violet-300 bg-violet-50' : 'border-stone-100 bg-stone-50'} ${isAdmin ? 'cursor-pointer' : ''}`}
            >
              <input
                type="checkbox"
                checked={on}
                disabled={!isAdmin || busyUid === s.id}
                onChange={(e) => toggle(s, e.target.checked)}
                className="w-5 h-5 rounded accent-violet-600"
              />
              <span className="flex-1 font-bold text-sm text-stone-800">{s.name || s.email}</span>
              {on && (
                <span className="text-xs font-bold text-violet-700">฿{STAFF_DAILY_WAGE}</span>
              )}
            </label>
          );
        })}
      </div>

      {isAdmin && (
        <p className="text-xs text-stone-500 text-center">
          {t('staffAttendanceDayCount')} {presentToday} {t('staffAttendanceDaysUnit')} · ฿{(presentToday * STAFF_DAILY_WAGE).toLocaleString()}
        </p>
      )}

      <div className="pt-3 border-t border-stone-100">
        <p className="font-bold text-stone-500 text-[10px] uppercase mb-2">
          📅 {t('staffAttendanceMonthTitle')} {formatMonthLabel(yearMonth)}
        </p>
        {monthSummary.length === 0 ? (
          <p className="text-xs text-stone-400">{t('staffAttendanceMonthEmpty')}</p>
        ) : (
          <div className="space-y-1.5">
            {monthSummary.map((row) => (
              <div key={row.staffUid} className="flex justify-between text-sm">
                <span className="font-medium text-stone-700">{row.staffName}</span>
                <span className="font-black text-violet-800">
                  {row.days} {t('staffAttendanceDaysUnit')} · ฿{row.wage.toLocaleString()}
                </span>
              </div>
            ))}
            <div className="flex justify-between pt-2 mt-2 border-t border-stone-100 text-sm">
              <span className="font-bold text-stone-600">{t('staffAttendanceMonthTotal')}</span>
              <span className="font-black text-violet-900">฿{monthTotalWage.toLocaleString()}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function formatMonthLabel(yearMonth) {
  try {
    const d = new Date(`${yearMonth}-01T12:00:00+07:00`);
    return d.toLocaleDateString('th-TH', { month: 'long', year: 'numeric' });
  } catch {
    return yearMonth;
  }
}
