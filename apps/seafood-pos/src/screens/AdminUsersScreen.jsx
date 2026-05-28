import React, { useEffect, useState } from 'react';
import { auth } from '../firebase';
import { fsDelete, fsPatch, fsRunQuery } from '../lib/firestoreRest';
import ShrimpLineNotifySettings from '../components/ShrimpLineNotifySettings';

function memberDeleteConfirmMessage(u) {
  const name = u.name || '—';
  const email = u.email || '—';
  return (
    `ลบสมาชิกถาวร?\n\n${name}\n${email}\n\n` +
    '· โปรไฟล์ในระบบจะหาย\n' +
    '· บัญชีอีเมลยังล็อกอิน Firebase ได้ (สมัครโปรไฟล์ใหม่ / รออนุมัติ)\n\n' +
    'กู้คืนไม่ได้'
  );
}

export default function AdminUsersScreen() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const rows = await fsRunQuery({
        from: [{ collectionId: 'shrimp_users' }],
        orderBy: [{ field: { fieldPath: 'createdAt' }, direction: 'ASCENDING' }],
        limit: 100,
      });
      setUsers(rows);
    } catch (e) {
      console.warn('loadUsers', e);
    }
    setLoading(false);
  };

  useEffect(() => { loadUsers(); }, []);

  const setApproved = async (uid, val) => {
    await fsPatch(`shrimp_users/${uid}`, { approved: val });
    setUsers((prev) => prev.map((u) => (u.id === uid ? { ...u, approved: val } : u)));
  };

  const setRole = async (uid, role) => {
    await fsPatch(`shrimp_users/${uid}`, { role });
    setUsers((prev) => prev.map((u) => (u.id === uid ? { ...u, role } : u)));
  };

  const deleteMember = async (u) => {
    const selfId = auth?.currentUser?.uid;
    if (!u.id || busyId) return;
    if (u.id === selfId) {
      alert('ลบบัญชีตัวเองไม่ได้');
      return;
    }
    const activeAdmins = users.filter((x) => x.role === 'admin' && x.approved);
    if (u.role === 'admin' && u.approved && activeAdmins.length <= 1) {
      alert('ต้องเหลือแอดมินที่อนุมัติแล้วอย่างน้อย 1 คน');
      return;
    }
    if (!window.confirm(memberDeleteConfirmMessage(u))) return;

    setBusyId(u.id);
    try {
      await fsDelete(`shrimp_users/${u.id}`);
      setUsers((prev) => prev.filter((x) => x.id !== u.id));
    } catch (e) {
      console.error(e);
      alert(e?.message || 'ลบไม่สำเร็จ — ลองอีกครั้ง');
      await loadUsers();
    } finally {
      setBusyId(null);
    }
  };

  if (loading) return <div className="p-8 text-center text-slate-400">กำลังโหลด...</div>;

  return (
    <div className="px-4 pt-4 pb-8 space-y-3">
      <ShrimpLineNotifySettings />
      <p className="text-xs font-bold text-slate-400 uppercase tracking-widest pt-2">
        จัดการสมาชิก ({users.length} คน)
      </p>
      {users.length === 0 && <p className="text-slate-300 text-center py-12">ยังไม่มีสมาชิก</p>}
      {users.map((u) => {
        const isSelf = u.id === auth?.currentUser?.uid;
        const deleting = busyId === u.id;
        return (
          <div key={u.id} className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200">
            <div className="flex justify-between items-start mb-3">
              <div className="min-w-0 flex-1">
                <p className="font-bold text-slate-800 truncate">{u.name || '—'}</p>
                <p className="text-xs text-slate-400 truncate">{u.email}</p>
                {isSelf && (
                  <p className="text-[10px] text-cyan-600 font-bold mt-0.5">บัญชีที่ล็อกอินอยู่</p>
                )}
              </div>
              <div className="flex items-center gap-1 ml-2 shrink-0">
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${u.role === 'admin' ? 'bg-purple-100 text-purple-700' : 'bg-slate-100 text-slate-600'}`}>
                  {u.role === 'admin' ? 'แอดมิน' : 'สตาฟ'}
                </span>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${u.approved ? 'bg-emerald-100 text-emerald-700' : 'bg-orange-100 text-orange-600'}`}>
                  {u.approved ? 'อนุมัติแล้ว' : 'รออนุมัติ'}
                </span>
              </div>
            </div>
            <div className="flex gap-2">
              {!u.approved ? (
                <button
                  type="button"
                  onClick={() => setApproved(u.id, true)}
                  className="flex-1 py-2 rounded-xl bg-emerald-500 text-white text-xs font-bold active:scale-95"
                >
                  ✓ อนุมัติ
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setApproved(u.id, false)}
                  className="flex-1 py-2 rounded-xl bg-red-50 text-red-500 text-xs font-bold active:scale-95"
                >
                  ✗ ระงับ
                </button>
              )}
              <button
                type="button"
                onClick={() => setRole(u.id, u.role === 'admin' ? 'staff' : 'admin')}
                className="flex-1 py-2 rounded-xl bg-slate-100 text-slate-700 text-xs font-bold active:scale-95"
              >
                {u.role === 'admin' ? '→ สตาฟ' : '→ แอดมิน'}
              </button>
            </div>
            <button
              type="button"
              disabled={isSelf || deleting}
              onClick={() => deleteMember(u)}
              className="w-full mt-2 py-2 rounded-xl border-2 border-red-200 text-red-600 text-xs font-bold active:scale-95 disabled:opacity-40 disabled:border-slate-200 disabled:text-slate-400"
            >
              {deleting ? 'กำลังลบ...' : '🗑 ลบสมาชิกถาวร'}
            </button>
          </div>
        );
      })}
    </div>
  );
}
