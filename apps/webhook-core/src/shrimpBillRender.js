const fs = require('fs');
const path = require('path');
const satoriMod = require('satori');
const satori = satoriMod.default || satoriMod;
const { Resvg } = require('@resvg/resvg-js');
const {
  FIXED_TEMPLATE_ROWS,
  BILL_TRANSFER_ACCOUNTS,
  BILL_PAID_THANK_YOU_MESSAGE,
} = require('./shrimpBillTemplateRows');

const PUBLIC_ORIGIN = process.env.SHRIMP_PUBLIC_ORIGIN || 'https://ko-seafood.top';
/** TTF เต็มชุด (ไทย+เลข) — subset woff ของ @fontsource ทำให้ Satori ขึ้นกล่อง */
const FONT_DIR = path.join(__dirname, '../assets/fonts');

let fontCache = null;
const imageCache = new Map();

function el(type, props, children) {
  const node = { type, props: props || {} };
  if (children !== undefined) node.props.children = children;
  return node;
}

function txt(str, style = {}) {
  return el('div', { style: { display: 'flex', ...style } }, String(str ?? ''));
}

function formatCellMoney(n) {
  const v = parseFloat(n);
  if (!Number.isFinite(v) || v === 0) return '';
  return v.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

function formatCellPrice(n) {
  const v = parseFloat(n);
  if (!Number.isFinite(v) || v === 0) return '';
  return String(v);
}

function formatBillQuantityKg(quantity) {
  const raw = String(quantity ?? '').trim();
  if (!raw) return '';
  const v = parseFloat(raw.replace(/,/g, ''));
  if (!Number.isFinite(v) || v <= 0) return '';
  const num = v % 1 === 0 ? String(v) : v.toLocaleString('en-US', { maximumFractionDigits: 2 });
  return `${num} Kg`;
}

function findTemplateItem(data, matchName) {
  return (data.items || []).find((item) => String(item.name || '').trim() === String(matchName || '').trim());
}

function getItemRowData(data, row) {
  const matched = row.matchName ? findTemplateItem(data, row.matchName) : null;
  const hasValues = matched && (matched.quantity || matched.pricePerUnit || matched.amount);
  if (!hasValues) {
    return { label: row.matchName || '', quantity: '', pricePerUnit: '', amount: '' };
  }
  return {
    label: row.matchName || '',
    quantity: formatBillQuantityKg(matched.quantity),
    pricePerUnit: formatCellPrice(matched.pricePerUnit),
    amount: formatCellMoney(matched.amount),
  };
}

function getExtraRowData(extraQueue) {
  const extra = extraQueue.length > 0 ? extraQueue.shift() : null;
  if (!extra) return { label: '', quantity: '', pricePerUnit: '', amount: '' };
  return {
    label: extra.name,
    quantity: formatBillQuantityKg(extra.quantity),
    pricePerUnit: formatCellPrice(extra.pricePerUnit),
    amount: formatCellMoney(extra.amount),
  };
}

function readBundledFont(fileName) {
  const filePath = path.join(FONT_DIR, fileName);
  if (!fs.existsSync(filePath)) {
    throw new Error(`โหลดฟอนต์ Sarabun ไม่สำเร็จ: ${fileName}`);
  }
  return fs.readFileSync(filePath);
}

/** ฟอนต์ Sarabun TTF ใน repo — ไม่พึ่ง network ตอน cold start */
function loadBillFonts() {
  if (fontCache) return fontCache;
  const defs = [
    ['Sarabun-Regular.ttf', 400],
    ['Sarabun-Bold.ttf', 700],
    ['Sarabun-ExtraBold.ttf', 800],
    ['Sarabun-ExtraBold.ttf', 900],
  ];
  fontCache = defs.map(([fileName, weight]) => ({
    name: 'Sarabun',
    data: readBundledFont(fileName),
    weight,
    style: 'normal',
  }));
  return fontCache;
}

async function loadImageDataUrl(path) {
  if (imageCache.has(path)) return imageCache.get(path);
  const url = `${PUBLIC_ORIGIN}${path.startsWith('/') ? path : `/${path}`}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`โหลดรูปไม่สำเร็จ: ${path}`);
  const buf = Buffer.from(await res.arrayBuffer());
  const mime = path.endsWith('.png') ? 'image/png' : 'image/jpeg';
  const dataUrl = `data:${mime};base64,${buf.toString('base64')}`;
  imageCache.set(path, dataUrl);
  return dataUrl;
}

function tableCell(content, widthPct, opts = {}) {
  const { borderRight = true, color = '#dc2626', fontSize = 16, fontWeight = 900, align = 'center' } = opts;
  return el('div', {
    style: {
      width: `${widthPct}%`,
      display: 'flex',
      alignItems: 'center',
      justifyContent: align === 'right' ? 'flex-end' : align === 'left' ? 'flex-start' : 'center',
      borderRight: borderRight ? '1px solid #1e3a8a' : 'none',
      borderBottom: '1px solid #1e3a8a',
      height: 36,
      paddingLeft: align === 'left' ? 8 : 0,
      paddingRight: align === 'right' ? 8 : 0,
      color,
      fontSize,
      fontWeight,
      backgroundColor: opts.bg || 'rgba(248,250,252,0.5)',
    },
  }, content || '\u00a0');
}

function buildTableRows(data) {
  const extraQueue = [...(data.extraLines || [])];
  const rows = [];

  rows.push(el('div', {
    style: {
      display: 'flex',
      backgroundColor: '#1e3a8a',
      color: '#ffffff',
      fontWeight: 700,
      fontSize: 13,
      textAlign: 'center',
    },
  }, [
    tableCell('จำนวน', 15, { color: '#fff', fontSize: 13, fontWeight: 700, bg: '#1e3a8a' }),
    tableCell('รายการ', 50, { color: '#fff', fontSize: 13, fontWeight: 700, bg: '#1e3a8a', align: 'left' }),
    tableCell('หน่วยละ', 15, { color: '#fff', fontSize: 13, fontWeight: 700, bg: '#1e3a8a' }),
    tableCell('จำนวนเงิน', 20, { color: '#fff', fontSize: 13, fontWeight: 700, bg: '#1e3a8a', borderRight: false }),
  ]));

  for (const row of FIXED_TEMPLATE_ROWS) {
    if (row.kind === 'section') {
      rows.push(el('div', {
        style: {
          display: 'flex',
          borderBottom: '1px solid #1e3a8a',
          backgroundColor: 'rgba(248,250,252,0.8)',
          padding: '6px 8px',
          fontSize: 11,
          fontWeight: 700,
          color: '#1e3a8a',
        },
      }, row.label));
      continue;
    }
    if (row.kind === 'spacer') {
      rows.push(el('div', { style: { height: 36, borderBottom: '1px solid #1e3a8a' } }));
      continue;
    }
    const rowValue = row.kind === 'extra' ? getExtraRowData(extraQueue) : getItemRowData(data, row);
    const labelColor = row.kind === 'extra' && rowValue.label ? '#2563eb' : '#111827';
    rows.push(el('div', { style: { display: 'flex' } }, [
      tableCell(rowValue.quantity, 15),
      tableCell(rowValue.label, 50, { align: 'left', color: labelColor, fontSize: 13, fontWeight: 600, bg: '#fff' }),
      tableCell(rowValue.pricePerUnit, 15),
      tableCell(rowValue.amount, 20, { borderRight: false, align: 'right' }),
    ]));
  }

  rows.push(el('div', { style: { display: 'flex', backgroundColor: 'rgba(239,246,255,0.5)' } }, [
    el('div', {
      style: {
        width: '80%',
        display: 'flex',
        justifyContent: 'flex-end',
        alignItems: 'center',
        paddingRight: 16,
        borderRight: '2px solid #1e3a8a',
        borderBottom: '1px solid #1e3a8a',
        height: 36,
        color: '#1e3a8a',
        fontWeight: 700,
      },
    }, 'รวมเงิน'),
    el('div', {
      style: {
        width: '20%',
        display: 'flex',
        justifyContent: 'flex-end',
        alignItems: 'center',
        paddingRight: 8,
        borderBottom: '1px solid #1e3a8a',
        height: 36,
        color: '#dc2626',
        fontSize: 18,
        fontWeight: 900,
      },
    }, formatCellMoney(data.totalAmount)),
  ]));

  return rows;
}

function fieldLine(label, value, variant) {
  const valueStyle = variant === 'customer'
    ? { color: '#2563eb', fontSize: 20, fontWeight: 800 }
    : { color: '#000', fontSize: 14, fontWeight: 600 };
  return el('div', { style: { display: 'flex', alignItems: 'flex-end', gap: 8, marginBottom: 8 } }, [
    txt(label, { color: '#1e3a8a', fontSize: 14, fontWeight: 700, flexShrink: 0 }),
    el('div', {
      style: {
        flex: 1,
        borderBottom: '1px dashed #6b7280',
        minHeight: 28,
        paddingBottom: 6,
        ...valueStyle,
      },
    }, value || '\u00a0'),
  ]);
}

function buildSatoriTree(data, logoUrl, qrUrl) {
  const credit = data.creditTransfer || null;
  const paymentNote = data.paymentNote || '';

  const footerBlock = paymentNote
    ? el('div', {
      style: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        marginTop: 12,
        border: '2px solid #22c55e',
        backgroundColor: '#f0fdf4',
        borderRadius: 8,
        padding: '10px 12px',
        textAlign: 'center',
      },
    }, [
      txt(paymentNote, { color: '#16a34a', fontSize: 20, fontWeight: 900, justifyContent: 'center' }),
      txt(BILL_PAID_THANK_YOU_MESSAGE, { color: '#166534', fontSize: 13, fontWeight: 600, marginTop: 8, justifyContent: 'center' }),
    ])
    : credit
      ? el('div', {
        style: {
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          marginTop: 12,
          border: '2px solid #ef4444',
          backgroundColor: '#fef2f2',
          borderRadius: 8,
          padding: '10px 12px',
          textAlign: 'center',
        },
      }, [
        txt(`ค้างชำระ ฿${formatCellMoney(credit.unpaidAmount ?? data.totalAmount)}`, {
          color: '#dc2626', fontSize: 20, fontWeight: 900, justifyContent: 'center',
        }),
        txt('โอนชำระเข้าบัญชี (เลือกบัญชีใดบัญชีหนึ่ง)', {
          color: '#b91c1c', fontSize: 13, fontWeight: 700, marginTop: 6, justifyContent: 'center',
        }),
        el('div', { style: { display: 'flex', gap: 8, marginTop: 8, width: '100%' } }, (credit.accounts || BILL_TRANSFER_ACCOUNTS).map((acc) => el('div', {
          style: {
            display: 'flex',
            flexDirection: 'column',
            flex: 1,
            backgroundColor: 'rgba(255,255,255,0.8)',
            border: '1px solid #fecaca',
            borderRadius: 6,
            padding: 6,
            fontSize: 10,
          },
        }, [
          acc.label ? txt(acc.label, { color: '#991b1b', fontWeight: 900 }) : null,
          txt(`${acc.holder} · ${acc.bank}`, { color: '#b91c1c', fontWeight: 700, marginTop: 2 }),
          txt(acc.accountNo, { color: '#dc2626', fontWeight: 900, fontSize: 12, marginTop: 2 }),
        ].filter(Boolean)))),
      ])
      : null;

  return el('div', {
    style: {
      width: 600,
      backgroundColor: '#f8fafc',
      padding: 24,
      display: 'flex',
      flexDirection: 'column',
      color: '#1e3a8a',
      fontFamily: 'Sarabun',
    },
  }, [
    el('div', { style: { display: 'flex', justifyContent: 'space-between', marginBottom: 8 } }, [
      el('div', { style: { display: 'flex', gap: 12 } }, [
        el('img', { src: logoUrl, style: { width: 56, height: 56, borderRadius: 28 } }),
        el('div', { style: { display: 'flex', flexDirection: 'column' } }, [
          txt('โกอ้วนคลังซีฟู๊ดภูเก็ต', { fontSize: 22, fontWeight: 800, color: '#1a365d' }),
          txt('📞 094-6693628 (โกอ้วน)', { fontSize: 11, marginTop: 4 }),
          txt('📞 094-9408665 (พีช)', { fontSize: 11 }),
        ]),
      ]),
      el('div', { style: { display: 'flex', flexDirection: 'column', alignItems: 'flex-end', fontSize: 11 } }, [
        txt(`เล่มที่ ${data.bookNo || ' '}`),
        txt(`เลขที่ ${data.billNo || ' '}`, { marginTop: 4 }),
        el('img', { src: qrUrl, style: { width: 72, height: 72, marginTop: 6, border: '2px solid #1e3a8a' } }),
      ]),
    ]),
    txt('จำหน่าย : ซีฟู้ดของสดของเป็น เน้นกุ้งแม่น้ำธรรมชาติเป็นๆ พร้อมส่ง', {
      fontSize: 11, textAlign: 'center', marginBottom: 10, fontWeight: 600,
    }),
    el('div', {
      style: {
        display: 'flex',
        justifyContent: 'center',
        backgroundColor: '#2563eb',
        color: '#fff',
        textAlign: 'center',
        padding: '8px 0',
        fontSize: 18,
        fontWeight: 700,
        marginBottom: 12,
      },
    }, 'ใบส่งของ'),
    el('div', { style: { display: 'flex', flexDirection: 'column', marginBottom: 12 } }, [
      el('div', { style: { display: 'flex', gap: 16 } }, [
        el('div', { style: { display: 'flex', flex: 1, flexDirection: 'column' } }, [fieldLine('ชื่อลูกค้า', data.customerName, 'customer')]),
        el('div', { style: { display: 'flex', width: 150, flexDirection: 'column' } }, [fieldLine('วันที่ส่ง', data.date)]),
      ]),
      fieldLine('เบอร์โทร', data.customerPhone || ''),
      fieldLine('ที่อยู่', data.deliveryAddress || data.address || ''),
    ]),
    el('div', {
      style: {
        display: 'flex',
        flexDirection: 'column',
        border: '2px solid #1e3a8a',
        backgroundColor: '#fff',
      },
    }, buildTableRows(data)),
    footerBlock,
    el('div', { style: { display: 'flex', justifyContent: 'space-between', marginTop: 28, fontSize: 11, gap: 16 } }, [
      el('div', { style: { display: 'flex', flex: 1, alignItems: 'flex-end', gap: 4 } }, [
        txt('ลงชื่อ', { fontWeight: 700 }),
        txt(data.senderName || '\u00a0', { flex: 1, borderBottom: '2px dashed rgba(30,58,138,0.5)', fontWeight: 800, fontSize: 14 }),
        txt('ผู้บันทึก/ส่งของ', { fontWeight: 700 }),
      ]),
      el('div', { style: { display: 'flex', flex: 1, alignItems: 'flex-end', gap: 4 } }, [
        txt('ลงชื่อ', { fontWeight: 700 }),
        txt(data.moneyReceiverName || '\u00a0', { flex: 1, borderBottom: '2px dashed rgba(30,58,138,0.5)', fontWeight: 800, fontSize: 14 }),
        txt('ผู้รับเงิน', { fontWeight: 700 }),
      ]),
    ]),
  ]);
}

/**
 * @param {object} billData — รูปแบบเดียวกับ saleToBillData() ในแอปกุ้ง
 * @returns {Promise<Buffer>} JPEG buffer
 */
async function renderShrimpBillJpeg(billData) {
  if (!billData || typeof billData !== 'object') {
    throw new Error('billData_required');
  }

  const fonts = loadBillFonts();
  const [logoUrl, qrUrl] = await Promise.all([
    loadImageDataUrl('/logo.jpg'),
    loadImageDataUrl('/bill-assets/line-oa-qr.png'),
  ]);

  const tree = buildSatoriTree(billData, logoUrl, qrUrl);
  const svg = await satori(tree, {
    width: 600,
    height: 1200,
    fonts,
  });

  const resvg = new Resvg(svg, { fitTo: { mode: 'width', value: 600 }, background: '#f8fafc' });
  const png = resvg.render().asPng();

  // LINE + Storage ใช้ JPEG — แปลงผ่าน canvas ไม่มีบน Node; ส่ง PNG ไป upload แทน (upload รองรับ)
  return Buffer.from(png);
}

module.exports = {
  renderShrimpBillJpeg,
  PUBLIC_ORIGIN,
};
