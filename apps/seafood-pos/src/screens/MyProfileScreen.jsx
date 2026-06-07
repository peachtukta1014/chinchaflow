import React, { useRef, useState } from 'react';
import MemberAvatar from '../components/MemberAvatar';
import { getShrimpRoleLabel } from '../lib/shrimpRoles';
import {
  changeShrimpMemberPassword,
  updateShrimpMemberProfile,
  uploadShrimpMemberPhoto,
} from '../services/shrimpProfileService';

export default function MyProfileScreen({ member, onProfileUpdated }) {
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
      const url = await uploadShrimpMemberPhoto(member.uid, file);
      setPhotoUrl(url);
      setMessage('อัปเดตรูปโปรไฟล์แล้ว');
      onProfileUpdated?.({ ...member, photoUrl: url });
    } catch (err) {
      setError(err?.message || 'อัปโหลดรูปไม่สำเร็จ');
    } finally {
      setBusy('');
    }
  };

  const onSaveProfile = async () => {
    clearFeedback();
    setBusy('profile');
    try {
      const updated = await updateShrimpMemberProfile(member.uid, { name, phone });
      setMessage('บันทึกข้อมูลแล้ว');
      onProfileUpdated?.({
        ...member,
        name: updated.name,
        displayName: updated.name,
        phone: updated.phone,
      });
    } catch (err) {
      setError(err?.message || 'บันทึกไม่สำเร็จ');
    } finally {
      setBusy('');
    }
  };

  const onChangePassword = async () => {
    clearFeedback();
    if (newPassword !== confirmPassword) {
      setError('รหัสผ่านใหม่กับยืนยันไม่ตรงกัน');
      return;
    }
    setBusy('password');
    try {
      await changeShrimpMemberPassword({ currentPassword, newPassword });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setMessage('เปลี่ยนรหัสผ่านแล้ว');
    } catch (err) {
      const code = err?.code || '';
      if (code.includes('wrong-password') || code.includes('invalid-credential')) {
        setError('รหัสผ่านเดิมไม่ถูกต้อง');
      } else if (code.includes('weak-password')) {
        setError('รหัสผ่านใหม่สั้นเกินไป');
      } else {
        setError(err?.message || 'เปลี่ยนรหัสผ่านไม่สำเร็จ');
      }
    } finally {
      setBusy('');
    }
  };

  return (
    <div className="px-4 pt-4 pb-10 space-y-4">
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200 flex flex-col items-center text-center gap-3">
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
            className="border-slate-200"
          />
          <span className="absolute -bottom-1 -right-1 bg-blue-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
            {busy === 'photo' ? '...' : 'เปลี่ยนรูป'}
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
          <p className="font-black text-slate-800">{name || 'สมาชิก'}</p>
          <p className="text-xs text-slate-500 mt-0.5">{member?.email}</p>
          <p className="text-[10px] text-amber-700 font-bold mt-1">
            {getShrimpRoleLabel(member?.role, member?.email)}
          </p>
        </div>
      </div>

      <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200 space-y-3">
        <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">ข้อมูลส่วนตัว</p>
        <label className="block text-[11px] font-bold text-slate-600">
          ชื่อเล่น
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-3 text-sm outline-none focus:border-blue-500"
          />
        </label>
        <label className="block text-[11px] font-bold text-slate-600">
          เบอร์โทร
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            inputMode="tel"
            placeholder="08xxxxxxxx"
            className="mt-1 w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-3 text-sm outline-none focus:border-blue-500"
          />
        </label>
        <label className="block text-[11px] font-bold text-slate-600">
          อีเมลล็อกอิน
          <input
            value={member?.email || ''}
            readOnly
            className="mt-1 w-full bg-slate-100 border border-slate-200 rounded-xl px-3 py-3 text-sm text-slate-500"
          />
        </label>
        <button
          type="button"
          onClick={onSaveProfile}
          disabled={busy === 'profile'}
          className="w-full py-3 rounded-xl bg-blue-600 text-white text-sm font-bold disabled:opacity-50"
        >
          {busy === 'profile' ? 'กำลังบันทึก...' : 'บันทึกข้อมูล'}
        </button>
      </div>

      <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200 space-y-3">
        <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">เปลี่ยนรหัสผ่าน</p>
        <input
          type="password"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          placeholder="รหัสผ่านเดิม"
          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-3 text-sm outline-none focus:border-blue-500"
        />
        <input
          type="password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          placeholder="รหัสผ่านใหม่ (อย่างน้อย 6 ตัว)"
          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-3 text-sm outline-none focus:border-blue-500"
        />
        <input
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          placeholder="ยืนยันรหัสผ่านใหม่"
          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-3 text-sm outline-none focus:border-blue-500"
        />
        <button
          type="button"
          onClick={onChangePassword}
          disabled={busy === 'password'}
          className="w-full py-3 rounded-xl border-2 border-slate-300 text-slate-700 text-sm font-bold disabled:opacity-50"
        >
          {busy === 'password' ? 'กำลังเปลี่ยน...' : 'เปลี่ยนรหัสผ่าน'}
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
