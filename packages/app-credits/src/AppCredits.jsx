import { APP_CREDITS } from './creditsContent.js';

const THEMES = {
  tea: {
    login: {
      wrap: 'border-amber-400/35 bg-amber-950/55 backdrop-blur-sm',
      studio: 'text-amber-200/90',
      name: 'text-amber-100',
      alias: 'text-amber-300/95',
      roles: 'text-amber-500/90',
      divider: 'bg-amber-500/30',
      devName: 'text-amber-200',
      devRole: 'text-amber-400/85',
      devByline: 'text-amber-600/90',
    },
    bar: {
      wrap: 'border-amber-900/15 bg-amber-50/90',
      studio: 'text-amber-800/70',
      name: 'text-amber-950',
      alias: 'text-amber-800',
      roles: 'text-amber-700/80',
      divider: 'bg-amber-900/15',
      devName: 'text-amber-950',
      devRole: 'text-amber-800/75',
      devByline: 'text-amber-700/70',
    },
  },
  shrimp: {
    login: {
      wrap: 'border-cyan-400/30 bg-slate-950/70 backdrop-blur-sm',
      studio: 'text-cyan-200/90',
      name: 'text-white',
      alias: 'text-cyan-300/95',
      roles: 'text-slate-400',
      divider: 'bg-cyan-500/25',
      devName: 'text-cyan-100',
      devRole: 'text-cyan-400/90',
      devByline: 'text-slate-500',
    },
    bar: {
      wrap: 'border-slate-200 bg-white/95 shadow-sm',
      studio: 'text-slate-500',
      name: 'text-slate-900',
      alias: 'text-slate-700',
      roles: 'text-slate-500',
      divider: 'bg-slate-200',
      devName: 'text-slate-900',
      devRole: 'text-blue-600/90',
      devByline: 'text-slate-500',
    },
  },
};

/**
 * @param {{ theme?: 'tea' | 'shrimp', placement?: 'login' | 'bar', className?: string }} props
 */
export default function AppCredits({ theme = 'tea', placement = 'login', className = '' }) {
  const t = THEMES[theme]?.[placement] ?? THEMES.tea.login;
  const isLogin = placement === 'login';
  const c = APP_CREDITS;

  return (
    <footer
      className={`text-center ${className}`}
      aria-label="เครดิตผู้จัดทำระบบ"
    >
      <div
        className={`mx-auto border rounded-2xl px-4 ${isLogin ? 'py-4 max-w-sm' : 'py-2.5 max-w-md'} ${t.wrap}`}
      >
        <p className={`text-[9px] font-black tracking-[0.28em] uppercase ${t.studio}`}>
          ✦ {c.studioLabel} ✦
        </p>
        <p className={`mt-2 font-black leading-tight ${isLogin ? 'text-base' : 'text-[11px]'} ${t.name}`}>
          {c.ownerName}
        </p>
        <p className={`text-[10px] font-bold tracking-wide mt-0.5 ${t.alias}`}>{c.ownerAlias}</p>
        <p className={`text-[9px] leading-snug mt-1.5 ${t.roles}`}>{c.ownerRoles}</p>

        <div className={`my-2 h-px w-12 mx-auto ${t.divider}`} aria-hidden />

        <p className={`text-[10px] font-black ${t.devName}`}>{c.devName}</p>
        <p className={`text-[9px] font-semibold mt-0.5 ${t.devRole}`}>{c.devRole}</p>
        <p className={`text-[8px] mt-0.5 tracking-wide ${t.devByline}`}>{c.devByline}</p>
      </div>
    </footer>
  );
}
