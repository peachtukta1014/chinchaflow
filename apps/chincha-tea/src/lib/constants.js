/** อีเมลแอดมินหลัก — สมัคร/ล็อกอินครั้งแรกได้ role admin + อนุมัติทันที (ตรง firestore.rules) */
export const BOOTSTRAP_ADMIN_EMAILS = [
  'gmc-peach@chincha.pos',
  'peachtukta1014@gmail.com',
];

/** @deprecated ใช้ isBootstrapAdminEmail() แทน */
export const BOOTSTRAP_ADMIN_EMAIL = BOOTSTRAP_ADMIN_EMAILS[0];

export function isBootstrapAdminEmail(email) {
  const em = (email || '').trim().toLowerCase();
  return BOOTSTRAP_ADMIN_EMAILS.some((e) => e.toLowerCase() === em);
}

/** role ตอนสมัครครั้งแรก — แอดมิน bootstrap เท่านั้นที่ได้ admin ทันที */
export function getTeaSignupRole(email) {
  return isBootstrapAdminEmail(email) ? 'admin' : 'staff';
}

/** ค่าแรงพนักงานต่อวันที่มาทำงาน (บาท) */
export const STAFF_DAILY_WAGE = 400;

/** กะงานร้านชา — แสดงในแท็บตัดวัน (ไม่ผูกชื่อพนักงานคนใดคนหนึ่ง) */
export const STAFF_SHIFT_DEFAULTS = {
  shiftCheckIn: '07:00–08:00',
  storeClose: '19:00',
};

/** หมวดเครื่องดื่ม — ร้านชงชา · กาแฟ · ผลไม้ปั่น (ไม่ใช่คาเฟ่) */
export const DRINK_CATEGORIES = [
  { id: 'milk-tea', label: 'ชานม/ชงชา', labelMy: 'လက်ဖက်နို့', labelEn: 'MILK TEA', accent: '#c87941', accentBg: '#fff5eb', emoji: '🧋' },
  { id: 'clear-tea', label: 'ชาชง', labelMy: 'လက်ဖက်ရည်ချို', labelEn: 'BREWED TEA', accent: '#4a7a5a', accentBg: '#edf7f0', emoji: '🍵' },
  { id: 'coffee', label: 'กาแฟ', labelMy: 'ကော်ဖီ', labelEn: 'COFFEE', accent: '#8b5a2b', accentBg: '#faf3eb', emoji: '☕' },
  { id: 'blended', label: 'ผลไม้สดปั่น', labelMy: '်သီးဖျော်ပါး', labelEn: 'FRUIT SMOOTHIE', accent: '#b94a6a', accentBg: '#fdeef2', emoji: '🍓' },
];

export const DEFAULT_MENU = [
  { id: 'thai-tea', key: 'thaiTea', nameEn: 'Thai Tea', nameTh: 'ชาไทย', basePrice: 30, category: 'milk-tea', tag: 'ชงชา', star: true, emoji: '🧋', active: true },
  { id: 'brown-sugar', key: 'brownSugar', nameEn: 'Brown Sugar Milk Tea', nameTh: 'ชานมบราวน์ชูการ์', basePrice: 35, category: 'milk-tea', tag: 'ยอดนิยม', star: true, emoji: '🧋', active: true },
  { id: 'green-tea', key: 'greenTea', nameEn: 'Green Tea', nameTh: 'ชาเขียว', basePrice: 30, category: 'clear-tea', tag: 'ชง', star: false, emoji: '🍵', active: true },
  { id: 'lemon-tea', key: 'lemonTea', nameEn: 'Lemon Tea', nameTh: 'ชามะนาว', basePrice: 30, category: 'clear-tea', tag: 'ชง', star: false, emoji: '🍋', active: true },
  { id: 'matcha', key: 'matcha', nameEn: 'Matcha', nameTh: 'มัทฉะ', basePrice: 35, category: 'clear-tea', tag: 'ชง', star: true, emoji: '🍃', active: true },
  { id: 'black-tea', key: 'blackTea', nameEn: 'Black Tea', nameTh: 'ชาดำ', basePrice: 25, category: 'clear-tea', tag: 'ชง', star: false, emoji: '🍵', active: true },
  { id: 'coffee', key: 'coffee', nameEn: 'Coffee', nameTh: 'กาแฟเย็น', basePrice: 35, category: 'coffee', tag: 'กาแฟ', star: true, emoji: '☕', active: true },
  { id: 'thai-coffee', key: 'thaiCoffee', nameEn: 'Thai Iced Coffee', nameTh: 'โอเลี้ยง', basePrice: 35, category: 'coffee', tag: 'กาแฟ', star: false, emoji: '🥤', active: true },
  { id: 'latte', key: 'latte', nameEn: 'Latte', nameTh: 'ลาเต้', basePrice: 40, category: 'coffee', tag: 'กาแฟ', star: false, emoji: '☕', active: true },
  { id: 'mango-smoothie', key: 'mangoSmoothie', nameEn: 'Mango Smoothie', nameTh: 'มะม่วงปั่น', basePrice: 45, category: 'blended', tag: 'ผลไม้', star: true, emoji: '🥭', active: true },
  { id: 'strawberry', key: 'strawberry', nameEn: 'Strawberry Smoothie', nameTh: 'สตรอว์เบอร์รีปั่น', basePrice: 45, category: 'blended', tag: 'ผลไม้', star: true, emoji: '🍓', active: true },
  { id: 'watermelon', key: 'watermelonSmoothie', nameEn: 'Watermelon Smoothie', nameTh: 'แตงโมปั่น', basePrice: 40, category: 'blended', tag: 'ผลไม้', star: false, emoji: '🍉', active: true },
  { id: 'mixed-fruit', key: 'mixedFruitSmoothie', nameEn: 'Mixed Fruit Smoothie', nameTh: 'ผลไม้รวมปั่น', basePrice: 50, category: 'blended', tag: 'รวม', star: false, emoji: '🍹', active: true },
  { id: 'taro', key: 'taro', nameEn: 'Taro Smoothie', nameTh: 'เผือกปั่น', basePrice: 45, category: 'blended', tag: 'ปั่น', star: false, emoji: '🫐', active: true },
];

export const DEFAULT_TOPPINGS = [
  { id: 'pearl', label: 'ไข่มุก', price: 10, active: true },
  { id: 'coco-jelly', label: 'วุ้นมะพร้าว', price: 10, active: true },
  { id: 'grass-jelly', label: 'เฉาก๊วย', price: 10, active: true },
  { id: 'taro-ball', label: 'บัวลอย', price: 10, active: true },
  { id: 'popping', label: 'ไข่มุกป๊อบ', price: 15, active: true },
];

export const SIZES = [
  { id: '22oz', label: '22oz', addPrice: 0 },
  { id: '32oz', label: '32oz', addPrice: 15 },
];

export const SWEET_OPTIONS = [
  { id: '0', label: '0%' },
  { id: '25', label: '25%' },
  { id: '50', label: '50%' },
  { id: '70', label: '70%' },
  { id: '100', label: '100%' },
];

export const ICE_OPTIONS = [
  { id: 'noice', labelKey: 'noice' },
  { id: 'lessice', labelKey: 'lessice' },
  { id: 'normalice', labelKey: 'normalice' },
  { id: 'fullice', labelKey: 'fullice' },
];

export function dateKeyBangkok(d = new Date()) {
  return new Date(d.getTime() + 7 * 3600000).toISOString().split('T')[0];
}

/** เลื่อนวันที่ YYYY-MM-DD (+1 / -1) */
export function shiftDateKey(dateKey, days) {
  const d = new Date(`${dateKey}T12:00:00+07:00`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' });
}

export function menuItemToCard(item, t, lang = 'th') {
  const cat = DRINK_CATEGORIES.find((c) => c.id === item.category) || DRINK_CATEGORIES[0];
  const nameMy = item.nameMy || (lang === 'my' && t?.(item.key));
  const primary = lang === 'my'
    ? (nameMy || item.nameTh || t?.(item.key) || item.nameEn)
    : (item.nameTh || t?.(item.key) || item.nameEn);
  return {
    ...item,
    nameDisplay: primary,
    nameSub: lang === 'my' ? (item.nameTh || item.nameEn) : item.nameEn,
    cat,
    bg: 'bg-white',
    border: 'border-stone-100',
  };
}
