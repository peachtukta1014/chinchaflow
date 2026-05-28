import React, { useState } from 'react';
import Dashboard from './Dashboard';
import CustomerAccountsScreen from './CustomerAccountsScreen';

const SUB_TABS = [
  { id: 'summary', label: 'ยอดวัน' },
  { id: 'debts', label: 'ลูกหนี้' },
];

/**
 * รวม "ภาพรวม" + "บัญชี" เป็นแท็บเดียว — ลดปุ่มล่างที่ซ้ำกัน
 */
export default function SalesHubScreen({
  localBills = [],
  refreshKey = 0,
  active = true,
  isAdmin = false,
  stock = null,
  stockBatches = [],
  updateMainStock,
  onSaleDeleted,
}) {
  const [subTab, setSubTab] = useState('summary');

  return (
    <div className="flex flex-col min-h-full">
      <div className="sticky top-0 z-20 bg-slate-50/95 backdrop-blur-sm px-4 pt-2 pb-2 border-b border-slate-200">
        <div className="flex gap-1 p-1 bg-slate-200/80 rounded-xl">
          {SUB_TABS.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              onClick={() => setSubTab(id)}
              className={`flex-1 py-2 rounded-lg text-xs font-black transition-all ${
                subTab === id
                  ? 'bg-white text-blue-700 shadow-sm'
                  : 'text-slate-500'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {subTab === 'summary' ? (
        <Dashboard
          localBills={localBills}
          refreshKey={refreshKey}
          active={active}
          isAdmin={isAdmin}
          stock={stock}
          stockBatches={stockBatches}
          updateMainStock={updateMainStock}
          onSaleDeleted={onSaleDeleted}
        />
      ) : (
        <CustomerAccountsScreen
          refreshKey={refreshKey}
          active={active}
          debtsOnly
          isAdmin={isAdmin}
          stock={stock}
          stockBatches={stockBatches}
          updateMainStock={updateMainStock}
          onSaleDeleted={onSaleDeleted}
        />
      )}
    </div>
  );
}
