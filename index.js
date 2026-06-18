import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const apiKey = process.env.OPENROUTER_API_KEY;
const modelName = process.env.DEFAULT_MODEL || "deepseek/deepseek-v4-flash";
const aiInstruction = process.env.AI_CODE_INSTRUCTION || "";

// รายชื่อแอปใน Monorepo ตามโครงสร้างของพี่พีช
const APP_SCOPES = {
  "seafood": "apps/seafood-pos",
  "tea": "apps/chincha-tea",
  "webhook": "apps/webhook-core",
  "scheduled": "apps/webhook-core-scheduled"
};

async function runOrchestrator() {
  if (!aiInstruction) {
    console.log("💡 [Status] รอคำสั่งจากพี่พีช...");
    return;
  }

  // 1. ตัวกลางสวมหมวก (Determine Scope)
  let targetApp = "root"; // ถ้าไม่ระบุ ให้ทำที่ root
  let scopePath = "";
  
  const instructionLower = aiInstruction.toLowerCase();
  if (instructionLower.includes("กุ้ง") || instructionLower.includes("seafood")) { targetApp = "seafood"; }
  else if (instructionLower.includes("ชา") || instructionLower.includes("tea")) { targetApp = "tea"; }
  else if (instructionLower.includes("webhook")) { targetApp = "webhook"; }
  else if (instructionLower.includes("scheduled")) { targetApp = "scheduled"; }

  scopePath = APP_SCOPES[targetApp] || "";
  console.log(`🤖 [Chinchaflow Orchestrator] สวมหมวก: ${targetApp.toUpperCase()} | Scope: ${scopePath || 'ROOT'}`);

  // 2. ส่งงานให้ AI
  try {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        "model": modelName,
        "messages": [
          { 
            "role": "system", 
            "content": `คุณคือ AI Admin ของ ${targetApp.toUpperCase()} ใน CHINCHA FLOW. 
                        ห้ามเขียนไฟล์นอกโฟลเดอร์ ${scopePath || 'ROOT'}. 
                        ตอบกลับ JSON เท่านั้น มี key 'operations' (action, path, content).` 
          },
          { "role": "user", "content": `คำสั่ง: ${aiInstruction}` }
        ]
      })
    });

    const data = await response.json();
    const rawContent = data.choices?.[0]?.message?.content || "{}";
    const jsonString = rawContent.replace(/```json/g, "").replace(/```/g, "").trim();
    const result = JSON.parse(jsonString);

    // 3. ปฏิบัติตามคำสั่ง (ปลอดภัย)
    if (result.operations) {
      result.operations.forEach(op => {
        // กันไม่ให้ AI ออกนอกลู่นอกทาง
        const fullPath = path.join(__dirname, scopePath, op.path.replace(/^\//, ''));
        fs.mkdirSync(path.dirname(fullPath), { recursive: true });
        fs.writeFileSync(fullPath, op.content, 'utf8');
        console.log(`✅ [Write] ${op.path}`);
      });
      pushChanges();
    }
  } catch (err) {
    console.error("❌ Critical Error:", err.message);
    process.exit(1);
  }
}

function pushChanges() {
  console.log("📦 [Git] กำลัง Sync...");
  execSync('git config user.name "Chinchaflow-Bot" && git config user.email "bot@chinchaflow.ai"');
  execSync('git add .');
  if (execSync('git status --porcelain').toString().length > 0) {
    execSync('git commit -m "🤖 AI Admin: ปรับปรุงระบบตามคำสั่งพี่พีช"');
    execSync('git push origin HEAD');
  }
}

runOrchestrator();
