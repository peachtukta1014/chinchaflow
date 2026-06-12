import React, { useEffect, useRef, useState } from 'react';
import MemberAvatar from '../components/MemberAvatar';
import { displayMemberPhotoUrl, stripPhotoCacheBust } from '../lib/memberAvatar';
import { getTeaRoleLabel, getTeaTabsForMember } from '../lib/teaRoles';
import {
  changeTeaMemberPassword,
  updateTeaMemberProfile,
  uploadTeaMemberPhoto,
} from '../services/teaProfileService';

function SectionFeedback({ message, error }) {
  if (!message && !error) return null;
  return (
    <p className={`text-center text-sm font-bold ${error ? 'text-red-600' : 'text-emerald-600'}`}>
      {error || message}
    </p>
  );
}

function resolveProfileError(err, t, fallbackKey) {
  const code = err?.code || err?.message || '';
  if (code.startsWith('profile')) {
    const translated = t(code);
    if (translated !== code) return translated;
  }
  const fb = String(err?.code || '');
  if (fb.includes('wrong-password') || fb.includes('invalid-credential')) {
    return t('profileWrongPassword');
  }
  if (fb.includes('weak-password')) return t('profileWeakPassword');
  return err?.message || t(fallbackKey);
}

export default function MyProfileScreen({ member, onProfileUpdated, t }) {
  const fileRef = useRef(null);
  const [name, setName] = useState(member?.name || '');
  const [phone, setPhone] = useState(member?.phone || '');
  const [photoUrl, setPhotoUrl] = useState(
    () => displayMemberPhotoUrl(member?.photoUrl, member?.photoUpdatedAt),
  );
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [busy, setBusy] = useState('');
  const [photoFeedback, setPhotoFeedback] = useState({ message: '', error: '' });
  const [profileFeedback, setProfileFeedback] = useState({ message: '', error: '' });
  const [passwordFeedback, setPasswordFeedback] = useState({ message: '', error: '' });
  const visibleTabs = getTeaTabsForMember(member).filter((tabId) => tabId !== 'my-profile');

  useEffect(() => {
    setName(member?.name || '');
    setPhone(member?.phone || '');
    setPhotoUrl(displayMemberPhotoUrl(member?.photoUrl, member?.photoUpdatedAt));
  }, [member?.name, member?.phone, member?.photoUrl, member?.photoUpdatedAt]);

  const onPickPhoto = () => fileRef.current?.click();

  const onPhotoFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setPhotoFeedback({ message: '', error: '' });
    setBusy('photo');
    try {
      const url = await uploadTeaMemberPhoto(member.uid, file);
      const photoUpdatedAt = new Date().toISOString();
      setPhotoUrl(url);
      setPhotoFeedback({ message: t('profilePhotoUpdated'), error: '' });
      onProfileUpdated?.({
        ...member,
        photoUrl: stripPhotoCacheBust(url),
        photoUpdatedAt,
      });
    } catch (err) {
      setPhotoFeedback({
        message: '',
        error: resolveProfileError(err, t, 'profilePhotoFailed'),
      });
    } finally {
      setBusy('');
    }
  };

  const onSaveProfile = async () => {
    setProfileFeedback({ message: '', error: '' });
    setBusy('profile');
    try {
      const updated = await updateTeaMemberProfile(member.uid, { name, phone });
      setProfileFeedback({ message: t('profileSaved'), error: '' });
      onProfileUpdated?.({
        ...member,
        name: updated.name,
        phone: updated.phone,
      });
    } catch (err) {
      setProfileFeedback({
        message: '',
        error: resolveProfileError(err, t, 'profileSaveFailed'),
      });
    } finally {
      setBusy('');
    }
  };

  const onChangePassword = async () => {
    setPasswordFeedback({ message: '', error: '' });
    if (newPassword !== confirmPassword) {
      setPasswordFeedback({ message: '', error: t('profilePasswordMismatch') });
      return;
    }
    setBusy('password');
    try {
      await changeTeaMemberPassword({ currentPassword, newPassword });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setPasswordFeedback({ message: t('profilePasswordChanged'), error: '' });
    } catch (err) {
      setPasswordFeedback({
        message: '',
        error: resolveProfileError(err, t, 'profilePasswordFailed'),
      });
    } finally {
      setBusy('');
    }
  };

  return (
    <div className="px-4 pt-2 pb-10 space-y-3">
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-amber-200 flex flex-col items-center text-center gap-2">
        <button
          type="button"
          onClick={onPickPhoto}
          disabled={busy === 'photo'}
          className="relative active:scale-95 disabled:opacity-60"
        >
          <MemberAvatar
            key={photoUrl || 'no-photo'}
            name={name}
            email={member?.email}
            photoUrl={photoUrl}
            size="lg"
          />
          <span
            className="absolute -bottom-1 -right-1 text-white text-[10px] font-bold px-2 py-0.5 rounded-full"
            style={{ background: '#3d1f0f' }}
          >
            {busy === 'photo' ? '...' : t('profileChangePhoto')}
          </span>
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={onPhotoFile}
        />
        <SectionFeedback {...photoFeedback} />
        <div>
          <p className="font-black text-amber-900">{name || t('profileMember')}</p>
          <p className="text-xs text-amber-700 mt-0.5">{member?.email}</p>
          <p className="text-[10px] text-amber-600 font-bold mt-1">
            {getTeaRoleLabel(member?.role, t)}
          </p>
        </div>
      </div>

      <div className="bg-white rounded-2xl p-4 shadow-sm border border-amber-200 space-y-3">
        <p className="text-xs font-bold text-amber-700 uppercase tracking-widest">
          {t('profileAccessTitle')}
        </p>
        <div className="grid grid-cols-2 gap-2 text-[11px]">
          <div className="rounded-xl bg-amber-50 border border-amber-100 px-3 py-2">
            <p className="font-black text-amber-900">{t('profileRole')}</p>
            <p className="font-bold text-amber-700 mt-0.5">{getTeaRoleLabel(member?.role, t)}</p>
          </div>
          <div className="rounded-xl bg-amber-50 border border-amber-100 px-3 py-2">
            <p className="font-black text-amber-900">{t('profileUserCode')}</p>
            <p className="font-bold text-amber-700 mt-0.5">{member?.userCode || '—'}</p>
          </div>
          <div className="rounded-xl bg-amber-50 border border-amber-100 px-3 py-2">
            <p className="font-black text-amber-900">{t('profileBranch')}</p>
            <p className="font-bold text-amber-700 mt-0.5">{member?.branchId || 'main'}</p>
          </div>
          <div className="rounded-xl bg-amber-50 border border-amber-100 px-3 py-2">
            <p className="font-black text-amber-900">{t('profileStatus')}</p>
            <p className="font-bold text-emerald-700 mt-0.5">{member?.approved ? t('profileApproved') : t('pendingTitle')}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {visibleTabs.map((tabId) => (
            <span key={tabId} className="rounded-full bg-stone-100 border border-stone-200 px-2 py-1 text-[10px] font-black text-stone-600">
              {t(`profileAccess_${tabId}`)}
            </span>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-2xl p-4 shadow-sm border border-amber-200 space-y-3">
        <p className="text-xs font-bold text-amber-700 uppercase tracking-widest">
          {t('profilePersonalInfo')}
        </p>
        <label className="block text-[11px] font-bold text-amber-800">
          {t('nicknamePlaceholder')}
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 w-full bg-amber-50 border border-amber-200 rounded-xl px-3 py-3 text-sm outline-none focus:border-amber-500"
          />
        </label>
        <label className="block text-[11px] font-bold text-amber-800">
          {t('profilePhone')}
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            inputMode="tel"
            placeholder="08xxxxxxxx"
            className="mt-1 w-full bg-amber-50 border border-amber-200 rounded-xl px-3 py-3 text-sm outline-none focus:border-amber-500"
          />
        </label>
        <label className="block text-[11px] font-bold text-amber-800">
          {t('profileLoginEmail')}
          <input
            value={member?.email || ''}
            readOnly
            className="mt-1 w-full bg-amber-100 border border-amber-200 rounded-xl px-3 py-3 text-sm text-amber-600"
          />
        </label>
        <button
          type="button"
          onClick={onSaveProfile}
          disabled={busy === 'profile'}
          className="w-full py-3 rounded-xl text-white text-sm font-bold disabled:opacity-50"
          style={{ background: '#3d1f0f' }}
        >
          {busy === 'profile' ? t('profileSaving') : t('profileSave')}
        </button>
        <SectionFeedback {...profileFeedback} />
      </div>

      <div className="bg-white rounded-2xl p-4 shadow-sm border border-amber-200 space-y-3">
        <p className="text-xs font-bold text-amber-700 uppercase tracking-widest">
          {t('profileChangePassword')}
        </p>
        <input
          type="password"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          placeholder={t('profileCurrentPassword')}
          className="w-full bg-amber-50 border border-amber-200 rounded-xl px-3 py-3 text-sm outline-none focus:border-amber-500"
        />
        <input
          type="password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          placeholder={t('profileNewPassword')}
          className="w-full bg-amber-50 border border-amber-200 rounded-xl px-3 py-3 text-sm outline-none focus:border-amber-500"
        />
        <input
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          placeholder={t('profileConfirmPassword')}
          className="w-full bg-amber-50 border border-amber-200 rounded-xl px-3 py-3 text-sm outline-none focus:border-amber-500"
        />
        <button
          type="button"
          onClick={onChangePassword}
          disabled={busy === 'password'}
          className="w-full py-3 rounded-xl border-2 border-amber-300 text-amber-900 text-sm font-bold disabled:opacity-50"
        >
          {busy === 'password' ? t('profileChangingPassword') : t('profileChangePasswordBtn')}
        </button>
        <SectionFeedback {...passwordFeedback} />
      </div>
    </div>
  );
}
