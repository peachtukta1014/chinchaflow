import { PLATFORM_BRAND } from './platformBrand.js';

const STYLES = {
  tea: {
    sm: 'text-amber-600/85',
    md: 'text-amber-400/90',
    tagline: 'text-amber-600/75',
  },
  shrimp: {
    sm: 'text-cyan-400/90',
    md: 'text-cyan-300/95',
    tagline: 'text-slate-500',
  },
};

/**
 * ป้าย CHINCHA FLOW บนหัวแอป / หน้า login
 * @param {{ theme?: 'tea' | 'shrimp', size?: 'sm' | 'md', showTagline?: boolean, lang?: 'th' | 'en' | 'my', className?: string }} props
 */
export function PlatformMark({
  theme = 'tea',
  size = 'sm',
  showTagline = false,
  lang = 'th',
  className = '',
}) {
  const s = STYLES[theme] ?? STYLES.tea;
  const tagline = lang === 'en' ? PLATFORM_BRAND.taglineEn : PLATFORM_BRAND.taglineTh;

  return (
    <div className={className || 'text-center'}>
      <p
        className={`font-black uppercase tracking-[0.22em] ${
          size === 'md' ? 'text-[10px]' : 'text-[8px]'
        } ${s[size]}`}
      >
        ✦ {PLATFORM_BRAND.name} ✦
      </p>
      {showTagline && (
        <p className={`text-[8px] mt-0.5 tracking-wide ${s.tagline}`}>{tagline}</p>
      )}
    </div>
  );
}
