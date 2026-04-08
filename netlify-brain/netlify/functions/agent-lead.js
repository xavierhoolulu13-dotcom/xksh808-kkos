// ============================================================
// /functions/agent-lead — A_LEAD: Lead Engine Agent
// Input: normalized { channel, user_id, message, metadata }
// Output: lead object + suggested reply + escalation flag
// ============================================================

const { callLLM } = require("../../lib/groqRouter");
const AT = require("../../lib/anytypeClient");
const MON = require("../../agents/A_MON");

const SYSTEM_PROMPT = `
You are A_LEAD, the Lead Engine Agent for XKSH808 — a Hawaii web/SEO company.
Parse the inbound message and extract structured lead data.

Scoring:
- HOT: clear need + budget signal + urgency ("ASAP", "ready", "need now")
- WARM: clear need, no budget mentioned yet
- COLD: vague, browsing, no clear need

Urgency 1–5:
- 5: needs it today/this week, high stakes
- 4: clear deadline, "soon"
- 3: general interest
- 2: casual browsing
- 1: no timeline expressed

Output ONLY valid JSON:
{
  "name": "extracted or 'Unknown'",
  "need": "what they need",
  "score": "Hot|Warm|Cold",
  "urgency": 1-5,
  "next_action": "what to do next",
  "follow_up_script": "short message to send back",
  "suggested_reply": "immediate reply to user"
}
`;

exports.handler = async (event) => {
  const start = Date.now();
  let body;

  try {
    body = JSON.parse(event.body || "{}");
  } catch {
    return respond(400, { error: "Invalid JSON" });
  }

  const { channel, user_id, message, metadata = {} } = body;

  if (!message) return respond(400, { error: "message required" });

  try {
    // 1. LLM: extract and score lead
    const llmResult = await callLLM([
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content: `Channel: ${channel || "UNKNOWN"}\nUser: ${user_id || "unknown"}\nMessage: "${message}"`,
      },
    ]);

    let parsed;
    try {
      parsed = JSON.parse(llmResult.content);
    } catch {
      throw new Error(`LLM non-JSON response: ${llmResult.content}`);
    }

    // 2. Build lead payload
    const leadPayload = {
      name: parsed.name || user_id || "Unknown",
      source_channel: normalizeChannel(channel),
      need: parsed.need || "",
      urgency: parsed.urgency || 3,
      score: parsed.score || "Cold",
      status: "New",
      next_action: parsed.next_action || "",
      follow_up_script: parsed.follow_up_script || "",
      created_at: new Date().toISOString(),
    };

    // 3. Save to Anytype
    const lead = await AT.createLead(leadPayload);

    // 4. Escalation logic
    const escalate = parsed.score === "Hot" || parsed.urgency >= 4;

    // 5. Log latency to A_MON
    await MON.checkSystemHealth({ llmLatencyMs: Date.now() - start, anytypeReachable: true });

    return respond(200, {
      agent: "A_LEAD",
      lead_id: lead.id,
      lead_data: leadPayload,
      suggested_reply: parsed.suggested_reply,
      escalate_to_sales: escalate,
      model_used: llmResult.model,
    });

  } catch (err) {
    await MON.logIncident({
      type: "AGENT_LEAD_ERROR",
      source: "agent-lead.js",
      message: err.message,
      severity: "error",
    });
    return respond(500, { error: err.message });
  }
};

function normalizeChannel(ch) {
  const map = { telegram: "TG", tg: "TG", whatsapp: "WA", wa: "WA", instagram: "IG", ig: "IG", site: "SITE" };
  return map[(ch || "").toLowerCase()] || "OTHER";
}

function respond(statusCode, body) {
  return { statusCode, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) };
}
