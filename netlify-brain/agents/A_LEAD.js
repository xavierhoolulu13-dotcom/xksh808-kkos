// ============================================================
// A_LEAD — Lead Engine Agent
// Responsibilities:
//   - Parse inbound message
//   - Score lead (Hot/Warm/Cold)
//   - Assign Urgency (1–5)
//   - Write Next Action + Follow-up Script
//   - Save Lead + Channel to Anytype
//   - Notify A_SALES if Hot or Urgency >= 4
// ============================================================

const { callLLM } = require("../lib/groqRouter");
const AT = require("../lib/anytypeClient");

const SYSTEM_PROMPT = `
You are A_LEAD, the Lead Engine for XKSH808 — a Hawaii web and SEO company.
Your job is to process inbound business inquiries and output structured lead data.

Scoring rules:
- HOT: Clear need, budget signals, urgency language ("ASAP", "need now", "ready to pay")
- WARM: Clear need, no budget signal yet
- COLD: Vague inquiry, just browsing, no clear need

Urgency 1–5:
- 5: "need it today/this week", high stakes
- 4: "soon", clear deadline
- 3: general interest
- 2: casual browsing
- 1: no timeline

Always output valid JSON only. No prose.
`;

async function run({ message, channel, channelPlatform, leadId = null }) {
  // 1. Call LLM to score and structure the lead
  const llmResult = await callLLM([
    { role: "system", content: SYSTEM_PROMPT },
    {
      role: "user",
      content: `Inbound message from ${channelPlatform}:\n"${message}"\n\nReturn JSON with fields: score, urgency, need, next_action, follow_up_script, suggested_reply`,
    },
  ]);

  let parsed;
  try {
    parsed = JSON.parse(llmResult.content);
  } catch {
    throw new Error(`[A_LEAD] LLM returned non-JSON: ${llmResult.content}`);
  }

  // 2. Build lead payload
  const leadPayload = {
    name: channel || "Unknown",
    source_channel: channelPlatform || "OTHER",
    need: parsed.need || "",
    urgency: parsed.urgency || 3,
    score: parsed.score || "Cold",
    status: "New",
    next_action: parsed.next_action || "",
    follow_up_script: parsed.follow_up_script || "",
    created_at: new Date().toISOString(),
  };

  // 3. Save to Anytype
  let lead;
  if (leadId) {
    lead = await AT.updateLead(leadId, { ...leadPayload, status: "Scored" });
  } else {
    lead = await AT.createLead(leadPayload);
  }

  // 4. Determine if A_SALES should be triggered
  const escalate = parsed.score === "Hot" || parsed.urgency >= 4;

  return {
    agent: "A_LEAD",
    lead_id: lead.id,
    score: parsed.score,
    urgency: parsed.urgency,
    suggested_reply: parsed.suggested_reply,
    escalate_to_sales: escalate,
    lead_data: leadPayload,
  };
}

module.exports = { run };
