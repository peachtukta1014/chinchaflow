import React from 'react';
import { UserCircle, Users } from 'lucide-react';

/**
 * ทางลัดลูกค้า + สมาชิกแอป — อยู่ใต้แถบสต๊อก (แทนแท็บล่าง)
 */
export default function HeaderQuickLinks({ isAdmin, onOpenCustomers, onOpenAppMembers }) {
  return (
    <div className="bg-slate-100 border-b border-slate-200 px-3 py-2 flex gap-2 shrink-0 z-20">
      <button
        type="button"
        onClick={onOpenCustomers}
        className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-white border border-slate-200 text-slate-800 text-xs font-bold active:scale-[0.98] shadow-sm"
      >
        <UserCircle size={16} className="text-blue-600 shrink-0" />
        รายชื่อลูกค้า
      </button>
      {isAdmin && (
        <button
          type="button"
          onClick={onOpenAppMembers}
          className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-white border border-slate-200 text-slate-800 text-xs font-bold active:scale-[0.98] shadow-sm"
        >
          <Users size={16} className="text-purple-600 shrink-0" />
          สมาชิกแอป
        </button>
      )}
    </div>
  );
}
