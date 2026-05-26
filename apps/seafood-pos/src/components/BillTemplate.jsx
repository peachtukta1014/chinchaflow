import React from 'react';
import { BILL_QR_URL } from '../lib/billTemplateConfig';

/** @typedef {{ name: string; quantity: string; pricePerUnit: number; amount: number }} BillItem */
/** @typedef {{ bookNo?: string; billNo?: string; customerName: string; date: string; deliveryDate?: string; address?: string; items: BillItem[]; extraLines?: BillItem[]; totalAmount: number }} BillData */

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
          <div className="inline-block border border-[#1e3a8a] p-1 bg-white rounded text-center">
            <img
              src={BILL_QR_URL}
              alt="LINE QR"
              className="w-12 h-12 object-contain"
              crossOrigin="anonymous"
            />
            <p className="text-[8px] font-bold mt-0.5 text-[#1e3a8a]">LINE</p>
          </div>
        </div>
      </div>

      <p className="text-[11px] text-center font-semibold border-b border-gray-300 pb-2 mb-3 text-[#1e3a8a]">
        จำหน่าย : ซีฟู้ดของสดของเป็น เน้นกุ้งแม่น้ำธรรมชาติเป็นๆ พร้อมส่ง
      </p>

      <div className="bg-[#2563eb] text-white text-center py-1.5 font-bold tracking-widest text-lg rounded-sm shadow-sm mb-2">
        ใบส่งของ
      </div>

      <div className="text-xs space-y-2 mb-4 font-medium -mt-1">
        <div className="flex w-full gap-4">
          <div className="flex-grow min-w-0">
            <div className="flex gap-1.5 items-start">
              <span className="whitespace-nowrap pt-0.5 shrink-0">นามลูกค้า</span>
              <div className="flex-grow min-w-0 relative pb-1">
                <p className="text-black font-semibold truncate leading-snug mb-1 relative z-10">
                  {data.customerName}
                </p>
                <div className="border-b border-dotted border-gray-400 w-full" aria-hidden />
              </div>
            </div>
          </div>
          <div className="w-40 shrink-0">
            <div className="flex gap-1.5 items-start">
              <span className="whitespace-nowrap pt-0.5 shrink-0">วันที่ส่ง</span>
              <div className="flex-grow min-w-0 relative pb-1">
                <p className="text-black font-semibold leading-snug mb-1 relative z-10 whitespace-nowrap">
                  {data.date}
                </p>
                <div className="border-b border-dotted border-gray-400 w-full" aria-hidden />
              </div>
            </div>
          </div>
        </div>
        <div className="flex w-full gap-1.5 items-start">
          <span className="whitespace-nowrap pt-0.5 shrink-0">ที่อยู่</span>
          <div className="flex-grow min-w-0 relative pb-1">
            <p className="text-black leading-snug mb-1 min-h-[1rem] relative z-10">
              {data.address || '\u00a0'}
            </p>
            <div className="border-b border-dotted border-gray-400 w-full" aria-hidden />
          </div>
        </div>
      </div>

      <table className="w-full border-collapse border-2 border-[#1e3a8a] bg-white text-xs shadow-sm">
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
              <tr key={row.key} className="h-7 text-center">
                <td className="border-r border-b border-[#1e3a8a] text-red-700 font-bold bg-slate-50/50">
                  {rowValue.quantity}
                </td>
                <td className="border-r border-b border-[#1e3a8a] text-left px-3 font-medium text-gray-800">
                  {rowValue.label}
                </td>
                <td className="border-r border-b border-[#1e3a8a] text-red-700 font-bold bg-slate-50/50">
                  {rowValue.pricePerUnit}
                </td>
                <td className="border-b border-[#1e3a8a] text-right px-2 text-red-800 font-bold">
                  {rowValue.amount}
                </td>
              </tr>
            );
          })}
          <tr className="h-8 font-bold bg-blue-50/30">
            <td colSpan={3} className="border-r-2 border-[#1e3a8a] text-right pr-4 text-[#1e3a8a]">
              รวมเงิน
            </td>
            <td className="text-right px-2 text-lg text-blue-900 font-extrabold bg-blue-50">
              {formatCellMoney(data.totalAmount)}
            </td>
          </tr>
        </tbody>
      </table>

      <div className="flex justify-between items-center text-[10px] mt-8 font-medium px-2 text-[#1e3a8a]">
        <div className="flex items-center">
          <span>ลงชื่อ</span>
          <span className="border-b border-dotted border-gray-400 w-36 mx-1" />
          <span>ผู้ส่งของ</span>
        </div>
        <div className="flex items-center">
          <span>ลงชื่อ</span>
          <span className="border-b border-dotted border-gray-400 w-36 mx-1" />
          <span>ผู้รับของ</span>
        </div>
      </div>
    </div>
  );
}
