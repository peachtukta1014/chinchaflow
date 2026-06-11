import { ExpensesTab } from './ExpensesTab';
import { RestockTab } from './RestockTab';
import { SegmentedTabBar } from '../components/TabNav';
import { useState } from 'react';

export function OpsTab({ member, t, lang, viewDateKey, setViewDateKey, onRestockListChange }) {
  const [section, setSection] = useState('restock');

  return (
    <div className="pb-8">
      <div className="px-4 pt-3 sticky top-0 z-30 bg-[#fdf6f0]/95 backdrop-blur">
        <SegmentedTabBar
          tabs={[
            ['restock', t('restockTabShort')],
            ['cups', t('cupStockTab')],
          ]}
          activeId={section}
          onSelect={setSection}
        />
      </div>
      {section === 'restock' ? (
        <RestockTab member={member} t={t} lang={lang} onRestockListChange={onRestockListChange} />
      ) : (
        <ExpensesTab
          member={member}
          t={t}
          lang={lang}
          viewDateKey={viewDateKey}
          setViewDateKey={setViewDateKey}
          allowedModes={['cups']}
          defaultMode="cups"
          compactHeader
        />
      )}
    </div>
  );
}
