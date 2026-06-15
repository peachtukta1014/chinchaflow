import { ExpensesTab } from './ExpensesTab';

export function CupsTab({
  member,
  t,
  lang,
  viewDateKey,
  setViewDateKey,
  onSummaryChanged,
}) {
  return (
    <ExpensesTab
      member={member}
      t={t}
      lang={lang}
      viewDateKey={viewDateKey}
      setViewDateKey={setViewDateKey}
      allowedModes={['cups']}
      defaultMode="cups"
      onSummaryChanged={onSummaryChanged}
    />
  );
}
