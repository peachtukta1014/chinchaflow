import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { EyeOff, Link2, RefreshCw, UserPlus, UserRound } from 'lucide-react';
import { getShrimpRoleLabel } from '../lib/shrimpRoles';
import { getBillingLineUserId } from '../lib/lineCustomerContacts';
import {
  createCustomerVerified,
  fetchCustomersMap,
  getMainCatalogCustomers,
  linkLineOaUidToCustomer,
  linkLineOaUidToCustomerIds,
  mergeCustomerLists,
  subscribeCustomers,
} from '../services/customerService';
import { multiLinkGroupsPending } from '../lib/lineOaLinkGroups';
import {
  clearPendingLinkRequest,
  dismissLineOaPendingUid,
  fetchDismissedLineOaUids,
  fetchLineOaContacts,
  findCustomerByLineUserId,
  partitionLineOaContacts,
  suggestMainCatalogLinks,
} from '../services/lineOaCustomerService';
import {
  assignPendingLineUidToMember,
  fetchShrimpMembersForLineAssign,
  fetchStaffLineUserIdSet,
  mergeSkipLineOaUidSets,
} from '../services/shrimpMemberLineService';
import { isValidLineUserId } from '../lib/lineUserId';

export default function LineOaCustomersPanel({ showFlash, onPendingCountChange }) {
  const [fsCustomers, setFsCustomers] = useState({});
  const [contacts, setContacts] = useState([]);
  const [skipUids, setSkipUids] = useState(() => new Set());
  const [appMembers, setAppMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyUid, setBusyUid] = useState(null);
  const [linkPick, setLinkPick] = useState(null);
  const [linkConfirm, setLinkConfirm] = useState(null);
  const [staffAssign, setStaffAssign] = useState(null);
  const [view, setView] = useState('pending');

  const allCustomers = mergeCustomerLists(fsCustomers);
  const mainCatalog = useMemo(() => getMainCatalogCustomers(fsCustomers), [fsCustomers]);
  const { pending, linked } = useMemo(
    () => partitionLineOaContacts(contacts, allCustomers, skipUids),
    [contacts, allCustomers, skipUids],
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
      const [rows, dismissed, staffUids, members] = await Promise.all([
        fetchLineOaContacts(),
        fetchDismissedLineOaUids(),
        fetchStaffLineUserIdSet(),
        fetchShrimpMembersForLineAssign(),
        refreshCustomers(),
      ]);
      setContacts(rows);
      setSkipUids(mergeSkipLineOaUidSets(dismissed, staffUids));
      setAppMembers(members);
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

  const findCustomer = (customerId) => mainCatalog.find((x) => x.id === customerId)
    || allCustomers.find((x) => x.id === customerId);

  const beginLink = (contact, customerId) => {
    const c = findCustomer(customerId);
    if (!c) return;
    const billing = getBillingLineUserId(c);
    if (billing && billing !== contact.lineUserId) {
      setLinkPick(null);
      setLinkConfirm({ contact, customerId, customerName: c.name });
      return;
    }
    linkToCustomer(contact, customerId, 'auto');
  };

  const maybeClearLinkRequest = async (contact, customerIds) => {
    if (!contact.linkRequested) return;
    const groups = multiLinkGroupsPending(
      contact.lineUserId,
      (id) => findCustomer(id),
    );
    const pendingGroup = groups.find((g) => g.customerIds.join() === customerIds.join());
    if (pendingGroup) return;
    await clearPendingLinkRequest(contact.lineUserId);
  };

  const linkToCustomer = async (contact, customerId, role) => {
    const c = findCustomer(customerId);
    if (!c) return;
    setBusyUid(contact.lineUserId);
    try {
      const { map } = await linkLineOaUidToCustomer(c.id, contact.lineUserId, role);
      confirmLinked(map, contact.lineUserId, c.name);
      setFsCustomers(map);
      await maybeClearLinkRequest(contact, [customerId]);
      const roleLabel = role === 'billing' ? 'เจ้าของ/โอน' : 'คนสั่งใน LINE';
      showFlash?.(`✅ ผูก LINE กับ "${c.name}" (${role === 'auto' ? 'เรียบร้อย' : roleLabel}) แล้ว`);
      setLinkPick(null);
      setLinkConfirm(null);
      await load();
    } catch (e) {
      showFlash?.('❌ ' + (e?.message || 'ผูกไม่สำเร็จ'));
    } finally {
      setBusyUid(null);
    }
  };

  const linkToCustomerGroup = async (contact, group) => {
    setBusyUid(contact.lineUserId);
    try {
      const { map } = await linkLineOaUidToCustomerIds(group.customerIds, contact.lineUserId);
      setFsCustomers(map);
      await clearPendingLinkRequest(contact.lineUserId);
      showFlash?.(`✅ ผูก LINE กับ ${group.label} แล้ว`);
      setLinkPick(null);
      setLinkConfirm(null);
      await load();
    } catch (e) {
      showFlash?.('❌ ' + (e?.message || 'ผูกไม่สำเร็จ'));
    } finally {
      setBusyUid(null);
    }
  };

  const assignToAppMember = async (contact, memberId) => {
    if (!memberId) return;
    const member = appMembers.find((m) => m.id === memberId);
    setBusyUid(contact.lineUserId);
    try {
      const { staffSet } = await assignPendingLineUidToMember(memberId, contact.lineUserId);
      const dismissed = await fetchDismissedLineOaUids();
      setSkipUids(mergeSkipLineOaUidSets(dismissed, staffSet));
      setAppMembers((prev) => prev.map((m) => (
        m.id === memberId ? { ...m, lineUserId: contact.lineUserId } : m
      )));
      showFlash?.(`✅ บันทึก LINE UID ให้ ${member?.name || 'สมาชิก'} แล้ว — ไม่ขึ้นรอผูก`);
      setStaffAssign(null);
      setLinkPick(null);
      setLinkConfirm(null);
    } catch (e) {
      showFlash?.('❌ ' + (e?.message || 'บันทึกไม่สำเร็จ'));
    } finally {
      setBusyUid(null);
    }
  };

  const dismissContact = async (contact) => {
    if (!window.confirm(
      'ซ่อนรายการนี้จาก「รอผูก」?\n\nใช้กับการทดสอบบอท / UID ที่ไม่ใช่ร้านจริง\n(ออเดอร์ LINE ยังอยู่ในระบบ)',
    )) return;
    setBusyUid(contact.lineUserId);
    try {
      const next = await dismissLineOaPendingUid(contact.lineUserId);
      setSkipUids(mergeSkipLineOaUidSets(next, await fetchStaffLineUserIdSet()));
      showFlash?.('✅ ซ่อนรายการแล้ว');
      setLinkPick(null);
      setLinkConfirm(null);
    } catch (e) {
      showFlash?.('❌ ' + (e?.message || 'ซ่อนไม่สำเร็จ'));
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

  const renderLinkRoleChoice = (contact, customerId, customerName) => {
    const busy = busyUid === contact.lineUserId;
    return (
      <div className="mt-3 space-y-2 rounded-xl border border-blue-200 bg-blue-50/60 p-3">
        <p className="text-[10px] font-bold text-slate-700">
          ร้าน「{customerName}」มีเจ้าของ/โอนแล้ว — ผูก UID นี้แบบไหน?
        </p>
        <button
          type="button"
          disabled={busy}
          onClick={() => linkToCustomer(contact, customerId, 'order')}
          className="w-full py-2.5 rounded-xl bg-[#06C755] text-white text-xs font-bold disabled:opacity-50"
        >
          คนสั่งใน LINE (แนะนำ)
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            if (window.confirm('เปลี่ยนเจ้าของ/โอนเป็น UID นี้แทน? (รับบิล/สลิปจะไปคนนี้)')) {
              linkToCustomer(contact, customerId, 'billing');
            }
          }}
          className="w-full py-2 rounded-xl border border-amber-300 text-amber-900 text-xs font-bold bg-white disabled:opacity-50"
        >
          ตั้งเป็นเจ้าของ/โอนใหม่
        </button>
        <button
          type="button"
          onClick={() => setLinkConfirm(null)}
          className="w-full text-xs text-slate-400 py-1"
        >
          ยกเลิก
        </button>
      </div>
    );
  };

  const renderPendingCard = (contact) => {
    const busy = busyUid === contact.lineUserId;
    const picking = linkPick === contact.lineUserId;
    const confirming = linkConfirm?.contact?.lineUserId === contact.lineUserId;
    const assigningStaff = staffAssign === contact.lineUserId;
    const suggestions = suggestMainCatalogLinks(contact, fsCustomers);
    const multiGroups = multiLinkGroupsPending(contact.lineUserId, (id) => findCustomer(id));
    const linkedNames = (contact.linkedCustomers || []).map((c) => c.name).filter(Boolean);

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
          {contact.linkRequested && (
            <span className="text-[10px] bg-violet-100 text-violet-800 px-2 py-0.5 rounded-full font-bold">
              ขอผูกจาก LINE
            </span>
          )}
          <span className="text-[10px] bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full font-bold">
            {linkedNames.length ? 'ผูกบางร้านแล้ว' : 'ยังไม่ผูกรายชื่อหลัก'}
          </span>
          {contact.orderCount > 0 && (
            <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
              ออเดอร์ {contact.orderCount} ครั้ง
            </span>
          )}
          {contact.lastDeliveryDate && (
            <span className="text-[10px] bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">
              ส่งล่าสุด {contact.lastDeliveryDate}
            </span>
          )}
        </div>

        {linkedNames.length > 0 && (
          <p className="text-[10px] text-green-700 font-bold mt-1.5">
            ผูกแล้ว: {linkedNames.join(' · ')}
          </p>
        )}

        {multiGroups.length > 0 && !picking && !confirming && !assigningStaff && (
          <div className="mt-2 space-y-1">
            {multiGroups.map((group) => (
              <button
                key={group.id}
                type="button"
                disabled={busy}
                onClick={() => linkToCustomerGroup(contact, group)}
                className="w-full text-left text-xs font-bold text-indigo-800 bg-indigo-50 border border-indigo-200 rounded-lg px-2.5 py-2 disabled:opacity-50"
              >
                ผูกทั้ง {group.label}
                <span className="block text-[10px] font-normal text-indigo-600 mt-0.5">
                  {group.hint}
                  {group.missing?.length < group.shops.length
                    ? ` · เหลือ ${group.missing.map((s) => s.name).join(', ')}`
                    : ''}
                </span>
              </button>
            ))}
          </div>
        )}

        {confirming && renderLinkRoleChoice(
          contact,
          linkConfirm.customerId,
          linkConfirm.customerName,
        )}

        {assigningStaff && (
          <div className="mt-3 space-y-2 rounded-xl border border-violet-200 bg-violet-50/60 p-3">
            <p className="text-[10px] font-bold text-violet-900">
              เลือกสมาชิกแอป (ทดสอบบอท / ครอบครัว)
            </p>
            <select
              className="w-full border border-violet-200 rounded-xl px-3 py-2 text-sm font-bold bg-white"
              defaultValue=""
              onChange={(e) => {
                if (e.target.value) assignToAppMember(contact, e.target.value);
              }}
            >
              <option value="">— เลือกชื่อในแอป —</option>
              {appMembers.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name || m.email || m.id}
                  {m.lineUserId ? ` · มี UID แล้ว` : ''}
                  {' · '}
                  {getShrimpRoleLabel(m.role, m.email)}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => setStaffAssign(null)}
              className="w-full text-xs text-slate-400 py-1"
            >
              ยกเลิก
            </button>
          </div>
        )}

        {suggestions.length > 0 && !picking && !confirming && !assigningStaff && (
          <div className="mt-2 space-y-1">
            <p className="text-[10px] text-slate-500 font-bold">อาจเป็นร้านในระบบ:</p>
            {suggestions.slice(0, 3).map((c) => (
              <button
                key={c.id}
                type="button"
                disabled={busy}
                onClick={() => beginLink(contact, c.id)}
                className="w-full text-left text-xs font-bold text-blue-700 bg-blue-50 border border-blue-200 rounded-lg px-2.5 py-2 disabled:opacity-50"
              >
                ผูกกับ {c.name}
                {c.zone ? ` (${c.zone})` : ''}
              </button>
            ))}
          </div>
        )}

        {!picking && !confirming && !assigningStaff && (
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

        {!confirming && !assigningStaff && (
          <div className="flex gap-2 mt-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                setStaffAssign(contact.lineUserId);
                setLinkPick(null);
                setLinkConfirm(null);
              }}
              className="flex-1 py-2 rounded-xl border border-violet-200 bg-violet-50 text-violet-800 text-[11px] font-bold flex items-center justify-center gap-1 disabled:opacity-50"
            >
              <UserRound size={13} />
              สมาชิกแอป
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => dismissContact(contact)}
              className="flex-1 py-2 rounded-xl border border-slate-200 text-slate-500 text-[11px] font-bold flex items-center justify-center gap-1 disabled:opacity-50"
            >
              <EyeOff size={13} />
              ซ่อนรายการ
            </button>
          </div>
        )}

        {picking && !confirming && !assigningStaff && (
          <div className="mt-3 space-y-2">
            <p className="text-[10px] text-slate-500 font-bold">
              เลือกจากรายชื่อหลัก ({mainCatalog.length} ร้าน)
            </p>
            <select
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold"
              defaultValue=""
              onChange={(e) => {
                if (e.target.value) beginLink(contact, e.target.value);
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
          แท็บนี้เฉพาะคนทัก <strong>LINE OA ตรงๆ</strong>
          · ลูกค้าพิมพ์「ผูกไอดีลูกค้า」จะขึ้นที่นี่ (ไม่ต้องสั่งอาหาร) — แอดมินจับคู่ร้านเอง
          · ตาจุ้ยสองร้าน → กด「ผูกทั้งตาจุ้ยหนึ่ง + ตาจุ้ยสอง」ได้
          · ทดสอบบอท →「สมาชิกแอป」· เสร็จแล้ว →「ซ่อนรายการ」
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
