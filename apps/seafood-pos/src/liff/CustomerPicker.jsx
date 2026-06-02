import React, { useMemo, useState } from 'react';
import { CUSTOMERS } from '../constants/customers.js';
import { Bilingual, BilingualHeading, BilingualHint, BilingualInline } from './Bilingual.jsx';
import { LIFF_COPY as T } from './liffCopy.js';

const CATALOG = CUSTOMERS.filter((c) => c.id !== 'general');

export function CustomerPicker({ onSelect, onClose }) {
  const [q, setQ] = useState('');

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return CATALOG;
    return CATALOG.filter(
      (c) =>
        c.name.toLowerCase().includes(needle)
        || (c.zone || '').toLowerCase().includes(needle)
        || (c.aliases || []).some((a) => a.toLowerCase().includes(needle)),
    );
  }, [q]);

  return (
    <>
      <header className="px-5 pt-5 pb-4 bg-gradient-to-b from-slate-900 to-slate-800 text-white rounded-b-[1.75rem] shadow-md">
        <BilingualHeading
          th={T.pickTitle.th}
          en={T.pickTitle.en}
          className="text-xl font-extrabold tracking-tight !text-white"
        />
        <div className="mt-2">
          <BilingualHint th={T.pickHint.th} en={T.pickHint.en} />
        </div>
      </header>

      <main className="px-4 pt-4 pb-32 max-w-md mx-auto">
        <input
          type="search"
          className="w-full min-h-[48px] px-4 rounded-xl border border-slate-200 bg-white text-base mb-3"
          placeholder={`${T.pickSearch.th} / ${T.pickSearch.en}`}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          autoComplete="off"
        />
        <ul className="space-y-2">
          {filtered.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => onSelect(c)}
                className="w-full text-left min-h-[52px] px-4 py-3 rounded-2xl border border-slate-200 bg-white active:bg-sky-50"
              >
                <p className="font-bold text-slate-900">{c.name}</p>
                {c.zone && (
                  <p className="text-xs text-slate-500 mt-0.5">{c.zone}</p>
                )}
              </button>
            </li>
          ))}
        </ul>
        {filtered.length === 0 && (
          <p className="text-center text-sm text-slate-500 py-8">
            <BilingualInline th={T.pickEmpty.th} en={T.pickEmpty.en} />
          </p>
        )}
      </main>

      <footer
        className="fixed bottom-0 left-0 right-0 z-20 bg-white/95 backdrop-blur border-t border-slate-200 px-4 pt-3"
        style={{ paddingBottom: 'max(12px, env(safe-area-inset-bottom))' }}
      >
        <button
          type="button"
          onClick={onClose}
          className="w-full max-w-md mx-auto block min-h-[52px] rounded-2xl border border-slate-200 font-bold text-slate-600"
        >
          <BilingualInline th={T.close.th} en={T.close.en} />
        </button>
      </footer>
    </>
  );
}
