const path = require('path');

// 🔑 ดึงคีย์ลับล็อกระบบ OpenRouter API และสมองตัวหลักจาก GitHub Workflows
const apiKey = process.env.OPENROUTER_API_KEY;
const modelName = process.env.DEFAULT_MODEL || "deepseek/deepseek-v4-flash";

// 🎯 ตัวแปรเลือกเป้าหมายว่าจะปลุกเอเจนต์แอปไหน (ค่าเริ่มต้นให้เทสระบบฝั่งร้านน้ำชินชา)
const targetApp = process.env.TARGET_APP || 'chincha-tea'; 

console.log(`🚀 [Chinchaflow Orchestrator] ระบบควบคุมและกระจายงานส่วนกลางเปิดใช้งาน...`);

if (!apiKey) {
  console.error("❌ ไม่พบ OPENROUTER_API_KEY ในระบบ! กรุณาตรวจสอบการต่อท่อน้ำใน GitHub Secrets");
  process.exit(1);
}

// 🎛️ ระบบ Router สลับสายสั่งงานสมองกลเฉพาะทางตามโฟลเดอร์แอปจริงของพี่พีช
switch (targetApp) {
  case 'chincha-tea':
    console.log("🍵 [Switch] ทำการส่งสาย -> ปลุก Agent ร้านน้ำชินชา (apps/chincha-tea)");
    // สั่งให้วิ่งไปปลุกไฟล์สมองกลที่เราจะสร้างไว้ในโฟลเดอร์ร้านน้ำ
    const teaAgent = require('./apps/chincha-tea/agent.js');
    teaAgent.start(apiKey, modelName);
    break;

  case 'chincha-shrimp':
    console.log("🍤 [Switch] ทำการส่งสาย -> ปลุก Agent ร้านกุ้งแม่น้ำ (apps/chincha-shrimp)");
    const shrimpAgent = require('./apps/chincha-shrimp/agent.js');
    shrimpAgent.start(apiKey, modelName);
    break;

  case 'webhook-core':
    console.log("💬 [Switch] ทำการส่งสาย -> ปลุก Agent LINE Router 3 ช่อง (apps/webhook-core)");
    const webhookAgent = require('./apps/webhook-core/agent.js');
    webhookAgent.start(apiKey, modelName);
    break;

  case 'firebase-functions':
    console.log("🔥 [Switch] ทำการส่งสาย -> ปลุก Agent ระบบหลังบ้าน (apps/firebase-functions)");
    // เผื่อไว้ใช้สำหรับสั่งคุมฐานข้อมูลในอนาคตครับพี่
    break;

  default:
    console.error(`❌ ไม่พบแอปย่อยชื่อ "${targetApp}" ในระบบพาร์ทิชันของคุณพี่พีชครับ!`);
}
