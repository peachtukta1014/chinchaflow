import React, { useRef, useState } from 'react';
import MemberAvatar from '../components/MemberAvatar';
import { getTeaRoleLabel } from '../lib/teaRoles';
import {
  changeTeaMemberPassword,
  updateTeaMemberProfile,
  uploadTeaMemberPhoto,
} from '../services/teaProfileService';

export default function MyProfileScreen({ member, onProfileUpdated, t }) {
  const fileRef = useRef(null);
  const [name, setName] = useState(member?.name || '');
  const [phone, setPhone] = useState(member?.phone || '');
  const [photoUrl, setPhotoUrl] = useState(member?.photoUrl || '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const clearFeedback = () => {
    setMessage('');
    setError('');
  };

  const onPickPhoto = () => fileRef.current?.click();

  const onPhotoFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    clearFeedback();
    setBusy('photo');
    try {
      const url = await uploadTeaMemberPhoto(member.uid, file);
      setPhotoUrl(url);
      setMessage(t('profilePhotoUpdated'));
      onProfileUpdated?.({ ...member, photoUrl: url });
    } catch (err) {
      setError(err?.message || t('profilePhotoFailed'));
    } finally {
      setBusy('');
    }
  };

  const onSaveProfile = async () => {
    clearFeedback();
    setBusy('profile');
    try {
      const updated = await updateTeaMemberProfile(member.uid, { name, phone });
      setMessage(t('profileSaved'));
      onProfileUpdated?.({
        ...member,
        name: updated.name,
        phone: updated.phone,
      });
    } catch (err) {
      setError(err?.message || t('profileSaveFailed'));
    } finally {
      setBusy('');
    }
  };

  const onChangePassword = async () => {
    clearFeedback();
    if (newPassword !== confirmPassword) {
      setError(t('profilePasswordMismatch'));
      return;
    }
    setBusy('password');
    try {
      await changeTeaMemberPassword({ currentPassword, newPassword });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setMessage(t('profilePasswordChanged'));
    } catch (err) {
      const code = err?.code || '';
      if (code.includes('wrong-password') || code.includes('invalid-credential')) {
        setError(t('profileWrongPassword'));
      } else if (code.includes('weak-password')) {
        setError(t('profileWeakPassword'));
      } else {
        setError(err?.message || t('profilePasswordFailed'));
      }
    } finally {
      setBusy('');
    }
  };

  return (
    <div className="px-4 pt-4 pb-10 space-y-4">
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-amber-200 flex flex-col items-center text-center gap-3">
        <button
          type="button"
          onClick={onPickPhoto}
          disabled={busy === 'photo'}
          className="relative active:scale-95 disabled:opacity-60"
        >
          <MemberAvatar
            name={name}
            email={member?.email}
            photoUrl={photoUrl}
            size="xl"
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
      </div>

      {message && (
        <p className="text-center text-sm font-bold text-emerald-600">{message}</p>
      )}
      {error && (
        <p className="text-center text-sm font-bold text-red-600">{error}</p>
      )}
    </div>
  );
}
