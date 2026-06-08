import { CreditsStrip } from '@chincha/app-credits';
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
}) {
  const staffNeedsMy = member?.role === 'staff' && lang !== 'my';
  const handleReload = () => {
    if (!window.confirm(t('reloadConfirm'))) return;
    hardReloadApp();
  };
  return (
    <header className="z-10 shrink-0 px-4 pt-6 pb-3 flex items-center justify-between" style={{ background: '#3d1f0f' }}>
      <div className="flex items-center gap-3 min-w-0">
        {profileMode ? (
          <button
            type="button"
            onClick={onBackFromProfile}
            className="w-10 h-10 rounded-full border border-amber-800 text-amber-300 flex items-center justify-center shrink-0"
            style={{ background: '#5a2d14' }}
            aria-label={t('profileBack')}
          >
            <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 18l-6-6 6-6" />
            </svg>
          </button>
        ) : (
          <img src="/chincha-logo.jpg" alt="" className="w-10 h-10 rounded-full border-2 border-amber-300 shrink-0 object-cover" />
        )}
        <button
          type="button"
          onClick={profileMode ? undefined : onOpenProfile}
          disabled={profileMode}
          className={`flex items-center gap-2 min-w-0 text-left ${profileMode ? '' : 'active:opacity-80'}`}
          title={profileMode ? undefined : t('profileMyTitle')}
        >
          {!profileMode && (
            <MemberAvatar
              name={member?.name}
              email={member?.email}
              photoUrl={displayMemberPhotoUrl(member?.photoUrl, member?.photoUpdatedAt)}
              size="sm"
            />
          )}
          <div className="min-w-0">
            <p className="font-black text-amber-300 leading-none">
              {profileMode ? t('profileMyTitle') : t('appName')}
            </p>
            {!profileMode && (
              <p className="text-amber-700 text-[10px] truncate">{member.name}</p>
            )}
            {!profileMode && getAppBuildLabel() && (
              <p className="text-[9px] text-cyan-300/90 mt-0.5 truncate max-w-[200px]" title={t('buildVersionHint')}>
                {getAppBuildLabel()}
              </p>
            )}
            {!profileMode && (
              <CreditsStrip theme="tea" onDark className="text-left mt-1 max-w-[220px]" />
            )}
          </div>
        </button>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <div className="flex rounded-xl overflow-hidden border border-amber-800" style={{ background: '#5a2d14' }}>
          {['th', 'my', 'en'].map((l) => (
            <button
              key={l}
              type="button"
              onClick={() => setLang(l)}
              className={`px-2 py-1.5 text-[10px] font-bold ${
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
          className="w-9 h-9 rounded-full border border-amber-800 text-cyan-300 flex items-center justify-center"
          style={{ background: '#5a2d14' }}
          aria-label={t('reloadApp')}
          title={t('reloadApp')}
        >
          <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v6h6M20 20v-6h-6M5 19a9 9 0 0014-7M19 5a9 9 0 00-14 7" />
          </svg>
        </button>
        <button
          type="button"
          onClick={onLogout}
          className="w-9 h-9 rounded-full border border-amber-800 text-amber-500 flex items-center justify-center"
          style={{ background: '#5a2d14' }}
          aria-label={t('logout')}
        >
          <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" d="M17 16l4-4m0 0l-4-4m4 4H7" />
          </svg>
        </button>
      </div>
    </header>
  );
}
