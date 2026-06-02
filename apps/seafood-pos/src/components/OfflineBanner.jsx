import React from 'react';
import { CloudOff, RefreshCw, Wifi } from 'lucide-react';

/**
 * แถบสถานะ offline / คิวบิลรอ sync
 */
export default function OfflineBanner({
  isOnline,
  pendingCount = 0,
  syncing = false,
  onRetrySync,
}) {
  if (isOnline && pendingCount === 0 && !syncing) return null;

  const offline = !isOnline;

  return (
    <div
      className={`px-4 py-2.5 text-xs font-bold shrink-0 z-20 border-b ${
        offline
          ? 'bg-amber-500/95 text-amber-950 border-amber-600'
          : 'bg-sky-600/95 text-white border-sky-700'
      }`}
      role="status"
      aria-live="polite"
    >
      <div className="flex items-start gap-2">
        {offline ? <CloudOff size={16} className="shrink-0 mt-0.5" /> : <Wifi size={16} className="shrink-0 mt-0.5" />}
        <div className="flex-1 min-w-0 leading-relaxed">
          {offline ? (
            <p>ไม่มีอินเทอร์เน็ต — บันทึกบิลได้ ระบบจะเก็บในคิวแล้วส่งอัตโนมัติเมื่อเน็ตกลับ</p>
          ) : syncing ? (
            <p>กำลังส่งบิลที่ค้างในคิว...</p>
          ) : (
            <p>มีบิลค้างส่ง {pendingCount} รายการ — กำลัง sync อัตโนมัติ</p>
          )}
          {pendingCount > 0 && (
            <p className="font-medium opacity-90 mt-0.5">
              คิว offline: {pendingCount} บิล
            </p>
          )}
        </div>
        {isOnline && pendingCount > 0 && onRetrySync && !syncing && (
          <button
            type="button"
            onClick={onRetrySync}
            className="shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white/20 active:scale-95"
          >
            <RefreshCw size={14} />
            ส่งเลย
          </button>
        )}
      </div>
    </div>
  );
}
