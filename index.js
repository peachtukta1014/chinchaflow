import "dotenv/config";
import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const apiKey = process.env.OPENROUTER_API_KEY;
const modelName = process.env.DEFAULT_MODEL || "deepseek/deepseek-chat";
const aiInstruction = process.env.AI_CODE_INSTRUCTION || "";

if (!apiKey) {
  console.error("❌ Missing OPENROUTER_API_KEY");
  process.exit(1);
}

const APP_SCOPES = {
  seafood: "apps/seafood-pos",
  tea: "apps/chincha-tea",
  webhook: "apps/webhook-core",
  scheduled: "apps/webhook-core-scheduled",
};

function detectScope(instruction) {
  const text = instruction.toLowerCase();

  if (text.includes("กุ้ง") || text.includes("seafood")) return "seafood";
  if (text.includes("ชา") || text.includes("tea")) return "tea";
  if (text.includes("webhook")) return "webhook";
  if (text.includes("scheduled")) return "scheduled";

  return "root";
}

function safeResolve(scopePath, targetPath) {
  const scopeRoot = path.resolve(__dirname, scopePath || ".");
  const resolved = path.resolve(scopeRoot, targetPath);

  if (!resolved.startsWith(scopeRoot)) {
    throw new Error(`Blocked path traversal: ${targetPath}`);
  }

  return resolved;
}

async function callAI(scopeName, scopePath) {
  const response = await fetch(
    "https://openrouter.ai/api/v1/chat/completions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: modelName,
        messages: [
          {
            role: "system",
            content: `
คุณคือ AI Admin ของ ${scopeName.toUpperCase()} ใน CHINCHA FLOW
ตอบ JSON อย่างเดียว

format:
{
  "operations":[
    {
      "action":"write",
      "path":"relative/path.js",
      "content":"file content"
    }
  ]
}
            `,
          },
          {
            role: "user",
            content: aiInstruction,
          },
        ],
      }),
    }
  );

  const data = await response.json();

  if (!response.ok) {
    console.error("❌ OpenRouter Error");
    console.error(JSON.stringify(data, null, 2));
    process.exit(1);
  }

  return data;
}

function parseAIResponse(data) {
  const raw = data?.choices?.[0]?.message?.content;

  if (!raw) {
    throw new Error("AI returned empty response");
  }

  const clean = raw
    .replace(/```json/g, "")
    .replace(/```/g, "")
    .trim();

  try {
    return JSON.parse(clean);
  } catch (err) {
    console.error("❌ JSON Parse Failed");
    console.error(raw);
    throw err;
  }
}

function applyOperations(result, scopePath) {
  if (!result.operations?.length) {
    console.log("ℹ️ No operations returned");
    return;
  }

  for (const op of result.operations) {
    if (op.action !== "write") continue;

    const fullPath = safeResolve(scopePath, op.path);

    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    fs.writeFileSync(fullPath, op.content, "utf8");

    console.log(`✅ Updated: ${op.path}`);
  }
}

function pushChanges() {
  console.log("📦 Git Sync...");

  execSync(`git config user.name "Chinchaflow-Bot"`);
  execSync(`git config user.email "bot@chinchaflow.ai"`);

  execSync("git add .");

  const changed = execSync("git status --porcelain")
    .toString()
    .trim();

  if (!changed) {
    console.log("ℹ️ No changes");
    return;
  }

  execSync(`git commit -m "🤖 AI Admin update"`);

  try {
    execSync("git push origin HEAD", { stdio: "inherit" });
  } catch {
    console.error("❌ Git push failed");
  }
}

async function run() {
  if (!aiInstruction) {
    console.log("💡 Waiting for instruction...");
    return;
  }

  const targetApp = detectScope(aiInstruction);
  const scopePath = APP_SCOPES[targetApp] || "";

  console.log(
    `🤖 Scope: ${targetApp.toUpperCase()} -> ${scopePath || "ROOT"}`
  );

  try {
    const data = await callAI(targetApp, scopePath);
    const result = parseAIResponse(data);

    applyOperations(result, scopePath);
    pushChanges();
  } catch (err) {
    console.error("❌ Fatal:", err.message);
    process.exit(1);
  }
}

run();