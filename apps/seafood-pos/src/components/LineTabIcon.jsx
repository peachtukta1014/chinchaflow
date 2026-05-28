import React from 'react';

/** ไอคอนแท็บออเดอร์ LINE — สีเขียวมาตรฐาน #06C755 */
export default function LineTabIcon({ size = 22, active = false }) {
  return (
    <span
      className="inline-flex items-center justify-center rounded-md font-black text-white mb-1 shadow-sm"
      style={{
        width: size,
        height: size,
        backgroundColor: '#06C755',
        fontSize: Math.round(size * 0.52),
        lineHeight: 1,
        opacity: active ? 1 : 0.92,
      }}
      aria-hidden
    >
      L
    </span>
  );
}
