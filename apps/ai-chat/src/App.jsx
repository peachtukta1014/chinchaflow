import { useCallback, useEffect, useRef, useState } from 'react';
import { chatWithAI, pollProgress } from './api';
import { listSessions, createSession, updateSession, deleteSession, getSession } from './sessionStore';

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

const MAX_IMAGES = 5;
const WELCOME_MSG = {
  role: 'assistant',
  content: 'สวัสดีพี่พีช! จีจี้เลขาส่วนตัวพีชเองนะคะ 🌸\n\nพร้อมช่วยพี่เสมอเลย ไม่ว่าจะเป็น:\n- ถามเรื่องร้านชา / ร้านกุ้ง\n- ส่งรูป screenshot หรือ error มาให้ดู (แนบได้ถึง 5 รูปต่อครั้งเลย)\n- สั่งแก้โค้ด AI deepseek จัดการ + เปิด PR ให้\n\nพูดหรือพิมพ์ได้เลยนะคะ',
};

const AGENT_OPTIONS = [
  { id: 'root', label: '🌸 จีจี้', desc: 'ทั่วไป' },
  { id: 'tea', label: '🧋 ชินชา', desc: 'ร้านชา' },
  { id: 'seafood', label: '🦐 โกอ้วน', desc: 'ร้านกุ้ง' },
  { id: 'webhook', label: '🤖 LINE', desc: 'Bot' },
  { id: 'scheduled', label: '⏰ Cron', desc: 'Automation' },
];

export default function App() {
  const [messages, setMessages] = useState([WELCOME_MSG]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [listening, setListening] = useState(false);
  const [agentScope, setAgentScope] = useState('root');
  const [showAgentPicker, setShowAgentPicker] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [imagePreviews, setImagePreviews] = useState([]);
  const [progressStep, setProgressStep] = useState(null);
  const [sessions, setSessions] = useState(() => listSessions());
  const chatEnd = useRef(null);
  const inputRef = useRef(null);
  const recognitionRef = useRef(null);
  const fileInputRef = useRef(null);
  const pollIntervalRef = useRef(null);
  const currentSessionId = useRef(null);

  // ── Auto-scroll ────────────────────────────────────────────────────────
  useEffect(() => { chatEnd.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  // ── Scope detection ────────────────────────────────────────────────────
  function detectScope(text) {
    const t = (text || '').toLowerCase();
    if (t.includes('กุ้ง') || t.includes('shrimp') || t.includes('seafood') || t.includes('โกอ้วน') || t.includes('ร้านกุ้ง')) return 'seafood';
    if (t.includes('ชา') || t.includes('tea') || t.includes('ชินชา') || t.includes('ร้านน้ำ') || t.includes('chincha') || t.includes('bubble')) return 'tea';
    if (t.includes('webhook') || t.includes('line') || t.includes('ไลน์')) return 'webhook';
    if (t.includes('cron') || t.includes('scheduled') || t.includes('schedule') || t.includes('automation') || t.includes('auto')) return 'scheduled';
    return agentScope;
  }

  // ── New chat ───────────────────────────────────────────────────────────
  const newChat = useCallback(() => {
    currentSessionId.current = null;
    setMessages([{ role: 'assistant', content: 'แชทใหม่เริ่มแล้วนะคะพี่ 🌸 สั่งได้เลย' }]);
    setImagePreviews([]);
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
    setAgentScope(session.scope || 'root');
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
    const text = input.trim();
    if ((!text && imagePreviews.length === 0) || loading) return;

    const images = imagePreviews.map(p => p.split(',')[1]);
    const displayText = text || '📸';
    const requestId = typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : Date.now().toString(36) + Math.random().toString(36).slice(2);

    const scope = detectScope(text);
    const messagesWithUser = [...messages, { role: 'user', content: displayText, imageUrls: [...imagePreviews] }];

    setInput('');
    setImagePreviews([]);
    setProgressStep(null);
    setMessages(messagesWithUser);
    setLoading(true);
    if (scope !== agentScope) setAgentScope(scope);

    // สร้าง session ใหม่เมื่อส่งข้อความแรก
    if (!currentSessionId.current) {
      currentSessionId.current = createSession({ firstMessage: text || 'รูปภาพ', scope });
      setSessions(listSessions());
    }

    // Start progress polling
    pollIntervalRef.current = setInterval(async () => {
      const data = await pollProgress(requestId);
      if (data.step) setProgressStep(data.step);
    }, 2000);

    // ส่ง history แค่ 10 ข้อความล่าสุดให้ AI (ลด token + ลดช้า)
    const historyForAI = messagesWithUser.slice(-10).map(m => ({ role: m.role, content: m.content }));

    const reply = await chatWithAI({
      message: displayText,
      history: historyForAI,
      scope,
      images: images.length > 0 ? images : undefined,
      requestId,
    });

    clearInterval(pollIntervalRef.current);
    pollIntervalRef.current = null;
    setProgressStep(null);

    const finalMessages = [...messagesWithUser, { role: 'assistant', content: reply.reply }];
    setMessages(finalMessages);
    if (reply.scope) setAgentScope(reply.scope);

    // Auto-save session
    if (currentSessionId.current) {
      updateSession(currentSessionId.current, finalMessages, reply.scope || scope);
      setSessions(listSessions());
    }

    setLoading(false);
    inputRef.current?.focus();
  }, [input, loading, messages, agentScope, imagePreviews]);

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
  useEffect(() => () => { clearInterval(pollIntervalRef.current); }, []);

  // ── Handle Enter ───────────────────────────────────────────────────────
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const currentAgent = AGENT_OPTIONS.find(a => a.id === agentScope) || AGENT_OPTIONS[0];
  const canSend = (input.trim() || imagePreviews.length > 0) && !loading;

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
                    {s.scope && s.scope !== 'root' && (
                      <span className="text-[9px] text-ai-accent border border-ai-accent/40 rounded-full px-1.5 py-0.5 leading-none">
                        {AGENT_OPTIONS.find(a => a.id === s.scope)?.label || s.scope}
                      </span>
                    )}
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
            <p className="text-[10px] text-ai-muted">CHINCHA FLOW</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Scope picker */}
          <div className="relative">
            <button
              onClick={() => setShowAgentPicker(!showAgentPicker)}
              className="text-xs px-2 py-1 rounded-full border border-ai-border text-ai-muted hover:text-ai-accent hover:border-ai-accent transition-colors"
            >
              {currentAgent.label}
            </button>
            {showAgentPicker && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowAgentPicker(false)} />
                <div className="absolute right-0 top-8 z-20 bg-ai-card border border-ai-border rounded-xl shadow-xl overflow-hidden min-w-[160px]">
                  {AGENT_OPTIONS.map(a => (
                    <button
                      key={a.id}
                      onClick={() => { setAgentScope(a.id); setShowAgentPicker(false); }}
                      className={`w-full text-left px-3 py-2 text-sm hover:bg-ai-bg transition-colors flex items-center gap-2 ${agentScope === a.id ? 'text-ai-accent' : 'text-ai-text'}`}
                    >
                      <span>{a.label}</span>
                      <span className="text-[10px] text-ai-muted ml-auto">{a.desc}</span>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
          <button onClick={newChat} className="p-1.5 text-ai-muted hover:text-ai-accent transition-colors" title="แชทใหม่">
            <IconPlus />
          </button>
        </div>
      </header>

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

          {/* Image button with count badge */}
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

          {/* Voice button */}
          <button
            onClick={toggleVoice}
            className={`p-2.5 rounded-full transition-colors shrink-0 ${listening ? 'bg-red-500 text-white animate-pulse' : 'bg-ai-bg border border-ai-border text-ai-muted hover:text-ai-accent hover:border-ai-accent'}`}
            title={listening ? 'หยุดฟัง' : 'พูดคำสั่ง'}
          >
            {listening ? <IconStop /> : <IconMic active={false} />}
          </button>

          {/* Send button */}
          <button
            onClick={handleSend}
            disabled={!canSend}
            className={`p-2.5 rounded-full transition-colors shrink-0 ${canSend ? 'bg-ai-accent text-white hover:brightness-110' : 'bg-ai-bg border border-ai-border text-ai-muted cursor-not-allowed'}`}
          >
            <IconSend />
          </button>
        </div>

        {/* Hidden file input — multiple */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={handleImageSelect}
        />
      </div>

    </div>
  );
}
