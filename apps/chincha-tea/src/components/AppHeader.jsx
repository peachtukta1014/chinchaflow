import { hardReloadApp } from '../lib/reloadApp';
import { getAppBuildLabel } from '../lib/appBuildInfo';
import { displayMemberPhotoUrl } from '../lib/memberAvatar';
import MemberAvatar from './MemberAvatar';

export default function AppHeader({
  member,
  lang,
  setLang,
  onLogout,
  onOpenProfile,
  profileMode = false,
  onBackFromProfile,
  t,
  dailySummary,
}) {
  const staffNeedsMy = member?.role === 'staff' && lang !== 'my';
  const todaySales = Math.round(Number(dailySummary?.salesTotal) || 0);
  const todayCups = Math.round(Number(dailySummary?.cupsSold) || 0);
  const buildLabel = getAppBuildLabel();
  const handleReload = () => {
    if (!window.confirm(t('reloadConfirm'))) return;
    hardReloadApp();
  };
  return (
    <header
      className="z-10 shrink-0 px-3 pt-[max(0.5rem,env(safe-area-inset-top))] pb-2 flex items-center justify-between gap-2"
      style={{ background: '#3d1f0f' }}
    >
      <div className="flex items-center gap-2 min-w-0">
        {profileMode ? (
          <button
            type="button"
            onClick={onBackFromProfile}
            className="w-8 h-8 rounded-full border border-amber-800 text-amber-300 flex items-center justify-center shrink-0"
            style={{ background: '#5a2d14' }}
            aria-label={t('profileBack')}
          >
            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 18l-6-6 6-6" />
            </svg>
          </button>
        ) : (
          <button
            type="button"
            onClick={onOpenProfile}
            className="flex items-center gap-2 min-w-0 text-left active:opacity-80"
            title={t('profileMyTitle')}
          >
            <MemberAvatar
              key={`${member?.uid}-${member?.photoUpdatedAt || ''}`}
              name={member?.name}
              email={member?.email}
              photoUrl={displayMemberPhotoUrl(member?.photoUrl, member?.photoUpdatedAt)}
              size="sm"
            />
            <div className="min-w-0">
              <p className="font-black text-amber-300 text-sm leading-tight truncate">
                {t('appName')}
                <span className="font-semibold text-amber-600/90"> · {member.name}</span>
              </p>
              <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                <span className="rounded-full bg-amber-300/15 px-2 py-0.5 text-[9px] font-black text-amber-100">
                  {t('todaySales')} ฿{todaySales.toLocaleString()}
                </span>
                <span className="rounded-full bg-amber-300/15 px-2 py-0.5 text-[9px] font-black text-amber-100">
                  {todayCups.toLocaleString()} {t('cupUnit')}
                </span>
              </div>
              {buildLabel && (
                <p className="text-[8px] text-cyan-300/80 truncate max-w-[180px]" title={t('buildVersionHint')}>
                  {buildLabel}
                </p>
              )}
            </div>
          </button>
        )}
        {profileMode && (
          <p className="font-black text-amber-300 text-sm leading-tight">{t('profileMyTitle')}</p>
        )}
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        <div className="flex rounded-lg overflow-hidden border border-amber-800" style={{ background: '#5a2d14' }}>
          {['th', 'my', 'en'].map((l) => (
            <button
              key={l}
              type="button"
              onClick={() => setLang(l)}
              className={`px-1.5 py-1 text-[9px] font-bold ${
                lang === l ? 'bg-amber-300 text-amber-900' : 'text-amber-500'
              } ${staffNeedsMy && l === 'my' ? 'ring-2 ring-red-400 animate-pulse' : ''}`}
            >
              {l === 'th' ? 'TH' : l === 'my' ? 'MY' : 'EN'}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={handleReload}
          className="w-8 h-8 rounded-full border border-amber-800 text-cyan-300 flex items-center justify-center"
          style={{ background: '#5a2d14' }}
          aria-label={t('reloadApp')}
          title={t('reloadApp')}
        >
          <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v6h6M20 20v-6h-6M5 19a9 9 0 0014-7M19 5a9 9 0 00-14 7" />
          </svg>
        </button>
        <button
          type="button"
          onClick={onLogout}
          className="w-8 h-8 rounded-full border border-amber-800 text-amber-500 flex items-center justify-center"
          style={{ background: '#5a2d14' }}
          aria-label={t('logout')}
        >
          <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" d="M17 16l4-4m0 0l-4-4m4 4H7" />
          </svg>
        </button>
      </div>
    </header>
  );
}
