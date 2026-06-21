import { useCallback, useRef, useState } from 'react';

/** Speech-to-text ภาษาไทย (Chrome / Edge) */
export function useVoice(onText) {
  const [listening, setListening] = useState(false);
  const [liveText, setLiveText] = useState('');
  const recRef = useRef(null);
  const onTextRef = useRef(onText);
  const committedRef = useRef('');
  const displayRef = useRef('');
  const wantListenRef = useRef(false);
  const flushedRef = useRef(false);
  onTextRef.current = onText;

  const flushTranscript = useCallback(() => {
    if (flushedRef.current) return;
    flushedRef.current = true;
    const text = displayRef.current.trim();
    committedRef.current = '';
    displayRef.current = '';
    setLiveText('');
    if (text) onTextRef.current(text);
  }, []);

  const stop = useCallback(() => {
    wantListenRef.current = false;
    recRef.current?.stop();
    setListening(false);
    flushTranscript();
  }, [flushTranscript]);

  const start = useCallback(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      alert('ใช้ Chrome หรือ Edge เพื่อสั่งงานด้วยเสียงครับ');
      return;
    }
    wantListenRef.current = true;
    flushedRef.current = false;
    committedRef.current = '';
    displayRef.current = '';
    const rec = new SR();
    rec.lang = 'th-TH';
    rec.continuous = true;
    rec.interimResults = true;
    recRef.current = rec;

    rec.onresult = (e) => {
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) {
          committedRef.current += e.results[i][0].transcript;
        }
      }
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (!e.results[i].isFinal) {
          interim += e.results[i][0].transcript;
        }
      }
      const display = (committedRef.current + interim).trim();
      displayRef.current = display;
      setLiveText(display);
    };

    rec.onerror = () => {
      if (!wantListenRef.current) {
        setListening(false);
        setLiveText('');
      }
    };

    rec.onend = () => {
      if (wantListenRef.current) {
        try {
          rec.start();
        } catch {
          wantListenRef.current = false;
          setListening(false);
          flushTranscript();
        }
      } else {
        setListening(false);
        flushTranscript();
      }
    };

    rec.start();
    setListening(true);
  }, [flushTranscript]);

  const toggle = useCallback(() => {
    if (listening) stop();
    else start();
  }, [listening, start, stop]);

  return { listening, toggle, stop, liveText };
}
