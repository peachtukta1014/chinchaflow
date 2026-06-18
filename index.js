import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log(`🚀 [Chinchaflow Orchestrator v1.4.0] System Ready...`);

const apiKey = process.env.OPENROUTER_API_KEY;
// เรียกใช้งาน DeepSeek V4 Flash ตามที่พี่พีชต้องการ
const modelName = process.env.DEFAULT_MODEL || "deepseek/deepseek-v4-flash";
const aiInstruction = process.env.AI_CODE_INSTRUCTION || "";

async function runOrchestrator() {
  if (!aiInstruction) {
    console.log("💡 [Status] รอคำสั่งจากพี่พีช...");
    return;
  }

  if (!apiKey) {
    console.error("❌ Critical Error: ไม่พบ OPENROUTER_API_KEY กรุณาตรวจสอบ GitHub Secrets");
    process.exit(1);
  }

  try {
    console.log(`🧠 [AI] กำลังส่งคำสั่งไปที่ OpenRouter (${modelName})...`);
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: { 
        "Authorization": `Bearer ${apiKey}`, 
        "Content-Type": "application/json" 
      },
      body: JSON.stringify({
        "model": modelName,
        "response_format": { "type": "json_object" },
        "messages": [
          { 
            "role": "system", 
            "content": "คุณคือ AI Admin ของ CHINCHA FLOW ทำหน้าที่จัดโครงสร้างโฟลเดอร์ใน apps/webhook-core/ และอัปเดตไฟล์ กรุณาตอบกลับในรูปแบบ JSON ที่มี Key ชื่อ 'operations' ซึ่งเป็น Array ของ Object { action: 'write_file', path: 'path/ถึง/ไฟล์', content: 'เนื้อหาไฟล์' }" 
          },
          { "role": "user", "content": `คำสั่งจากพี่พีช: ${aiInstruction}` }
        ]
      })
    });

    const data = await response.json();

    if (data.error) {
      console.error("❌ OpenRouter API Error:", data.error.message);
      process.exit(1);
    }

    const result = JSON.parse(data.choices?.[0]?.message?.content || "{}");

    if (result.operations && result.operations.length > 0) {
      result.operations.forEach(op => {
        const absPath = path.join(__dirname, op.path);
        if (op.action === 'write_file') {
          fs.mkdirSync(path.dirname(absPath), { recursive: true });
          fs.writeFileSync(absPath, op.content, 'utf8');
          console.log(`✅ [${op.action}] สำเร็จ: ${op.path}`);
        }
      });
      pushChanges();
    } else {
      console.log("⚠️ [Status] AI ไม่ได้ส่งคำสั่งอัปเดตไฟล์กลับมา (รูปแบบอาจผิดหรือไม่มีการเปลี่ยนแปลง)");
    }
  } catch (err) { 
    console.error("❌ Critical Error ในกระบวนการประมวลผล:", err); 
    process.exit(1);
  }
}

function pushChanges() {
  try {
    console.log("📦 [Git] กำลังเตรียมอัปเดตไฟล์ขึ้น GitHub...");
    execSync('git config --global user.name "Chinchaflow-Admin-Bot"');
    execSync('git config --global user.email "admin@chinchaflow.ai"');
    execSync('git add .');
    
    const status = execSync('git status --porcelain').toString();
    if (status) {
      execSync('git commit -m "🤖 AI Admin: ปรับปรุงระบบตามคำสั่งพี่พีช"');
      execSync('git push');
      console.log("🎉 [Success] อัปเดตขึ้น GitHub แล้ว!");
    } else {
      console.log("💡 [Git] ไม่มีไฟล์ใหม่ให้ Push ครับผม");
    }
  } catch (error) {
    console.error("❌ Git Push Error: ไม่สามารถนำโค้ดขึ้นระบบได้ (เช็คสิทธิ์ contents: write ใน YML)");
    console.error(error.message);
    process.exit(1);
  }
}

runOrchestrator();
