import React from 'react';
import { memberAvatarInitials } from '../lib/memberAvatar';

const SIZES = {
  xs: 'w-7 h-7 text-[10px]',
  sm: 'w-9 h-9 text-xs',
  md: 'w-10 h-10 text-sm',
  lg: 'w-16 h-16 text-lg',
  xl: 'w-24 h-24 text-2xl',
};

export default function MemberAvatar({
  name = '',
  email = '',
  photoUrl = '',
  size = 'md',
  className = '',
}) {
  const box = SIZES[size] || SIZES.md;
  const initials = memberAvatarInitials(name, email);

  if (photoUrl) {
    return (
      <img
        src={photoUrl}
        alt={name || 'โปรไฟล์'}
        className={`${box} rounded-full object-cover border-2 border-slate-700 shrink-0 bg-slate-800 ${className}`}
      />
    );
  }

  return (
    <div
      className={`${box} rounded-full border-2 border-slate-700 shrink-0 bg-gradient-to-br from-cyan-600 to-blue-700 text-white font-black flex items-center justify-center ${className}`}
      aria-hidden
    >
      {initials}
    </div>
  );
}
