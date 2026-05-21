/** หมวดเครื่องดื่มสำหรับ CRUD / แสดงเมนู */
export const DRINK_CATEGORIES = [
  { id: 'milk-tea', label: 'ชานม', labelEn: 'MILK TEA', accent: '#c87941', accentBg: '#fff5eb', emoji: '🧋' },
  { id: 'clear-tea', label: 'ชาใส', labelEn: 'CLEAR TEA', accent: '#4a7a5a', accentBg: '#edf7f0', emoji: '🍵' },
  { id: 'coffee', label: 'กาแฟ', labelEn: 'COFFEE', accent: '#8b5a2b', accentBg: '#faf3eb', emoji: '☕' },
  { id: 'soda', label: 'โซดา', labelEn: 'SODA', accent: '#3b82a8', accentBg: '#eef6fb', emoji: '🥤' },
  { id: 'blended', label: 'เมนูปั่น', labelEn: 'BLENDED', accent: '#b94a6a', accentBg: '#fdeef2', emoji: '🍓' },
];

export const DEFAULT_MENU = [
  { id: 'thai-tea', key: 'thaiTea', nameEn: 'Thai Tea', nameTh: 'ชาไทย', basePrice: 30, category: 'milk-tea', tag: 'ชาดี', star: true, emoji: '🧋', active: true },
  { id: 'brown-sugar', key: 'brownSugar', nameEn: 'Brown Sugar Milk', nameTh: 'ชานมบราวน์ชูการ์', basePrice: 35, category: 'milk-tea', tag: 'ยอดนิยม', star: true, emoji: '🧋', active: true },
  { id: 'green-tea', key: 'greenTea', nameEn: 'Green Tea', nameTh: 'ชาเขียว', basePrice: 30, category: 'clear-tea', tag: 'เย็น/ร้อน', star: false, emoji: '🍵', active: true },
  { id: 'lemon-tea', key: 'lemonTea', nameEn: 'Lemon Tea', nameTh: 'ชามะนาว', basePrice: 30, category: 'clear-tea', tag: 'เส้น', star: false, emoji: '🍋', active: true },
  { id: 'matcha', key: 'matcha', nameEn: 'Matcha', nameTh: 'มัทฉะ', basePrice: 35, category: 'clear-tea', tag: 'พรีเมียม', star: true, emoji: '🍃', active: true },
  { id: 'coffee', key: 'coffee', nameEn: 'Coffee', nameTh: 'กาแฟ', basePrice: 35, category: 'coffee', tag: 'ยอดนิยม', star: false, emoji: '☕', active: true },
  { id: 'thai-coffee', key: 'thaiCoffee', nameEn: 'Thai Iced Coffee', nameTh: 'โอเลี้ยง', basePrice: 35, category: 'coffee', tag: 'เย็น', star: false, emoji: '🥤', active: true },
  { id: 'soda-lime', key: 'sodaLime', nameEn: 'Lime Soda', nameTh: 'โซดามะนาว', basePrice: 30, category: 'soda', tag: 'สดชื่น', star: false, emoji: '🥤', active: true },
  { id: 'taro', key: 'taro', nameEn: 'Taro Blend', nameTh: 'เผือกปั่น', basePrice: 50, category: 'blended', tag: 'พิเศษ', star: true, emoji: '🫐', active: true },
  { id: 'strawberry', key: 'strawberry', nameEn: 'Strawberry Blend', nameTh: 'สตรอว์เบอร์รีปั่น', basePrice: 50, category: 'blended', tag: 'ซีซั่น', star: true, emoji: '🍓', active: true },
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

export function dateKeyBangkok() {
  return new Date(Date.now() + 7 * 3600000).toISOString().split('T')[0];
}

export function menuItemToCard(item, t) {
  const cat = DRINK_CATEGORIES.find((c) => c.id === item.category) || DRINK_CATEGORIES[0];
  return {
    ...item,
    nameDisplay: item.nameTh || t(item.key) || item.nameEn,
    cat,
    bg: 'bg-white',
    border: 'border-stone-100',
  };
}
