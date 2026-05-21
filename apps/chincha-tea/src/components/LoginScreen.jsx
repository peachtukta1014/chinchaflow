import { useState } from 'react';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  setPersistence,
  browserLocalPersistence,
  browserSessionPersistence,
} from 'firebase/auth';
import { signOut } from 'firebase/auth';
import { auth, fbReady } from '../firebase';
import { fsGetDoc, fsPatch } from '../lib/firestoreRest';
import { T } from '../lib/i18n';

export function LoginScreen({ onAuthed, lang, setLang, pending, setPending }) {
  const t = (key) => T[lang]?.[key] ?? T.th?.[key] ?? key;
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nickname, setNickname] = useState('');
  const [remember, setRemember] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const loadProfile = async (uid) => {
    const profile = await fsGetDoc(`users/${uid}`);
    if (!profile) throw new Error('ไม่พบข้อมูลผู้ใช้ในระบบ');
    return { uid, ...profile };
  };

  const handleRegister = async () => {
    const em = email.trim().toLowerCase();
    const pw = password.trim();
    const name = nickname.trim();
    if (!em || !pw || pw.length < 6) { setError('กรุณากรอกอีเมลและรหัสผ่านอย่างน้อย 6 ตัว'); return; }
    if (!name) { setError('กรุณากรอกชื่อเล่น'); return; }
    if (!auth || !fbReady) { setError('Firebase ยังไม่พร้อม'); return; }
    setLoading(true);
    setError('');
    try {
      await setPersistence(auth, remember ? browserLocalPersistence : browserSessionPersistence);
      const cred = await createUserWithEmailAndPassword(auth, em, pw);
      await fsPatch(`users/${cred.user.uid}`, {
        name,
        email: em,
        role: 'staff',
        approved: false,
        uid: cred.user.uid,
        createdAt: new Date().toISOString(),
      });
      setPending(true);
    } catch (e) {
      setError(e?.message || 'สมัครไม่สำเร็จ');
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async () => {
    const em = email.trim().toLowerCase();
    const pw = password.trim();
    if (!em || !pw) { setError('กรุณากรอกอีเมลและรหัสผ่าน'); return; }
    if (!auth || !fbReady) { setError('Firebase ยังไม่พร้อม'); return; }
    setLoading(true);
    setError('');
    try {
      await setPersistence(auth, remember ? browserLocalPersistence : browserSessionPersistence);
      const cred = await signInWithEmailAndPassword(auth, em, pw);
      const profile = await loadProfile(cred.user.uid);
      if (profile.approved !== true) {
        setPending(true);
        return;
      }
      onAuthed(profile);
    } catch (e) {
      setError(e?.message || 'เข้าสู่ระบบไม่สำเร็จ');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = () => (mode === 'register' ? handleRegister() : handleLogin());

  if (pending) {
    return (
      <div
        className="min-h-screen flex flex-col items-center justify-center p-8 text-center"
        style={{ background: 'linear-gradient(160deg,#3d1f0f 0%,#6b3a2a 60%,#3d1f0f 100%)' }}
      >
        <div className="text-6xl mb-6">⏳</div>
        <h2 className="text-2xl font-black text-amber-300 mb-3">{t('pendingTitle')}</h2>
        <p className="text-amber-500 text-sm leading-relaxed max-w-xs">{t('pendingMsg')}</p>
        <button
          type="button"
          onClick={async () => {
            if (auth) await signOut(auth);
            setPending(false);
            setMode('login');
          }}
          className="mt-8 px-6 py-3 rounded-2xl font-bold text-amber-900 bg-amber-300 active:scale-95"
        >
          ← กลับ
        </button>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center p-6 max-w-md mx-auto relative overflow-hidden"
      style={{ background: 'linear-gradient(160deg,#3d1f0f 0%,#6b3a2a 60%,#3d1f0f 100%)' }}
    >
      <div
        className="absolute inset-0 opacity-[0.06]"
        style={{ backgroundImage: 'url(/chincha-logo.jpg)', backgroundSize: '110px', backgroundRepeat: 'repeat' }}
      />
      <div className="relative z-10 text-center mb-8 w-full">
        <img src="/chincha-logo.jpg" alt="CHINCHA" className="w-36 h-36 rounded-full object-cover mx-auto mb-4 border-4 border-amber-300 shadow-2xl" />
        <h1 className="text-3xl font-black text-amber-300 tracking-widest">CHINCHA</h1>
        <p className="text-amber-500 text-sm mt-1">{t('tagline')}</p>
        <div className="flex justify-center gap-2 mt-4">
          {['th', 'my', 'en'].map((l) => (
            <button
              key={l}
              type="button"
              onClick={() => setLang(l)}
              className={`px-4 py-1.5 rounded-full text-xs font-bold border-2 transition-all ${lang === l ? 'bg-amber-300 text-amber-900 border-amber-300' : 'text-amber-400 border-amber-700'}`}
            >
              {l === 'th' ? 'ไทย' : l === 'my' ? 'မြန်မာ' : 'EN'}
            </button>
          ))}
        </div>
      </div>
      <div className="relative z-10 w-full space-y-3">
        <p className="text-center text-amber-400 font-bold text-sm mb-1">
          {mode === 'register' ? t('registerTitle') : t('loginTitle')}
        </p>
        {mode === 'register' && (
          <input
            type="text"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            placeholder={t('nicknamePlaceholder')}
            className="w-full p-4 rounded-2xl text-stone-800 font-bold text-base outline-none bg-white/90"
          />
        )}
        <input
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={t('emailPlaceholder')}
          className="w-full p-4 rounded-2xl text-stone-800 font-bold text-base outline-none bg-white/90"
        />
        <input
          type="password"
          autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder={t('passwordPlaceholder')}
          className="w-full p-4 rounded-2xl text-stone-800 font-bold text-base outline-none bg-white/90"
        />
        <label className="flex items-center gap-2 text-amber-400 text-sm px-1">
          <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} className="w-4 h-4 rounded" />
          {t('rememberMe')}
        </label>
        {error && <p className="text-red-300 text-sm text-center font-bold">{error}</p>}
        <button
          type="button"
          onClick={handleSubmit}
          disabled={loading}
          className="w-full py-4 rounded-2xl font-black text-amber-900 text-lg bg-amber-300 shadow-lg active:scale-95 disabled:opacity-60"
        >
          {loading ? '⏳...' : mode === 'register' ? t('registerBtn') : t('loginBtn')}
        </button>
        <button
          type="button"
          onClick={() => { setMode((m) => (m === 'login' ? 'register' : 'login')); setError(''); }}
          className="w-full py-3 text-amber-400 text-sm font-bold"
        >
          {mode === 'login' ? '→ สมัครสมาชิกใหม่' : '← มีบัญชีแล้ว'}
        </button>
      </div>
    </div>
  );
}
