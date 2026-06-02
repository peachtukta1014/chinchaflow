import { useEffect, useState } from 'react';
import liff from '@line/liff';
import { fetchLiffContext } from './liffOrderApi.js';

function parsePreviewMode() {
  const q = new URLSearchParams(window.location.search);
  return {
    forceNew: q.get('mode') === 'new',
    forcePick: q.get('mode') === 'pick',
  };
}

/**
 * @returns {{
 *   status: 'loading'|'preview'|'error'|'ready',
 *   idToken?: string,
 *   displayName?: string,
 *   context?: { mode: string, customer?: object|null },
 *   error?: string,
 *   isPreview?: boolean,
 * }}
 */
export function useLiffSession() {
  const [state, setState] = useState({ status: 'loading', isPreview: false });

  useEffect(() => {
    const liffId = (import.meta.env.VITE_LIFF_ID || '').trim();
    const isProdHost = /(^|\.)ko-seafood\.top$/i.test(window.location.hostname);
    const preview = !liffId && !isProdHost;

    if (!liffId && isProdHost) {
      setState({
        status: 'error',
        isPreview: false,
        error: 'ระบบกำลังเปิดใช้ฟอร์มสั่ง — ลองใหม่ในอีกสักครู่ หรือพิมพ์สั่งในแชต LINE',
      });
      return;
    }

    if (preview) {
      const { forceNew, forcePick } = parsePreviewMode();
      let mode = 'short';
      if (forceNew) mode = 'new';
      else if (forcePick) mode = 'pick';
      setState({
        status: 'preview',
        isPreview: true,
        context: {
          mode,
          customer: mode === 'short' ? { id: 'c1', name: 'จ๊ะขียด', zone: 'ป่าตอง' } : null,
        },
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
        const ctx = await fetchLiffContext(idToken);
        if (cancelled) return;

        const { forceNew } = parsePreviewMode();
        setState({
          status: 'ready',
          isPreview: false,
          idToken,
          displayName: profile.displayName || ctx.lineDisplayName || '',
          context: forceNew ? { mode: 'new', customer: null } : ctx,
        });
      } catch (e) {
        if (!cancelled) {
          setState({
            status: 'error',
            isPreview: false,
            error: e?.message || 'เปิด LIFF ไม่สำเร็จ',
          });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}

export function closeLiffWindow() {
  if (window.liff?.closeWindow) window.liff.closeWindow();
  else window.close();
}
