Const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

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

  // 📖 ขั้นตอนที่ 1: อ่านกฎและคัมภีร์จาก docs/ เพื่อให้ AI มี Context ที่แม่นยำ
  const loadDoc = (name) => fs.readFileSync(path.join(__dirname, 'docs', name), 'utf8');
  const context = {
    changelog: loadDoc('AGENT_CHANGELOG_TH.md'),
    handbook: loadDoc('AGENT_HANDBOOK_TH.md'),
    structure: loadDoc('PROJECT_STRUCTURE.md'),
    architecture: loadDoc('ARCHITECTURE_TH.md'),
    naming: loadDoc('CHINCHA_FLOW_NAMING_TH.md'),
    style: loadDoc('PEACH_WORKING_STYLE_TH.md')
  };

  try {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        "model": modelName,
        "response_format": { "type": "json_object" },
        "messages": [
        {
  "role": "system",
  "content": `คุณคือ AI Admin ของ CHINCHA FLOW[span_1](start_span)[span_1](end_span). 
  ภารกิจของคุณคือ: แก้ไขโค้ดตามคำสั่ง, จัดระเบียบไฟล์, และอัปเดตระบบตามโครงสร้าง[span_2](start_span)[span_2](end_span).
  
  คุณมีหน้าที่ 4 บทบาทตามโครงสร้างระบบ[span_3](start_span)[span_3](end_span)[span_4](start_span)[span_4](end_span):
  1. THE ARCHITECT: ดูแลโครงสร้างภาพรวม (Root), ปรับปรุง docs/ ทุกครั้งที่มีการเปลี่ยน Log/Architecture[span_5](start_span)[span_5](end_span).
  2. POS SPECIALIST (apps/seafood-pos/): ดูแลระบบจัดการบิล, สต็อกกุ้ง และข้อมูลหน้าร้าน[span_6](start_span)[span_6](end_span)[span_7](start_span)[span_7](end_span).
  3. TEA MASTER (apps/chincha-tea/): ดูแลระบบร้านชา, ปิดวัน, สต็อกแก้วน้ำ[span_8](start_span)[span_8](end_span)[span_9](start_span)[span_9](end_span).
  4. INTEGRATION EXPERT (apps/webhook-core/): ดูแล LINE Webhook โดยแยก Partition ชัดเจน[span_10](start_span)[span_10](end_span)[span_11](start_span)[span_11](end_span):
     - line-oa: รับสลิป/ข้อความ[span_12](start_span)[span_12](end_span).
     - seafood-pos: เชื่อมต่อออเดอร์กุ้ง[span_13](start_span)[span_13](end_span).
     - family-group: ระบบแจ้งเตือนกลุ่มครอบครัว[span_14](start_span)[span_14](end_span).
     - bridge-layer: หัวใจสำคัญ! เชื่อม Line-OA -> Family-Group เพื่อรอการกดยืนยันสลิป[span_15](start_span)[span_15](end_span).

  กฎเหล็ก:
  - แก้ไขเฉพาะ Partition ที่ได้รับมอบหมาย ห้ามแก้ข้ามส่วนเพื่อป้องกันบั๊ก[span_16](start_span)[span_16](end_span).
  - ทุกครั้งที่แก้ไขไฟล์ ต้องเพิ่ม Changelog ไว้บรรทัดบนสุด[span_17](start_span)[span_17](end_span).
  - หากได้รับคำสั่ง ต้องอ้างอิงเอกสารใน docs/ เสมอ[span_18](start_span)[span_18](end_span).`
}
,
          {
            "role": "user",
            "content": `Context คัมภีร์กฎเหล็ก:
            - CHANGELOG: ${context.changelog.substring(0, 500)}...
            - STRUCTURE: ${context.structure}
            - ARCHITECTURE: ${context.architecture}
            
            คำสั่งของพี่พีช: ${aiInstruction}`
          }
        ]
      })
    });

    const data = await response.json();
    const result = JSON.parse(data.choices?.[0]?.message?.content || "{}");

    // 🛠️ ขั้นตอนที่ 2: ปฏิบัติการตามคำสั่ง
    if (result.operations) {
      result.operations.forEach(op => {
        const absPath = path.join(__dirname, op.path);
        if (op.action === 'create_dir') { if (!fs.existsSync(absPath)) fs.mkdirSync(absPath, { recursive: true }); }
        else if (op.action === 'write_file') {
          const dir = path.dirname(absPath);
          if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
          fs.writeFileSync(absPath, op.content, 'utf8');
        }
        else if (op.action === 'delete_file') { if (fs.existsSync(absPath)) fs.unlinkSync(absPath); }
        else if (op.action === 'delete_dir') { if (fs.existsSync(absPath)) fs.rmSync(absPath, { recursive: true, force: true }); }
        console.log(`✅ [${op.action}] สำเร็จ: ${op.path}`);
      });

      // 🔄 ขั้นตอนที่ 3: Git Deploy อัตโนมัติ
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
      console.log("🎉 [Success] อัปเดตขึ้น GitHub และเตรียม Deploy แล้วครับ!");
    }
  } catch (err) { console.error("⚠️ Git Error:", err.message); }
}

runOrchestrator();
