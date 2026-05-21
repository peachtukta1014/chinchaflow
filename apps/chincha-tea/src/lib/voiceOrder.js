import { useCallback, useRef, useState } from 'react';
import { ICE_OPTIONS, SIZES, SWEET_OPTIONS } from './constants';

const THAI_NUM = {
  ศูนย์: '0', หนึ่ง: '1', สอง: '2', สาม: '3', สี่: '4', ห้า: '5',
  หก: '6', เจ็ด: '7', แปด: '8', เก้า: '9', สิบ: '10',
  zero: '0', one: '1', two: '2', three: '3', four: '4', five: '5',
};

const SWEET_PATTERNS = [
  { re: /ไม่หวาน|โนชูการ์|no\s*sugar|0\s*%|ศูนย์\s*เปอร์/, sweet: '0', label: '0%' },
  { re: /หวาน\s*(?:น้อย|25)|ยี่สิบห้า|25\s*%/, sweet: '25', label: '25%' },
  { re: /หวาน\s*(?:กลาง|ปกติ|50)|ห้าสิบ|50\s*%/, sweet: '50', label: '50%' },
  { re: /หวาน\s*(?:มาก|70)|เจ็ดสิบ|70\s*%/, sweet: '70', label: '70%' },
  { re: /หวาน\s*(?:เต็ม|100)|ร้อย\s*เปอร์|หวานปกติ/, sweet: '100', label: '100%' },
];

const ICE_PATTERNS = [
  { re: /ไม่(?:มี)?(?:น้ำ)?แข็ง|โนว์\s*ไอซ์|no\s*ice/, ice: 'noice' },
  { re: /แข็งน้อย|น้ำแข็งน้อย|less\s*ice/, ice: 'lessice' },
  { re: /แข็งเต็ม|น้ำแข็งเต็ม|full\s*ice/, ice: 'fullice' },
  { re: /แข็งปกติ|normal\s*ice/, ice: 'normalice' },
];

const SIZE_PATTERNS = [
  { re: /32\s*oz|สามสิบสอง|ไซส์ใหญ่|ใหญ่|large|l\b/i, size: SIZES[1] },
  { re: /22\s*oz|ยี่สิบสอง|ไซส์เล็ก|เล็ก|small|s\b/i, size: SIZES[0] },
];

const TOPPING_SYNONYMS = [
  { re: /ไข่มุก|บีบี|pearl|boba|ป๊อบ|popping/i, ids: ['pearl', 'popping'] },
  { re: /วุ้น(?:มะพร้าว)?|coco|jelly/i, ids: ['coco-jelly'] },
  { re: /เฉาก๊วย|grass/i, ids: ['grass-jelly'] },
  { re: /บัวลอย|taro\s*ball/i, ids: ['taro-ball'] },
];

function normalize(text) {
  let t = (text || '').toLowerCase().replace(/\s+/g, ' ');
  Object.entries(THAI_NUM).forEach(([k, v]) => { t = t.replaceAll(k, v); });
  return t;
}

function buildMenuPatterns(menuItems) {
  return menuItems
    .filter((m) => m.active !== false)
    .map((item) => {
      const names = [
        item.nameTh,
        item.nameEn,
        item.id?.replace(/-/g, ' '),
        item.key,
      ].filter(Boolean);
      const reParts = names.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
      return {
        item,
        re: new RegExp(reParts.join('|'), 'i'),
      };
    });
}

/**
 * Parse Thai/English mixed voice into cart line(s).
 * Returns [{ menuItem, qty, size, sweetLabel, iceId, toppings[], note }]
 */
export function parseTeaVoice(rawText, menuItems, toppingsList) {
  const t = normalize(rawText);
  if (!t.trim()) return [];

  const patterns = buildMenuPatterns(menuItems);
  const segments = t.split(/(?:แล้วก็|ต่อไป|อีกแก้ว|อีกหนึ่ง|and then|,\s*)/).map((s) => s.trim()).filter(Boolean);
  const chunks = segments.length ? segments : [t];

  const lines = [];
  for (const chunk of chunks) {
    let menuItem = null;
    let bestIdx = -1;
    for (const { item, re } of patterns) {
      const m = chunk.match(re);
      if (m && (bestIdx < 0 || m.index < bestIdx)) {
        bestIdx = m.index;
        menuItem = item;
      }
    }
    if (!menuItem) continue;

    let sweet = SWEET_OPTIONS[2];
    for (const p of SWEET_PATTERNS) {
      if (p.re.test(chunk)) { sweet = { id: p.sweet, label: p.label }; break; }
    }

    let ice = ICE_OPTIONS[2];
    for (const p of ICE_PATTERNS) {
      if (p.re.test(chunk)) {
        ice = ICE_OPTIONS.find((o) => o.id === p.ice) || ice;
        break;
      }
    }

    let size = SIZES[0];
    for (const p of SIZE_PATTERNS) {
      if (p.re.test(chunk)) { size = p.size; break; }
    }

    const toppingIds = new Set();
    for (const syn of TOPPING_SYNONYMS) {
      if (syn.re.test(chunk)) syn.ids.forEach((id) => toppingIds.add(id));
    }
    if (/(แอด|เพิ่ม|extra|add)\s*/i.test(chunk)) {
      TOPPING_SYNONYMS.forEach((syn) => { if (syn.re.test(chunk)) syn.ids.forEach((id) => toppingIds.add(id)); });
    }

    const toppings = toppingsList.filter((tp) => toppingIds.has(tp.id));

    let qty = 1;
    const qtyMatch = chunk.match(/(\d+)\s*(?:แก้ว|cup|x)/i) || chunk.match(/x\s*(\d+)/i);
    if (qtyMatch) qty = Math.max(1, parseInt(qtyMatch[1], 10));
    else if (/สอง|two|2\b/.test(chunk)) qty = 2;
    else if (/สาม|three|3\b/.test(chunk)) qty = 3;

    const toppingTotal = toppings.reduce((s, tp) => s + (tp.price || 0), 0);
    const unitPrice = (menuItem.basePrice || 0) + (size.addPrice || 0) + toppingTotal;

    lines.push({
      menuItem,
      qty,
      size,
      sweetLabel: sweet.label,
      iceId: ice.id,
      toppings,
      unitPrice,
      note: chunk.slice(0, 80),
    });
  }
  return lines;
}

export function voiceLinesToCart(lines, t) {
  return lines.map((line) => ({
    key: line.menuItem.key || line.menuItem.id,
    emoji: line.menuItem.emoji || '☕',
    nameSnapshot: line.menuItem.nameTh || t(line.menuItem.key) || line.menuItem.nameEn,
    size: line.size.label,
    sweet: line.sweetLabel,
    ice: line.iceId,
    toppings: line.toppings,
    price: line.unitPrice,
    qty: line.qty,
    note: line.note,
    cartId: Date.now() + Math.random(),
  }));
}

export function useVoice(onFinalText) {
  const [listening, setListening] = useState(false);
  const [liveText, setLiveText] = useState('');
  const recRef = useRef(null);
  const wantListenRef = useRef(false);

  const stop = useCallback(() => {
    wantListenRef.current = false;
    recRef.current?.stop();
    setListening(false);
    setLiveText('');
  }, []);

  const start = useCallback(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      alert('ใช้ Chrome หรือ Edge เพื่อสั่งงานด้วยเสียง');
      return;
    }
    wantListenRef.current = true;
    const rec = new SR();
    rec.lang = 'th-TH';
    rec.continuous = true;
    rec.interimResults = false;
    recRef.current = rec;

    rec.onresult = (e) => {
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) {
          const text = e.results[i][0].transcript.trim();
          setLiveText(text);
          if (text) onFinalText(text);
        }
      }
    };
    rec.onerror = () => {
      if (!wantListenRef.current) setListening(false);
    };
    rec.onend = () => {
      if (wantListenRef.current) {
        try { rec.start(); } catch { setListening(false); }
      } else {
        setListening(false);
        setLiveText('');
      }
    };
    rec.start();
    setListening(true);
  }, [onFinalText]);

  const toggle = useCallback(() => {
    if (listening) stop();
    else start();
  }, [listening, start, stop]);

  return { listening, toggle, stop, liveText };
}
