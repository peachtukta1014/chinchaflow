import { useCallback, useEffect, useMemo, useState } from 'react';
import { dateKeyBangkok, PRIMARY_STAFF, shiftDateKey, STAFF_DAILY_WAGE } from '../lib/constants';
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
  getPrimaryAttendanceStaff,
  isStaffPresentOnDate,
  setStaffPresent,
} from '../lib/staffAttendanceService';

export function PayrollTab({ member, t, lang, todayKey = dateKeyBangkok() }) {
  const [period, setPeriod] = useState(() => getBiweeklyPeriodForDate(todayKey));
  const [markDateKey, setMarkDateKey] = useState(todayKey);
  const [staff, setStaff] = useState(null);
  const [staffIssue, setStaffIssue] = useState(null);
  const [periodRow, setPeriodRow] = useState(null);
  const [dayPresent, setDayPresent] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState('');

  const periodDates = useMemo(
    () => listDateKeysInRange(period.startKey, period.endKey),
    [period.startKey, period.endKey],
  );

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
      const resolved = await getPrimaryAttendanceStaff({ force });
      const s = resolved?.staff ?? null;
      setStaff(s);
      setStaffIssue(resolved?.issue ?? null);
      if (!s) {
        setPeriodRow(null);
        setDayPresent(false);
        return;
      }
      const [summary, dayRows] = await Promise.all([
        getPeriodAttendanceSummary(period.startKey, period.endKey, { force }),
        getAttendanceForDate(markDateKey),
      ]);
      const row = summary.find((x) => x.staffUid === s.id) || {
        staffUid: s.id,
        staffName: s.name || PRIMARY_STAFF.displayName,
        workDays: [],
        days: 0,
        wage: 0,
        periodDays: periodDates.length,
      };
      setPeriodRow(row);
      setDayPresent(isStaffPresentOnDate(s.id, dayRows));
    } catch (e) {
      console.error(e);
    }
  }, [period.startKey, period.endKey, markDateKey, periodDates.length]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    refresh()
      .catch((e) => console.error(e))
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [refresh]);

  const toggleDay = async (checked) => {
    if (!staff) return;
    setBusy(true);
    setFlash('');
    try {
      await setStaffPresent({
        dateKey: markDateKey,
        staffUid: staff.id,
        staffName: staff.name || PRIMARY_STAFF.displayName,
        present: checked,
        markedBy: member?.name || member?.email,
        markedByUid: member?.uid || member?.id,
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

  const staffLabel = staff?.name || PRIMARY_STAFF.displayName;
  const staffEmail = staff?.email || PRIMARY_STAFF.email;
  const workDaySet = new Set(periodRow?.workDays || []);
  const isTodayMark = markDateKey === todayKey;
  const canMarkDay = markDateKey <= todayKey;

  return (
    <div className="px-4 pt-3 pb-8 space-y-3">
      <div className="rounded-3xl p-4 text-white shadow-lg border border-violet-900/20" style={{ background: 'linear-gradient(145deg, #4c1d95 0%, #3d1f0f 100%)' }}>
        <p className="text-violet-200 text-[10px] font-bold uppercase tracking-wider">{t('payrollStaffCard')}</p>
        <p className="text-xl font-black text-white mt-1">{staffLabel}</p>
        <p className="text-violet-200/90 text-xs mt-0.5">{staffEmail}</p>
        <p className="text-[10px] text-amber-200/90 mt-2 leading-relaxed">
          {t('payrollShiftHint')
            .replace('{checkIn}', PRIMARY_STAFF.shiftCheckIn)
            .replace('{close}', PRIMARY_STAFF.storeClose)}
        </p>
        <p className="text-[10px] text-violet-200/70 mt-1">฿{STAFF_DAILY_WAGE}/{t('staffAttendancePerDay')}</p>
      </div>

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

      {!staff && !loading && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-sm text-amber-900 leading-relaxed space-y-2">
          <p className="font-bold">{staffIssue === 'wrong_role' ? t('payrollWrongRoleTitle') : t('payrollNoStaffTitle')}</p>
          <p>
            {staffIssue === 'not_approved' && t('payrollNotApprovedHint')}
            {staffIssue === 'wrong_role' && t('payrollWrongRoleHint')}
            {(!staffIssue || staffIssue === 'not_registered' || staffIssue === 'unknown') && t('payrollNoStaffHint').replace('{email}', PRIMARY_STAFF.email)}
          </p>
          <p className="text-[10px] text-stone-500">
            {PRIMARY_STAFF.displayName} · {PRIMARY_STAFF.email}
          </p>
        </div>
      )}

      {staff && (
        <>
          <div className="bg-white rounded-3xl p-4 border border-violet-200 shadow-sm">
            <div className="flex justify-between items-start gap-2 mb-3">
              <div>
                <p className="text-[10px] font-bold uppercase text-stone-400">{t('payrollPeriodTotal')}</p>
                <p className="text-3xl font-black text-violet-900 mt-0.5">
                  ฿{(periodRow?.wage || 0).toLocaleString()}
                </p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-black text-stone-800">{periodRow?.days || 0}</p>
                <p className="text-[10px] text-stone-500">
                  / {periodRow?.periodDays || periodDates.length} {t('staffAttendanceDaysUnit')}
                </p>
              </div>
            </div>
            <p className="text-[10px] text-stone-400 text-center">
              {(periodRow?.days || 0)} × ฿{STAFF_DAILY_WAGE} = ฿{(periodRow?.wage || 0).toLocaleString()}
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
              {busy ? '⏳' : dayPresent ? `✓ ${t('payrollPresentOn')}` : t('payrollAbsentOn')}
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
