import { useEffect, useRef } from 'react';

/**
 * รัน callback ทันทีเมื่อเปิด และตามช่วงเวลา — หยุดเมื่อ enabled = false (ประหยัดแบต/เน็ต)
 */
export function useIntervalWhen(enabled, callback, delayMs) {
  const saved = useRef(callback);
  saved.current = callback;

  useEffect(() => {
    if (!enabled || !delayMs || delayMs <= 0) return undefined;
    const tick = () => saved.current();
    tick();
    const id = setInterval(tick, delayMs);
    return () => clearInterval(id);
  }, [enabled, delayMs]);
}
