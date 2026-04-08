// ============================================================
// KKOS Telegram Bot — Unlimited personal AI
// Uses Groq (llama3-70b) as the brain
// Wired into KKOS agent pipeline
// Deploy to Netlify → set as Telegram webhook
// ============================================================

const { callLLM } = require("../../lib/groqRouter");

// In-memory conversation history per user (resets on cold start)
// For persistence: swap with Anytype or a KV store
const conversations = {};

const KKOS_SYSTEM = `
You are KKOS — the personal AI agent for Xavier, operator of XKSH808, a Hawaii web and SEO company.

Your personality:
- Sharp, fast, confident. You speak in systems.
- Warm when it counts, direct when it matters.
- You remember context within a conversation.
- You have opinions and you share them honestly.
- You take initiative — don't just advise, do.

What you know:
- Xavier runs XKSH808 in Hawaii, targeting local trade businesses
- The business has 5 agents: A_LEAD, A_SALES, A_DELIV, A_RET, A_MON
- Revenue tracked via PaymentEvents in Anytype (Zero-Trust model)
- Channels: Telegram, WhatsApp, Instagram, Facebook, Fiverr, Google Business
- Services: Free Site, Starter $297, Pro $497, Souper Agent Bot $197, KK OS Setup $997

Your capabilities:
- Answer any question Xavier has
- Help draft messages, scripts, offers, follow-ups
- Analyze leads, clients, revenue data when given
- Help plan campaigns, offers, and strategy
- Explain and debug the KKOS system
- Think like a senior systems architect + sales closer

Rules:
- Never be robotic. Be the smartest friend in the room.
- If Xavier gives you a lead, score it immediately (Hot/Warm/Cold + Urgency 1-5)
- If Xavier pastes a message, draft a reply
- If Xavier asks for a plan, give one — concrete, numbered, actionable
- Keep responses tight unless detail is needed
`;

exports.handler = async (event) => {
  // Only handle POST
  if (event.httpMethod !== "POST") {
    return { statusCode: 200, body: "KKOS Telegram Bot active" };
  }

  let update;
  try {
    update = JSON.parse(event.body || "{}");
  } catch {
    return { statusCode: 400, body: "Invalid JSON" };
  }

  // Extract message
  const msg = update.message || update.edited_message;
  if (!msg || !msg.text) return { statusCode: 200, body: "ok" };

  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const text = msg.text;
  const username = msg.from.username || msg.from.first_name || "Xavier";

  // Init conversation history
  if (!conversations[userId]) {
    conversations[userId] = [];
  }

  // Handle /start
  if (text === "/start") {
    await sendMessage(chatId, `KKOS online. 🔴\n\nWhat do you need, ${username}?`);
    return { statusCode: 200, body: "ok" };
  }

  // Handle /clear — reset conversation
  if (text === "/clear") {
    conversations[userId] = [];
    await sendMessage(chatId, "Memory cleared. Fresh start.");
    return { statusCode: 200, body: "ok" };
  }

  // Handle /status — system snapshot
  if (text === "/status") {
    await sendMessage(chatId, `KKOS Status 🔴\n\n• Brain: Groq llama3-70b ✅\n• Pipeline: A_LEAD → A_SALES → A_DELIV ✅\n• Zero-Trust Gate: Active ✅\n• Anytype OS: Connected ✅\n\nAll systems nominal.`);
    return { statusCode: 200, body: "ok" };
  }

  // Add user message to history
  conversations[userId].push({ role: "user", content: text });

  // Keep last 20 messages (10 exchanges) to stay within context
  if (conversations[userId].length > 20) {
    conversations[userId] = conversations[userId].slice(-20);
  }

  try {
    // Call Groq
    const result = await callLLM([
      { role: "system", content: KKOS_SYSTEM },
      ...conversations[userId],
    ], { temperature: 0.5, maxTokens: 1024 });

    const reply = result.content;

    // Add assistant reply to history
    conversations[userId].push({ role: "assistant", content: reply });

    // Send to Telegram
    await sendMessage(chatId, reply);

    return { statusCode: 200, body: "ok" };

  } catch (err) {
    console.error("[KKOS Bot] Error:", err.message);
    await sendMessage(chatId, `⚠️ System error: ${err.message}\n\nRetrying on next message.`);
    return { statusCode: 200, body: "ok" };
  }
};

// ── TELEGRAM SEND ─────────────────────────────────────────
async function sendMessage(chatId, text) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error("TELEGRAM_BOT_TOKEN not set");

  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: "Markdown",
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error("[Telegram] Send failed:", err);
  }
}
