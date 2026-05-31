// Proves the Claude Agent SDK streams with your existing login. Spends a tiny
// bit of usage. Usage: node scripts/chat-smoke.mjs [cwd] [prompt]
import { query } from "@anthropic-ai/claude-agent-sdk";

const cwd = process.argv[2] || process.cwd();
const prompt = process.argv[3] || "Reply with exactly three words, no punctuation.";
console.log(`querying claude (cwd: ${cwd})…`);

try {
  const stream = query({ prompt, options: { cwd, permissionMode: "acceptEdits", maxTurns: 1 } });
  for await (const msg of stream) {
    if (msg.type === "system" && msg.session_id) console.log("[init] session:", msg.session_id);
    else if (msg.type === "assistant") {
      const c = msg.message?.content;
      const text = Array.isArray(c)
        ? c.filter((b) => b.type === "text").map((b) => b.text).join("")
        : c;
      if (text) console.log("[assistant]", text);
    } else if (msg.type === "result") {
      console.log("[result]", msg.subtype);
    }
  }
  console.log("SMOKE_OK");
} catch (e) {
  console.error("SMOKE_FAIL:", e?.message || e);
  process.exitCode = 1;
}
