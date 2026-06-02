import React from 'react';

/** ไทยหลัก · อังกฤษบรรทัดล่างตัวเล็ก */
export function Bilingual({ th, en, className = '' }) {
  if (!en) {
    return <span className={className}>{th}</span>;
  }
  return (
    <span className={`block ${className}`.trim()}>
      <span>{th}</span>
      <span className="block text-[10px] font-normal text-slate-400 leading-snug mt-0.5">{en}</span>
    </span>
  );
}

export function BilingualHeading({ th, en, as: Tag = 'h2', className = '', id }) {
  return (
    <Tag id={id} className={className}>
      <span className="block">{th}</span>
      {en && (
        <span className="block text-[10px] font-normal text-slate-400 leading-snug mt-0.5 normal-case">
          {en}
        </span>
      )}
    </Tag>
  );
}

export function BilingualHint({ th, en }) {
  if (!th && !en) return null;
  return (
    <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
      {th}
      {en && (
        <span className="block text-[10px] text-slate-400 mt-0.5">{en}</span>
      )}
    </p>
  );
}

/** ปุ่ม / chip — ไทยบรรทัดเดียว อังกฤษในวงเล็กถัดไป (ไม่ใหญ่) */
export function BilingualInline({ th, en, className = '' }) {
  if (!en) return <span className={className}>{th}</span>;
  return (
    <span className={className}>
      {th}
      <span className="text-[10px] font-normal text-slate-400 ml-1">({en})</span>
    </span>
  );
}
