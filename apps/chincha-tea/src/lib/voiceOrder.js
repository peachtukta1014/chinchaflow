import { useCallback, useRef, useState } from 'react';
import { ICE_OPTIONS, SIZES, SWEET_OPTIONS } from './constants';
import { MENU_KEY_MY } from './burmeseLexicon';
import { burmeseToThai } from './burmeseToThai';
import { speechRecognitionLang } from './burmeseToThai';
import { voiceAliasNames } from './voiceAliases';
import { needsIOSVoiceMode, warmUpMicrophone } from './speechSupport';

/** iOS (Safari / Chrome) ใช้ instance เดียว — ลดเสียงแจ้งเตือนและค้าง */
let iosSharedRecognition = null;

const THAI_NUM = {
  ศูนย์: '0', หนึ่ง: '1', สอง: '2', สาม: '3', สี่: '4', ห้า: '5',
  หก: '6', เจ็ด: '7', แปด: '8', เก้า: '9', สิบ: '10',
  တစ်: '1', နှစ်: '2', သုံး: '3', လေး: '4', ငါး: '5',
  ခြောက်: '6', ခုနှစ်: '7', ရှစ်: '8', ကိုး: '9', တဆယ်: '10',
  zero: '0', one: '1', two: '2', three: '3', four: '4', five: '5',
};

const VOICE_COMMIT_RE = /(จบบิล|คิดเงิน|บันทึก(?:ออเดอร์)?|คอมมิท|confirm|checkout|save order|သိမ်းမည်|စာရင်းပိတ်|ချို့တော့|ပိတ်မည်|sin\s*ma\s*ne)/i;

const MENU_SYNONYMS = [
  { re: /ชาไทย|ชาส้ม|cha\s*thai|ထိုင်းချာ|chainngar\s*thai/i, keys: ['thaiTea', 'thai-tea'] },
  { re: /บราวน์ชูการ์|ชานมบราวน์|brown\s*sugar|ဘရောင်းရှူး/i, keys: ['brownSugar', 'brown-sugar'] },
  { re: /ชาเขียว|green\s*tea|လက်ဖက်စိမ်း/i, keys: ['greenTea', 'green-tea'] },
  { re: /ชามะนาว|เลมอน|lemon\s*tea|သံပုရာ/i, keys: ['lemonTea', 'lemon-tea'] },
  { re: /มัทฉะ|มัจฉะ|matcha|မတ်ချာ/i, keys: ['matcha'] },
  { re: /โอเลี้ยง|โอเล่|thai\s*coffee|oleang|အိုလီယောင်း/i, keys: ['thaiCoffee', 'thai-coffee'] },
  { re: /เผือกปั่น|เผือก|taro|ဧယ်ဝေါ်/i, keys: ['taro'] },
  { re: /สตรอ|สตรอว์|strawberry|စတော်ဘယ်ရီ/i, keys: ['strawberry'] },
  { re: /กาแฟ|ကော်ဖီ|ลาเต้|လက်တေး/i, keys: ['coffee', 'latte'] },
  { re: /ชาดำ|လက်ဖက်နက်/i, keys: ['blackTea', 'black-tea'] },
  { re: /มะม่วงปั่น|มะม่วง|သရက်သီး/i, keys: ['mangoSmoothie', 'mango-smoothie'] },
  { re: /แตงโมปั่น|แตงโม|ဖရဲသီး/i, keys: ['watermelonSmoothie', 'watermelon'] },
  { re: /ผลไม้รวม|ผลไม้ปั่น|သီးရောဖျော်|သီးဖျော်/i, keys: ['mixedFruitSmoothie', 'mixed-fruit'] },
  { re: /ปั่น|ဖျော်ပါး|smoothie/i, keys: ['strawberry', 'taro', 'mangoSmoothie'] },
  { re: /นมสด|နွားနို့/i, keys: ['milk'] },
  { re: /โกโก้|ကိုကိုး/i, keys: ['cocoa'] },
];

Object.entries(MENU_KEY_MY).forEach(([key, myName]) => {
  const escaped = myName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  MENU_SYNONYMS.push({ re: new RegExp(escaped, 'i'), keys: [key] });
});

const SWEET_PATTERNS = [
  { re: /ไม่หวาน|โนชูการ์|no\s*sugar|0\s*%|ศูนย์\s*เปอร์|မချိုပါ|မချို|cho\s*ma/i, sweet: '0', label: '0%' },
  { re: /หวาน\s*(?:น้อย|25)|ยี่สิบห้า|25\s*%|ချိုနည်း|cho\s*ne/i, sweet: '25', label: '25%' },
  { re: /หวาน\s*(?:กลาง|ปกติ|50)|ห้าสิบ|50\s*%|ချိုအသင့်/i, sweet: '50', label: '50%' },
  { re: /หวาน\s*(?:มาก|70)|เจ็ดสิบ|70\s*%|ချိုသာပ/i, sweet: '70', label: '70%' },
  { re: /หวาน\s*(?:เต็ม|100)|ร้อย\s*เปอร์|หวานปกติ/, sweet: '100', label: '100%' },
];

const ICE_PATTERNS = [
  { re: /ไม่(?:มี)?(?:น้ำ)?แข็ง|โนว์\s*ไอซ์|no\s*ice|ရေခဲမပါ|yay\s*kyi\s*ma\s*shi/i, ice: 'noice' },
  { re: /แข็งน้อย|น้ำแข็งน้อย|less\s*ice|ရေခဲနည်း/i, ice: 'lessice' },
  { re: /แข็งเต็ม|น้ำแข็งเต็ม|full\s*ice|ရေခဲများ/i, ice: 'fullice' },
  { re: /แข็งปกติ|normal\s*ice|ရေခဲပုံမှန်/i, ice: 'normalice' },
];

const SIZE_PATTERNS = [
  { re: /32\s*oz|สามสิบสอง|ไซส์ใหญ่|ขนาดใหญ่|แก้วใหญ่|large|l\b|ခွက်ကြီး/i, size: SIZES[1] },
  { re: /22\s*oz|ยี่สิบสอง|ไซส์เล็ก|ขนาดเล็ก|แก้วเล็ก|small|s\b|ခွက်သေး/i, size: SIZES[0] },
];

const TOPPING_SYNONYMS = [
  { re: /ไข่มุก|บีบี|pearl|boba|ပုလဲ/i, ids: ['pearl'] },
  { re: /ป๊อบ|popping|ပေါ့ပ်/i, ids: ['popping'] },
  { re: /วุ้น(?:มะพร้าว)?|coco|jelly|အုန်းသီး/i, ids: ['coco-jelly'] },
  { re: /เฉาก๊วย|grass|စဉ်စူ|ချဉ်စူ/i, ids: ['grass-jelly'] },
  { re: /บัวลอย|taro\s*ball|ဘာလာအိုး/i, ids: ['taro-ball'] },
];

function normalize(text) {
  let t = burmeseToThai(text || '');
  t = t.toLowerCase().replace(/\s+/g, ' ');
  Object.entries(THAI_NUM).forEach(([k, v]) => { t = t.replaceAll(k, v); });
  return t;
}

function compact(s) {
  return (s || '').replace(/\s+/g, '').toLowerCase();
}

export function hasVoiceCommitCommand(text) {
  return VOICE_COMMIT_RE.test(text || '');
}

function buildMenuPatterns(menuItems) {
  return menuItems
    .filter((m) => m.active !== false)
    .map((item) => {
      const names = voiceAliasNames(item, [
        item.nameTh,
        item.nameEn,
        item.nameMy,
        MENU_KEY_MY[item.key],
        item.id?.replace(/-/g, ' '),
        item.key,
      ].filter(Boolean));
      const reParts = names.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
      const compactNames = names.map(compact).filter((n) => n.length >= 2);
      return { item, re: new RegExp(reParts.join('|'), 'i'), compactNames };
    });
}

function resolveMenuFromChunk(chunk, menuItems, patterns) {
  let menuItem = null;
  let bestIdx = -1;
  const chunkCompact = compact(chunk);

  for (const { item, re, compactNames } of patterns) {
    const m = chunk.match(re);
    if (m && (bestIdx < 0 || m.index < bestIdx)) {
      bestIdx = m.index;
      menuItem = item;
    }
    for (const cn of compactNames) {
      if (cn.length >= 3 && chunkCompact.includes(cn) && (bestIdx < 0 || chunkCompact.indexOf(cn) < bestIdx)) {
        bestIdx = chunkCompact.indexOf(cn);
        menuItem = item;
      }
    }
  }

  if (!menuItem) {
    for (const syn of MENU_SYNONYMS) {
      if (!syn.re.test(chunk)) continue;
      menuItem = menuItems.find((m) =>
        syn.keys.some((k) => m.key === k || m.id === k || compact(m.id) === compact(k)),
      );
      if (menuItem) break;
    }
  }

  return menuItem;
}

function buildToppingMatchers(toppingsList) {
  const fromCatalog = toppingsList.map((tp) => ({
    re: new RegExp((tp.label || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'),
    ids: [tp.id],
  })).filter((x) => x.re.source.length > 1);
  return [...TOPPING_SYNONYMS, ...fromCatalog];
}

export function parseTeaVoice(rawText, menuItems, toppingsList) {
  const t = normalize(rawText);
  if (!t.trim()) return [];

  const patterns = buildMenuPatterns(menuItems);
  const toppingMatchers = buildToppingMatchers(toppingsList);
  const segments = t.split(/(?:แล้วก็|ต่อไป|อีกแก้ว|อีกหนึ่ง|and then|,\s*)/).map((s) => s.trim()).filter(Boolean);
  const chunks = segments.length ? segments : [t];

  const lines = [];
  for (const chunk of chunks) {
    const menuItem = resolveMenuFromChunk(chunk, menuItems, patterns);
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
    for (const syn of toppingMatchers) {
      if (syn.re.test(chunk)) syn.ids.forEach((id) => toppingIds.add(id));
    }

    const toppings = toppingsList.filter((tp) => toppingIds.has(tp.id));

    let qty = 1;
    const qtyMatch = chunk.match(/(\d+)\s*(?:แก้ว|cup|x)/i) || chunk.match(/x\s*(\d+)/i);
    if (qtyMatch) qty = Math.max(1, parseInt(qtyMatch[1], 10));
    else if (/สอง|two|2\s*แก้ว|နှစ်|နှစ်ခွက်/.test(chunk)) qty = 2;
    else if (/สาม|three|3\s*แก้ว|သုံး|သုံးခွက်/.test(chunk)) qty = 3;
    else if (/หนึ่งแก้ว|1\s*แก้ว|တစ်|တစ်ခွက်/.test(chunk)) qty = 1;

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

export function voiceLinesToCart(lines, t, lang = 'th') {
  return lines.map((line) => ({
    key: line.menuItem.key || line.menuItem.id,
    emoji: line.menuItem.emoji || '☕',
    nameSnapshot: line.menuItem.nameTh || t(line.menuItem.key) || line.menuItem.nameEn || line.menuItem.nameMy,
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

export function useVoice(onFinalText, appLang = 'th', { enabled = true } = {}) {
  const [listening, setListening] = useState(false);
  const [liveText, setLiveText] = useState('');
  const recRef = useRef(null);
  const wantListenRef = useRef(false);
  const committedRef = useRef('');
  const displayRef = useRef('');
  const onFinalTextRef = useRef(onFinalText);
  onFinalTextRef.current = onFinalText;

  const flushTranscript = useCallback(() => {
    const text = displayRef.current.trim();
    committedRef.current = '';
    displayRef.current = '';
    setLiveText('');
    if (text) onFinalTextRef.current(text);
  }, []);

  const stop = useCallback(() => {
    wantListenRef.current = false;
    recRef.current?.stop();
    setListening(false);
    flushTranscript();
  }, [flushTranscript]);

  const start = useCallback(async () => {
    if (!enabled) return;
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      alert(appLang === 'my'
        ? 'Safari သို့မဟုတ် Chrome မှ ဖွင့်ပြီး အသံဖြင့် မှာယူနိုင်ပါသည်'
        : 'เปิดแอปผ่าน Safari หรือ Chrome เพื่อสั่งงานด้วยเสียง');
      return;
    }

    const iosMode = needsIOSVoiceMode();
    if (iosMode) await warmUpMicrophone();

    wantListenRef.current = true;
    committedRef.current = '';
    displayRef.current = '';

    const rec = iosMode
      ? (iosSharedRecognition || (iosSharedRecognition = new SR()))
      : new SR();
    rec.lang = speechRecognitionLang(appLang);
    rec.continuous = !iosMode;
    rec.interimResults = true;
    recRef.current = rec;

    rec.onresult = (e) => {
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) {
          committedRef.current += e.results[i][0].transcript;
        }
      }
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (!e.results[i].isFinal) {
          interim += e.results[i][0].transcript;
        }
      }
      const display = (committedRef.current + interim).trim();
      displayRef.current = display;
      setLiveText(display);
    };
    rec.onerror = (ev) => {
      if (ev?.error === 'not-allowed' && appLang === 'my') {
        alert('မိုက်ခရိုဖုန်း ခွင့်ပြုပါ');
      } else if (ev?.error === 'not-allowed') {
        alert('กรุณาอนุญาตไมโครโฟนใน Safari หรือ Chrome');
      }
      if (!wantListenRef.current) setListening(false);
    };
    rec.onend = () => {
      if (wantListenRef.current) {
        const delay = iosMode ? 250 : 0;
        const restart = () => {
          try { rec.start(); } catch {
            wantListenRef.current = false;
            setListening(false);
            flushTranscript();
          }
        };
        if (delay) setTimeout(restart, delay);
        else restart();
      } else {
        setListening(false);
        flushTranscript();
      }
    };
    try {
      rec.start();
      setListening(true);
    } catch {
      wantListenRef.current = false;
      setListening(false);
      alert(appLang === 'my'
        ? 'အသံမစနိုင် — Safari/Chrome မှ ဖွင့်ပြီး မိုက်ခရိုဖုန်း ခွင့်ပြုပါ'
        : 'เปิดไมค์ไม่ได้ — เปิดผ่าน Safari หรือ Chrome แล้วอนุญาตไมโครโฟน');
    }
  }, [appLang, enabled, flushTranscript]);

  const toggle = useCallback(() => {
    if (!enabled) return;
    if (listening) stop();
    else start();
  }, [enabled, listening, start, stop]);

  return { listening, toggle, stop, liveText, voiceAvailable: enabled };
}
