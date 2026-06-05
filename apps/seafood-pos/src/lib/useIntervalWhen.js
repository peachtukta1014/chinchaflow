import { useEffect, useRef, useState } from 'react';

/**
 * รัน callback ทันทีเมื่อเปิด และตามช่วงเวลา — หยุดเมื่อ enabled = false
 * @param {boolean} pauseWhenHidden — ข้าม tick ตอนแท็บไม่โฟกัส (ลด REST poll)
 */
export function useIntervalWhen(enabled, callback, delayMs, { pauseWhenHidden = false } = {}) {
  const saved = useRef(callback);
  saved.current = callback;

  const [visible, setVisible] = useState(
    () => !pauseWhenHidden || typeof document === 'undefined' || document.visibilityState === 'visible',
  );

  useEffect(() => {
    if (!pauseWhenHidden || typeof document === 'undefined') return undefined;
    const onVis = () => setVisible(document.visibilityState === 'visible');
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [pauseWhenHidden]);

  const active = enabled && (!pauseWhenHidden || visible);

  useEffect(() => {
    if (!active || !delayMs || delayMs <= 0) return undefined;
    const tick = () => saved.current();
    tick();
    const id = setInterval(tick, delayMs);
    return () => clearInterval(id);
  }, [active, delayMs]);
}
