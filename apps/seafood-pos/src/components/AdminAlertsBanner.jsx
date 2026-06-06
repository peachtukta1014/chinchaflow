import React, { useCallback, useEffect, useState } from 'react';
import { BellRing, X } from 'lucide-react';
import { fetchPendingAdminAlerts, resolveAdminAlert } from '../services/adminAlertService';
import { useIntervalWhen } from '../lib/useIntervalWhen';

export default function AdminAlertsBanner({ member, active = true, onOpenSales }) {
  const [alerts, setAlerts] = useState([]);

  const reload = useCallback(async () => {
    try {
      setAlerts(await fetchPendingAdminAlerts());
    } catch (e) {
      console.warn('AdminAlertsBanner', e);
    }
  }, []);

  useEffect(() => {
    if (!active || !member) return;
    reload();
  }, [active, member, reload]);

  useIntervalWhen(Boolean(active && member), reload, 45000);

  if (!alerts.length) return null;

  const dismiss = async (alert) => {
    try {
      await resolveAdminAlert(alert.id, member, 'dismissed');
      setAlerts((prev) => prev.filter((a) => a.id !== alert.id));
    } catch (e) {
      window.alert(e?.message || 'ปิดแจ้งเตือนไม่สำเร็จ');
    }
  };

  return (
    <div className="px-4 py-2 bg-amber-500/95 border-b border-amber-600 shrink-0 z-10 space-y-2">
      {alerts.map((alert) => (
        <div
          key={alert.id}
          className="flex items-start gap-2 bg-white/95 rounded-xl px-3 py-2 text-xs text-amber-950"
        >
          <BellRing size={16} className="shrink-0 mt-0.5 text-amber-600" />
          <div className="flex-1 min-w-0">
            <p className="font-black">แมนเนเจอร์ขอลบบิล</p>
            <p className="mt-0.5 leading-snug">
              {alert.billNo || alert.saleId}
              {alert.customerName ? ` · ${alert.customerName}` : ''}
              {alert.amount != null ? ` · ฿${Number(alert.amount).toLocaleString()}` : ''}
            </p>
            <p className="text-[10px] text-amber-800 mt-0.5">
              โดย {alert.requestedByName || 'แมนเนเจอร์'}
              {alert.reason ? ` — ${alert.reason}` : ''}
            </p>
            <button
              type="button"
              onClick={() => onOpenSales?.()}
              className="mt-1.5 text-[10px] font-bold text-blue-700 underline"
            >
              ไปแท็บยอดขาย → ลบบิล
            </button>
          </div>
          <button
            type="button"
            onClick={() => dismiss(alert)}
            className="shrink-0 p-1 rounded-lg text-amber-700 hover:bg-amber-100"
            aria-label="ปิดแจ้งเตือน"
          >
            <X size={16} />
          </button>
        </div>
      ))}
    </div>
  );
}
