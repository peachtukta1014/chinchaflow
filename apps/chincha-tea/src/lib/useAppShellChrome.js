import { useEffect } from 'react';

/** @typedef {'loading' | 'login' | 'app'} AppShell */

const CHROME = {
  loading: { surface: '#3d1f0f', theme: '#3d1f0f' },
  login: { surface: '#3d1f0f', theme: '#3d1f0f' },
  app: { surface: '#fdf6f0', theme: '#3d1f0f' },
};

/** ซิงก์สีพื้นหลัง html/body/#root — ลดอาการ layer หน้า login ค้างบน Android WebView */
export function useAppShellChrome(shell) {
  useEffect(() => {
    const { surface, theme } = CHROME[shell] || CHROME.app;
    const root = document.getElementById('root');
    document.documentElement.style.backgroundColor = surface;
    document.body.style.backgroundColor = surface;
    if (root) root.style.backgroundColor = surface;
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', theme);

    const repaint = () => {
      // OPPO/Android Chrome บางรุ่นค้างภาพ PWA ตอนกลับจาก home screen;
      // แตะ transform สั้น ๆ เพื่อบังคับ compositor วาดหน้า app ใหม่โดยไม่เปลี่ยน layout.
      if (!root || document.hidden) return;
      root.style.transform = 'translateZ(0)';
      window.requestAnimationFrame(() => {
        root.style.transform = '';
      });
    };

    repaint();
    document.addEventListener('visibilitychange', repaint);
    window.addEventListener('pageshow', repaint);
    window.addEventListener('focus', repaint);
    return () => {
      document.removeEventListener('visibilitychange', repaint);
      window.removeEventListener('pageshow', repaint);
      window.removeEventListener('focus', repaint);
    };
  }, [shell]);
}
