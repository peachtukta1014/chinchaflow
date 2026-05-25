import { createElement } from 'react';
import { createRoot } from 'react-dom/client';
import html2canvas from 'html2canvas';
import BillTemplate from '../components/BillTemplate';
import { saleToBillData } from './billDataFromSale';

export { normalizeLineItem } from './billRowMap';

function waitForPaint() {
  return new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(resolve));
  });
}

function waitForImages(container) {
  const imgs = [...container.querySelectorAll('img')];
  return Promise.all(
    imgs.map(
      (img) =>
        new Promise((resolve) => {
          if (img.complete) resolve();
          else {
            img.onload = () => resolve();
            img.onerror = () => resolve();
          }
        }),
    ),
  );
}

/** สร้างภาพบิลจากฟอร์ม React (ไม่ใช้ภาพสแกน) */
export async function generateBillImage(bill, customer = {}) {
  if (typeof document === 'undefined') {
    throw new Error('สร้างภาพบิลได้เฉพาะในเบราว์เซอร์');
  }

  const data = saleToBillData(bill, customer);
  const host = document.createElement('div');
  host.setAttribute('aria-hidden', 'true');
  host.style.cssText = 'position:fixed;left:-10000px;top:0;z-index:-1;pointer-events:none;';
  document.body.appendChild(host);

  const root = createRoot(host);
  try {
    root.render(createElement(BillTemplate, { data }));
    await waitForPaint();
    await waitForImages(host);

    const el = host.querySelector('#go-uan-bill');
    if (!el) throw new Error('ไม่พบฟอร์มบิล');

    const canvas = await html2canvas(el, {
      scale: 2,
      useCORS: true,
      allowTaint: false,
      backgroundColor: '#f8fafc',
      logging: false,
    });

    const blob = await new Promise((resolve, reject) => {
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error('สร้างภาพไม่สำเร็จ'))),
        'image/jpeg',
        0.92,
      );
    });

    return { blob, objectUrl: URL.createObjectURL(blob) };
  } finally {
    root.unmount();
    document.body.removeChild(host);
  }
}

export function revokeBillImageUrl(objectUrl) {
  if (objectUrl) URL.revokeObjectURL(objectUrl);
}

export function downloadBillImageBlob(blob, billNo = 'bill') {
  const safe = String(billNo).replace(/[^\w.-]+/g, '_');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${safe}.jpg`;
  a.click();
  URL.revokeObjectURL(a.href);
}
