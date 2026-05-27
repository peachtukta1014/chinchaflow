import { CATEGORY_ID_MY, MENU_KEY_MY, TOPPING_ID_MY } from './burmeseLexicon';

export function menuDisplayName(item, lang, t) {
  if (lang === 'my') {
    return item.nameMy || MENU_KEY_MY[item.key] || item.nameTh || t?.(item.key) || item.nameEn;
  }
  return item.nameTh || t?.(item.key) || item.nameEn;
}

/** บรรทัดรอง — พนักงานพม่าเห็นชื่อไทยช่วยจำ */
export function menuDisplaySub(item, lang) {
  if (lang === 'my') return item.nameTh || item.nameEn || '';
  return item.nameEn || '';
}

export function categoryDisplayLabel(cat, lang, t) {
  if (lang === 'my') return cat.labelMy || CATEGORY_ID_MY[cat.id] || cat.label;
  return cat.label;
}

export function categoryDisplaySub(cat, lang) {
  if (lang === 'my') return cat.label;
  return cat.labelEn || '';
}

export function toppingDisplayLabel(tp, lang) {
  if (lang === 'my') return tp.labelMy || TOPPING_ID_MY[tp.id] || tp.label;
  return tp.label;
}

export function toppingDisplaySub(tp, lang) {
  if (lang === 'my') return tp.label;
  return '';
}

/** ชื่อรายการในตะกร้า/ประวัติ — แปลตามภาษาปัจจุบัน ไม่ติด nameSnapshot */
export function cartItemDisplayName(item, lang, t, menuItems) {
  const menuItem = (menuItems || []).find((m) => m.key === item.key || m.id === item.key);
  if (menuItem) {
    return {
      primary: menuDisplayName(menuItem, lang, t),
      sub: menuDisplaySub(menuItem, lang),
    };
  }
  const fallback = item.nameSnapshot || item.nameEn || item.name || '';
  return { primary: fallback, sub: '' };
}
