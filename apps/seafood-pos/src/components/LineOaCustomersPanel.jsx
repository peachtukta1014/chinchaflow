import React, { useCallback, useEffect, useState } from 'react';
import { Link2, RefreshCw, UserPlus } from 'lucide-react';
import {
  createCustomerVerified,
  fetchCustomersMap,
  mergeCustomerLists,
  saveCustomerVerified,
  subscribeCustomers,
} from '../services/customerService';
import {
  fetchLineOaContacts,
  findCustomerByExactName,
  findCustomerByLineUserId,
} from '../services/lineOaCustomerService';
import { isValidLineUserId } from '../lib/lineUserId';

export default function LineOaCustomersPanel({ showFlash }) {
  const [fsCustomers, setFsCustomers] = useState({});
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyUid, setBusyUid] = useState(null);
  const [linkPick, setLinkPick] = useState(null);

  const allCustomers = mergeCustomerLists(fsCustomers);

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
    const linked = findCustomerByLineUserId(list, lineUserId);
    if (!linked) {
      throw new Error('ผูกไม่สำเร็จ — ลองรีเฟรชหรือบันทึกอีกครั้ง');
    }
    if (expectedName && linked.name !== expectedName) {
      throw new Error(`ผูกแล้วแต่ชื่อไม่ตรง (ได้ "${linked.name}")`);
    }
    return linked;
  };

  const saveAsNewCustomer = async (contact, nameOverride) => {
    const name = (nameOverride || contact.suggestedName || '').trim();
    if (!name) {
      showFlash?.('❌ ใส่ชื่อลูกค้าก่อนครับ');
      return;
    }
    setBusyUid(contact.lineUserId);
    try {
      const existing = findCustomerByExactName(allCustomers, name);
      let map;
      if (existing) {
        const result = await saveCustomerVerified(existing.id, {
          name: existing.name,
          zone: existing.zone || '',
          phone: existing.phone || '',
          lineUserId: contact.lineUserId,
        });
        map = result.map;
        confirmLinked(map, contact.lineUserId, existing.name);
        showFlash?.(`✅ ผูก LINE กับ "${existing.name}" แล้ว`);
      } else {
        const result = await createCustomerVerified({
          name,
          zone: 'LINE OA',
          phone: '',
          lineUserId: contact.lineUserId,
        });
        map = result.map;
        confirmLinked(map, contact.lineUserId, name);
        showFlash?.(`✅ เพิ่ม "${name}" เข้ารายชื่อหลักแล้ว`);
      }
      setFsCustomers(map);
      await load();
    } catch (e) {
      showFlash?.('❌ ' + (e?.message || 'บันทึกไม่สำเร็จ'));
    } finally {
      setBusyUid(null);
      setLinkPick(null);
    }
  };

  const linkToExisting = async (contact, customerId) => {
    const c = allCustomers.find((x) => x.id === customerId);
    if (!c) return;
    setBusyUid(contact.lineUserId);
    try {
      const { map } = await saveCustomerVerified(c.id, {
        name: c.name,
        zone: c.zone || '',
        phone: c.phone || '',
        lineUserId: contact.lineUserId,
      });
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

  return (
    <div className="space-y-3">
      <div className="bg-[#06C755]/10 border border-[#06C755]/30 rounded-2xl p-3">
        <p className="text-xs text-[#047857] leading-relaxed font-medium">
          เฉพาะลูกค้าที่ทัก LINE OA แชทตรง (ไม่รวมกลุ่ม LINE ภายใน)
          หลังผูกจะขึ้น「ผูกแล้ว」สีเขียว — ถ้ายังส้มให้กดรีเฟรช
        </p>
      </div>
      <div className="flex items-center justify-between">
        <p className="text-sm font-black text-slate-800">
          ลูกค้า LINE OA ({contacts.length})
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
      ) : contacts.length === 0 ? (
        <p className="text-slate-400 text-sm text-center py-8">
          ยังไม่มีคนทัก LINE OA — จะขึ้นที่นี่เมื่อมีออเดอร์จาก LINE
        </p>
      ) : (
        <div className="space-y-2">
          {contacts.map((contact) => {
            const linked = findCustomerByLineUserId(allCustomers, contact.lineUserId);
            const busy = busyUid === contact.lineUserId;
            const picking = linkPick === contact.lineUserId;

            return (
              <div
                key={contact.lineUserId}
                className="bg-white rounded-2xl p-4 shadow-sm border border-[#06C755]/20"
              >
                <div className="flex justify-between items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-slate-800 truncate">
                      {contact.displayNames.join(' · ') || 'ลูกค้า LINE'}
                    </p>
                    <p className="text-[10px] font-mono text-slate-400 mt-0.5 truncate">
                      UID …{contact.lineUserId.slice(-8)}
                    </p>
                    <div className="flex flex-wrap gap-1.5 mt-1.5">
                      <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
                        ออเดอร์ {contact.orderCount} ครั้ง
                      </span>
                      {contact.lastDeliveryDate && (
                        <span className="text-[10px] bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">
                          ส่งล่าสุด {contact.lastDeliveryDate}
                        </span>
                      )}
                      {linked ? (
                        <span className="text-[10px] bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-bold">
                          ผูกแล้ว → {linked.name}
                        </span>
                      ) : (
                        <span className="text-[10px] bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full font-bold">
                          ยังไม่ผูกรายชื่อหลัก
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {!linked && !picking && (
                  <div className="flex gap-2 mt-3">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => saveAsNewCustomer(contact)}
                      className="flex-1 py-2 rounded-xl bg-[#06C755] text-white text-xs font-bold flex items-center justify-center gap-1 disabled:opacity-50"
                    >
                      <UserPlus size={14} />
                      บันทึกเข้ารายชื่อ
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => setLinkPick(contact.lineUserId)}
                      className="flex-1 py-2 rounded-xl border border-slate-200 text-slate-700 text-xs font-bold flex items-center justify-center gap-1"
                    >
                      <Link2 size={14} />
                      ผูกลูกค้าเดิม
                    </button>
                  </div>
                )}

                {picking && (
                  <div className="mt-3 space-y-2">
                    <p className="text-[10px] text-slate-500 font-bold">เลือกลูกค้าในรายชื่อหลัก</p>
                    <select
                      className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold"
                      defaultValue=""
                      onChange={(e) => {
                        if (e.target.value) linkToExisting(contact, e.target.value);
                      }}
                    >
                      <option value="">— เลือกชื่อ —</option>
                      {allCustomers.map((c) => (
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

                {linked && (
                  <p className="text-[10px] text-green-700 mt-2 font-medium">
                    พร้อมส่งบิลอัตโนมัติเมื่อเลือก "{linked.name}" ตอนขาย
                    {isValidLineUserId(linked.lineUserId) ? '' : ' (UID ยังไม่ถูกต้อง)'}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
