const DEFAULTS = {
  maxWidth: 1600,
  maxHeight: 1600,
  quality: 0.82,
  mimeType: 'image/jpeg',
};

function scaleDimensions(w, h, maxW, maxH) {
  if (w <= maxW && h <= maxH) return { width: w, height: h };
  const ratio = Math.min(maxW / w, maxH / h);
  return { width: Math.round(w * ratio), height: Math.round(h * ratio) };
}

/**
 * บีบรูปก่อนอัปโหลด — ลดขนาดไฟล์ อัปโหลดเร็ว เก็บ Storage ถูกลง
 * ใช้ canvas + JPEG (พอสำหรับดูบิล/ใบสั่งของ ไม่จำเป็นต้องไฟล์ต้นฉบับ)
 */
export async function compressImageFile(file, options = {}) {
  if (!file?.type?.startsWith('image/')) return file;

  const opts = { ...DEFAULTS, ...options };
  if (typeof createImageBitmap !== 'function' || typeof document === 'undefined') {
    return file;
  }

  try {
    const bitmap = await createImageBitmap(file);
    const { width, height } = scaleDimensions(
      bitmap.width,
      bitmap.height,
      opts.maxWidth,
      opts.maxHeight,
    );

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      bitmap.close?.();
      return file;
    }
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close?.();

    const blob = await new Promise((resolve, reject) => {
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error('compress failed'))),
        opts.mimeType,
        opts.quality,
      );
    });

    const base = (file.name || 'photo').replace(/\.[^.]+$/i, '') || 'photo';
    return new File([blob], `${base}.jpg`, { type: opts.mimeType, lastModified: Date.now() });
  } catch (e) {
    console.warn('compressImageFile: using original', e);
    return file;
  }
}
