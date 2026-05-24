import { useRef, useState } from 'react';

/** Speech-to-text ภาษาไทย (Chrome) */
export function useVoice(onText) {
  const [listening, setListening] = useState(false);
  const [liveText, setLiveText] = useState('');
  const recRef = useRef(null);
  const onTextRef = useRef(onText);
  onTextRef.current = onText;

  const toggle = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      alert('ใช้ Chrome เพื่อเปิด Voice ครับ');
      return;
    }
    if (listening) {
      recRef.current?.stop();
      return;
    }
    const rec = new SR();
    rec.lang = 'th-TH';
    rec.continuous = false;
    rec.interimResults = true;
    recRef.current = rec;
    rec.onresult = (e) => {
      const interim = Array.from(e.results).map((r) => r[0].transcript).join('');
      setLiveText(interim);
      const last = e.results[e.results.length - 1];
      if (last.isFinal) onTextRef.current(last[0].transcript.trim());
    };
    rec.onerror = () => {
      setListening(false);
      setLiveText('');
    };
    rec.onend = () => {
      setListening(false);
      setLiveText('');
    };
    rec.start();
    setListening(true);
  };

  return { listening, toggle, liveText };
}
