import { useState } from 'react';
import {
  previewOrphanedAttendance,
  pruneOrphanedAttendance,
} from '../lib/staffAttendanceService';

export function StaffAttendanceCleanupPanel({ t }) {
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState('');

  const loadPreview = async () => {
    setBusy(true);
    setFlash('');
    try {
      const result = await previewOrphanedAttendance();
      setPreview(result);
    } catch (e) {
      console.error(e);
      setFlash(t('staffAttendanceCleanupLoadFailed'));
    } finally {
      setBusy(false);
    }
  };

  const runPrune = async () => {
    if (!preview?.orphans?.length) return;
    const names = [...new Set(preview.orphans.map((r) => r.staffName || r.staffUid))].join(', ');
    const msg = t('staffAttendanceCleanupConfirm')
      .replace('{count}', String(preview.orphans.length))
      .replace('{names}', names);
    if (!window.confirm(msg)) return;

    setBusy(true);
    setFlash('');
    try {
      const result = await pruneOrphanedAttendance();
      setPreview(result);
      if (result.errors > 0) {
        setFlash(
          t('staffAttendanceCleanupPartial')
            .replace('{deleted}', String(result.deleted))
            .replace('{errors}', String(result.errors)),
        );
      } else {
        setFlash(t('staffAttendanceCleanupDone').replace('{deleted}', String(result.deleted)));
      }
      setTimeout(() => setFlash(''), 5000);
    } catch (e) {
      console.error(e);
      setFlash(t('staffAttendanceCleanupFailed'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="bg-amber-50/80 rounded-2xl border border-amber-200 p-4 space-y-3">
      <div>
        <h3 className="text-sm font-black text-amber-950">{t('staffAttendanceCleanupTitle')}</h3>
        <p className="text-[10px] text-amber-900/80 mt-1 leading-relaxed">{t('staffAttendanceCleanupHint')}</p>
      </div>

      {flash && (
        <p className="text-xs font-bold text-emerald-700 bg-emerald-50 px-3 py-2 rounded-xl border border-emerald-200">
          {flash}
        </p>
      )}

      {preview && (
        <div className="text-[10px] text-amber-950 bg-white/70 px-3 py-2 rounded-xl space-y-1">
          <p>
            {t('staffAttendanceCleanupFound').replace('{count}', String(preview.orphans.length))}
          </p>
          {preview.orphans.length > 0 && (
            <ul className="list-disc pl-4 space-y-0.5">
              {preview.orphans.map((r) => (
                <li key={r.id}>
                  {r.staffName || r.staffUid}
                  {' · '}
                  {r.dateKey}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={loadPreview}
          className="px-3 py-2 rounded-xl border-2 border-amber-300 text-amber-950 text-xs font-bold disabled:opacity-50"
        >
          {busy ? t('loading') : t('staffAttendanceCleanupCheck')}
        </button>
        {preview && preview.orphans.length > 0 && (
          <button
            type="button"
            disabled={busy}
            onClick={runPrune}
            className="px-3 py-2 rounded-xl bg-amber-800 text-white text-xs font-bold disabled:opacity-50"
          >
            {t('staffAttendanceCleanupRun')}
          </button>
        )}
      </div>
    </div>
  );
}
