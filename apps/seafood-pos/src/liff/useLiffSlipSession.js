import { useEffect, useState } from 'react';
import liff from '@line/liff';

/**
 * @returns {{
 *   status: 'loading'|'preview'|'error'|'ready',
 *   idToken?: string,
 *   displayName?: string,
 *   error?: string,
 * }}
 */
export function useLiffSlipSession() {
  const [state, setState] = useState({ status: 'loading' });

  useEffect(() => {
    // ห้าม fallback ไป VITE_LIFF_ID (สั่งออเดอร์) — endpoint คนละหน้า จะได้ Invalid LIFF ID
    const liffId = (import.meta.env.VITE_LIFF_SLIP_ID || '').trim();
    const isProdHost = /(^|\.)ko-seafood\.top$/i.test(window.location.hostname);
    const preview = !liffId && !isProdHost;

    if (!liffId && isProdHost) {
      setState({
        status: 'error',
        error: 'ระบบฝากสลิปกำลังเปิดใช้ — ลองใหม่ในอีกสักครู่ หรือส่งรูปสลิปในแชต LINE',
      });
      return;
    }

    if (preview) {
      setState({
        status: 'preview',
        idToken: 'preview',
        displayName: 'ตัวอย่าง',
      });
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        await liff.init({ liffId });
        if (!liff.isLoggedIn()) {
          liff.login({ redirectUri: window.location.href });
          return;
        }
        const idToken = liff.getIDToken();
        if (!idToken) throw new Error('ไม่ได้รับ LINE token');
        const profile = await liff.getProfile().catch(() => ({ displayName: '' }));
        if (cancelled) return;
        setState({
          status: 'ready',
          idToken,
          displayName: profile.displayName || '',
        });
      } catch (e) {
        if (!cancelled) {
          const raw = String(e?.message || '');
          const friendly = /invalid liff id/i.test(raw)
            ? 'ระบบฝากสลิปกำลังเปิดใช้ — ลองใหม่ในอีกสักครู่ หรือส่งรูปสลิปในแชต LINE'
            : (raw || 'เปิดจาก LINE ไม่สำเร็จ');
          setState({
            status: 'error',
            error: friendly,
          });
        }
      }
    })();

    return () => { cancelled = true; };
  }, []);

  return state;
}
