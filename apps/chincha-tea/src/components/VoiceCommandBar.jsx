import { useCallback, useState } from 'react';
import {
  canUseVoiceOrder,
  isIOS,
  isStandalonePWA,
} from '../lib/speechSupport';
import { useVoice } from '../lib/voiceOrder';

/**
 * ปุ่มฟังคำสั่งด้วยเสียง — ใช้ซ้ำในหน้าขาย / สรุป / สั่งของ
 * รองรับ Safari / Chrome บน iPhone (webkitSpeechRecognition)
 */
export function VoiceCommandBar({ lang, t, hint, idleHint, onFinalText, className = '' }) {
  const [voiceLog, setVoiceLog] = useState('');
  const voiceAvailable = canUseVoiceOrder();
  const showMobileTip = voiceAvailable && isIOS();
  const showPwaTip = showMobileTip && isStandalonePWA();

  const onVoiceFinal = useCallback((text) => {
    const result = onFinalText(text);
    if (result && typeof result === 'object' && result.log) {
      setVoiceLog(result.log);
    } else if (typeof result === 'string') {
      setVoiceLog(result);
    } else {
      setVoiceLog(text);
    }
  }, [onFinalText]);

  const { listening, toggle, liveText } = useVoice(onVoiceFinal, lang, { enabled: voiceAvailable });

  const displayHint = idleHint || hint || t('voiceHint');

  return (
    <div className={`space-y-2 ${className}`}>
      {!voiceAvailable && (
        <p className="text-xs px-3 py-2.5 rounded-xl bg-amber-50 text-amber-900 border border-amber-200 leading-relaxed">
          {t('installVoiceBrowser')}
        </p>
      )}
      {voiceAvailable && (
        <button
          type="button"
          onClick={toggle}
          className={`w-full flex items-center justify-center gap-2 py-3 rounded-2xl font-bold text-sm border-2 transition-all ${
            listening ? 'bg-red-500 border-red-400 text-white' : 'bg-white border-stone-200 text-stone-600'
          }`}
        >
          <span>{listening ? '🎙️' : '🎤'}</span>
          {listening ? t('voiceStop') : t('voiceListen')}
        </button>
      )}
      {showMobileTip && !listening && (
        <p className="text-[10px] px-2 text-amber-800/90 leading-relaxed">
          {showPwaTip ? t('voicePwaIosHint') : t('voiceIosHint')}
        </p>
      )}
      {(listening || liveText || voiceLog) && (
        <p className={`text-xs px-2 py-2 rounded-xl ${listening ? 'bg-red-50 text-red-600' : 'bg-stone-100 text-stone-500'}`}>
          {liveText || voiceLog || displayHint}
        </p>
      )}
      {voiceAvailable && !listening && !liveText && !voiceLog && hint && (
        <p className="text-[10px] text-stone-400 px-1 leading-relaxed">{hint}</p>
      )}
    </div>
  );
}
