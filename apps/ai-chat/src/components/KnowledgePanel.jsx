import { useState, useEffect } from 'react';

export default function KnowledgePanel({ data, onSave, onRefresh }) {
  const [section, setSection] = useState('notes'); // 'notes' | 'tree' | 'docs'
  const [localNotes, setLocalNotes] = useState(data.notes || '');

  useEffect(() => { setLocalNotes(data.notes || ''); }, [data.notes]);

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Sub-tabs */}
      <div className="flex border-b border-ai-border bg-ai-card shrink-0">
        {[
          { id: 'notes', label: '✏️ Custom Skills' },
          { id: 'tree', label: '📂 Project Tree' },
          { id: 'docs', label: '📚 Agent Docs' },
        ].map(s => (
          <button
            key={s.id}
            onClick={() => setSection(s.id)}
            className={`flex-1 py-2 text-[11px] font-medium transition-colors ${
              section === s.id ? 'text-ai-accent border-b-2 border-ai-accent' : 'text-ai-muted'
            }`}
          >
            {s.label}
          </button>
        ))}
        <button onClick={onRefresh} className="px-3 text-ai-muted hover:text-ai-accent transition-colors" title="รีเฟรช">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/>
            <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/>
          </svg>
        </button>
      </div>

      {data.notesLoading ? (
        <div className="flex-1 flex items-center justify-center text-ai-muted text-sm">กำลังโหลด...</div>
      ) : (
        <div className="flex-1 overflow-y-auto">
          {/* Custom Skills / Notes — editable */}
          {section === 'notes' && (
            <div className="p-4 flex flex-col h-full gap-3">
              <p className="text-[11px] text-ai-muted leading-relaxed">
                จีจี้จะอ่าน Custom Skills ทุกครั้งที่คุย — ใส่ข้อมูลร้าน, style การตอบ, หรือสกิลเพิ่มเติมได้เลยครับพี่
              </p>
              <textarea
                value={localNotes}
                onChange={e => setLocalNotes(e.target.value)}
                placeholder={'ตัวอย่าง:\n- ร้านกุ้งส่งทุกวันจันทร์-ศุกร์\n- ลูกค้าประจำ: คุณA ชอบกุ้งขนาดใหญ่\n- Flash ตอบสั้นๆ ไม่เกิน 3 บรรทัด\n- ราคากุ้งปัจจุบัน: ตัวเล็ก 80/kg, ใหญ่ 120/kg'}
                className="flex-1 w-full min-h-[200px] resize-none bg-ai-bg border border-ai-border rounded-xl p-3 text-sm text-ai-text placeholder-ai-muted outline-none focus:border-ai-accent transition-colors font-mono"
                style={{ height: '300px' }}
              />
              <button
                onClick={() => onSave(localNotes)}
                disabled={data.notesSaving}
                className={`w-full py-2.5 rounded-xl text-sm font-medium transition-colors ${
                  data.notesSaving
                    ? 'bg-ai-border text-ai-muted cursor-not-allowed'
                    : 'bg-ai-accent text-white hover:brightness-110'
                }`}
              >
                {data.notesSaving ? 'กำลังบันทึก...' : 'บันทึก Custom Skills'}
              </button>
            </div>
          )}

          {/* Project Tree — read-only */}
          {section === 'tree' && (
            <div className="p-4">
              {data.tree ? (
                <pre className="text-[11px] text-ai-text font-mono leading-relaxed whitespace-pre-wrap break-all">
                  {data.tree}
                </pre>
              ) : (
                <p className="text-ai-muted text-sm text-center mt-8">ยังไม่มีข้อมูล — รัน Pro Agent ครั้งแรกแล้วจะ sync อัตโนมัติ</p>
              )}
            </div>
          )}

          {/* Agent Docs — read-only */}
          {section === 'docs' && (
            <div className="p-4 space-y-4">
              {Object.keys(data.docs).length === 0 ? (
                <p className="text-ai-muted text-sm text-center mt-8">ยังไม่มีข้อมูล</p>
              ) : Object.entries(data.docs).map(([filename, content]) => (
                <div key={filename}>
                  <p className="text-[11px] font-semibold text-ai-accent mb-1">{filename}</p>
                  <pre className="text-[11px] text-ai-muted font-mono leading-relaxed whitespace-pre-wrap break-words bg-ai-bg rounded-lg p-2 max-h-40 overflow-y-auto">
                    {content}
                  </pre>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
