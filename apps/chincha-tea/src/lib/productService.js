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
