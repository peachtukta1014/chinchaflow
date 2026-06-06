import React from 'react';
import { BellRing, Trash2 } from 'lucide-react';

/** ปุ่มลบบิล (แอดมิน) หรือขอให้แอดมินลบ (แมนเนเจอร์) */
export default function SaleBillActions({
  tx,
  canDelete = false,
  canRequestDelete = false,
  deleteBusyId = null,
  requestBusyId = null,
  payUpdatingId = null,
  onDelete,
  onRequestDelete,
  layout = 'row',
}) {
  if (!tx?.id) return null;
  const busy = payUpdatingId === tx.id;
  const deleting = deleteBusyId === tx.id;
  const requesting = requestBusyId === tx.id;

  if (!canDelete && !canRequestDelete) return null;

  const rowCls = layout === 'row'
    ? 'shrink-0 px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1 disabled:opacity-50'
    : 'w-full py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1 disabled:opacity-50';

  if (canDelete) {
    return (
      <button
        type="button"
        disabled={deleting || busy}
        onClick={() => onDelete?.(tx)}
        className={`${rowCls} border border-red-200 text-red-600`}
        title="ลบบิล (แอดมิน)"
      >
        <Trash2 size={14} />
        {deleting ? '…' : 'ลบ'}
      </button>
    );
  }

  return (
    <button
      type="button"
      disabled={requesting || busy}
      onClick={() => onRequestDelete?.(tx)}
      className={`${rowCls} border border-amber-200 text-amber-800 bg-amber-50`}
      title="แจ้งแอดมินให้ลบบิล"
    >
      <BellRing size={14} />
      {requesting ? '…' : 'ขอลบ'}
    </button>
  );
}
