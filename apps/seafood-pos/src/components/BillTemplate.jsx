import React from 'react';
import { BILL_PAID_THANK_YOU_MESSAGE } from '../lib/billPaymentDisplay';
import { BILL_QR_URL } from '../lib/billTemplateConfig';

/** @typedef {{ name: string; quantity: string; pricePerUnit: number; amount: number }} BillItem */
/** @typedef {{ label?: string; holder: string; bank: string; accountNo: string }} TransferAccount */
/** @typedef {{ unpaidAmount: number; accounts: TransferAccount[] }} CreditTransferInfo */
/** @typedef {{ bookNo?: string; billNo?: string; customerName: string; date: string; deliveryDate?: string; address?: string; items: BillItem[]; extraLines?: BillItem[]; totalAmount: number; senderName?: string; paymentNote?: string; creditTransfer?: CreditTransferInfo | null }} BillData */

export const FIXED_TEMPLATE_ROWS = [
  { key: 'shrimp-a', defaultName: 'กุ้งแม่น้ำ A' },
  { key: 'shrimp-b', defaultName: 'กุ้งแม่น้ำ B' },
  { key: 'shrimp-c', defaultName: 'กุ้งแม่น้ำ C' },
  { key: 'empty-1', defaultName: '' },
  { key: 'dead-shrimp-big', defaultName: 'กุ้งแม่น้ำตาย ใหญ่' },
  { key: 'dead-shrimp-small', defaultName: 'กุ้งแม่น้ำตาย เล็ก' },
  { key: 'empty-2', defaultName: '' },
  { key: 'empty-3', defaultName: '' },
  { key: 'empty-4', defaultName: '' },
  { key: 'empty-5', defaultName: '' },
  { key: 'empty-6', defaultName: '' },
];

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

/** ตัวเลขในตาราง — ขยับขึ้นเล็กน้อยให้อ่านชัด (ไม่ชิดขอบล่างเซลล์) */
function TableNum({ children, align = 'center' }) {
  if (children === '' || children == null) return null;
  const alignCls =
    align === 'right' ? 'justify-end' : align === 'left' ? 'justify-start' : 'justify-center';
  return (
    <span
      className={`inline-flex w-full items-center ${alignCls} leading-none -translate-y-[3px] min-h-[1.1em]`}
    >
      {children}
    </span>
  );
}

function FieldLine({ label, value, valueClassName = '' }) {
  return (
    <div className="flex items-end gap-2 min-w-0">
      <span className="shrink-0 text-[#1e3a8a] pb-[6px] leading-none">{label}</span>
      <p
        className={`flex-1 min-w-0 border-b border-dotted border-gray-500 text-black font-semibold leading-tight pb-[6px] min-h-[22px] ${valueClassName}`}
      >
        {value || '\u00a0'}
      </p>
    </div>
  );
}

/**
 * @param {BillData} data
 */
function getRowData(data, defaultName, extraQueue) {
  if (!defaultName) {
    const extra = extraQueue.length > 0 ? extraQueue.shift() : null;
    if (!extra) return { label: '', quantity: '', pricePerUnit: '', amount: '' };
    return {
      label: extra.name,
      quantity: extra.quantity ?? '',
      pricePerUnit: formatCellPrice(extra.pricePerUnit),
      amount: formatCellMoney(extra.amount),
    };
  }

  const matched = data.items.find((item) => item.name.trim() === defaultName.trim());
  if (!matched) {
    return { label: defaultName, quantity: '', pricePerUnit: '', amount: '' };
  }
  return {
    label: defaultName,
    quantity: matched.quantity ?? '',
    pricePerUnit: formatCellPrice(matched.pricePerUnit),
    amount: formatCellMoney(matched.amount),
  };
}

/**
 * ฟอร์มใบส่งของดิจิทัล — ไม่ใช้ภาพสแกนบิล
 * @param {{ data: BillData }} props
 */
export default function BillTemplate({ data }) {
  const extraQueue = [...(data.extraLines || [])];

  return (
    <div
      id="go-uan-bill"
      className="w-[600px] bg-[#f8fafc] p-6 text-[#1e3a8a] font-sans border border-gray-200"
      style={{ boxSizing: 'border-box', fontFamily: '"Sarabun", "Noto Sans Thai", system-ui, sans-serif' }}
    >
      <div className="flex justify-between items-start relative mb-2">
        <div className="flex items-start gap-3">
          <img
            src="/logo.jpg"
            alt="โกอ้วน คลังซีฟู้ด"
            className="w-14 h-14 rounded-full object-cover border-2 border-[#1e3a8a] shrink-0"
            crossOrigin="anonymous"
          />
          <div>
            <h1 className="text-3xl font-extrabold tracking-wide text-[#1a365d] leading-tight">
              โกอ้วน คลังซีฟู้ด
            </h1>
            <div className="text-xs mt-1 space-y-0.5 font-medium text-[#1e3a8a]">
              <p>📞 094-6693628 (โกอ้วน)</p>
              <p>📞 094-9408665 (พีช)</p>
              <p>🎵 โกอ้วน คลังซีฟู้ด ภูเก็ต</p>
            </div>
          </div>
        </div>

        <div className="text-right text-xs shrink-0">
          <p className="mb-1">
            เล่มที่{' '}
            <span className="border-b border-dotted border-gray-400 px-2 text-black font-semibold">
              {data.bookNo || ' '}
            </span>
          </p>
          <p className="mb-2">
            เลขที่{' '}
            <span className="border-b border-dotted border-gray-400 px-2 text-black font-semibold">
              {data.billNo || ' '}
            </span>
          </p>
          <div
            className="w-[76px] h-[76px] ml-auto border-2 border-[#1e3a8a] bg-white rounded-sm flex items-center justify-center overflow-hidden p-1 shadow-sm"
            title="สแกนแอด LINE โกอ้วน"
          >
            <img
              src={BILL_QR_URL}
              alt="LINE OA QR"
              className="w-full h-full object-contain object-center"
              crossOrigin="anonymous"
            />
          </div>
        </div>
      </div>

      <p className="text-[11px] text-center font-semibold border-b border-gray-300 pb-2 mb-3 text-[#1e3a8a]">
        จำหน่าย : ซีฟู้ดของสดของเป็น เน้นกุ้งแม่น้ำธรรมชาติเป็นๆ พร้อมส่ง
      </p>

      <div className="bg-[#2563eb] text-white text-center py-1.5 font-bold tracking-widest text-lg rounded-sm shadow-sm mb-3">
        ใบส่งของ
      </div>

      <div className="text-xs space-y-3 mb-4 font-medium">
        <div className="flex w-full gap-4">
          <div className="flex-grow min-w-0">
            <FieldLine label="นามลูกค้า" value={data.customerName} />
          </div>
          <div className="w-[9.5rem] shrink-0">
            <FieldLine label="วันที่ส่ง" value={data.date} valueClassName="whitespace-nowrap" />
          </div>
        </div>
        <FieldLine label="ที่อยู่" value={data.address} />
      </div>

      <table className="w-full border-collapse border-2 border-[#1e3a8a] bg-white text-sm shadow-sm">
        <thead>
          <tr className="bg-[#1e3a8a] text-white text-center font-bold">
            <th className="border border-[#1e3a8a] py-2 w-[15%]">จำนวน</th>
            <th className="border border-[#1e3a8a] py-2 w-[50%]">รายการ</th>
            <th className="border border-[#1e3a8a] py-2 w-[15%]">หน่วยละ</th>
            <th className="border border-[#1e3a8a] py-2 w-[20%]">จำนวนเงิน</th>
          </tr>
        </thead>
        <tbody>
          {FIXED_TEMPLATE_ROWS.map((row) => {
            const rowValue = getRowData(data, row.defaultName, extraQueue);
            return (
              <tr key={row.key} className="h-8 text-center align-middle">
                <td className="border-r border-b border-[#1e3a8a] text-red-600 text-base font-extrabold bg-slate-50/50 align-middle py-0">
                  <TableNum>{rowValue.quantity}</TableNum>
                </td>
                <td className="border-r border-b border-[#1e3a8a] text-left px-3 text-sm font-medium text-gray-800 align-middle">
                  {rowValue.label}
                </td>
                <td className="border-r border-b border-[#1e3a8a] text-red-600 text-base font-extrabold bg-slate-50/50 align-middle py-0">
                  <TableNum>{rowValue.pricePerUnit}</TableNum>
                </td>
                <td className="border-b border-[#1e3a8a] text-red-600 text-base font-extrabold align-middle py-0 px-2">
                  <TableNum align="right">{rowValue.amount}</TableNum>
                </td>
              </tr>
            );
          })}
          <tr className="h-9 font-bold bg-blue-50/30 align-middle">
            <td colSpan={3} className="border-r-2 border-[#1e3a8a] text-right pr-4 text-[#1e3a8a] align-middle">
              รวมเงิน
            </td>
            <td className="text-xl text-red-600 font-black bg-blue-50 align-middle py-0 px-2">
              <TableNum align="right">{formatCellMoney(data.totalAmount)}</TableNum>
            </td>
          </tr>
        </tbody>
      </table>

      {data.paymentNote ? (
        <div className="mt-3 rounded-lg border-2 border-green-500 bg-green-50 px-3 py-2.5 text-center">
          <p className="text-green-600 font-black text-xl leading-tight tracking-wide">
            {data.paymentNote}
          </p>
          <p className="text-green-800 font-semibold text-sm mt-2 leading-snug">
            {BILL_PAID_THANK_YOU_MESSAGE}
          </p>
        </div>
      ) : data.creditTransfer ? (
        <div className="mt-3 rounded-lg border-2 border-red-500 bg-red-50 px-3 py-2.5 text-center">
          <p className="text-red-600 font-black text-xl leading-tight">
            ค้างชำระ ฿{formatCellMoney(data.creditTransfer.unpaidAmount)}
          </p>
          <p className="text-red-700 font-bold text-sm mt-2">
            โอนชำระเข้าบัญชี (เลือกบัญชีใดบัญชีหนึ่ง)
          </p>
          <div className="mt-2 grid grid-cols-2 gap-2 text-left">
            {(data.creditTransfer.accounts || []).map((acc) => (
              <div
                key={`${acc.label}-${acc.accountNo}`}
                className="bg-white/80 rounded-md px-2 py-1.5 border border-red-200 min-w-0"
              >
                {acc.label && (
                  <p className="text-red-800 font-black text-xs leading-tight">{acc.label}</p>
                )}
                <p className="text-red-700 font-bold text-[10px] leading-tight mt-0.5">
                  {acc.holder}
                  {' · '}
                  {acc.bank}
                </p>
                <p className="text-red-600 font-black text-sm tracking-wide mt-0.5 break-all">
                  {acc.accountNo}
                </p>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div className="flex justify-between items-end text-[10px] mt-8 font-medium px-2 text-[#1e3a8a] gap-6">
        <div className="flex items-end flex-1 min-w-0 gap-1">
          <span className="shrink-0 pb-[5px]">ลงชื่อ</span>
          <p className="flex-1 border-b border-dotted border-gray-500 text-black font-semibold pb-[5px] min-h-[18px] truncate">
            {data.senderName || '\u00a0'}
          </p>
          <span className="shrink-0 pb-[5px]">ผู้ส่งของ</span>
        </div>
        <div className="flex items-end flex-1 min-w-0 gap-1">
          <span className="shrink-0 pb-[5px]">ลงชื่อ</span>
          <p className="flex-1 border-b border-dotted border-gray-500 min-h-[18px] pb-[5px]" />
          <span className="shrink-0 pb-[5px]">ผู้รับของ</span>
        </div>
      </div>
    </div>
  );
}
