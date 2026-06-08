import { useState } from 'react';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  setPersistence,
  browserLocalPersistence,
  browserSessionPersistence,
} from 'firebase/auth';
import { signOut } from 'firebase/auth';
import { auth, fbReady } from '../firebase';
import { fsGetDoc, fsPatch, fsSetUserProfile } from '../lib/firestoreRest';
import { getTeaSignupRole, isBootstrapAdminEmail } from '../lib/constants';
import { CreditsStrip, PlatformMark } from '@chincha/app-credits';
import { T } from '../lib/i18n';

function authErrorKey(code) {
  if (!code) return null;
  if (code.includes('invalid-credential') || code.includes('wrong-password') || code.includes('user-not-found')) return 'authInvalidLogin';
  if (code.includes('email-already-in-use')) return 'authEmailInUse';
  if (code.includes('weak-password')) return 'authWeakPw';
  if (code.includes('invalid-email')) return 'authInvalidEmail';
  if (code.includes('too-many-requests')) return 'authTooMany';
  if (code.includes('network-request-failed')) return 'authNetwork';
  return null;
}

export function LoginScreen({ onAuthed, lang, setLang, pending, setPending }) {
  const t = (key) => T[lang]?.[key] ?? T.th?.[key] ?? key;
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nickname, setNickname] = useState('');
  const [remember, setRemember] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [resetSent, setResetSent] = useState(false);

  const loadOrCreateProfile = async (uid, em) => {
    let profile = await fsGetDoc(`users/${uid}`);
    if (!profile) {
      const role = getTeaSignupRole(em);
      await fsSetUserProfile(uid, {
        name: em.split('@')[0],
        email: em,
        role,
        approved: true,
        uid,
        createdAt: new Date().toISOString(),
      });
      profile = await fsGetDoc(`users/${uid}`);
    }
    if (!profile) throw new Error('authCreateFailed');
    return ensureBootstrapAdmin(uid, em, { uid, ...profile });
  };

  /** บัญชีที่สมัครก่อน PR #48 อาจยังเป็น staff/รออนุมัติ — อัปเกรดเมื่อล็อกอินด้วยเมล bootstrap */
  const ensureBootstrapAdmin = async (uid, em, profile) => {
    if (!isBootstrapAdminEmail(em)) return profile;
    if (profile.role === 'admin' && profile.approved === true) return profile;
    await fsPatch(`users/${uid}`, { role: 'admin', approved: true });
    const updated = await fsGetDoc(`users/${uid}`);
    return updated ? { uid, ...updated } : { ...profile, role: 'admin', approved: true };
  };

  const handleRegister = async () => {
    const em = email.trim().toLowerCase();
    const pw = password.trim();
    const name = nickname.trim();
    if (!em || !pw || pw.length < 6) { setError(t('authNeedEmailPw')); return; }
    if (!name) { setError(t('authNeedNickname')); return; }
    if (!auth || !fbReady) { setError(t('storageNotReady')); return; }
    setLoading(true);
    setError('');
    try {
      await setPersistence(auth, remember ? browserLocalPersistence : browserSessionPersistence);
      const cred = await createUserWithEmailAndPassword(auth, em, pw);
      const role = getTeaSignupRole(em);
      await fsSetUserProfile(cred.user.uid, {
        name,
        email: em,
        role,
        approved: true,
        uid: cred.user.uid,
        createdAt: new Date().toISOString(),
      });
      const profile = await fsGetDoc(`users/${cred.user.uid}`);
      if (profile) onAuthed({ uid: cred.user.uid, ...profile });
    } catch (e) {
      const code = e?.code || '';
      const key = authErrorKey(code);
      setError(key ? t(key) : (e?.message?.startsWith('auth') ? t(e.message) : e?.message) || t('authRegisterFailed'));
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async () => {
    const em = email.trim().toLowerCase();
    const pw = password.trim();
    if (!em || !pw) { setError(t('authNeedLoginFields')); return; }
    if (!auth || !fbReady) { setError(t('storageNotReady')); return; }
    setLoading(true);
    setError('');
    try {
      await setPersistence(auth, remember ? browserLocalPersistence : browserSessionPersistence);
      const cred = await signInWithEmailAndPassword(auth, em, pw);
      const profile = await loadOrCreateProfile(cred.user.uid, em);
      if (profile.approved !== true) {
        setPending(true);
        setError('');
        return;
      }
      onAuthed({ uid: cred.user.uid, ...profile });
    } catch (e) {
      const code = e?.code || '';
      const key = authErrorKey(code);
      setError(key ? t(key) : e?.message || t('authLoginFailed'));
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async () => {
    const em = email.trim().toLowerCase();
    if (!em) { setError(t('authForgotEmail')); return; }
    if (!auth) { setError(t('storageNotReady')); return; }
    try {
      await sendPasswordResetEmail(auth, em);
      setResetSent(true);
      setError('');
    } catch (e) {
      const code = e?.code || '';
      const key = authErrorKey(code);
      setError(key ? t(key) : t('authResetFailed'));
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
      className="min-h-screen flex flex-col items-center p-6 pb-8 max-w-md mx-auto relative overflow-hidden"
      style={{ background: 'linear-gradient(160deg,#3d1f0f 0%,#6b3a2a 60%,#3d1f0f 100%)' }}
    >
      <div
        className="absolute inset-0 opacity-[0.06]"
        style={{ backgroundImage: 'url(/chincha-logo.jpg)', backgroundSize: '110px', backgroundRepeat: 'repeat' }}
      />
      <div className="relative z-10 text-center mb-8 w-full pt-[max(1.5rem,env(safe-area-inset-top))]">
        <PlatformMark theme="tea" size="md" showTagline lang={lang} className="mb-2" />
        <CreditsStrip theme="tea" onDark className="mb-3 px-2" />
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
      <div className="relative z-10 w-full space-y-3 flex-1 flex flex-col justify-center">
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
        {resetSent && <p className="text-emerald-300 text-sm text-center font-bold">ส่งลิงก์รีเซ็ตรหัสผ่านไปที่อีเมลแล้ว</p>}
        <button
          type="button"
          onClick={handleSubmit}
          disabled={loading}
          className="w-full py-4 rounded-2xl font-black text-amber-900 text-lg bg-amber-300 shadow-lg active:scale-95 disabled:opacity-60"
        >
          {loading ? '⏳...' : mode === 'register' ? t('registerBtn') : t('loginBtn')}
        </button>
        {mode === 'login' && (
          <button
            type="button"
            onClick={handleResetPassword}
            className="w-full py-2 text-amber-600 text-xs font-bold"
          >
            ลืมรหัสผ่าน? กดส่งลิงก์รีเซ็ตทางอีเมล
          </button>
        )}
        <button
          type="button"
          onClick={() => { setMode((m) => (m === 'login' ? 'register' : 'login')); setError(''); setResetSent(false); }}
          className="w-full py-3 text-amber-400 text-sm font-bold"
        >
          {mode === 'login' ? '→ สมัครสมาชิกใหม่' : '← มีบัญชีแล้ว'}
        </button>
      </div>
    </div>
  );
}
