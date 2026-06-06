import { useCallback, useState } from 'react';
import { billAmount } from '../lib/salesAggregate';
import { deleteSaleBill } from '../services/salesService';
import { requestSaleDelete } from '../services/adminAlertService';
import {
  canDeleteShrimpSale,
  canRequestShrimpSaleDelete,
} from '../lib/shrimpRoles';

export function useSaleDeleteHandlers({
  member,
  stock,
  stockBatches,
  updateMainStock,
  onSaleDeleted,
  onLocalRemove,
}) {
  const [deleteBusyId, setDeleteBusyId] = useState(null);
  const [requestBusyId, setRequestBusyId] = useState(null);

  const canDelete = canDeleteShrimpSale(member);
  const canRequestDelete = canRequestShrimpSaleDelete(member);

  const handleDeleteSale = useCallback(async (tx) => {
    if (!canDelete || !tx?.id || deleteBusyId) return;
    const label = `${tx.billNo || tx.id} · ${tx.customerName} · ฿${billAmount(tx).toLocaleString()}`;
    if (!window.confirm(
      `ลบบิลนี้ออกจากระบบ?\n\n${label}\n\n` +
        '· คืนยอดค้าง (ถ้ามี)\n· คืนสต๊อกกุ้ง\n· ออเดอร์ LINE กลับเป็นรอส่ง (ถ้ามี)\n\nกู้คืนไม่ได้',
    )) return;
    setDeleteBusyId(tx.id);
    try {
      await deleteSaleBill(tx, { stock, stockBatches, updateMainStock });
      onLocalRemove?.(tx.id);
      onSaleDeleted?.();
      window.alert('✅ ลบบิลแล้ว — บันทึกใหม่ได้ที่ออเดอร์ LINE หรือขายของ');
    } catch (e) {
      window.alert(e?.message || 'ลบบิลไม่สำเร็จ');
    } finally {
      setDeleteBusyId(null);
    }
  }, [
    canDelete,
    deleteBusyId,
    stock,
    stockBatches,
    updateMainStock,
    onLocalRemove,
    onSaleDeleted,
  ]);

  const handleRequestDeleteSale = useCallback(async (tx) => {
    if (!canRequestDelete || !tx?.id || requestBusyId) return;
    const label = `${tx.billNo || tx.id} · ${tx.customerName} · ฿${billAmount(tx).toLocaleString()}`;
    const reason = window.prompt(
      `ขอให้แอดมินลบบิลนี้?\n\n${label}\n\nเหตุผล (ถ้ามี):`,
      '',
    );
    if (reason === null) return;
    setRequestBusyId(tx.id);
    try {
      await requestSaleDelete(tx, member, reason);
      window.alert('✅ แจ้งแอดมินแล้ว — รอแอดมินลบบิลในแอป');
    } catch (e) {
      window.alert(e?.message || 'แจ้งแอดมินไม่สำเร็จ');
    } finally {
      setRequestBusyId(null);
    }
  }, [canRequestDelete, member, requestBusyId]);

  return {
    canDelete,
    canRequestDelete,
    deleteBusyId,
    requestBusyId,
    handleDeleteSale,
    handleRequestDeleteSale,
  };
}
