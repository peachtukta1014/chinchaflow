/**
 * toolDefinitions.js — Constants + Tool definitions สำหรับ จีจี้ Agentic Loop
 * (OpenAI function-calling format, ส่งให้ OpenRouter)
 */

const OPENROUTER_BASE = 'https://openrouter.ai/api/v1';
const GH_API = 'https://api.github.com';
const GH_REPO = 'peachtukta1014/chinchaflow';
const ADMIN_EMAIL = 'peachtukta1014@gmail.com';
// deepseek-v4-pro: แม่นยำสูง สำหรับเขียนโค้ด/agentic loop โดยเฉพาะ
// (gpt-4o-mini ใช้แยกสำหรับ vision เท่านั้น — ดู aiChatAgent.js VISION_MODEL)
//
// ⚠ ก่อนเปลี่ยนค่านี้ — อ่านก่อน: ห้ามเปลี่ยน model เพื่อแก้ "agent นิ่ง/หยุดกลางทาง"
// ปัญหานั้นไม่ได้อยู่ที่ตัวโมเดล แต่อยู่ที่ runAgentLoop ด้านล่าง (forceToolUse ต้องบังคับ
// จนกว่า taskCompleted=true ไม่ใช่แค่ iteration แรก) — เคยสลับ AGENT_MODEL ไปมา 2 รอบ
// (deepseek → gpt-4o-mini → deepseek) ในวันเดียวกันโดยไม่ได้แก้ตรงจุดนี้ บั๊กก็กลับมาอีก
// ดู docs/AGENT_CHANGELOG_TH.md หัวข้อ "agentic loop ใช้ tools จริง" + "เปลี่ยน AGENT_MODEL → deepseek/deepseek-v4-pro"
const AGENT_MODEL = 'deepseek/deepseek-v4-pro';

// ── Tool definitions (OpenAI function-calling format) ─────────────────────
const TOOL_DEFINITIONS = [
  {
    type: 'function',
    function: {
      name: 'read_file',
      description: 'อ่านเนื้อหาไฟล์จาก GitHub repo — ต้องเรียกก่อน patch_file หรือ write_file ทุกครั้ง ห้ามเดาเนื้อไฟล์',
      parameters: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: 'path ไฟล์ relative จาก repo root เช่น apps/seafood-pos/src/App.jsx',
          },
        },
        required: ['path'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_files',
      description: 'ดูรายชื่อไฟล์ทั้งหมดใน scope หรือ directory ที่กำหนด',
      parameters: {
        type: 'object',
        properties: {
          scope: {
            type: 'string',
            enum: ['seafood', 'tea', 'webhook', 'scheduled', 'root'],
            description: 'scope แอป — ถ้าไม่ระบุจะใช้ scope ปัจจุบัน',
          },
          dir: {
            type: 'string',
            description: 'กรอง directory prefix เช่น apps/seafood-pos/src/lib/ (optional)',
          },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'search_code',
      description: 'ค้นหา string pattern ในไฟล์ที่กำหนด — คืนบรรทัดที่เจอพร้อมหมายเลขบรรทัด',
      parameters: {
        type: 'object',
        properties: {
          pattern: { type: 'string', description: 'ข้อความที่จะค้นหา' },
          files: {
            type: 'array',
            items: { type: 'string' },
            description: 'รายการ path ไฟล์ที่จะค้น (สูงสุด 10 ไฟล์)',
          },
        },
        required: ['pattern', 'files'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'patch_file',
      description: 'แก้ไขเฉพาะส่วนของไฟล์ด้วย find & replace — ต้อง read_file ก่อน, find ต้องตรงเป๊ะกับไฟล์จริง',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'path ไฟล์' },
          find: {
            type: 'string',
            description: 'ข้อความที่จะแทนที่ — ต้อง copy มาจากผล read_file เป๊ะตัวต่อตัว รวม whitespace/indent',
          },
          replace_with: { type: 'string', description: 'ข้อความใหม่ที่จะแทนที่' },
          reason: { type: 'string', description: 'อธิบายสั้นๆว่าแก้อะไร ทำไม' },
        },
        required: ['path', 'find', 'replace_with', 'reason'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'write_file',
      description: 'เขียนไฟล์ใหม่ทั้งหมด — ใช้สำหรับไฟล์ใหม่หรือไฟล์สั้น (<50 บรรทัด) เท่านั้น สำหรับไฟล์ใหญ่ให้ใช้ patch_file',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'path ไฟล์' },
          content: { type: 'string', description: 'เนื้อหาทั้งหมดของไฟล์ (ใหม่หรือ rewrite)' },
          reason: { type: 'string', description: 'อธิบายว่าสร้าง/เปลี่ยนอะไร' },
        },
        required: ['path', 'content', 'reason'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'commit_and_pr',
      description: 'commit ไฟล์ที่ stage ไว้ทั้งหมด สร้าง branch และเปิด PR ไปที่ main — ทำเป็นขั้นตอนสุดท้ายเสมอ',
      parameters: {
        type: 'object',
        properties: {
          branch: {
            type: 'string',
            description: 'ชื่อ branch เช่น dev/fix-price-display หรือ dev/add-export-feature',
          },
          commit_msg: {
            type: 'string',
            description: 'commit message เช่น "fix: แก้การแสดงราคา" หรือ "feat: เพิ่มปุ่ม export"',
          },
          pr_title: { type: 'string', description: 'ชื่อ PR — ชัดเจน บอกว่าแก้/เพิ่มอะไร' },
          pr_body: {
            type: 'string',
            description: 'รายละเอียด PR (markdown) — สรุปงาน, เหตุผล, ผลที่คาดว่าจะได้',
          },
        },
        required: ['branch', 'commit_msg', 'pr_title', 'pr_body'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'trigger_deploy',
      description: 'trigger GitHub Actions workflow เพื่อ deploy แอปไปยัง production (ต้องมี GH_PAT ที่มี workflow scope)',
      parameters: {
        type: 'object',
        properties: {
          app: {
            type: 'string',
            enum: ['chincha-tea', 'seafood-pos', 'webhook-core', 'ai-chat'],
            description: 'แอปที่จะ deploy',
          },
          ref: {
            type: 'string',
            description: 'branch หรือ tag ที่จะ deploy (default: main)',
          },
        },
        required: ['app'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_skill',
      description: 'อ่าน skill/command definition — ดูวิธีทำงานของ skill ที่มีในโปรเจกต์',
      parameters: {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            enum: ['auto-shrimp', 'auto-tea', 'ship-shrimp', 'ship-tea', 'land-it', 'peter-ser'],
            description: 'ชื่อ skill',
          },
        },
        required: ['name'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'exec_command',
      description: `รัน shell command ใน GitHub Actions runner (Node 20 · Ubuntu · repo checkout เต็ม)

⚠️ ข้อจำกัดสำคัญ — ประเมินก่อนเรียกทุกครั้ง:
• timeout สูงสุด 300 วิ — command ควรเสร็จก่อนนั้น
• **ใช้ path relative จาก repo root เสมอ** เช่น "node apps/seafood-pos/scripts/smoke-test.mjs" (ห้ามขึ้นต้น /)
• Ephemeral — ไม่มี state ข้ามการเรียก

✅ เหมาะ: node scripts/..., npm run build, git status, node -e "...", curl
❌ ไม่เหมาะ: path ขึ้นต้น / (absolute), คำสั่งที่ต้อง interactive input

path ต้องเป็น relative เสมอ เช่น "node apps/seafood-pos/scripts/smoke-test.mjs" ไม่ใช่ "node /apps/..."`,
      parameters: {
        type: 'object',
        properties: {
          command: {
            type: 'string',
            description: 'shell command ที่จะรัน เช่น node -e "console.log(1+1)" หรือ curl https://...',
          },
          timeout_seconds: {
            type: 'number',
            description: 'timeout (วินาที) สูงสุด 300, default 30',
          },
        },
        required: ['command'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'report_no_action_needed',
      description: `เรียก tool นี้เมื่อสรุปแล้วว่า "ไม่ต้องแก้/เขียนโค้ดจริง" สำหรับคำสั่งนี้
ใช้เฉพาะกรณีนี้เท่านั้น:
- พี่แค่ขอให้ดูข้อมูล/อธิบาย/วิเคราะห์ (ไม่ใช่ขอให้แก้)
- ข้อมูลที่มีไม่พอจะแก้โค้ดได้ ต้องถามพี่เพิ่มก่อน
- ตรวจสอบแล้วพบว่าสิ่งที่ขอมีอยู่แล้ว ไม่ต้องทำอะไรเพิ่ม

ห้ามเรียก tool นี้แทนการแก้โค้ดจริงเพื่อความง่าย — ถ้างานต้องแก้โค้ด ต้องทำให้ครบจนถึง commit_and_pr เท่านั้น`,
      parameters: {
        type: 'object',
        properties: {
          summary: {
            type: 'string',
            description: 'สรุปสั้นๆให้พี่อ่านบนมือถือ — ภาษาไทยชาวบ้าน ไม่ใช้ศัพท์เทค',
          },
          need_more_info: {
            type: 'boolean',
            description: 'true ถ้าต้องถามพี่ก่อนทำต่อ',
          },
        },
        required: ['summary'],
      },
    },
  },
];

module.exports = { TOOL_DEFINITIONS, OPENROUTER_BASE, GH_API, GH_REPO, ADMIN_EMAIL, AGENT_MODEL };
