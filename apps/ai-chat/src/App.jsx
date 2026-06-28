import { useCallback, useEffect, useRef, useState } from 'react';
import { chatWithAI, pollProgress, fetchResult, fetchDeployStatus } from './api';
import { listenForResult } from './firebase';
import { listSessions, createSession, updateSession, deleteSession, getSession } from './sessionStore';
import { APP_VERSION } from './version';

// ── Icons (inline lucide) ───────────────────────────────────────────────
const IconSend = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 2 11 13" /><path d="m22 2-7 20-4-9-9-4Z" />
  </svg>
);
const IconMic = ({ active }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill={active ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="9" y="2" width="6" height="11" rx="3" ry="3" /><path d="M5 10a7 7 0 0 0 14 0" /><line x1="12" y1="19" x2="12" y2="22" /><line x1="8" y1="22" x2="16" y2="22" />
  </svg>
);
const IconStop = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="6" y="6" width="12" height="12" rx="2" />
  </svg>
);
const IconTrash = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 6h18" /><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /><rect x="5" y="6" width="14" height="16" rx="2" /><path d="M10 11v6" /><path d="M14 11v6" />
  </svg>
);
const IconImage = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><path d="m21 15-5-5L5 21" />
  </svg>
);
const IconHistory = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" />
  </svg>
);
const IconPlus = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 5v14M5 12h14" />
  </svg>
);
const IconX = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 6 6 18M6 6l12 12" />
  </svg>
);
const IconRefresh = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
    <path d="M21 3v5h-5" />
    <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
    <path d="M8 16H3v5" />
  </svg>
);
const IconFile = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" /><path d="M14 2v4a2 2 0 0 0 2 2h4" /><path d="M10 9H8" /><path d="M16 13H8" /><path d="M16 17H8" />
  </svg>
);

const MAX_IMAGES = 5;
const MAX_FILE_CHARS = 8000;
const ACCEPTED_FILES = '.txt,.md,.js,.jsx,.ts,.tsx,.json,.csv,.log,.py,.html,.css';
const WELCOME_MSG = {
  role: 'assistant',
  content: 'สวัสดีพี่พีช! จีจี้เลขาส่วนตัวพีชเองนะคะ 🌸\n\nพร้อมช่วยพี่เสมอเลย ไม่ว่าจะเป็น:\n- ถามเรื่องร้านชา / ร้านกุ้ง\n- ส่งรูป screenshot หรือ error มาให้ดู (แนบได้ถึง 5 รูปต่อครั้งเลย)\n- สั่งแก้โค้ด AI deepseek จัดการ + เปิด PR ให้\n\nพูดหรือพิมพ์ได้เลยนะคะ',
};

// 🔥 [ลบออก] AGENT_OPTIONS Array

export default function App() {
  const [messages, setMessages] = useState([WELCOME_MSG]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [listening, setListening] = useState(false);
  // 🔥 [ลบออก] สเตตอยกกลุ่ม agentScope และ showAgentPicker
  const [showHistory, setShowHistory] = useState(false);
  const [imagePreviews, setImagePreviews] = useState([]);
  const [fileAttachment, setFileAttachment] = useState(null);
  const [progressStep, setProgressStep] = useState(null);
  const [deployBanner, setDeployBanner] = useState(null);
  const [sessions, setSessions] = useState(() => listSessions());
  const chatEnd = useRef(null);
  const inputRef = useRef(null);
  const recognitionRef = useRef(null);
  const fileInputRef = useRef(null);
  const fileInputRef2 = useRef(null);
  const pollIntervalRef = useRef(null);
  const unsubscribeRef = useRef(null);  // Firestore onSnapshot unsubscribe fn
  const currentSessionId = useRef(null);
  const loadingRef = useRef(false);

  // ── Sync loadingRef ────────────────────────────────────────────────────
  useEffect(() => { loadingRef.current = loading; }, [loading]);

  // ── Background result recovery ─────────────────────────────────────────
  const PENDING_KEY = 'jiiji_pending_result';
  useEffect(() => {
    const onVisible = async () => {
      if (document.visibilityState !== 'visible') return;
      if (loadingRef.current) return;
      const raw = localStorage.getItem(PENDING_KEY);
      if (!raw) return;
      let pending;
      try { pending = JSON.parse(raw); } catch { localStorage.removeItem(PENDING_KEY); return; }
      if (Date.now() - (pending.ts || 0) > 30 * 60 * 1000) { localStorage.removeItem(PENDING_KEY); return; }

      setLoading(true);
      setProgressStep('กำลังดึงผลลัพธ์จากฉากหลัง...');

      let found = null;
      for (let i = 0; i < 10; i++) {
        found = await fetchResult(pending.requestId);
        if (found) break;
        await new Promise(r => setTimeout(r, 3000));
      }

      localStorage.removeItem(PENDING_KEY);
      setProgressStep(null);
      setLoading(false);

      if (found) {
        const replyMsg = { role: 'assistant', content: found.reply };
        setMessages(prev => {
          const updated = [...prev, replyMsg];
          if (currentSessionId.current) {
            // 🧹 [ปรับปรุง] เอาพารามิเตอร์ scope ตัวท้ายออก
            updateSession(currentSessionId.current, updated);
            setSessions(listSessions());
          }
          return updated;
        });
        // 🔥 [ลบออก] setAgentScope(found.scope)
      } else {
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: 'จีจี้หาผลลัพธ์ในฉากหลังไม่เจอแล้วครับพี่ (อาจ timeout) — ลองส่งคำสั่งใหม่ได้เลย 🙏',
        }]);
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, []);

  // ── Deploy notification ────────────────────────────────────────────────
  const DEPLOY_SEEN_KEY = 'jiiji_deploy_seen';
  const DEPLOY_APP_LABELS = { shrimp: '🦐 Seafood POS', tea: '🧋 Chincha Tea', 'ai-chat': '🌸 AI Chat', functions: '⚙️ Cloud Functions' };
  useEffect(() => {
    const checkDeploys = async () => {
      const status = await fetchDeployStatus();
      if (!status) return;
      const lastSeen = parseInt(localStorage.getItem(DEPLOY_SEEN_KEY) || '0');
      const now = Date.now();
      localStorage.setItem(DEPLOY_SEEN_KEY, String(now));
      let newest = null;
      for (const [app, data] of Object.entries(status)) {
        if (!data?.updatedAt) continue;
        const updatedAt = new Date(data.updatedAt).getTime();
        if (updatedAt > lastSeen && (now - updatedAt) < 15 * 60 * 1000) {
          if (!newest || updatedAt > new Date(newest.updatedAt).getTime()) {
            newest = { app, status: data.status, updatedAt: data.updatedAt, label: DEPLOY_APP_LABELS[app] || app };
          }
        }
      }
      if (newest) setDeployBanner(newest);
    };
    checkDeploys();
    const onVisible = () => { if (document.visibilityState === 'visible') checkDeploys(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, []);

  // ── Auto-scroll ────────────────────────────────────────────────────────
  useEffect(() => { chatEnd.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  // 🔥 [ลบออก] ฟังก์ชัน detectScope(text)

  // ── New chat ───────────────────────────────────────────────────────────
  const newChat = useCallback(() => {
    currentSessionId.current = null;
    setMessages([{ role: 'assistant', content: 'แชทใหม่เริ่มแล้วนะคะพี่ 🌸 สั่งได้เลย' }]);
    setImagePreviews([]);
    setFileAttachment(null);
    setProgressStep(null);
    setShowHistory(false);
    setSessions(listSessions());
  }, []);

  // ── Load session ───────────────────────────────────────────────────────
  const loadSession = useCallback((id) => {
    const session = getSession(id);
    if (!session) return;
    currentSessionId.current = id;
    setMessages(session.messages.length > 0 ? session.messages : [WELCOME_MSG]);
    // 🔥 [ลบออก] setAgentScope(session.scope)
    setShowHistory(false);
  }, []);

  // ── Delete session ─────────────────────────────────────────────────────
  const deleteSessionHandler = useCallback((id) => {
    deleteSession(id);
    setSessions(listSessions());
    if (currentSessionId.current === id) {
      currentSessionId.current = null;
      setMessages([{ role: 'assistant', content: 'ลบแชทนั้นแล้วนะคะพี่ 🌸 เริ่มใหม่ได้เลย' }]);
    }
  }, []);

  // ── Send message ───────────────────────────────────────────────────────
  const handleSend = useCallback(async () => {
    // ยกเลิก onSnapshot เดิม (ถ้ามี) เมื่อผู้ใช้ส่งข้อความใหม่
    if (unsubscribeRef.current) {
      unsubscribeRef.current();
      unsubscribeRef.current = null;
      localStorage.removeItem(PENDING_KEY);
    }
    const text = input.trim();
    if ((!text && imagePreviews.length === 0 && !fileAttachment) || loading) return;

    const images = imagePreviews.map(p => p.split(',')[1]);
    const displayText = text || (imagePreviews.length > 0 ? '📸' : `📎 ${fileAttachment?.name}`);

    const aiText = fileAttachment
      ? `${text || '(ดูไฟล์แนบด้านล่าง)'}\n\n---\n📎 ไฟล์แนบ: ${fileAttachment.name}\n\`\`\`\n${fileAttachment.text.slice(0, MAX_FILE_CHARS)}\n\`\`\`${fileAttachment.text.length > MAX_FILE_CHARS ? `\n\n⚠️ ไฟล์ยาวเกิน แสดงแค่ ${MAX_FILE_CHARS} ตัวอักษรแรก` : ''}`
      : text;

    const requestId = typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : Date.now().toString(36) + Math.random().toString(36).slice(2);

    // 🔥 [ลบออก] ตัวแปรสโคปและการเซ็ตติ้งต่างๆ
    const messagesWithUser = [...messages, { role: 'user', content: displayText, imageUrls: [...imagePreviews] }];

    setInput('');
    setImagePreviews([]);
    setFileAttachment(null);
    setProgressStep(null);
    setMessages(messagesWithUser);
    setLoading(true);

    // 🧹 [ปรับปรุง] สร้าง session ใหม่โดยไม่ต้องส่ง scope เข้าไป
    if (!currentSessionId.current) {
      currentSessionId.current = createSession({ firstMessage: text || 'รูปภาพ' });
      setSessions(listSessions());
    }

    // 🧹 [ปรับปรุง] เอาพารามิเตอร์ scope ออกจากตัวจำ pending
    localStorage.setItem(PENDING_KEY, JSON.stringify({ requestId, ts: Date.now() }));

    pollIntervalRef.current = setInterval(async () => {
      const data = await pollProgress(requestId);
      if (data.step) setProgressStep(data.step);
    }, 2000);

    const historyForAI = messagesWithUser.slice(-10).map(m => ({ role: m.role, content: m.content }));

    // 🧹 [ปรับปรุง] ส่งค่าเข้า API ของ Cloud เปล่า ๆ โดยถอดระบบ 'scope' ออกไปดื้อ ๆ เลยค่ะ
    const reply = await chatWithAI({
      message: aiText,
      history: historyForAI,
      images: images.length > 0 ? images : undefined,
      requestId,
    });

    clearInterval(pollIntervalRef.current);
    pollIntervalRef.current = null;
    setProgressStep(null);

    if (reply.status === 'processing') {
      // Flash ส่งงานให้ Pro Agent แล้ว — แสดงข้อความรอ แล้วฟัง onSnapshot (event-driven ไม่ polling)
      const processingMessages = [...messagesWithUser, { role: 'assistant', content: reply.reply }];
      setMessages(processingMessages);
      if (currentSessionId.current) {
        updateSession(currentSessionId.current, processingMessages);
        setSessions(listSessions());
      }
      setLoading(false);
      inputRef.current?.focus();

      // ยกเลิก listener เดิม (ถ้ามี) แล้วเริ่มฟัง aiResults/{requestId}
      if (unsubscribeRef.current) unsubscribeRef.current();
      unsubscribeRef.current = listenForResult(requestId, (found) => {
        if (unsubscribeRef.current) unsubscribeRef.current();
        unsubscribeRef.current = null;
        localStorage.removeItem(PENDING_KEY);
        setMessages(prev => {
          const updated = [...prev, { role: 'assistant', content: found.reply }];
          if (currentSessionId.current) {
            updateSession(currentSessionId.current, updated);
            setSessions(listSessions());
          }
          return updated;
        });
      });
      return;
    }

    localStorage.removeItem(PENDING_KEY);
    const finalMessages = [...messagesWithUser, { role: 'assistant', content: reply.reply }];
    setMessages(finalMessages);
    // 🔥 [ลบออก] if (reply.scope) setAgentScope(reply.scope)

    // 🧹 [ปรับปรุง] ตัวอัปเดตเซสชัน ลบพารามิเตอร์สุดท้ายออก
    if (currentSessionId.current) {
      updateSession(currentSessionId.current, finalMessages);
      setSessions(listSessions());
    }

    setLoading(false);
    inputRef.current?.focus();
  }, [input, loading, messages, imagePreviews]);

  // ── Voice input ────────────────────────────────────────────────────────
  const toggleVoice = useCallback(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setMessages(prev => [...prev, { role: 'assistant', content: '⚠️ เบราว์เซอร์นี้ไม่รองรับการพูด — ใช้ Safari/iOS หรือ Chrome บน Android แทน' }]);
      return;
    }

    if (listening) {
      recognitionRef.current?.stop();
      setListening(false);
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'th-TH';
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      setInput(prev => prev + transcript);
      setListening(false);
    };
    recognition.onerror = () => { setListening(false); };
    recognition.onend = () => { setListening(false); };

    recognitionRef.current = recognition;
    recognition.start();
    setListening(true);
  }, [listening]);

  // ── File picker (text files) ───────────────────────────────────────────
  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 500 * 1024) {
      alert('ไฟล์ใหญ่เกิน 500KB — ลองตัดให้สั้นลงก่อนนะครับพี่');
      e.target.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => {
      setFileAttachment({ name: file.name, text: reader.result, size: file.size });
    };
    reader.readAsText(file, 'UTF-8');
    e.target.value = '';
  };

  // ── Image picker (multiple, max 5) ─────────────────────────────────────
  const handleImageSelect = (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    const slots = MAX_IMAGES - imagePreviews.length;
    const toProcess = files.slice(0, slots);

    const readers = toProcess.map(file => new Promise(resolve => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.readAsDataURL(file);
    }));

    Promise.all(readers).then(results => {
      setImagePreviews(prev => [...prev, ...results].slice(0, MAX_IMAGES));
    });
    e.target.value = '';
  };

  // ── Cleanup polling on unmount ─────────────────────────────────────────
  useEffect(() => () => {
    clearInterval(pollIntervalRef.current);
    unsubscribeRef.current?.();
  }, []);

  // ── Handle Enter ───────────────────────────────────────────────────────
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  // 🔥 [ลบออก] บรรทัดคำนวณ currentAgent 
  const canSend = (input.trim() || imagePreviews.length > 0 || fileAttachment !== null) && !loading;

  return (
    <div className="flex flex-col h-full bg-ai-bg text-ai-text relative">

      {/* ── History panel (full-screen overlay) ──────────────────────── */}
      {showHistory && (
        <div className="absolute inset-0 z-50 bg-ai-bg flex flex-col">
          <div
            className="flex items-center justify-between px-4 border-b border-ai-border bg-ai-card shrink-0"
            style={{ paddingTop: 'calc(0.75rem + env(safe-area-inset-top, 0px))', paddingBottom: '0.75rem' }}
          >
            <h2 className="text-sm font-semibold">ประวัติแชท</h2>
            <div className="flex items-center gap-2">
              <button
                onClick={newChat}
                className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 bg-ai-accent text-white rounded-full hover:brightness-110 transition-colors"
              >
                <IconPlus /><span>แชทใหม่</span>
              </button>
              <button onClick={() => setShowHistory(false)} className="p-1.5 text-ai-muted hover:text-ai-text transition-colors">
                <IconX />
              </button>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1">
            {sessions.length === 0 ? (
              <p className="text-center text-ai-muted text-xs mt-12 leading-relaxed">
                ยังไม่มีประวัติแชทครับ<br />เริ่มพิมพ์แล้วจะบันทึกอัตโนมัติ
              </p>
            ) : sessions.map(s => (
              <div
                key={s.id}
                className={`flex items-start gap-2 px-3 py-2.5 rounded-xl cursor-pointer transition-colors ${
                  currentSessionId.current === s.id
                    ? 'bg-ai-accent/10 border border-ai-accent/30'
                    : 'hover:bg-ai-card border border-transparent'
                }`}
                onClick={() => loadSession(s.id)}
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-ai-text truncate leading-snug">{s.title}</p>
                  <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                    <span className="text-[10px] text-ai-muted">
                      {new Date(s.updatedAt).toLocaleDateString('th-TH', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </span>
                    {/* 🔥 [ลบออก] ป้าย Tag แสดงชื่อกลุ่มแชทขนาดเล็กในอดีต */}
                  </div>
                </div>
                <button
                  onClick={e => { e.stopPropagation(); deleteSessionHandler(s.id); }}
                  className="p-1 text-ai-muted hover:text-red-400 transition-colors shrink-0 mt-0.5"
                  title="ลบแชทนี้"
                >
                  <IconTrash />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Header ────────────────────────────────────────────────────── */}
      <header
        className="flex items-center justify-between px-4 border-b border-ai-border bg-ai-card shrink-0"
        style={{ paddingTop: 'calc(0.75rem + env(safe-area-inset-top, 0px))', paddingBottom: '0.75rem' }}
      >
        <div className="flex items-center gap-2">
          <button
            onClick={() => { setSessions(listSessions()); setShowHistory(true); }}
            className="p-1.5 text-ai-muted hover:text-ai-accent transition-colors"
            title="ประวัติแชท"
          >
            <IconHistory />
          </button>
          <span className="text-lg">🌸</span>
          <div>
            <h1 className="text-sm font-semibold leading-tight">จีจี้</h1>
            <p className="text-[10px] text-ai-muted">CHINCHA FLOW · <span className="text-ai-accent/70">{APP_VERSION}</span></p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* 🔥 [ลบออก] ชุด Dropdown ระบบ Scope Picker ทั้งดุ้นเรียบร้อยค่ะ */}
          <button onClick={newChat} className="p-1.5 text-ai-muted hover:text-ai-accent transition-colors" title="แชทใหม่">
            <IconPlus />
          </button>
          <button onClick={() => window.location.reload()} className="p-1.5 text-ai-muted hover:text-ai-accent transition-colors" title="โหลดหน้าใหม่">
            <IconRefresh />
          </button>
        </div>
      </header>

      {/* ── Deploy notification banner ────────────────────────────────── */}
      {deployBanner && (
        <div className={`flex items-center gap-2 px-4 py-2 text-sm shrink-0 border-b ${deployBanner.status === 'success' ? 'bg-green-900/30 border-green-700/30 text-green-300' : 'bg-red-900/30 border-red-700/30 text-red-300'}`}>
          <span>{deployBanner.status === 'success' ? '✅' : '❌'}</span>
          <span className="flex-1">Deploy <strong>{deployBanner.label}</strong> {deployBanner.status === 'success' ? 'เสร็จแล้ว 🎉' : 'ล้มเหลว — เช็ค Actions'}</span>
          <button onClick={() => setDeployBanner(null)} className="text-current opacity-60 hover:opacity-100 shrink-0 transition-opacity p-0.5">
            <IconX />
          </button>
        </div>
      )}

      {/* ── Messages ──────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 scrollbar-thin">
        {messages.map((msg, i) => (
          <div key={i} className={`flex gap-2 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
            {/* Avatar */}
            <div className="w-7 h-7 rounded-full overflow-hidden shrink-0 mt-0.5 border border-ai-border">
              {msg.role === 'user'
                ? <img src="/peach-avatar.jpg" alt="พีช" className="w-full h-full object-cover object-top" />
                : <img src="/jiji-avatar.png" alt="จีจี้" className="w-full h-full object-cover" />}
            </div>
            {/* Bubble */}
            <div className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${msg.role === 'user' ? 'bg-ai-user text-white rounded-br-md' : 'bg-ai-card border border-ai-border text-ai-text rounded-bl-md'}`}>
              {msg.imageUrls && msg.imageUrls.length > 0 && (
                <div className={`mb-2 ${msg.imageUrls.length > 1 ? 'grid grid-cols-2 gap-1' : ''}`}>
                  {msg.imageUrls.map((url, idx) => (
                    <img
                      key={idx}
                      src={url}
                      alt={`รูปที่ ${idx + 1}`}
                      className="rounded-lg object-cover w-full"
                      style={{ maxHeight: '160px' }}
                    />
                  ))}
                </div>
              )}
              {msg.content !== '📸' && msg.content}
            </div>
          </div>
        ))}

        {/* Typing indicator */}
        {loading && (
          <div className="flex gap-2">
            <div className="w-7 h-7 rounded-full overflow-hidden border border-ai-border shrink-0">
              <img src="/jiji-avatar.png" alt="จีจี้" className="w-full h-full object-cover" />
            </div>
            <div className="bg-ai-card border border-ai-border rounded-2xl rounded-bl-md px-4 py-3">
              <div className="flex gap-1 mb-1">
                <span className="w-2 h-2 bg-ai-muted rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-2 h-2 bg-ai-muted rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-2 h-2 bg-ai-muted rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
              <p className="text-[10px] text-ai-muted">
                {progressStep || 'กำลังดำเนินการ... งานแก้โค้ดอาจใช้ถึง 3 นาที'}
              </p>
            </div>
          </div>
        )}

        <div ref={chatEnd} />
      </div>

      {/* ── Input bar ─────────────────────────────────────────────────── */}
      <div
        className="px-3 py-3 border-t border-ai-border bg-ai-card shrink-0"
        style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom, 0px))' }}
      >
        {/* Image previews grid */}
        {imagePreviews.length > 0 && (
          <div className="flex gap-2 flex-wrap mb-2 items-end">
            {imagePreviews.map((preview, idx) => (
              <div key={idx} className="relative shrink-0">
                <img
                  src={preview}
                  alt={`preview ${idx + 1}`}
                  className="h-14 w-14 rounded-lg border border-ai-border object-cover"
                />
                <button
                  onClick={() => setImagePreviews(prev => prev.filter((_, i) => i !== idx))}
                  className="absolute -top-1.5 -right-1.5 bg-red-500 text-white rounded-full w-4 h-4 text-[10px] flex items-center justify-center leading-none hover:bg-red-600"
                >
                  ×
                </button>
              </div>
            ))}
            <span className="text-[10px] text-ai-muted pb-1">
              {imagePreviews.length}/{MAX_IMAGES}
            </span>
          </div>
        )}

        {/* File attachment chip */}
        {fileAttachment && (
          <div className="flex items-center gap-2 mb-2 px-3 py-1.5 bg-ai-bg border border-ai-accent/40 rounded-xl w-fit max-w-full">
            <span className="text-ai-accent shrink-0"><IconFile /></span>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-ai-text font-medium truncate">{fileAttachment.name}</p>
              <p className="text-[10px] text-ai-muted">{(fileAttachment.size / 1024).toFixed(1)} KB</p>
            </div>
            <button
              onClick={() => setFileAttachment(null)}
              className="text-ai-muted hover:text-red-400 transition-colors shrink-0 p-0.5"
            >
              <IconX />
            </button>
          </div>
        )}

        <div className="flex items-end gap-2">
          <div className="flex-1 relative">
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="พิมพ์หรือพูดคำสั่ง... หรือแนบรูปได้เลย"
              rows={1}
              className="w-full resize-none bg-ai-bg border border-ai-border rounded-2xl px-4 py-2.5 text-sm text-ai-text placeholder-ai-muted outline-none focus:border-ai-accent transition-colors"
              style={{ maxHeight: '120px' }}
              onInput={e => { e.target.style.height = 'auto'; e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px'; }}
            />
          </div>

          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={imagePreviews.length >= MAX_IMAGES}
            className={`p-2.5 rounded-full transition-colors shrink-0 relative ${imagePreviews.length > 0 ? 'bg-ai-accent text-white' : 'bg-ai-bg border border-ai-border text-ai-muted hover:text-ai-accent hover:border-ai-accent'} ${imagePreviews.length >= MAX_IMAGES ? 'opacity-40 cursor-not-allowed' : ''}`}
            title={`แนบรูปภาพ (${imagePreviews.length}/${MAX_IMAGES})`}
          >
            <IconImage />
            {imagePreviews.length > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[9px] rounded-full w-4 h-4 flex items-center justify-center font-bold leading-none">
                {imagePreviews.length}
              </span>
            )}
          </button>

          <button
            onClick={() => fileInputRef2.current?.click()}
            disabled={fileAttachment !== null}
            className={`p-2.5 rounded-full transition-colors shrink-0 ${fileAttachment ? 'bg-ai-accent text-white' : 'bg-ai-bg border border-ai-border text-ai-muted hover:text-ai-accent hover:border-ai-accent'} ${fileAttachment ? 'opacity-70 cursor-not-allowed' : ''}`}
            title="แนบไฟล์ข้อความ (.txt, .js, .json ฯลฯ)"
          >
            <IconFile />
          </button>

          <button
            onClick={toggleVoice}
            className={`p-2.5 rounded-full transition-colors shrink-0 ${listening ? 'bg-red-500 text-white animate-pulse' : 'bg-ai-bg border border-ai-border text-ai-muted hover:text-ai-accent hover:border-ai-accent'}`}
            title={listening ? 'หยุดฟัง' : 'พูดคำสั่ง'}
          >
            {listening ? <IconStop /> : <IconMic active={false} />}
          </button>

          <button
            onClick={handleSend}
            disabled={!canSend}
            className={`p-2.5 rounded-full transition-colors shrink-0 ${canSend ? 'bg-ai-accent text-white hover:brightness-110' : 'bg-ai-bg border border-ai-border text-ai-muted cursor-not-allowed'}`}
          >
            <IconSend />
          </button>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={handleImageSelect}
        />
        <input
          ref={fileInputRef2}
          type="file"
          accept={ACCEPTED_FILES}
          className="hidden"
          onChange={handleFileSelect}
        />
      </div>

    </div>
  );
}