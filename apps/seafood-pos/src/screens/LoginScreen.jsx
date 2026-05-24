import React, { useState } from 'react';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { auth, isFirebaseReady } from '../firebase';
import { ADMIN_EMAIL } from '../constants';
import { FS_BASE } from '../lib/firestoreRest';

export default function LoginScreen({ onLogin }) {
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [name,     setName]     = useState('');
  const [mode,     setMode]     = useState('login'); // 'login' | 'register' | 'pending'
  const [error,    setError]    = useState('');
  const [loading,  setLoading]  = useState(false);


  const handleSubmit = async () => {
    if (!email.trim() || !password) { setError('กรุณากรอก Email และ Password'); return; }
    if (mode === 'register' && !name.trim()) { setError('กรุณากรอกชื่อเล่น'); return; }
    if (!auth) { setError('Firebase ยังไม่พร้อม'); return; }
    setLoading(true); setError('');
    try {
      if (mode === 'register') {
        const { user } = await createUserWithEmailAndPassword(auth, email.trim(), password);
        const token    = await user.getIdToken();
        const authH    = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
        const listJson = await fetch(`${FS_BASE}/shrimp_users?pageSize=1`, { headers: authH }).then(r => r.json());
        const isFirst  = !listJson.documents?.length;
        const isAdminEmail = email.trim().toLowerCase() === ADMIN_EMAIL.toLowerCase();
        const grantAdmin   = isFirst || isAdminEmail;
        await fetch(`${FS_BASE}/shrimp_users/${user.uid}`, {
          method: 'PATCH', headers: authH,
          body: JSON.stringify({ fields: {
            name:      { stringValue: name.trim() },
            email:     { stringValue: email.trim() },
            role:      { stringValue: grantAdmin ? 'admin' : 'staff' },
            approved:  { booleanValue: grantAdmin },
            createdAt: { stringValue: new Date().toISOString() },
          }}),
        });
        if (!grantAdmin) { await signOut(auth); setMode('pending'); return; }
        onLogin({ uid: user.uid, name: name.trim(), email: email.trim(), role: 'admin' });
      } else {
        const { user } = await signInWithEmailAndPassword(auth, email.trim(), password);
        const token    = await user.getIdToken();
        const authH    = { Authorization: `Bearer ${token}` };
        const resp = await fetch(`${FS_BASE}/shrimp_users/${user.uid}`, { headers: authH });
        if (!resp.ok) throw new Error('ไม่พบข้อมูลสมาชิก กรุณาสมัครสมาชิกก่อน');
        const f = (await resp.json()).fields || {};
        if (!f.approved?.booleanValue) { await signOut(auth); setMode('pending'); return; }
        onLogin({ uid: user.uid, name: f.name?.stringValue || 'สมาชิก', email: email.trim(), role: f.role?.stringValue || 'staff' });
      }
    } catch (e) {
      const c = e.code || '';
      if (c.includes('email-already-in-use'))                       setError('Email นี้ถูกใช้แล้ว');
      else if (c.includes('wrong-password') || c.includes('invalid-credential')) setError('Email หรือ Password ไม่ถูกต้อง');
      else if (c.includes('user-not-found'))                        setError('ไม่พบบัญชีนี้ กรุณาสมัครสมาชิกก่อน');
      else if (c.includes('weak-password'))                         setError('Password ต้องมีอย่างน้อย 6 ตัวอักษร');
      else setError(e?.message || 'เชื่อมต่อไม่ได้');
    } finally { setLoading(false); }
  };

  if (mode === 'pending') {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-6 text-white max-w-md mx-auto">
        <img src="/logo.jpg" alt="" className="w-28 h-28 rounded-3xl mb-6 shadow-2xl" />
        <div className="bg-yellow-500/20 border border-yellow-500/40 rounded-2xl p-6 text-center w-full">
          <p className="text-4xl mb-3">⏳</p>
          <p className="text-yellow-300 font-bold text-lg">รอการอนุมัติ</p>
          <p className="text-slate-400 text-sm mt-2">แอดมินจะอนุมัติสิทธิ์ให้เร็วๆ นี้ครับ</p>
          <p className="text-slate-500 text-xs mt-1">{email}</p>
        </div>
        <button onClick={() => { setMode('login'); setEmail(''); setPassword(''); setName(''); }}
          className="mt-6 text-slate-400 text-sm underline">ย้อนกลับ</button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col justify-center items-center p-6 text-white max-w-md mx-auto relative overflow-hidden">
      <div className="absolute top-[-10%] left-[-20%] w-64 h-64 bg-blue-600 rounded-full filter blur-3xl opacity-40" />
      <div className="absolute top-[20%] right-[-10%] w-64 h-64 bg-cyan-400 rounded-full filter blur-3xl opacity-40" />

      <div className="relative z-10 w-full text-center mb-10">
        <img src="/logo.jpg" alt="โกอ้วน คลังซีฟู้ด" className="w-44 h-44 object-contain mx-auto mb-4 rounded-3xl shadow-2xl drop-shadow-[0_0_30px_rgba(96,165,250,0.3)]" />
        <h1 className="text-2xl font-black text-white mb-1">โกอ้วน คลังซีฟู้ด</h1>
        <p className="text-slate-400 text-sm font-medium tracking-wide">ระบบจัดการสต๊อกและจุดขาย</p>
      </div>

      <div className="relative z-10 w-full space-y-3">
        {mode === 'register' && (
          <input value={name} onChange={e => setName(e.target.value)}
            placeholder="ชื่อเล่น"
            className="w-full bg-slate-800 border border-slate-700 text-white placeholder-slate-500 rounded-2xl px-4 py-4 text-base focus:outline-none focus:border-blue-500" />
        )}
        <input value={email} onChange={e => setEmail(e.target.value)}
          placeholder="Email" type="email" inputMode="email"
          className="w-full bg-slate-800 border border-slate-700 text-white placeholder-slate-500 rounded-2xl px-4 py-4 text-base focus:outline-none focus:border-blue-500" />
        <input value={password} onChange={e => setPassword(e.target.value)}
          placeholder="Password" type="password"
          onKeyDown={e => e.key === 'Enter' && handleSubmit()}
          className="w-full bg-slate-800 border border-slate-700 text-white placeholder-slate-500 rounded-2xl px-4 py-4 text-base focus:outline-none focus:border-blue-500" />

        {error && <p className="text-red-400 text-sm text-center">{error}</p>}

        <button onClick={handleSubmit} disabled={loading}
          className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-4 rounded-2xl shadow-lg active:scale-95 transition-all disabled:opacity-50">
          {loading ? 'กำลังตรวจสอบ...' : mode === 'register' ? 'สมัครสมาชิก' : 'เข้าสู่ระบบ'}
        </button>

        <button onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(''); }}
          className="w-full text-slate-400 text-sm py-2">
          {mode === 'login' ? 'ยังไม่มีบัญชี? → สมัครสมาชิก' : 'มีบัญชีแล้ว? → เข้าสู่ระบบ'}
        </button>

        {!isFirebaseReady && <p className="text-yellow-400 text-xs text-center">⚠️ Firebase config ยังไม่ครบ</p>}
      </div>
    </div>
  );
}
