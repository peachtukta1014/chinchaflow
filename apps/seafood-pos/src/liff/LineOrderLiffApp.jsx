import React, { useMemo, useState } from 'react';
import { Bilingual, BilingualHeading, BilingualHint, BilingualInline } from './Bilingual.jsx';
import { CustomerPicker } from './CustomerPicker.jsx';
import { submitLiffOrder } from './liffOrderApi.js';
import { LIFF_COPY as T } from './liffCopy.js';
import { closeLiffWindow, useLiffSession } from './useLiffSession.js';

const SIZES = [
  {
    id: 'small',
    labelTh: T.sizes.small.th,
    labelEn: T.sizes.small.en,
    sub: '850/กก.',
    countTh: T.sizeCountPerKg.small.th,
    countEn: T.sizeCountPerKg.small.en,
    product: T.products.small,
  },
  {
    id: 'medium',
    labelTh: T.sizes.medium.th,
    labelEn: T.sizes.medium.en,
    sub: '1,100/กก.',
    countTh: T.sizeCountPerKg.medium.th,
    countEn: T.sizeCountPerKg.medium.en,
    product: T.products.medium,
  },
  {
    id: 'large',
    labelTh: T.sizes.large.th,
    labelEn: T.sizes.large.en,
    sub: '1,450/กก.',
    countTh: T.sizeCountPerKg.large.th,
    countEn: T.sizeCountPerKg.large.en,
    product: T.products.large,
  },
];

const DEAD_SIZES = [
  {
    id: 'dead_small',
    labelTh: T.deadSizeLabels.small.th,
    labelEn: T.deadSizeLabels.small.en,
    countTh: T.sizeCountPerKg.small.th,
    countEn: T.sizeCountPerKg.small.en,
    product: T.products.dead_small,
  },
  {
    id: 'dead_medium',
    labelTh: T.deadSizeLabels.medium.th,
    labelEn: T.deadSizeLabels.medium.en,
    countTh: T.sizeCountPerKg.medium.th,
    countEn: T.sizeCountPerKg.medium.en,
    product: T.products.dead_medium,
  },
  {
    id: 'dead_large',
    labelTh: T.deadSizeLabels.large.th,
    labelEn: T.deadSizeLabels.large.en,
    countTh: T.sizeCountPerKg.large.th,
    countEn: T.sizeCountPerKg.large.en,
    product: T.products.dead_large,
  },
];

function todayKey() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok' }).format(new Date());
}

function formatThaiDate(dateKey) {
  const d = new Date(`${dateKey}T12:00:00+07:00`);
  return d.toLocaleDateString('th-TH', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: 'Asia/Bangkok',
  });
}

function Section({ titleTh, titleEn, hintTh, hintEn, children }) {
  const headingId = titleTh.replace(/\s/g, '-');
  return (
    <section className="mb-5" aria-labelledby={headingId}>
      <div className="mb-2.5 px-0.5">
        <BilingualHeading
          th={titleTh}
          en={titleEn}
          id={headingId}
          className="text-[15px] font-bold text-slate-800 tracking-tight"
        />
        <BilingualHint th={hintTh} en={hintEn} />
      </div>
      {children}
    </section>
  );
}

function Field({ labelTh, labelEn, required, children, error }) {
  return (
    <label className="block mb-3">
      <span className="text-xs font-semibold text-slate-600 mb-1.5 block">
        <Bilingual th={labelTh} en={labelEn} />
        {required && <span className="text-red-500 ml-0.5" aria-hidden>*</span>}
      </span>
      {children}
      {error && (
        <p className="text-xs text-red-600 mt-1" role="alert">
          {error}
        </p>
      )}
    </label>
  );
}

const inputClass =
  'w-full min-h-[48px] px-4 rounded-xl border border-slate-200 bg-white text-slate-900 text-base ' +
  'placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500/30 focus:border-sky-500';

function Numpad({ value, onChange, onDone }) {
  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', 'del'];

  const press = (k) => {
    if (k === 'del') {
      onChange(value.slice(0, -1));
      return;
    }
    if (k === '.' && value.includes('.')) return;
    if (k === '.' && !value) {
      onChange('0.');
      return;
    }
    onChange(`${value}${k}`.replace(/^0+(?=\d)/, ''));
  };

  return (
    <div className="rounded-2xl bg-slate-100/80 p-2 border border-slate-200/80">
      <div
        className="min-h-[52px] mb-2 px-4 flex items-center justify-end rounded-xl bg-white border border-slate-200"
        aria-live="polite"
        aria-label={`${T.weightAria.th} ${T.weightAria.en}`}
      >
        <span className="text-2xl font-bold text-slate-900 tabular-nums tracking-tight">
          {value || '0'}
        </span>
        <span className="text-sm font-semibold text-slate-500 ml-2">
          <BilingualInline th={T.kg.th} en={T.kg.en} />
        </span>
      </div>
      <div className="grid grid-cols-3 gap-1.5" role="group" aria-label={`${T.numpadAria.th} ${T.numpadAria.en}`}>
        {keys.map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => press(k)}
            className="min-h-[48px] rounded-xl bg-white border border-slate-200 text-lg font-bold text-slate-800 active:scale-[0.98] active:bg-slate-50 shadow-sm"
          >
            {k === 'del' ? '⌫' : k}
          </button>
        ))}
      </div>
      {onDone && (
        <button
          type="button"
          onClick={onDone}
          className="mt-2 w-full min-h-[44px] text-sm font-bold text-sky-700 bg-sky-50 rounded-xl border border-sky-100"
        >
          <BilingualInline th={T.useWeight.th} en={T.useWeight.en} />
        </button>
      )}
    </div>
  );
}

function SizeChip({ item, active, weight, onToggle, onWeight, variant = 'sky' }) {
  const activeClass =
    variant === 'amber'
      ? 'border-amber-500 bg-amber-50/60 shadow-sm'
      : 'border-sky-500 bg-sky-50/60 shadow-sm';
  const checkClass = variant === 'amber' ? 'border-amber-600 bg-amber-600' : 'border-sky-600 bg-sky-600';

  return (
    <div
      className={`rounded-2xl border p-3 transition-colors ${
        active ? activeClass : 'border-slate-200 bg-white'
      }`}
    >
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between gap-2 min-h-[44px]"
        aria-pressed={active}
      >
        <div className="text-left">
          <p className="font-bold text-slate-900">
            <Bilingual th={item.labelTh} en={item.labelEn} />
          </p>
          {item.sub && <p className="text-[11px] text-slate-500">{item.sub}</p>}
          {item.countTh && (
            <p className="text-[10px] text-slate-400 mt-0.5 font-medium">
              <BilingualInline th={item.countTh} en={item.countEn} />
            </p>
          )}
        </div>
        <span
          className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 ${
            active ? checkClass : 'border-slate-300'
          }`}
          aria-hidden
        >
          {active && <span className="w-2 h-2 rounded-full bg-white" />}
        </span>
      </button>
      {active && (
        <div className="mt-3 pt-3 border-t border-slate-200/80">
          <p className="text-[11px] font-semibold text-slate-500 mb-2">
            <BilingualInline th={T.weightKg.th} en={T.weightKg.en} />
          </p>
          <Numpad value={weight} onChange={onWeight} />
        </div>
      )}
    </div>
  );
}

function OrderSummary({ lines, deliveryLabel }) {
  if (!lines.length) return null;
  return (
    <div className="rounded-2xl bg-slate-900 text-white p-4 mb-4 shadow-lg">
      <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
        <Bilingual th={T.orderSummary.th} en={T.orderSummary.en} className="!text-slate-400" />
      </p>
      <ul className="space-y-1.5 text-sm">
        {lines.map((ln) => (
          <li key={ln} className="flex justify-between gap-2">
            <span className="text-slate-200">{ln}</span>
          </li>
        ))}
      </ul>
      <p className="text-xs text-slate-400 mt-3 pt-3 border-t border-slate-700">
        <BilingualInline th={T.deliveryPrefix.th} en={T.deliveryPrefix.en} />
        {' · '}
        {deliveryLabel}
      </p>
    </div>
  );
}

function buildRiverPayload(sizes, activeSizes, deadSizes, activeDeadSizes) {
  const river = {};
  for (const s of SIZES) {
    if (activeSizes[s.id] && parseFloat(sizes[s.id]) > 0) river[s.id] = sizes[s.id];
  }
  for (const s of DEAD_SIZES) {
    if (activeDeadSizes[s.id] && parseFloat(deadSizes[s.id]) > 0) river[s.id] = deadSizes[s.id];
  }
  return river;
}

function useOrderDraft() {
  const [sizes, setSizes] = useState({ small: '', medium: '', large: '' });
  const [activeSizes, setActiveSizes] = useState({});
  const [deadOn, setDeadOn] = useState(false);
  const [deadSizes, setDeadSizes] = useState({
    dead_small: '',
    dead_medium: '',
    dead_large: '',
  });
  const [activeDeadSizes, setActiveDeadSizes] = useState({});
  const [delivery, setDelivery] = useState('today');
  const [otherDate, setOtherDate] = useState('');

  const deliveryKey = delivery === 'today' ? todayKey() : otherDate;
  const deliveryLabel =
    delivery === 'today' ? `วันนี้ (${formatThaiDate(todayKey())})` : formatThaiDate(otherDate || todayKey());

  const summaryLines = useMemo(() => {
    const lines = [];
    for (const s of SIZES) {
      if (activeSizes[s.id] && parseFloat(sizes[s.id]) > 0) {
        lines.push(`${s.product} · ${sizes[s.id]} ${T.kg.th}`);
      }
    }
    for (const s of DEAD_SIZES) {
      if (activeDeadSizes[s.id] && parseFloat(deadSizes[s.id]) > 0) {
        lines.push(`${s.labelTh} · ${deadSizes[s.id]} ${T.kg.th}`);
      }
    }
    return lines;
  }, [activeSizes, sizes, activeDeadSizes, deadSizes]);

  const toggleSize = (id) => {
    setActiveSizes((prev) => {
      const next = { ...prev, [id]: !prev[id] };
      if (!next[id]) setSizes((w) => ({ ...w, [id]: '' }));
      return next;
    });
  };

  const toggleDeadSize = (id) => {
    setActiveDeadSizes((prev) => {
      const next = { ...prev, [id]: !prev[id] };
      if (!next[id]) setDeadSizes((w) => ({ ...w, [id]: '' }));
      return next;
    });
  };

  const setDeadSectionOn = (on) => {
    setDeadOn(on);
    if (!on) {
      setActiveDeadSizes({});
      setDeadSizes({ dead_small: '', dead_medium: '', dead_large: '' });
    }
  };

  const canProceed =
    summaryLines.length > 0 &&
    (delivery !== 'other' || /^\d{4}-\d{2}-\d{2}$/.test(otherDate));

  const riverPayload = () => buildRiverPayload(sizes, activeSizes, deadSizes, activeDeadSizes);

  return {
    sizes,
    setSizes,
    activeSizes,
    deadOn,
    setDeadSectionOn,
    deadSizes,
    setDeadSizes,
    activeDeadSizes,
    toggleDeadSize,
    delivery,
    setDelivery,
    otherDate,
    setOtherDate,
    deliveryKey,
    deliveryLabel,
    summaryLines,
    toggleSize,
    canProceed,
    riverPayload,
  };
}

function LiffFooter({ onClose, onPrimary, primaryDisabled, primarySubmitting, primaryTh, primaryEn, onBack }) {
  return (
    <footer
      className="fixed bottom-0 left-0 right-0 z-20 bg-white/95 backdrop-blur-md border-t border-slate-200 px-4 pt-3 shadow-[0_-8px_30px_rgba(15,23,42,0.08)]"
      style={{ paddingBottom: 'max(12px, env(safe-area-inset-bottom))' }}
    >
      <div className="max-w-md mx-auto flex gap-2">
        {onBack ? (
          <button
            type="button"
            onClick={onBack}
            className="min-h-[52px] px-4 rounded-2xl border border-slate-200 text-slate-600 font-bold text-sm shrink-0"
          >
            <BilingualInline th={T.back.th} en={T.back.en} />
          </button>
        ) : (
          <button
            type="button"
            onClick={onClose}
            className="min-h-[52px] px-4 rounded-2xl border border-slate-200 text-slate-600 font-bold text-sm shrink-0"
          >
            <BilingualInline th={T.close.th} en={T.close.en} />
          </button>
        )}
        <button
          type="button"
          disabled={primaryDisabled || primarySubmitting}
          onClick={onPrimary}
          className="flex-1 min-h-[52px] rounded-2xl bg-sky-600 text-white font-extrabold text-base shadow-lg shadow-sky-600/25 disabled:opacity-40 disabled:shadow-none active:scale-[0.99] transition-transform"
        >
          {primarySubmitting ? (
            <BilingualInline th={T.submitting.th} en={T.submitting.en} className="!text-white" />
          ) : (
            <BilingualInline th={primaryTh} en={primaryEn} className="!text-white" />
          )}
        </button>
      </div>
    </footer>
  );
}

function IdentityStep({ onReturning, onNew, onBack }) {
  return (
    <>
      <header className="px-5 pt-5 pb-4 bg-gradient-to-b from-slate-900 to-slate-800 text-white rounded-b-[1.75rem] shadow-md">
        <p className="text-[11px] font-semibold text-sky-300/90 tracking-wide">
          <Bilingual th={T.brand.th} en={T.brand.en} className="!text-sky-300/90" />
        </p>
        <h1 className="text-xl font-extrabold mt-1 tracking-tight">
          <Bilingual th={T.identityTitle.th} en={T.identityTitle.en} className="!text-white" />
        </h1>
        <div className="text-xs text-slate-400 mt-3 leading-relaxed">
          <BilingualHint th={T.identityHint.th} en={T.identityHint.en} />
        </div>
      </header>
      <main className="px-4 pt-6 pb-32 max-w-md mx-auto space-y-3">
        <button
          type="button"
          onClick={onReturning}
          className="w-full text-left min-h-[72px] px-4 py-4 rounded-2xl border-2 border-sky-500 bg-sky-50 active:bg-sky-100"
        >
          <p className="font-extrabold text-slate-900 text-base">
            <Bilingual th={T.orderedBefore.th} en={T.orderedBefore.en} />
          </p>
          <p className="text-xs text-slate-600 mt-1">
            <BilingualHint th={T.orderedBeforeSub.th} en={T.orderedBeforeSub.en} />
          </p>
        </button>
        <button
          type="button"
          onClick={onNew}
          className="w-full text-left min-h-[72px] px-4 py-4 rounded-2xl border border-slate-200 bg-white active:bg-slate-50"
        >
          <p className="font-extrabold text-slate-900 text-base">
            <Bilingual th={T.notYetOrdered.th} en={T.notYetOrdered.en} />
          </p>
          <p className="text-xs text-slate-600 mt-1">
            <BilingualHint th={T.notYetOrderedSub.th} en={T.notYetOrderedSub.en} />
          </p>
        </button>
      </main>
      <footer
        className="fixed bottom-0 left-0 right-0 z-20 bg-white/95 backdrop-blur border-t border-slate-200 px-4 pt-3"
        style={{ paddingBottom: 'max(12px, env(safe-area-inset-bottom))' }}
      >
        <button
          type="button"
          onClick={onBack}
          className="w-full max-w-md mx-auto block min-h-[52px] rounded-2xl border border-slate-200 font-bold text-slate-600"
        >
          <BilingualInline th={T.back.th} en={T.back.en} />
        </button>
      </footer>
    </>
  );
}

function OrderStep({
  customer,
  draft,
  onClose,
  onPrimary,
  primaryTh,
  primaryEn,
  primarySubmitting,
  submitError,
}) {
  const {
    sizes,
    setSizes,
    activeSizes,
    deadOn,
    setDeadSectionOn,
    deadSizes,
    setDeadSizes,
    activeDeadSizes,
    toggleDeadSize,
    delivery,
    setDelivery,
    otherDate,
    setOtherDate,
    deliveryLabel,
    summaryLines,
    toggleSize,
    canProceed,
  } = draft;

  return (
    <>
      <header className="px-5 pt-5 pb-4 bg-gradient-to-b from-slate-900 to-slate-800 text-white rounded-b-[1.75rem] shadow-md">
        <p className="text-[11px] font-semibold text-sky-300/90 tracking-wide">
          <Bilingual th={T.brand.th} en={T.brand.en} className="!text-sky-300/90" />
        </p>
        <h1 className="text-xl font-extrabold mt-1 tracking-tight">
          <Bilingual th={T.orderTitle.th} en={T.orderTitle.en} className="!text-white" />
        </h1>
        {customer?.name ? (
          <div className="mt-3 inline-flex items-center gap-2 bg-white/10 border border-white/15 rounded-full px-3 py-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400" aria-hidden />
            <span className="text-sm font-semibold">{customer.name}</span>
          </div>
        ) : (
          <div className="text-xs text-slate-400 mt-3 leading-relaxed">
            <BilingualHint th={T.orderFirstHint.th} en={T.orderFirstHint.en} />
          </div>
        )}
        <div className="text-xs text-slate-400 mt-2 leading-relaxed">
          <BilingualHint th={T.headerHint.th} en={T.headerHint.en} />
        </div>
      </header>

      <main className="px-4 pt-5 pb-36 max-w-md mx-auto">
        <OrderSummary lines={summaryLines} deliveryLabel={deliveryLabel} />

        <Section
          titleTh={T.riverLive.th}
          titleEn={T.riverLive.en}
          hintTh={T.riverLiveHint.th}
          hintEn={T.riverLiveHint.en}
        >
          <div className="space-y-2">
            {SIZES.map((s) => (
              <SizeChip
                key={s.id}
                item={s}
                active={!!activeSizes[s.id]}
                weight={sizes[s.id]}
                onToggle={() => toggleSize(s.id)}
                onWeight={(v) => setSizes((prev) => ({ ...prev, [s.id]: v }))}
              />
            ))}
          </div>
          <p className="text-[10px] text-slate-400 mt-2 px-0.5 leading-relaxed">
            <BilingualHint th={T.sizeCountNote.th} en={T.sizeCountNote.en} />
          </p>
        </Section>

        <Section
          titleTh={T.deadShrimp.th}
          titleEn={T.deadShrimp.en}
          hintTh={T.deadShrimpHint.th}
          hintEn={T.deadShrimpHint.en}
        >
          <div
            className={`rounded-2xl border p-3 ${
              deadOn ? 'border-amber-400 bg-amber-50/50' : 'border-slate-200 bg-white'
            }`}
          >
            <button
              type="button"
              onClick={() => setDeadSectionOn(!deadOn)}
              className="w-full flex items-center justify-between min-h-[44px]"
              aria-pressed={deadOn}
            >
              <span className="font-bold text-slate-800">
                <BilingualInline th={T.orderDead.th} en={T.orderDead.en} />
              </span>
              <span
                className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                  deadOn ? 'bg-amber-500 text-white' : 'bg-slate-100 text-slate-500'
                }`}
              >
                {deadOn ? (
                  <BilingualInline th={T.on.th} en={T.on.en} className="!text-inherit" />
                ) : (
                  <BilingualInline th={T.off.th} en={T.off.en} />
                )}
              </span>
            </button>
            {deadOn && (
              <div className="mt-3 pt-3 border-t border-amber-200/80 space-y-2">
                {DEAD_SIZES.map((s) => (
                  <SizeChip
                    key={s.id}
                    item={s}
                    variant="amber"
                    active={!!activeDeadSizes[s.id]}
                    weight={deadSizes[s.id]}
                    onToggle={() => toggleDeadSize(s.id)}
                    onWeight={(v) => setDeadSizes((prev) => ({ ...prev, [s.id]: v }))}
                  />
                ))}
              </div>
            )}
          </div>
        </Section>

        <Section
          titleTh={T.deliveryDate.th}
          titleEn={T.deliveryDate.en}
          hintTh={T.deliveryDateHint.th}
          hintEn={T.deliveryDateHint.en}
        >
          <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-2xl border border-slate-200/80">
            <button
              type="button"
              onClick={() => setDelivery('today')}
              className={`min-h-[48px] rounded-xl text-sm font-bold transition-all px-1 ${
                delivery === 'today'
                  ? 'bg-white text-slate-900 shadow-sm ring-1 ring-slate-200'
                  : 'text-slate-500'
              }`}
            >
              <Bilingual th={T.today.th} en={T.today.en} className="text-center" />
            </button>
            <button
              type="button"
              onClick={() => setDelivery('other')}
              className={`min-h-[48px] rounded-xl text-sm font-bold transition-all px-1 ${
                delivery === 'other'
                  ? 'bg-white text-slate-900 shadow-sm ring-1 ring-slate-200'
                  : 'text-slate-500'
              }`}
            >
              <Bilingual th={T.otherDay.th} en={T.otherDay.en} className="text-center" />
            </button>
          </div>
          {delivery === 'other' && (
            <div className="mt-3">
              <input
                type="date"
                className={inputClass}
                value={otherDate}
                min={todayKey()}
                onChange={(e) => setOtherDate(e.target.value)}
              />
            </div>
          )}
        </Section>

        <p className="text-[11px] text-center text-slate-400 px-2 leading-relaxed">
          <BilingualHint th={T.privacy.th} en={T.privacy.en} />
        </p>
        <p className="text-[11px] text-center text-slate-400 px-2 mt-2 leading-relaxed">
          <BilingualHint th={T.chatOthersHint.th} en={T.chatOthersHint.en} />
        </p>
        {submitError && (
          <p className="text-sm text-red-600 text-center mt-3" role="alert">
            {submitError}
          </p>
        )}
      </main>

      <LiffFooter
        onClose={onClose}
        onPrimary={onPrimary}
        primaryDisabled={!canProceed}
        primarySubmitting={primarySubmitting}
        primaryTh={primaryTh}
        primaryEn={primaryEn}
      />
    </>
  );
}

function ProfileStep({ onClose, onBack, onSubmit, submitting, submitError }) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [notes, setNotes] = useState('');

  const profileOk = name.trim().length >= 2 && phone.trim().length >= 9 && notes.trim().length >= 3;

  return (
    <>
      <header className="px-5 pt-5 pb-4 bg-gradient-to-b from-slate-900 to-slate-800 text-white rounded-b-[1.75rem] shadow-md">
        <p className="text-[11px] font-semibold text-amber-300/90 tracking-wide">
          <Bilingual th={T.welcome.th} en={T.welcome.en} className="!text-amber-300/90" />
        </p>
        <h1 className="text-xl font-extrabold mt-1">
          <Bilingual th={T.registerTitle.th} en={T.registerTitle.en} className="!text-white" />
        </h1>
        <div className="text-xs text-slate-400 mt-2 leading-relaxed">
          <BilingualHint th={T.registerHint.th} en={T.registerHint.en} />
        </div>
        <p className="text-[11px] text-sky-300/80 mt-3">
          <BilingualInline th={T.stepShop.th} en={T.stepShop.en} className="!text-sky-300/80" />
        </p>
      </header>

      <main className="px-4 pt-5 pb-32 max-w-md mx-auto">
        {submitError && (
          <p className="text-sm text-red-600 text-center mb-3" role="alert">
            {submitError}
          </p>
        )}
        <Section
          titleTh={T.profileSection.th}
          titleEn={T.profileSection.en}
          hintTh={T.profileHint.th}
          hintEn={T.profileHint.en}
        >
          <Field labelTh={T.customerName.th} labelEn={T.customerName.en} required>
            <input
              className={inputClass}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={`${T.namePlaceholder.th} / ${T.namePlaceholder.en}`}
              autoComplete="organization"
            />
          </Field>
          <Field labelTh={T.phone.th} labelEn={T.phone.en} required>
            <input
              className={inputClass}
              type="tel"
              inputMode="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="08xxxxxxxx"
              autoComplete="tel"
            />
          </Field>
          <Field labelTh={T.notes.th} labelEn={T.notes.en} required>
            <textarea
              className={`${inputClass} min-h-[88px] py-3 resize-none`}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={`${T.notesPlaceholder.th} / ${T.notesPlaceholder.en}`}
            />
          </Field>
        </Section>
        <p className="text-[11px] text-slate-400 text-center">
          <BilingualHint th={T.noDefaultSize.th} en={T.noDefaultSize.en} />
        </p>
      </main>

      <LiffFooter
        onBack={onBack}
        onClose={onClose}
        onPrimary={() => onSubmit({ name: name.trim(), phone: phone.trim(), notes: notes.trim() })}
        primaryDisabled={!profileOk}
        primarySubmitting={submitting}
        primaryTh={T.submit.th}
        primaryEn={T.submit.en}
      />
    </>
  );
}

function PreviewBanner({ mode, onMode }) {
  return (
    <div className="sticky top-0 z-30 bg-amber-50 border-b border-amber-200 px-3 py-2 flex flex-wrap gap-2 items-center justify-center text-xs">
      <span className="font-bold text-amber-900">
        <BilingualInline th={T.previewBanner.th} en={T.previewBanner.en} />
      </span>
      <button
        type="button"
        onClick={() => onMode('short')}
        className={`px-2.5 py-1 rounded-lg font-bold ${
          mode === 'short' ? 'bg-slate-900 text-white' : 'bg-white border border-amber-200'
        }`}
      >
        <BilingualInline th={T.returningPreview.th} en={T.returningPreview.en} />
      </button>
      <button
        type="button"
        onClick={() => onMode('pick')}
        className={`px-2.5 py-1 rounded-lg font-bold ${
          mode === 'pick' ? 'bg-slate-900 text-white' : 'bg-white border border-amber-200'
        }`}
      >
        <BilingualInline th={T.pickPreview.th} en={T.pickPreview.en} />
      </button>
      <button
        type="button"
        onClick={() => onMode('new')}
        className={`px-2.5 py-1 rounded-lg font-bold ${
          mode === 'new' ? 'bg-slate-900 text-white' : 'bg-white border border-amber-200'
        }`}
      >
        <BilingualInline th={T.newPreview.th} en={T.newPreview.en} />
      </button>
    </div>
  );
}

/** LIFF สั่งกุ้ง — OA เท่านั้น (กลุ่ม LINE ยังพิมพ์สั่งเหมือนเดิม) */
function initialPreviewMode() {
  if ((import.meta.env.VITE_LIFF_ID || '').trim()) return null;
  const q = new URLSearchParams(window.location.search);
  if (q.get('mode') === 'new') return 'new';
  if (q.get('mode') === 'pick') return 'pick';
  return 'short';
}

export default function LineOrderLiffApp() {
  const session = useLiffSession();
  const [previewMode, setPreviewMode] = useState(initialPreviewMode);
  const [pickedCustomer, setPickedCustomer] = useState(null);
  const [step, setStep] = useState('order');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const draft = useOrderDraft();

  const close = () => closeLiffWindow();

  if (session.status === 'loading') {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-slate-50 font-['Sarabun',system-ui,sans-serif]">
        <p className="text-slate-600 font-semibold">
          <Bilingual th={T.loading.th} en={T.loading.en} />
        </p>
      </div>
    );
  }

  if (session.status === 'error') {
    return (
      <div className="min-h-[100dvh] flex flex-col items-center justify-center gap-3 p-6 bg-slate-50 font-['Sarabun',system-ui,sans-serif]">
        <p className="text-red-600 font-bold text-center">
          <Bilingual th={T.loadError.th} en={T.loadError.en} />
        </p>
        <p className="text-sm text-slate-600 text-center">{session.error}</p>
        <button
          type="button"
          onClick={close}
          className="min-h-[48px] px-6 rounded-xl border border-slate-200 font-bold"
        >
          <BilingualInline th={T.close.th} en={T.close.en} />
        </button>
      </div>
    );
  }

  const isPreview = session.isPreview;
  const ctx = isPreview && previewMode
    ? { mode: previewMode, customer: previewMode === 'short' ? { id: 'c1', name: 'จ๊ะขียด', zone: 'ป่าตอง' } : null }
    : session.context;

  const linkedCustomer =
    pickedCustomer
    || (ctx?.mode === 'short' && ctx?.customer ? ctx.customer : null);

  const submitOrder = async ({ customer, registerProfile }) => {
    if (!draft.canProceed || submitting) return;
    setSubmitError('');
    setSubmitting(true);
    try {
      const river = draft.riverPayload();
      if (isPreview) {
        alert(
          `[ตัวอย่าง] ส่งออเดอร์แล้ว\n${draft.summaryLines.join('\n')}\nส่ง: ${draft.deliveryLabel}`,
        );
        return;
      }
      const result = await submitLiffOrder({
        idToken: session.idToken,
        river,
        deliveryDate: draft.deliveryKey,
        customerId: customer?.id,
        customerName: customer?.name || registerProfile?.name,
        linkUid: true,
        ...(registerProfile
          ? {
              registerNew: true,
              phone: registerProfile.phone,
              notes: registerProfile.notes,
            }
          : {}),
      });
      alert(result.message || `${T.submitSuccess.th}\n${T.submitSuccess.en}`);
      closeLiffWindow();
    } catch (e) {
      setSubmitError(e?.message || T.submitFail.th);
    } finally {
      setSubmitting(false);
    }
  };

  const shell = (content) => (
    <div className="min-h-[100dvh] bg-slate-50 font-['Sarabun',system-ui,sans-serif] antialiased">
      {isPreview && (
        <PreviewBanner
          mode={previewMode || 'short'}
          onMode={(m) => {
            setPreviewMode(m);
            setPickedCustomer(null);
            setStep('order');
          }}
        />
      )}
      {content}
    </div>
  );

  if (step === 'pick') {
    return shell(
      <CustomerPicker
        onSelect={(c) => {
          const cust = { id: c.id, name: c.name, zone: c.zone };
          setPickedCustomer(cust);
          submitOrder({ customer: cust });
        }}
        onBack={() => setStep('identity')}
        onClose={close}
      />,
    );
  }

  if (step === 'identity') {
    return shell(
      <IdentityStep
        onReturning={() => setStep('pick')}
        onNew={() => setStep('profile')}
        onBack={() => setStep('order')}
      />,
    );
  }

  if (step === 'profile') {
    return shell(
      <ProfileStep
        onClose={close}
        onBack={() => setStep('identity')}
        onSubmit={(profile) => submitOrder({ registerProfile: profile })}
        submitting={submitting}
        submitError={submitError}
      />,
    );
  }

  const onOrderPrimary = () => {
    if (linkedCustomer) {
      submitOrder({ customer: linkedCustomer });
    } else {
      setSubmitError('');
      setStep('identity');
    }
  };

  return shell(
    <OrderStep
      customer={linkedCustomer}
      draft={draft}
      onClose={close}
      onPrimary={onOrderPrimary}
      primaryTh={linkedCustomer ? T.submit.th : T.next.th}
      primaryEn={linkedCustomer ? T.submit.en : T.next.en}
      primarySubmitting={submitting}
      submitError={submitError}
    />,
  );
}
