import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log(`🚀 [Chinchaflow Orchestrator v1.4.0] System Ready...`);

// 🔑 Config จาก Environment
const apiKey = process.env.OPENROUTER_API_KEY;
const modelName = process.env.DEFAULT_MODEL || "deepseek/deepseek-v4-flash";
const aiInstruction = process.env.AI_CODE_INSTRUCTION || "";

async function runOrchestrator() {
  if (!aiInstruction) {
    console.log("💡 [Status] รอคำสั่งจากพี่พีช...");
    return;
  }

  // 📖 ขั้นตอนที่ 1: อ่านกฎและคัมภีร์จาก docs/
  const loadDoc = (name) => fs.readFileSync(path.join(__dirname, 'docs', name), 'utf8');
  const context = {
    changelog: loadDoc('AGENT_CHANGELOG_TH.md'),
    structure: loadDoc('PROJECT_STRUCTURE.md'),
    architecture: loadDoc('ARCHITECTURE_TH.md')
  };

  try {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        "model": modelName,
        "response_format": { "type": "json_object" },
        "messages": [
          { "role": "system", "content": "คุณคือ AI Admin ของ CHINCHA FLOW ทำหน้าที่จัด Partition โค้ดและอัปเดตระบบตามโครงสร้างที่ได้รับมอบหมาย" },
          { "role": "user", "content": `คำสั่ง: ${aiInstruction}` }
        ]
      })
    });

    const data = await response.json();
    const result = JSON.parse(data.choices?.[0]?.message?.content || "{}");

    // 🛠️ ขั้นตอนที่ 2: ปฏิบัติการ
    if (result.operations) {
      result.operations.forEach(op => {
        const absPath = path.join(__dirname, op.path);
        if (op.action === 'write_file') {
          fs.mkdirSync(path.dirname(absPath), { recursive: true });
          fs.writeFileSync(absPath, op.content, 'utf8');
        }
        console.log(`✅ [${op.action}] สำเร็จ: ${op.path}`);
      });
      pushChanges();
    }
  } catch (err) { console.error("❌ Critical Error:", err); }
}

function pushChanges() {
  try {
    execSync('git config --global user.name "Chinchaflow-Admin-Bot"');
    execSync('git config --global user.email "admin@chinchaflow.ai"');
    execSync('git add .');
    if (execSync('git status --porcelain').toString()) {
      execSync('git commit -m "🤖 AI Admin: ปรับปรุงระบบตามคำสั่งพี่พีช"');
      execSync('git push');
      console.log("🎉 [Success] อัปเดตขึ้น GitHub แล้ว!");
    }
  } catch (err) { console.error("⚠️ Git Error:", err.message); }
}

runOrchestrator();
