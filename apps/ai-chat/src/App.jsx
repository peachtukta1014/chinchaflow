import { useCallback, useEffect, useRef, useState } from 'react';
import { chatWithAI } from './api';

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

const MAX_IMAGES = 5;

const AGENT_OPTIONS = [
  { id: 'root', label: '🌸 จีจี้', desc: 'ทั่วไป' },
  { id: 'tea', label: '🧋 ชินชา', desc: 'ร้านชา' },
  { id: 'seafood', label: '🦐 โกอ้วน', desc: 'ร้านกุ้ง' },
  { id: 'webhook', label: '🤖 LINE', desc: 'Bot' },
  { id: 'scheduled', label: '⏰ Cron', desc: 'Automation' },
];

export default function App() {
  const [messages, setMessages] = useState([
    { role: 'assistant', content: 'สวัสดีพี่พีช! จีจี้เลขาส่วนตัวพีชเองนะคะ 🌸\n\nพร้อมช่วยพี่เสมอเลย ไม่ว่าจะเป็น:\n- ถามเรื่องร้านชา / ร้านกุ้ง\n- ส่งรูป screenshot หรือ error มาให้ดู (แนบได้ถึง 5 รูปต่อครั้งเลย)\n- สั่งแก้โค้ด AI deepseek จัดการ + เปิด PR ให้\n\nพูดหรือพิมพ์ได้เลยนะคะ' },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [listening, setListening] = useState(false);
  const [agentScope, setAgentScope] = useState('root');
  const [showAgentPicker, setShowAgentPicker] = useState(false);
  const [imagePreviews, setImagePreviews] = useState([]);
  const chatEnd = useRef(null);
  const inputRef = useRef(null);
  const recognitionRef = useRef(null);
  const fileInputRef = useRef(null);

  // ── Auto-scroll ────────────────────────────────────────────────────────
  useEffect(() => { chatEnd.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  // ── Send message ───────────────────────────────────────────────────────
  const handleSend = useCallback(async () => {
    const text = input.trim();
    if ((!text && imagePreviews.length === 0) || loading) return;

    const images = imagePreviews.map(p => p.split(',')[1]);
    const displayText = text || '📸';

    setInput('');
    setImagePreviews([]);
    setMessages(prev => [...prev, { role: 'user', content: displayText, imageUrls: [...imagePreviews] }]);
    setLoading(true);

    const scope = detectScope(text);
    if (scope !== agentScope) setAgentScope(scope);

    const history = messages.map(m => ({ role: m.role, content: m.content }));
    const reply = await chatWithAI({
      message: displayText,
      history,
      scope,
      images: images.length > 0 ? images : undefined,
    });

    setMessages(prev => [...prev, { role: 'assistant', content: reply.reply }]);
    if (reply.scope) setAgentScope(reply.scope);
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

  // ── Scope detection ────────────────────────────────────────────────────
  function detectScope(text) {
    const t = (text || '').toLowerCase();
    if (t.includes('กุ้ง') || t.includes('shrimp') || t.includes('seafood') || t.includes('โกอ้วน')) return 'seafood';
    if (t.includes('ชา') || t.includes('tea') || t.includes('ชินชา')) return 'tea';
    if (t.includes('webhook') || t.includes('line') || t.includes('ไลน์')) return 'webhook';
    if (t.includes('cron') || t.includes('scheduled') || t.includes('schedule') || t.includes('automation') || t.includes('auto')) return 'scheduled';
    return agentScope;
  }

  // ── Clear chat ─────────────────────────────────────────────────────────
  const clearChat = () => {
    setMessages([{ role: 'assistant', content: 'ล้างประวัติแล้วนะคะพี่ — พร้อมช่วยใหม่ได้เลย 🌸' }]);
    setImagePreviews([]);
  };

  // ── Handle Enter ───────────────────────────────────────────────────────
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const currentAgent = AGENT_OPTIONS.find(a => a.id === agentScope) || AGENT_OPTIONS[0];
  const canSend = (input.trim() || imagePreviews.length > 0) && !loading;

  return (
    <div className="flex flex-col h-full bg-ai-bg text-ai-text">

      {/* ── Header ────────────────────────────────────────────────────── */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-ai-border bg-ai-card shrink-0">
        <div className="flex items-center gap-2">
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
          <button onClick={clearChat} className="p-1.5 text-ai-muted hover:text-red-400 transition-colors" title="ล้างแชท">
            <IconTrash />
          </button>
        </div>
      </header>

      {/* ── Messages ──────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 scrollbar-thin">
        {messages.map((msg, i) => (
          <div key={i} className={`flex gap-2 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
            {/* Avatar */}
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs shrink-0 mt-0.5 ${msg.role === 'user' ? 'bg-ai-user' : 'bg-ai-agent border border-ai-border'}`}>
              {msg.role === 'user' ? '👤' : '🌸'}
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
            <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs bg-ai-agent border border-ai-border shrink-0">🌸</div>
            <div className="bg-ai-card border border-ai-border rounded-2xl rounded-bl-md px-4 py-3">
              <div className="flex gap-1">
                <span className="w-2 h-2 bg-ai-muted rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-2 h-2 bg-ai-muted rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-2 h-2 bg-ai-muted rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
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
