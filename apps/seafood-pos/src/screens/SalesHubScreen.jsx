import React, { useState } from 'react';
import Dashboard from './Dashboard';
import CustomerAccountsScreen from './CustomerAccountsScreen';
import PaymentSlipsScreen from './PaymentSlipsScreen';

const SUB_TABS = [
  { id: 'summary', label: 'ยอดวัน' },
  { id: 'slips', label: 'สลิป' },
  { id: 'debts', label: 'ลูกหนี้' },
];

/**
 * รวม "ภาพรวม" + "บัญชี" เป็นแท็บเดียว — ลดปุ่มล่างที่ซ้ำกัน
 */
export default function SalesHubScreen({
  localBills = [],
  refreshKey = 0,
  active = true,
  member = null,
  stock = null,
  stockBatches = [],
  updateMainStock,
  onSaleDeleted,
}) {
  const [subTab, setSubTab] = useState('summary');
  const [pendingSlipCount, setPendingSlipCount] = useState(0);

  return (
    <div className="flex flex-col min-h-full">
      <div className="sticky top-0 z-20 bg-slate-50/95 backdrop-blur-sm px-4 pt-2 pb-2 border-b border-slate-200">
        <div className="flex gap-1 p-1 bg-slate-200/80 rounded-xl">
          {SUB_TABS.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              onClick={() => setSubTab(id)}
              className={`flex-1 py-2 rounded-lg text-xs font-black transition-all relative ${
                subTab === id
                  ? 'bg-white text-blue-700 shadow-sm'
                  : 'text-slate-500'
              }`}
            >
              {label}
              {id === 'slips' && pendingSlipCount > 0 && (
                <span className="absolute -top-1 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[9px] font-black flex items-center justify-center">
                  {pendingSlipCount > 9 ? '9+' : pendingSlipCount}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {subTab === 'summary' ? (
        <Dashboard
          localBills={localBills}
          refreshKey={refreshKey}
          active={active}
          member={member}
          stock={stock}
          stockBatches={stockBatches}
          updateMainStock={updateMainStock}
          onSaleDeleted={onSaleDeleted}
        />
      ) : subTab === 'slips' ? (
        <PaymentSlipsScreen
          member={member}
          active={active && subTab === 'slips'}
          onPendingCountChange={setPendingSlipCount}
        />
      ) : (
        <CustomerAccountsScreen
          refreshKey={refreshKey}
          active={active}
          debtsOnly
          member={member}
          stock={stock}
          stockBatches={stockBatches}
          updateMainStock={updateMainStock}
          onSaleDeleted={onSaleDeleted}
        />
      )}
    </div>
  );
}
