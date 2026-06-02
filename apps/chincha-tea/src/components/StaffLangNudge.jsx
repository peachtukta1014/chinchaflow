/** แจ้งพนักงานให้กด MY ถ้ายังไม่ได้เลือกภาษาพม่า */
export default function StaffLangNudge({ lang, setLang, t }) {
  if (lang === 'my') return null;
  return (
    <div className="z-10 shrink-0 mx-4 mt-1 px-3 py-2.5 rounded-xl bg-red-50 border-2 border-red-300 text-center">
      <p className="text-[11px] font-bold text-red-800 leading-snug">{t('staffLangNudge')}</p>
      <button
        type="button"
        onClick={() => setLang('my')}
        className="mt-2 px-4 py-1.5 rounded-xl bg-red-600 text-white text-xs font-black"
      >
        MY — မြန်မာ
      </button>
    </div>
  );
}
