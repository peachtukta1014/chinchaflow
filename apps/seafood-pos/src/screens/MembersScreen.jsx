import React, { useEffect, useState } from 'react';
import { PlusCircle, Trash2 } from 'lucide-react';
import {
  createCustomer,
  deleteCustomer,
  isDeletableCustomer,
  mergeCustomerLists,
  suggestLineUserIdFromOrders,
  subscribeCustomers,
  updateCustomer,
} from '../services/customerService';
import { isValidLineUserId } from '../lib/lineUserId';

export default function MembersScreen({ isAdmin = false }) {
  const [fsCustomers, setFsCustomers] = useState({});
  const [cusLoading, setCusLoading] = useState(true);
  const [cusEditId, setCusEditId] = useState(null);
  const [cusEditData, setCusEditData] = useState({ name: '', zone: '', phone: '', lineUserId: '' });
  const [showAdd, setShowAdd] = useState(false);
  const [newCus, setNewCus] = useState({ name: '', zone: '', phone: '', lineUserId: '' });
  const [suggestBusy, setSuggestBusy] = useState(null);
  const [saveBusy, setSaveBusy] = useState(false);

  useEffect(() => subscribeCustomers(
    (map) => { setFsCustomers(map); setCusLoading(false); },
    () => setCusLoading(false),
  ), []);

  const allCustomers = mergeCustomerLists(fsCustomers);

  const [saveFlash, setSaveFlash] = useState('');
  const showFlash = (msg) => { setSaveFlash(msg); setTimeout(() => setSaveFlash(''), 3000); };

  const saveCusEdit = async (id) => {
    if (!cusEditData.name.trim()) {
      showFlash('❌ ใส่ชื่อลูกค้าก่อนครับ');
      return;
    }
    setSaveBusy(true);
    try {
      await updateCustomer(id, cusEditData);
      setCusEditId(null);
      showFlash('✅ บันทึกสำเร็จแล้วครับ');
    } catch (e) {
      showFlash('❌ บันทึกไม่สำเร็จ: ' + (e?.message || 'ลองใหม่'));
    } finally {
      setSaveBusy(false);
    }
  };

  const fillLineFromOrders = async (target, setData, customerName) => {
    setSuggestBusy(target);
    try {
      const id = await suggestLineUserIdFromOrders(customerName);
      if (!id) {
        showFlash('ไม่พบ LINE ID — ชื่อต้องตรงกับออเดอร์ LINE ทุกตัวอักษร');
        return;
      }
      setData((p) => ({ ...p, lineUserId: id }));
      showFlash('✅ ดึง LINE ID จากออเดอร์ล่าสุดแล้ว');
    } catch (e) {
      showFlash('❌ ดึงไม่สำเร็จ');
    } finally {
      setSuggestBusy(null);
    }
  };

  const addCustomer = async () => {
    if (!newCus.name.trim()) {
      showFlash('❌ ใส่ชื่อลูกค้าก่อนครับ');
      return;
    }
    setSaveBusy(true);
    try {
      await createCustomer(newCus);
      setNewCus({ name: '', zone: '', phone: '', lineUserId: '' });
      setShowAdd(false);
      showFlash('✅ เพิ่มลูกค้าสำเร็จแล้วครับ');
    } catch (e) {
      showFlash('❌ เพิ่มไม่สำเร็จ: ' + (e?.message || 'ลองใหม่'));
    } finally {
      setSaveBusy(false);
    }
  };

  const removeCustomer = async (c) => {
    if (!isDeletableCustomer(c)) {
      showFlash('ลบได้เฉพาะลูกค้าที่เพิ่มเอง (cx_...) — รายการเริ่มต้นแก้ชื่อได้อย่างเดียว');
      return;
    }
    if (!window.confirm(`ลบลูกค้า "${c.name}" ออกจากระบบ?`)) return;
    setSaveBusy(true);
    try {
      await deleteCustomer(c.id);
      if (cusEditId === c.id) setCusEditId(null);
      showFlash('✅ ลบลูกค้าแล้ว');
    } catch (e) {
      showFlash('❌ ลบไม่สำเร็จ: ' + (e?.message || 'ลองใหม่'));
    } finally {
      setSaveBusy(false);
    }
  };

  return (
    <div className="p-4 space-y-4">
      {saveFlash && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 bg-emerald-600 text-white text-sm font-bold px-6 py-3 rounded-2xl shadow-2xl whitespace-nowrap max-w-[90vw] text-center">
          {saveFlash}
        </div>
      )}
      <>
        <p className="text-[10px] text-slate-500 leading-relaxed">
          บันทึก LINE User ID (U...) เพื่อส่งบิลอัตโนมัติ — ดึงจากออเดอร์ได้เมื่อชื่อตรงทุกตัวอักษร
        </p>
        <div className="flex items-center justify-between">
          <h2 className="text-base font-black text-slate-800">รายชื่อลูกค้า</h2>
          <button
            type="button"
            onClick={() => setShowAdd((v) => !v)}
            className="bg-blue-600 text-white text-xs font-bold px-3 py-2 rounded-xl flex items-center gap-1.5 active:scale-95"
          >
            <PlusCircle size={14} /> เพิ่มลูกค้า
          </button>
        </div>
        {showAdd && (
          <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 space-y-3">
            <p className="text-xs font-bold text-blue-600">เพิ่มลูกค้าใหม่</p>
            <input
              value={newCus.name}
              onChange={(e) => setNewCus((p) => ({ ...p, name: e.target.value }))}
              placeholder="ชื่อลูกค้า *"
              autoFocus
              className="w-full bg-white border border-blue-200 rounded-xl px-3 py-2.5 text-sm font-bold outline-none"
            />
            <input
              value={newCus.zone}
              onChange={(e) => setNewCus((p) => ({ ...p, zone: e.target.value }))}
              placeholder="โซน (เช่น ป่าตอง)"
              className="w-full bg-white border border-blue-200 rounded-xl px-3 py-2.5 text-sm outline-none"
            />
            <input
              value={newCus.phone}
              onChange={(e) => setNewCus((p) => ({ ...p, phone: e.target.value }))}
              placeholder="เบอร์โทร (ถ้ามี)"
              type="tel"
              className="w-full bg-white border border-blue-200 rounded-xl px-3 py-2.5 text-sm outline-none"
            />
            <input
              value={newCus.lineUserId}
              onChange={(e) => setNewCus((p) => ({ ...p, lineUserId: e.target.value }))}
              placeholder="LINE User ID (U...)"
              className="w-full bg-white border border-green-200 rounded-xl px-3 py-2.5 text-sm font-mono outline-none"
            />
            <button
              type="button"
              disabled={suggestBusy === 'add' || !newCus.name.trim()}
              onClick={() => fillLineFromOrders('add', setNewCus, newCus.name)}
              className="w-full text-xs font-bold text-green-700 border border-green-300 py-2.5 rounded-xl disabled:opacity-40"
            >
              {suggestBusy === 'add' ? 'กำลังค้นหา...' : 'ดึง LINE ID จากออเดอร์ล่าสุด'}
            </button>
            <div className="flex gap-2 pt-1">
              <button
                type="button"
                disabled={saveBusy}
                onClick={addCustomer}
                className="flex-1 bg-blue-600 text-white text-sm font-bold py-2.5 rounded-xl active:scale-95 disabled:opacity-50"
              >
                {saveBusy ? 'กำลังบันทึก...' : 'บันทึก'}
              </button>
              <button
                type="button"
                onClick={() => { setShowAdd(false); setNewCus({ name: '', zone: '', phone: '', lineUserId: '' }); }}
                className="flex-1 bg-white border border-slate-200 text-slate-500 text-sm font-bold py-2.5 rounded-xl"
              >
                ยกเลิก
              </button>
            </div>
          </div>
        )}
        {cusLoading ? (
          <p className="text-slate-400 text-sm text-center py-8">กำลังโหลด...</p>
        ) : (
          <div className="space-y-2">
            {allCustomers.map((c) => (
              <div
                key={c.id}
                className={`bg-white rounded-2xl p-4 shadow-sm border ${
                  c.duplicate ? 'border-amber-300 bg-amber-50/40' : 'border-slate-100'
                }`}
              >
                {cusEditId === c.id ? (
                  <div className="space-y-3">
                    <input
                      value={cusEditData.name}
                      onChange={(e) => setCusEditData((p) => ({ ...p, name: e.target.value }))}
                      placeholder="ชื่อลูกค้า"
                      autoFocus
                      className="w-full border border-blue-400 rounded-xl px-3 py-2.5 text-sm font-bold outline-none"
                    />
                    <input
                      value={cusEditData.zone}
                      onChange={(e) => setCusEditData((p) => ({ ...p, zone: e.target.value }))}
                      placeholder="โซน"
                      className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none"
                    />
                    <input
                      value={cusEditData.phone}
                      onChange={(e) => setCusEditData((p) => ({ ...p, phone: e.target.value }))}
                      placeholder="เบอร์โทร"
                      type="tel"
                      className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none"
                    />
                    <input
                      value={cusEditData.lineUserId}
                      onChange={(e) => setCusEditData((p) => ({ ...p, lineUserId: e.target.value }))}
                      placeholder="LINE User ID (U...)"
                      className="w-full border border-green-200 rounded-xl px-3 py-2.5 text-sm font-mono outline-none"
                    />
                    <button
                      type="button"
                      disabled={suggestBusy === c.id || !cusEditData.name.trim()}
                      onClick={() => fillLineFromOrders(c.id, setCusEditData, cusEditData.name)}
                      className="w-full text-xs font-bold text-green-700 border border-green-300 py-2.5 rounded-xl disabled:opacity-40"
                    >
                      {suggestBusy === c.id ? 'กำลังค้นหา...' : 'ดึง LINE ID จากออเดอร์ล่าสุด'}
                    </button>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        disabled={saveBusy}
                        onClick={() => saveCusEdit(c.id)}
                        className="flex-1 bg-blue-600 text-white text-xs font-bold py-2.5 rounded-xl active:scale-95 disabled:opacity-50"
                      >
                        {saveBusy ? 'กำลังบันทึก...' : 'บันทึก'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setCusEditId(null)}
                        className="flex-1 border border-slate-200 text-slate-400 text-xs font-bold py-2.5 rounded-xl"
                      >
                        ยกเลิก
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-slate-800 truncate">{c.name}</p>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        {c.duplicate && (
                          <span className="text-[10px] bg-amber-200 text-amber-800 px-2 py-0.5 rounded-full font-bold">
                            ชื่อซ้ำ
                          </span>
                        )}
                        {c.zone && (
                          <span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">{c.zone}</span>
                        )}
                        {c.phone && <span className="text-[10px] text-slate-400">{c.phone}</span>}
                        {c.lineUserId && (
                          <span
                            className={`text-[10px] px-2 py-0.5 rounded-full font-mono ${
                              isValidLineUserId(c.lineUserId)
                                ? 'bg-green-100 text-green-700'
                                : 'bg-amber-100 text-amber-700'
                            }`}
                          >
                            LINE {c.lineUserId.slice(0, 6)}…
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          setCusEditId(c.id);
                          setCusEditData({
                            name: c.name,
                            zone: c.zone || '',
                            phone: c.phone || '',
                            lineUserId: c.lineUserId || '',
                          });
                        }}
                        className="text-xs text-blue-500 border border-blue-200 px-3 py-1.5 rounded-lg"
                      >
                        แก้ไข
                      </button>
                      {isDeletableCustomer(c) && (
                        <button
                          type="button"
                          disabled={saveBusy}
                          onClick={() => removeCustomer(c)}
                          className="text-xs text-red-500 border border-red-200 px-2 py-1.5 rounded-lg"
                          title="ลบลูกค้าที่เพิ่มเอง"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </>
    </div>
  );
}
