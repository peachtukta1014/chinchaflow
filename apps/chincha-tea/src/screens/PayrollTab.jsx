import { useCallback, useEffect, useMemo, useState } from 'react';
import { dateKeyBangkok, STAFF_SHIFT_DEFAULTS, shiftDateKey } from '../lib/constants';
import {
  dayOfMonth,
  formatBiweeklyPeriodLabel,
  getBiweeklyPeriodForDate,
  listDateKeysInRange,
  shiftBiweeklyPeriod,
  weekdayShort,
} from '../lib/payrollPeriod';
import {
  getAttendanceForDate,
  getPeriodAttendanceSummary,
  isStaffPresentOnDate,
  listAttendanceStaff,
  setStaffPresent,
} from '../lib/staffAttendanceService';
import { getStaffDailyWage } from '../lib/staffWage';

export function PayrollTab({ member, t, lang, todayKey = dateKeyBangkok() }) {
  const [period, setPeriod] = useState(() => getBiweeklyPeriodForDate(todayKey));
  const [markDateKey, setMarkDateKey] = useState(todayKey);
  const [staffList, setStaffList] = useState([]);
  const [selectedStaffId, setSelectedStaffId] = useState('');
  const [periodSummary, setPeriodSummary] = useState([]);
  const [dayPresent, setDayPresent] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState('');

  const selectedStaff = staffList.find((s) => s.id === selectedStaffId) || null;
  const periodRow = periodSummary.find((x) => x.staffUid === selectedStaffId) || null;

  const periodDates = useMemo(
    () => listDateKeysInRange(period.startKey, period.endKey),
    [period.startKey, period.endKey],
  );

  const periodTotalWage = periodSummary.reduce((s, r) => s + (r.wage || 0), 0);

  const clampMarkDate = useCallback(
    (dk) => {
      if (dk < period.startKey) return period.startKey;
      if (dk > period.endKey) return period.endKey;
      if (dk > todayKey) return todayKey;
      return dk;
    },
    [period.startKey, period.endKey, todayKey],
  );

  useEffect(() => {
    setMarkDateKey((dk) => clampMarkDate(dk));
  }, [period.id, clampMarkDate]);

  const refresh = useCallback(async ({ force = false } = {}) => {
    try {
      const list = await listAttendanceStaff({ force });
      setStaffList(list);
      setSelectedStaffId((prev) => {
        if (prev && list.some((s) => s.id === prev)) return prev;
        return list[0]?.id || '';
      });
      if (!list.length) {
        setPeriodSummary([]);
        setDayPresent(false);
        return;
      }
      const summary = await getPeriodAttendanceSummary(period.startKey, period.endKey, { force });
      setPeriodSummary(summary);
      const dayRows = await getAttendanceForDate(markDateKey);
      const sid = selectedStaffId && list.some((s) => s.id === selectedStaffId)
        ? selectedStaffId
        : list[0]?.id;
      setDayPresent(sid ? isStaffPresentOnDate(sid, dayRows) : false);
    } catch (e) {
      console.error(e);
    }
  }, [period.startKey, period.endKey, markDateKey, selectedStaffId]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    refresh()
      .catch((e) => console.error(e))
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [refresh]);

  useEffect(() => {
    if (!selectedStaffId) return;
    getAttendanceForDate(markDateKey)
      .then((rows) => setDayPresent(isStaffPresentOnDate(selectedStaffId, rows)))
      .catch(() => {});
  }, [markDateKey, selectedStaffId]);

  const toggleDay = async (checked) => {
    if (!selectedStaff || member?.role !== 'admin') return;
    setBusy(true);
    setFlash('');
    try {
      await setStaffPresent({
        dateKey: markDateKey,
        staffUid: selectedStaff.id,
        staffName: selectedStaff.name || 'พนักงาน',
        present: checked,
        markedBy: member?.name || member?.email,
        markedByUid: member?.uid || member?.id,
        actingMember: member,
      });
      await refresh({ force: true });
      setFlash(checked ? t('staffAttendanceSaved') : t('staffAttendanceRemoved'));
      setTimeout(() => setFlash(''), 2000);
    } catch (e) {
      console.error(e);
      setFlash(`⚠️ ${e.message || t('saveFailed')}`);
    }
    setBusy(false);
  };

  const workDaySet = new Set(periodRow?.workDays || []);
  const isTodayMark = markDateKey === todayKey;
  const canMarkDay = markDateKey <= todayKey;
  const staffRate = selectedStaff ? getStaffDailyWage(selectedStaff) : 0;

  return (
    <div className="px-4 pt-3 pb-8 space-y-3">
      <div className="flex items-center gap-2 bg-white rounded-2xl p-2 border border-violet-200 shadow-sm">
        <button
          type="button"
          onClick={() => setPeriod((p) => shiftBiweeklyPeriod(p, -1))}
          className="w-10 h-10 rounded-xl bg-violet-50 font-black text-violet-800"
        >
          ‹
        </button>
        <div className="flex-1 text-center min-w-0 px-1">
          <p className="font-black text-xs text-stone-800 leading-snug">
            {formatBiweeklyPeriodLabel(period, lang)}
          </p>
          <p className="text-[10px] text-stone-400">{t('payrollPeriodHint')}</p>
        </div>
        <button
          type="button"
          onClick={() => setPeriod((p) => shiftBiweeklyPeriod(p, 1))}
          className="w-10 h-10 rounded-xl bg-violet-50 font-black text-violet-800"
        >
          ›
        </button>
      </div>

      {!staffList.length && !loading && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-sm text-amber-900 leading-relaxed">
          <p className="font-bold">{t('payrollNoStaffTitle')}</p>
          <p className="mt-2">{t('payrollNoStaffHint')}</p>
        </div>
      )}

      {staffList.length > 0 && (
        <>
          <div className="bg-white rounded-3xl p-4 border border-violet-200 shadow-sm">
            <p className="text-[10px] font-bold uppercase text-stone-400 mb-2">{t('payrollPeriodTotal')}</p>
            <p className="text-3xl font-black text-violet-900">฿{periodTotalWage.toLocaleString()}</p>
            <p className="text-[10px] text-stone-400 mt-1">{t('payrollAdminOnlyHint')}</p>
          </div>

          <div className="space-y-2">
            {periodSummary.map((row) => (
              <button
                key={row.staffUid}
                type="button"
                onClick={() => setSelectedStaffId(row.staffUid)}
                className={`w-full text-left rounded-2xl p-3 border-2 transition-all ${
                  row.staffUid === selectedStaffId
                    ? 'border-violet-500 bg-violet-50'
                    : 'border-stone-100 bg-white'
                }`}
              >
                <div className="flex justify-between items-start gap-2">
                  <div>
                    <p className="font-black text-stone-800">{row.staffName}</p>
                    <p className="text-[10px] text-stone-500">
                      ฿{row.dailyWage}/{t('staffAttendancePerDay')} · {row.days} {t('staffAttendanceDaysUnit')}
                    </p>
                  </div>
                  <p className="font-black text-violet-800">฿{row.wage.toLocaleString()}</p>
                </div>
              </button>
            ))}
          </div>

          {selectedStaff && (
            <>
              <div className="rounded-3xl p-4 text-white shadow-lg border border-violet-900/20" style={{ background: 'linear-gradient(145deg, #4c1d95 0%, #3d1f0f 100%)' }}>
                <p className="text-violet-200 text-[10px] font-bold uppercase tracking-wider">{t('payrollStaffCard')}</p>
                <p className="text-xl font-black text-white mt-1">{selectedStaff.name}</p>
                <p className="text-violet-200/90 text-xs mt-0.5">{selectedStaff.email}</p>
                <p className="text-[10px] text-amber-200/90 mt-2 leading-relaxed">
                  {t('payrollShiftHint')
                    .replace('{checkIn}', STAFF_SHIFT_DEFAULTS.shiftCheckIn)
                    .replace('{close}', STAFF_SHIFT_DEFAULTS.storeClose)}
                </p>
                <p className="text-[10px] text-violet-200/70 mt-1">
                  ฿{staffRate}/{t('staffAttendancePerDay')}
                </p>
              </div>

              <div className="bg-white rounded-3xl p-4 border border-stone-200 shadow-sm space-y-3">
                <p className="font-bold text-stone-500 text-[10px] uppercase">{t('payrollWorkDaysTitle')}</p>
                <div className="grid grid-cols-5 gap-1.5">
                  {periodDates.map((dk) => {
                    const worked = workDaySet.has(dk);
                    const selected = dk === markDateKey;
                    const future = dk > todayKey;
                    return (
                      <button
                        key={dk}
                        type="button"
                        disabled={future}
                        onClick={() => !future && setMarkDateKey(dk)}
                        className={`relative flex flex-col items-center py-2 rounded-xl border-2 text-[10px] font-bold transition-all ${
                          future
                            ? 'opacity-30 border-stone-100 bg-stone-50 text-stone-300'
                            : worked
                              ? 'border-emerald-400 bg-emerald-50 text-emerald-800'
                              : 'border-stone-100 bg-stone-50 text-stone-400'
                        } ${selected ? 'ring-2 ring-violet-500 ring-offset-1' : ''}`}
                      >
                        <span className="text-[8px] opacity-70">{weekdayShort(dk, lang)}</span>
                        <span className="text-sm font-black">{dayOfMonth(dk)}</span>
                        {worked && <span className="absolute top-0.5 right-0.5 w-1.5 h-1.5 rounded-full bg-emerald-500" />}
                      </button>
                    );
                  })}
                </div>
                {periodRow?.workDays?.length > 0 ? (
                  <p className="text-xs text-stone-600 leading-relaxed">
                    <span className="font-bold text-emerald-700">{t('payrollWorkedList')} </span>
                    {formatWorkDaysList(periodRow.workDays, lang)}
                  </p>
                ) : (
                  <p className="text-xs text-stone-400 text-center">{t('payrollNoWorkDays')}</p>
                )}
              </div>

              <div className="bg-white rounded-3xl p-4 border border-violet-200 shadow-sm space-y-3">
                <p className="font-bold text-stone-500 text-[10px] uppercase">
                  {t('payrollMarkDay')} · {formatDayLabel(markDateKey, lang)}
                  {isTodayMark && (
                    <span className="ml-1 text-emerald-600 normal-case">({t('todayLabel')})</span>
                  )}
                </p>
                {!canMarkDay && (
                  <p className="text-xs text-amber-700 bg-amber-50 rounded-xl px-3 py-2">{t('payrollFutureDay')}</p>
                )}
                {flash && (
                  <p className={`text-center text-xs font-bold py-1.5 rounded-xl ${flash.startsWith('✅') ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'}`}>
                    {flash}
                  </p>
                )}
                <button
                  type="button"
                  disabled={busy || !canMarkDay}
                  onClick={() => toggleDay(!dayPresent)}
                  className={`w-full py-4 rounded-2xl font-black text-base transition-all ${
                    dayPresent
                      ? 'bg-violet-600 text-white shadow-md'
                      : 'bg-stone-100 text-stone-600 border-2 border-dashed border-stone-300'
                  } disabled:opacity-50`}
                >
                  {busy ? '⏳' : dayPresent
                    ? `✓ ${t('payrollPresentOn').replace('{rate}', String(staffRate))}`
                    : t('payrollAbsentOn')}
                </button>
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={markDateKey <= period.startKey}
                    onClick={() => setMarkDateKey(clampMarkDate(shiftDateKey(markDateKey, -1)))}
                    className="flex-1 py-2 rounded-xl bg-stone-100 font-bold text-stone-600 text-sm disabled:opacity-30"
                  >
                    ‹ {t('payrollPrevDay')}
                  </button>
                  <button
                    type="button"
                    disabled={markDateKey >= clampMarkDate(period.endKey) || markDateKey >= todayKey}
                    onClick={() => setMarkDateKey(clampMarkDate(shiftDateKey(markDateKey, 1)))}
                    className="flex-1 py-2 rounded-xl bg-stone-100 font-bold text-stone-600 text-sm disabled:opacity-30"
                  >
                    {t('payrollNextDay')} ›
                  </button>
                </div>
              </div>
            </>
          )}
        </>
      )}

      {loading && (
        <p className="text-center text-stone-400 text-sm py-4">{t('loading')}</p>
      )}
    </div>
  );
}

function formatDayLabel(dateKey, lang) {
  const locale = lang === 'en' ? 'en-US' : lang === 'my' ? 'my-MM' : 'th-TH';
  try {
    return new Date(`${dateKey}T12:00:00+07:00`).toLocaleDateString(locale, {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    });
  } catch {
    return dateKey;
  }
}

function formatWorkDaysList(workDays, lang) {
  const locale = lang === 'en' ? 'en-US' : lang === 'my' ? 'my-MM' : 'th-TH';
  return workDays
    .map((dk) => {
      try {
        const d = new Date(`${dk}T12:00:00+07:00`);
        return d.toLocaleDateString(locale, { day: 'numeric', month: 'short' });
      } catch {
        return dk.slice(8, 10);
      }
    })
    .join(', ');
}
