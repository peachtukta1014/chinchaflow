import { DEFAULT_MENU, DEFAULT_TOPPINGS } from './constants';
import { fsPatch, fsPost } from './firestoreRest';

export function normalizeProductForm(form) {
  return {
    nameTh: (form.nameTh || '').trim(),
    nameEn: (form.nameEn || '').trim(),
    nameMy: (form.nameMy || '').trim(),
    key: (form.key || '').trim() || (form.nameEn || '').toLowerCase().replace(/\s+/g, '-'),
    basePrice: Math.max(0, parseInt(form.basePrice, 10) || 0),
    category: form.category || 'milk-tea',
    tag: (form.tag || '').trim(),
    emoji: form.emoji || '☕',
    star: !!form.star,
    active: form.active !== false,
    voiceAliases: (form.voiceAliases || '').trim(),
  };
}

export async function saveProduct(form, id) {
  const data = normalizeProductForm(form);
  if (id) {
    await fsPatch(`products/${id}`, data);
    return { id, ...data };
  }
  const created = await fsPost('products', data);
  return created;
}

export async function updateProductPrice(id, basePrice) {
  const price = Math.max(0, parseInt(basePrice, 10) || 0);
  await fsPatch(`products/${id}`, { basePrice: price });
  return price;
}

export function normalizeToppingForm(form) {
  return {
    label: (form.label || '').trim(),
    price: Math.max(0, parseInt(form.price, 10) || 0),
    active: form.active !== false,
  };
}

export async function saveTopping(form, id) {
  const data = normalizeToppingForm(form);
  if (id) {
    await fsPatch(`toppings/${id}`, data);
    return { id, ...data };
  }
  return fsPost('toppings', data);
}

function productKeyOf(p) {
  return (p.key || p.id || '').trim();
}

/** เมนูบนหน้าขายที่ยังไม่อยู่ใน Firestore (แก้ไม่ได้จนกว่าจะนำเข้า) */
export function listMenuNotInFirestore(products = []) {
  const keys = new Set(products.map(productKeyOf).filter(Boolean));
  return DEFAULT_MENU.filter((d) => !keys.has(d.key) && !keys.has(d.id));
}

/** นำเมนูเริ่มต้นเข้า Firestore — ข้ามรายการที่มี key ซ้ำแล้ว */
export async function importDefaultMenuToFirestore(existingProducts = []) {
  const keys = new Set(existingProducts.map(productKeyOf).filter(Boolean));
  let added = 0;
  for (const item of DEFAULT_MENU) {
    if (keys.has(item.key) || keys.has(item.id)) continue;
    await fsPost('products', normalizeProductForm(item));
    keys.add(item.key);
    added += 1;
  }
  return added;
}

export async function importDefaultToppingsToFirestore(existingToppings = []) {
  const labels = new Set(existingToppings.map((t) => (t.label || '').trim()));
  let added = 0;
  for (const item of DEFAULT_TOPPINGS) {
    if (labels.has(item.label)) continue;
    await fsPost('toppings', normalizeToppingForm(item));
    labels.add(item.label);
    added += 1;
  }
  return added;
}
