import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log(`🚀 [Chinchaflow Orchestrator v1.5.1] System Initializing...`);

const apiKey = process.env.OPENROUTER_API_KEY;
const modelName = process.env.DEFAULT_MODEL || "deepseek/deepseek-v4-flash";
const aiInstruction = process.env.AI_CODE_INSTRUCTION || "";

async function runOrchestrator() {
  if (!aiInstruction) {
    console.log("💡 [Status] รอคำสั่งจากพี่พีช...");
    return;
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
        "messages": [
          { 
            "role": "system", 
            "content": "คุณคือ AI Admin ที่แม่นยำที่สุด ตอบกลับเฉพาะ JSON เท่านั้น ห้ามเขียนคำอธิบายใดๆ เพิ่มเติม โดยต้องมี key 'operations' (array of {action, path, content})"
          },
          { "role": "user", "content": `คำสั่งพี่พีช: ${aiInstruction}` }
        ]
      })
    });

    const data = await response.json();
    const rawContent = data.choices?.[0]?.message?.content || "{}";
    
    // ล้างข้อความที่ไม่ใช่ JSON ออก (เผื่อ AI กวนประสาทส่งอะไรติดมา)
    const jsonString = rawContent.replace(/```json/g, "").replace(/```/g, "").trim();
    const result = JSON.parse(jsonString);

    if (result.operations && result.operations.length > 0) {
      result.operations.forEach(op => {
        const absPath = path.resolve(__dirname, op.path);
        fs.mkdirSync(path.dirname(absPath), { recursive: true });
        fs.writeFileSync(absPath, op.content, 'utf8');
        console.log(`✅ [Write] ${op.path}`);
      });
      pushChanges();
    } else {
      console.log("⚠️ [Status] AI ตอบกลับมา แต่ไม่มีการสั่งอัปเดตไฟล์");
      console.log("Raw Response:", rawContent);
    }
  } catch (err) { 
    console.error("❌ Critical Error:", err.message);
    process.exit(1);
  }
}

function pushChanges() {
  try {
    console.log("📦 [Git] กำลัง Sync...");
    // ใช้คำสั่งแบบปลอดภัย
    execSync('git config user.name "Chinchaflow-Bot"');
    execSync('git config user.email "bot@chinchaflow.ai"');
    execSync('git add .');
    
    // เช็คว่ามีอะไรให้ commit ไหม
    const status = execSync('git status --porcelain').toString();
    if (status.length > 0) {
      execSync('git commit -m "🤖 AI Admin: ปรับปรุงระบบตามคำสั่งพี่พีช"');
      execSync('git push origin HEAD');
      console.log("🎉 [Success] อัปเดตสำเร็จ!");
    } else {
      console.log("💡 [Git] ไม่มีไฟล์ให้ Commit");
    }
  } catch (error) {
    console.error("❌ Git Error (เช็คสิทธิ์ GITHUB_TOKEN):", error.message);
    process.exit(1);
  }
}

runOrchestrator();
