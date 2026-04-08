// ============================================================
// /functions/router — Channel Router
// Receives: Telegram, WhatsApp, Google Sites widget
// Normalizes: → { channel, user_id, message, metadata }
// Routes: → agent-lead | agent-sales | agent-delivery
// Uses Groq to decide routing when ambiguous
// ============================================================

const { callLLM } = require("../../lib/groqRouter");
const MON = require("../../agents/A_MON");

const NETLIFY_BASE = process.env.NETLIFY_URL || "http://localhost:8888";

const ROUTER_SYSTEM = `
You are the KKOS Channel Router. Given a normalized inbound message, decide which agent to invoke.

Agents:
- A_LEAD: new inquiries, first contact, unknown users
- A_SALES: users already in the lead pipeline, qualifying, pricing questions
- A_DELIV: post-payment delivery triggers (rare via chat)
- A_RET: existing clients checking in, trial users

Output ONLY valid JSON: { "route_to": "A_LEAD|A_SALES|A_DELIV|A_RET", "reason": "one line" }
`;

exports.handler = async (event) => {
  let raw;
  try {
    raw = JSON.parse(event.body || "{}");
  } catch {
    return respond(400, { error: "Invalid JSON body" });
  }

  // ── NORMALIZE INBOUND PAYLOAD ─────────────────────────
  const normalized = normalizePayload(raw, event.headers);
  const { channel, user_id, message, metadata } = normalized;

  if (!message) return respond(400, { error: "No message content found" });

  try {
    // ── LLM ROUTING DECISION ──────────────────────────────
    const routingResult = await callLLM([
      { role: "system", content: ROUTER_SYSTEM },
      {
        role: "user",
        content: `Channel: ${channel}\nUser: ${user_id}\nMessage: "${message}"\nMetadata: ${JSON.stringify(metadata)}`,
      },
    ], { temperature: 0.1, maxTokens: 128 });

    let routing;
    try {
      routing = JSON.parse(routingResult.content);
    } catch {
      routing = { route_to: "A_LEAD", reason: "Default fallback" };
    }

    // ── DISPATCH TO AGENT FUNCTION ────────────────────────
    const agentFn = {
      A_LEAD: "agent-lead",
      A_SALES: "agent-sales",
      A_DELIV: "agent-delivery",
      A_RET: "agent-retention",
    }[routing.route_to] || "agent-lead";

    const agentUrl = `${NETLIFY_BASE}/.netlify/functions/${agentFn}`;

    const agentRes = await fetch(agentUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ channel, user_id, message, metadata, lead: metadata.lead }),
    });

    const agentData = await agentRes.json();

    // ── IF A_LEAD ESCALATES → CALL A_SALES ───────────────
    if (agentFn === "agent-lead" && agentData.escalate_to_sales) {
      const salesRes = await fetch(`${NETLIFY_BASE}/.netlify/functions/agent-sales`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lead: agentData.lead_data,
          message,
          history: [],
        }),
      });
      const salesData = await salesRes.json();

      return respond(200, {
        pipeline: ["router", "A_LEAD", "A_SALES"],
        routing,
        lead: agentData,
        sales: salesData,
        reply: salesData.reply || agentData.suggested_reply,
      });
    }

    return respond(200, {
      pipeline: ["router", routing.route_to],
      routing,
      agent_response: agentData,
      reply: agentData.suggested_reply || agentData.reply,
    });

  } catch (err) {
    await MON.logIncident({
      type: "ROUTER_ERROR",
      source: "router.js",
      message: err.message,
      severity: "error",
    });
    return respond(500, { error: err.message });
  }
};

// ── PAYLOAD NORMALIZER ────────────────────────────────────
function normalizePayload(raw, headers = {}) {
  // Telegram format
  if (raw.update_id && raw.message) {
    return {
      channel: "TG",
      user_id: String(raw.message.from?.id || "unknown"),
      message: raw.message.text || "",
      metadata: { telegram_chat_id: raw.message.chat?.id, raw },
    };
  }

  // WhatsApp (Meta Cloud API)
  if (raw.object === "whatsapp_business_account") {
    const entry = raw.entry?.[0]?.changes?.[0]?.value;
    const msg = entry?.messages?.[0];
    return {
      channel: "WA",
      user_id: msg?.from || "unknown",
      message: msg?.text?.body || "",
      metadata: { wa_phone_id: entry?.metadata?.phone_number_id, raw },
    };
  }

  // Google Sites widget / generic POST
  if (raw.channel || raw.message) {
    return {
      channel: raw.channel || "SITE",
      user_id: raw.user_id || raw.sender || "unknown",
      message: raw.message || "",
      metadata: raw.metadata || {},
    };
  }

  // Fallback
  return { channel: "OTHER", user_id: "unknown", message: JSON.stringify(raw), metadata: {} };
}

function respond(statusCode, body) {
  return { statusCode, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) };
}
