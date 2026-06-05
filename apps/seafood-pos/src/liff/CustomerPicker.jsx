import React, { useEffect, useMemo, useState } from 'react';
import { CUSTOMERS } from '../constants/customers.js';
import { fetchLiffCustomerCatalog } from './liffOrderApi.js';
import { Bilingual, BilingualHeading, BilingualHint, BilingualInline } from './Bilingual.jsx';
import { LIFF_COPY as T } from './liffCopy.js';

const PREVIEW_CATALOG = CUSTOMERS.filter((c) => c.id !== 'general');

export function CustomerPicker({
  idToken,
  initialCatalog,
  onSelect,
  onClose,
  onBack,
}) {
  const [q, setQ] = useState('');
  const [catalog, setCatalog] = useState(initialCatalog || PREVIEW_CATALOG);
  const [loading, setLoading] = useState(Boolean(idToken && !initialCatalog?.length));
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    if (!idToken) {
      setCatalog(initialCatalog || PREVIEW_CATALOG);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setLoadError('');

    fetchLiffCustomerCatalog(idToken)
      .then((res) => {
        if (cancelled) return;
        const rows = Array.isArray(res.customers) ? res.customers : [];
        setCatalog(rows.length ? rows : (initialCatalog || PREVIEW_CATALOG));
      })
      .catch((e) => {
        if (cancelled) return;
        setLoadError(e?.message || T.loadError.th);
        if (initialCatalog?.length) setCatalog(initialCatalog);
        else setCatalog(PREVIEW_CATALOG);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [idToken, initialCatalog]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return catalog;
    return catalog.filter(
      (c) =>
        c.name.toLowerCase().includes(needle)
        || (c.zone || '').toLowerCase().includes(needle)
        || (c.aliases || []).some((a) => a.toLowerCase().includes(needle)),
    );
  }, [q, catalog]);

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
          disabled={loading}
        />
        {loading && (
          <p className="text-center text-sm text-slate-500 py-6">
            <BilingualInline th={T.loading.th} en={T.loading.en} />
          </p>
        )}
        {loadError && !loading && (
          <p className="text-center text-sm text-amber-700 py-2 mb-2" role="status">
            {loadError}
          </p>
        )}
        {!loading && (
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
        )}
        {!loading && filtered.length === 0 && (
          <p className="text-center text-sm text-slate-500 py-8">
            <BilingualInline th={T.pickEmpty.th} en={T.pickEmpty.en} />
          </p>
        )}
      </main>

      <footer
        className="fixed bottom-0 left-0 right-0 z-20 bg-white/95 backdrop-blur border-t border-slate-200 px-4 pt-3"
        style={{ paddingBottom: 'max(12px, env(safe-area-inset-bottom))' }}
      >
        <div className="max-w-md mx-auto flex gap-2">
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="min-h-[52px] px-4 rounded-2xl border border-slate-200 font-bold text-slate-600 text-sm shrink-0"
            >
              <BilingualInline th={T.back.th} en={T.back.en} />
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="flex-1 min-h-[52px] rounded-2xl border border-slate-200 font-bold text-slate-600"
          >
            <BilingualInline th={T.close.th} en={T.close.en} />
          </button>
        </div>
      </footer>
    </>
  );
}
