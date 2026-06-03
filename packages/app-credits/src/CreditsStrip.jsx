import { PLATFORM_BRAND } from './platformBrand.js';
import { APP_CREDITS } from './creditsContent.js';

const STYLES = {
  tea: 'text-amber-600/90',
  shrimp: 'text-slate-500',
  'tea-on-dark': 'text-amber-500/85',
  'shrimp-on-dark': 'text-slate-500',
};

/**
 * แถบเครดิตบาง — ไว้หัวแอป / login (ไม่บังปุ่มล่าง)
 * @param {{ theme?: 'tea' | 'shrimp', onDark?: boolean, className?: string }} props
 */
export function CreditsStrip({ theme = 'tea', onDark = false, className = '' }) {
  const tone = STYLES[onDark ? `${theme}-on-dark` : theme] ?? STYLES.tea;

  return (
    <p
      className={`text-[7px] font-semibold tracking-wide leading-snug text-center ${tone} ${className}`}
      aria-label="เครดิตระบบ CHINCHA FLOW"
    >
      <span className="font-black tracking-[0.14em] uppercase">{PLATFORM_BRAND.name}</span>
      <span className="opacity-90"> · Production by {APP_CREDITS.ownerAlias}</span>
      <span className="opacity-75"> · {APP_CREDITS.devName} @ Cursor</span>
    </p>
  );
}
