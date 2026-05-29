import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link2, RefreshCw, UserPlus } from 'lucide-react';
import {
  createCustomerVerified,
  fetchCustomersMap,
  getMainCatalogCustomers,
  mergeCustomerLists,
  saveCustomerVerified,
  subscribeCustomers,
} from '../services/customerService';
import {
  fetchLineOaContacts,
  findCustomerByLineUserId,
  partitionLineOaContacts,
  suggestMainCatalogLinks,
} from '../services/lineOaCustomerService';
import { isValidLineUserId } from '../lib/lineUserId';

export default function LineOaCustomersPanel({ showFlash, onPendingCountChange }) {
  const [fsCustomers, setFsCustomers] = useState({});
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyUid, setBusyUid] = useState(null);
  const [linkPick, setLinkPick] = useState(null);
  const [view, setView] = useState('pending');

  const allCustomers = mergeCustomerLists(fsCustomers);
  const mainCatalog = useMemo(() => getMainCatalogCustomers(fsCustomers), [fsCustomers]);
  const { pending, linked } = useMemo(
    () => partitionLineOaContacts(contacts, allCustomers),
    [contacts, allCustomers],
  );

  useEffect(() => {
    onPendingCountChange?.(pending.length);
  }, [pending.length, onPendingCountChange]);

  const refreshCustomers = useCallback(async () => {
    const map = await fetchCustomersMap();
    setFsCustomers(map);
    return map;
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [rows] = await Promise.all([
        fetchLineOaContacts(),
        refreshCustomers(),
      ]);
      setContacts(rows);
    } catch (e) {
      console.error(e);
      showFlash?.('❌ โหลดรายชื่อ LINE ไม่สำเร็จ');
    } finally {
      setLoading(false);
    }
  }, [showFlash, refreshCustomers]);

  useEffect(() => subscribeCustomers(setFsCustomers, () => {}), []);
  useEffect(() => { load(); }, [load]);

  const confirmLinked = (map, lineUserId, expectedName) => {
    const list = mergeCustomerLists(map);
    const hit = findCustomerByLineUserId(list, lineUserId);
    if (!hit) {
      throw new Error('ผูกไม่สำเร็จ — ลองรีเฟรชหรือบันทึกอีกครั้ง');
    }
    if (expectedName && hit.name !== expectedName) {
      throw new Error(`ผูกแล้วแต่ชื่อไม่ตรง (ได้ "${hit.name}")`);
    }
    return hit;
  };

  const linkToExisting = async (contact, customerId) => {
    const c = mainCatalog.find((x) => x.id === customerId)
      || allCustomers.find((x) => x.id === customerId);
    if (!c) return;
    setBusyUid(contact.lineUserId);
    try {
      const { map } = await saveCustomerVerified(c.id, {
        lineUserId: contact.lineUserId,
      }, { merge: true });
      confirmLinked(map, contact.lineUserId, c.name);
      setFsCustomers(map);
      showFlash?.(`✅ ผูก LINE กับ "${c.name}" แล้ว`);
      setLinkPick(null);
      await load();
    } catch (e) {
      showFlash?.('❌ ' + (e?.message || 'ผูกไม่สำเร็จ'));
    } finally {
      setBusyUid(null);
    }
  };

  /** เพิ่มเป็นลูกค้าใหม่ (cx_*) — ไม่ผูกกับรายชื่อ 27 ร้านอัตโนมัติ */
  const addAsNewCustomer = async (contact) => {
    const name = (contact.suggestedName || contact.displayNames[0] || '').trim();
    if (!name) {
      showFlash?.('❌ ไม่มีชื่อจากออเดอร์ LINE');
      return;
    }
    const suggestions = suggestMainCatalogLinks(contact, fsCustomers);
    if (suggestions.length > 0) {
      const names = suggestions.slice(0, 3).map((s) => s.name).join(' / ');
      if (!window.confirm(
        `เพิ่ม "${name}" เป็นลูกค้าใหม่ (แยกจากรายชื่อหลัก)?\n\n` +
          `ถ้าเป็นร้านเดิม ให้กด「ผูกลูกค้าเดิม」แทน\nแนะนำ: ${names}`,
      )) return;
    }
    setBusyUid(contact.lineUserId);
    try {
      const result = await createCustomerVerified({
        name,
        zone: 'LINE OA',
        phone: '',
        lineUserId: contact.lineUserId,
      });
      confirmLinked(result.map, contact.lineUserId, name);
      setFsCustomers(result.map);
      showFlash?.(`✅ เพิ่ม "${name}" แล้ว (รายชื่อหลัก)`);
      await load();
    } catch (e) {
      showFlash?.('❌ ' + (e?.message || 'เพิ่มไม่สำเร็จ'));
    } finally {
      setBusyUid(null);
      setLinkPick(null);
    }
  };

  const renderPendingCard = (contact) => {
    const busy = busyUid === contact.lineUserId;
    const picking = linkPick === contact.lineUserId;
    const suggestions = suggestMainCatalogLinks(contact, fsCustomers);

    return (
      <div
        key={contact.lineUserId}
        className="bg-white rounded-2xl p-4 shadow-sm border border-amber-200"
      >
        <p className="font-bold text-slate-800 truncate">
          {contact.displayNames.join(' · ') || 'ลูกค้า LINE'}
        </p>
        <p className="text-[10px] font-mono text-slate-400 mt-0.5">
          UID …{contact.lineUserId.slice(-8)}
        </p>
        <div className="flex flex-wrap gap-1.5 mt-1.5">
          <span className="text-[10px] bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full font-bold">
            ยังไม่ผูกรายชื่อหลัก
          </span>
          <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
            ออเดอร์ {contact.orderCount} ครั้ง
          </span>
          {contact.lastDeliveryDate && (
            <span className="text-[10px] bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">
              ส่งล่าสุด {contact.lastDeliveryDate}
            </span>
          )}
        </div>

        {suggestions.length > 0 && !picking && (
          <div className="mt-2 space-y-1">
            <p className="text-[10px] text-slate-500 font-bold">อาจเป็นร้านในระบบ:</p>
            {suggestions.slice(0, 3).map((c) => (
              <button
                key={c.id}
                type="button"
                disabled={busy}
                onClick={() => linkToExisting(contact, c.id)}
                className="w-full text-left text-xs font-bold text-blue-700 bg-blue-50 border border-blue-200 rounded-lg px-2.5 py-2 disabled:opacity-50"
              >
                ผูกกับ {c.name}
                {c.zone ? ` (${c.zone})` : ''}
              </button>
            ))}
          </div>
        )}

        {!picking && (
          <div className="flex gap-2 mt-3">
            <button
              type="button"
              disabled={busy}
              onClick={() => setLinkPick(contact.lineUserId)}
              className="flex-[1.2] py-2 rounded-xl bg-[#06C755] text-white text-xs font-bold flex items-center justify-center gap-1 disabled:opacity-50"
            >
              <Link2 size={14} />
              ผูกลูกค้าเดิม
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => addAsNewCustomer(contact)}
              className="flex-1 py-2 rounded-xl border border-slate-200 text-slate-700 text-xs font-bold flex items-center justify-center gap-1 disabled:opacity-50"
            >
              <UserPlus size={14} />
              เพิ่มใหม่
            </button>
          </div>
        )}

        {picking && (
          <div className="mt-3 space-y-2">
            <p className="text-[10px] text-slate-500 font-bold">
              เลือกจากรายชื่อหลัก ({mainCatalog.length} ร้าน)
            </p>
            <select
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold"
              defaultValue=""
              onChange={(e) => {
                if (e.target.value) linkToExisting(contact, e.target.value);
              }}
            >
              <option value="">— เลือกชื่อ —</option>
              {mainCatalog.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                  {c.zone ? ` (${c.zone})` : ''}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => setLinkPick(null)}
              className="w-full text-xs text-slate-400 py-1"
            >
              ยกเลิก
            </button>
          </div>
        )}
      </div>
    );
  };

  const renderLinkedCard = ({ contact, customer }) => (
    <div
      key={contact.lineUserId}
      className="bg-white rounded-2xl p-3 shadow-sm border border-green-200"
    >
      <div className="flex justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-bold text-slate-800 truncate">
            LINE: {contact.displayNames[0] || '—'}
          </p>
          <p className="text-[10px] text-green-700 font-bold mt-0.5">
            ผูกแล้ว → {customer.name}
            {customer.zone ? ` · ${customer.zone}` : ''}
          </p>
        </div>
        {isValidLineUserId(customer.lineUserId) && (
          <span className="text-[9px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full shrink-0">
            LINE OK
          </span>
        )}
      </div>
    </div>
  );

  const list = view === 'pending' ? pending : linked.map((x) => x);

  return (
    <div className="space-y-3">
      <div className="bg-[#06C755]/10 border border-[#06C755]/30 rounded-2xl p-3">
        <p className="text-xs text-[#047857] leading-relaxed font-medium">
          แท็บนี้เฉพาะคนทัก LINE OA ที่<strong>ยังไม่ผูก</strong>กับรายชื่อหลัก 27 ร้าน
          ร้านเดิมที่สั่งผ่าน LINE ให้กด「ผูกลูกค้าเดิม」เลือกชื่อในระบบ
        </p>
      </div>

      <div className="flex bg-slate-200 p-1 rounded-xl gap-1">
        <button
          type="button"
          onClick={() => setView('pending')}
          className={`flex-1 py-2 rounded-lg text-xs font-bold ${
            view === 'pending' ? 'bg-white text-amber-700 shadow-sm' : 'text-slate-500'
          }`}
        >
          รอผูก ({pending.length})
        </button>
        <button
          type="button"
          onClick={() => setView('linked')}
          className={`flex-1 py-2 rounded-lg text-xs font-bold ${
            view === 'linked' ? 'bg-white text-green-700 shadow-sm' : 'text-slate-500'
          }`}
        >
          ผูกแล้ว ({linked.length})
        </button>
      </div>

      <div className="flex items-center justify-between">
        <p className="text-sm font-black text-slate-800">
          {view === 'pending' ? 'LINE OA รอผูก' : 'LINE OA ผูกแล้ว'}
        </p>
        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="text-xs font-bold text-slate-600 border border-slate-200 px-3 py-1.5 rounded-xl flex items-center gap-1"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          รีเฟรช
        </button>
      </div>

      {loading ? (
        <p className="text-slate-400 text-sm text-center py-8">กำลังโหลดจากออเดอร์ LINE…</p>
      ) : list.length === 0 ? (
        <p className="text-slate-400 text-sm text-center py-8">
          {view === 'pending'
            ? 'ไม่มีรายการรอผูก — ดีแล้วครับ'
            : 'ยังไม่มีรายการที่ผูกจากแท็บนี้'}
        </p>
      ) : (
        <div className="space-y-2">
          {view === 'pending'
            ? pending.map(renderPendingCard)
            : linked.map(renderLinkedCard)}
        </div>
      )}
    </div>
  );
}
