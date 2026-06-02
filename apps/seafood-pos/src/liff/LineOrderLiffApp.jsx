import React, { useCallback, useMemo, useState } from 'react';
import { Bilingual, BilingualHeading, BilingualHint, BilingualInline } from './Bilingual.jsx';
import { LIFF_COPY as T } from './liffCopy.js';

const SIZES = [
  { id: 'small', labelTh: T.sizes.small.th, labelEn: T.sizes.small.en, sub: '850/กก.', product: T.products.small },
  { id: 'medium', labelTh: T.sizes.medium.th, labelEn: T.sizes.medium.en, sub: '1,100/กก.', product: T.products.medium },
  { id: 'large', labelTh: T.sizes.large.th, labelEn: T.sizes.large.en, sub: '1,450/กก.', product: T.products.large },
];

function parseMode() {
  const q = new URLSearchParams(window.location.search);
  return q.get('mode') === 'new' ? 'new' : 'returning';
}

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

function SizeChip({ item, active, weight, onToggle, onWeight }) {
  return (
    <div
      className={`rounded-2xl border p-3 transition-colors ${
        active ? 'border-sky-500 bg-sky-50/60 shadow-sm' : 'border-slate-200 bg-white'
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
          <p className="text-[11px] text-slate-500">{item.sub}</p>
        </div>
        <span
          className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 ${
            active ? 'border-sky-600 bg-sky-600' : 'border-slate-300'
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

function ReturningForm({ shopName, onClose }) {
  const [sizes, setSizes] = useState({ small: '', medium: '', large: '' });
  const [activeSizes, setActiveSizes] = useState({});
  const [deadOn, setDeadOn] = useState(false);
  const [deadKg, setDeadKg] = useState('');
  const [delivery, setDelivery] = useState('today');
  const [otherDate, setOtherDate] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const deliveryLabel =
    delivery === 'today' ? `วันนี้ (${formatThaiDate(todayKey())})` : formatThaiDate(otherDate || todayKey());

  const summaryLines = useMemo(() => {
    const lines = [];
    for (const s of SIZES) {
      if (activeSizes[s.id] && parseFloat(sizes[s.id]) > 0) {
        lines.push(`${s.product} · ${sizes[s.id]} ${T.kg.th}`);
      }
    }
    if (deadOn && parseFloat(deadKg) > 0) lines.push(`${T.products.dead} · ${deadKg} ${T.kg.th}`);
    return lines;
  }, [activeSizes, sizes, deadOn, deadKg]);

  const toggleSize = (id) => {
    setActiveSizes((prev) => {
      const next = { ...prev, [id]: !prev[id] };
      if (!next[id]) setSizes((w) => ({ ...w, [id]: '' }));
      return next;
    });
  };

  const canSubmit =
    summaryLines.length > 0 &&
    (delivery !== 'other' || /^\d{4}-\d{2}-\d{2}$/.test(otherDate));

  const submit = () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setTimeout(() => {
      setSubmitting(false);
      alert(
        `[ตัวอย่าง] ส่งออเดอร์แล้ว\n${summaryLines.join('\n')}\nส่ง: ${deliveryLabel}`,
      );
    }, 600);
  };

  return (
    <>
      <header className="px-5 pt-5 pb-4 bg-gradient-to-b from-slate-900 to-slate-800 text-white rounded-b-[1.75rem] shadow-md">
        <p className="text-[11px] font-semibold text-sky-300/90 tracking-wide">
          <Bilingual th={T.brand.th} en={T.brand.en} className="!text-sky-300/90" />
        </p>
        <h1 className="text-xl font-extrabold mt-1 tracking-tight">
          <Bilingual th={T.orderTitle.th} en={T.orderTitle.en} className="!text-white" />
        </h1>
        <div className="mt-3 inline-flex items-center gap-2 bg-white/10 border border-white/15 rounded-full px-3 py-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-400" aria-hidden />
          <span className="text-sm font-semibold">{shopName}</span>
        </div>
        <div className="text-xs text-slate-400 mt-3 leading-relaxed">
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
              onClick={() => setDeadOn((v) => !v)}
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
              <div className="mt-3 pt-3 border-t border-amber-200/80">
                <Numpad value={deadKg} onChange={setDeadKg} />
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
      </main>

      <footer
        className="fixed bottom-0 left-0 right-0 z-20 bg-white/95 backdrop-blur-md border-t border-slate-200 px-4 pt-3 shadow-[0_-8px_30px_rgba(15,23,42,0.08)]"
        style={{ paddingBottom: 'max(12px, env(safe-area-inset-bottom))' }}
      >
        <div className="max-w-md mx-auto flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="min-h-[52px] px-4 rounded-2xl border border-slate-200 text-slate-600 font-bold text-sm shrink-0"
          >
            <BilingualInline th={T.close.th} en={T.close.en} />
          </button>
          <button
            type="button"
            disabled={!canSubmit || submitting}
            onClick={submit}
            className="flex-1 min-h-[52px] rounded-2xl bg-sky-600 text-white font-extrabold text-base shadow-lg shadow-sky-600/25 disabled:opacity-40 disabled:shadow-none active:scale-[0.99] transition-transform"
          >
            {submitting ? (
              <BilingualInline th={T.submitting.th} en={T.submitting.en} className="!text-white" />
            ) : (
              <BilingualInline th={T.submit.th} en={T.submit.en} className="!text-white" />
            )}
          </button>
        </div>
      </footer>
    </>
  );
}

function NewCustomerForm({ onClose }) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [step, setStep] = useState(1);

  const profileOk = name.trim().length >= 2 && phone.trim().length >= 9 && notes.trim().length >= 3;

  if (step === 2) {
    return <ReturningForm shopName={name.trim() || '—'} onClose={onClose} />;
  }

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
        <div className="flex gap-2 mt-4">
          <span className="flex-1 h-1 rounded-full bg-sky-400" />
          <span className="flex-1 h-1 rounded-full bg-white/20" />
        </div>
      </header>

      <main className="px-4 pt-5 pb-32 max-w-md mx-auto">
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

      <footer
        className="fixed bottom-0 left-0 right-0 z-20 bg-white/95 backdrop-blur border-t border-slate-200 px-4 pt-3"
        style={{ paddingBottom: 'max(12px, env(safe-area-inset-bottom))' }}
      >
        <div className="max-w-md mx-auto flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="min-h-[52px] px-4 rounded-2xl border border-slate-200 font-bold text-slate-600 text-sm"
          >
            <BilingualInline th={T.close.th} en={T.close.en} />
          </button>
          <button
            type="button"
            disabled={!profileOk}
            onClick={() => setStep(2)}
            className="flex-1 min-h-[52px] rounded-2xl bg-sky-600 text-white font-extrabold disabled:opacity-40"
          >
            <BilingualInline th={T.nextPickShrimp.th} en={T.nextPickShrimp.en} className="!text-white" />
          </button>
        </div>
      </footer>
    </>
  );
}

/** ตัวอย่าง UI LIFF — ยังไม่เชื่อม LINE / Firestore */
export default function LineOrderLiffApp() {
  const [mode, setMode] = useState(parseMode);
  const isPreview = !window.liff;

  const close = useCallback(() => {
    if (window.liff?.closeWindow) window.liff.closeWindow();
    else alert('ปิดหน้าต่าง (ตัวอย่าง)');
  }, []);

  return (
    <div className="min-h-[100dvh] bg-slate-50 font-['Sarabun',system-ui,sans-serif] antialiased">
      {isPreview && (
        <div className="sticky top-0 z-30 bg-amber-50 border-b border-amber-200 px-3 py-2 flex flex-wrap gap-2 items-center justify-center text-xs">
          <span className="font-bold text-amber-900">
            <BilingualInline th={T.previewBanner.th} en={T.previewBanner.en} />
          </span>
          <button
            type="button"
            onClick={() => setMode('returning')}
            className={`px-2.5 py-1 rounded-lg font-bold ${
              mode === 'returning' ? 'bg-slate-900 text-white' : 'bg-white border border-amber-200'
            }`}
          >
            <BilingualInline th={T.returningPreview.th} en={T.returningPreview.en} />
          </button>
          <button
            type="button"
            onClick={() => setMode('new')}
            className={`px-2.5 py-1 rounded-lg font-bold ${
              mode === 'new' ? 'bg-slate-900 text-white' : 'bg-white border border-amber-200'
            }`}
          >
            <BilingualInline th={T.newPreview.th} en={T.newPreview.en} />
          </button>
        </div>
      )}

      {mode === 'new' ? (
        <NewCustomerForm onClose={close} />
      ) : (
        <ReturningForm shopName="จ๊ะขียด" onClose={close} />
      )}
    </div>
  );
}
