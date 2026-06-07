/**
 * Pre-render ภาพบิลเก็บ Storage + sales.billImageUrl — ลดเวลา shrimpPushBill
 */
function billRenderCacheKey(billData) {
  const pt = String(billData?.paymentType || '');
  const rem = billData?.creditTransfer?.unpaidAmount;
  const unpaid = rem != null && rem !== '' ? String(rem) : String(billData?.remainingAmount ?? '');
  const total = String(billData?.totalAmount ?? '');
  const recv = String(billData?.moneyReceiverName || '');
  return `${pt}|${unpaid}|${total}|${recv}`;
}

async function uploadCachedBillImage(admin, buffer, saleId) {
  const bucket = admin.storage().bucket();
  const safeId = String(saleId).replace(/[^\w-]+/g, '_').slice(0, 64);
  const path = `lineBills/cache/${safeId}.png`;
  const file = bucket.file(path);
  await file.save(buffer, {
    metadata: { contentType: 'image/png', cacheControl: 'public, max-age=86400' },
  });
  await file.makePublic();
  return `https://storage.googleapis.com/${bucket.name}/${path}`;
}

async function resolveCachedBillImageUrl(db, saleId, billData) {
  if (!saleId || !billData) return null;
  const snap = await db.collection('sales').doc(String(saleId)).get();
  if (!snap.exists) return null;
  const data = snap.data() || {};
  const key = billRenderCacheKey(billData);
  if (data.billImageUrl && data.billImageKey === key) {
    return String(data.billImageUrl);
  }
  return null;
}

async function preRenderBillForSale(db, admin, saleId, billData) {
  const id = String(saleId || billData?.saleId || '').trim();
  if (!id || !billData || typeof billData !== 'object') {
    const err = new Error('saleId_and_billData_required');
    err.code = 'saleId_and_billData_required';
    throw err;
  }
  const key = billRenderCacheKey(billData);
  const cached = await resolveCachedBillImageUrl(db, id, billData);
  if (cached) return { url: cached, key, cached: true };

  const { renderShrimpBillJpeg } = require('./shrimpBillRender');
  const buffer = await renderShrimpBillJpeg(billData);
  const url = await uploadCachedBillImage(admin, buffer, id);
  await db.collection('sales').doc(id).set({
    billImageUrl: url,
    billImageKey: key,
    billImageAt: new Date().toISOString(),
  }, { merge: true });
  return { url, key, cached: false };
}

module.exports = {
  billRenderCacheKey,
  resolveCachedBillImageUrl,
  preRenderBillForSale,
};
