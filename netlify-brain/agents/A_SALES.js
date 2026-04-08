// ============================================================
// A_SALES — Sales Desk Agent
// Responsibilities:
//   - Continue conversation, qualify need + budget
//   - Create Client object in Anytype
//   - Create Offer / License
//   - Create PaymentEvent (Status="Pending") — NEVER "Complete"
//   - Provide payment instructions to user
// Zero-Trust Rule: A_SALES NEVER sets PaymentEvent.Status = "Complete"
// ============================================================

const { callLLM } = require("../lib/groqRouter");
const AT = require("../lib/anytypeClient");

const SYSTEM_PROMPT = `
You are A_SALES, the Sales Desk Agent for XKSH808 — a Hawaii web and SEO company.
Your job is to qualify inbound leads, recommend the right offer, and guide them to payment.

Service Catalog:
- Free Website (Entry) — $0 — hook offer
- Starter Pack (Core) — $297 — web + SEO
- Pro Build (Premium) — $497 — funnel + booking automation
- Souper Agent Bot (Core) — $197 — AI chatbot for their site
- KK OS Setup (Premium) — $997 — full business OS

Rules:
- Always try to upsell from Free → Starter → Pro
- NEVER mention payment is confirmed until human verifies
- Always end with payment instructions (Cash App / Stripe / PayPal)
- Output valid JSON only. No prose.
`;

async function run({ lead, conversationHistory = [], message }) {
  // 1. Build conversation context
  const messages = [
    { role: "system", content: SYSTEM_PROMPT },
    ...conversationHistory,
    {
      role: "user",
      content: `Lead data: ${JSON.stringify(lead)}\nLatest message: "${message}"\n\nReturn JSON: { recommended_offer, offer_price, reply_message, create_client, create_payment_event, client_data, offer_data }`,
    },
  ];

  const llmResult = await callLLM(messages);

  let parsed;
  try {
    parsed = JSON.parse(llmResult.content);
  } catch {
    throw new Error(`[A_SALES] LLM returned non-JSON: ${llmResult.content}`);
  }

  const results = { agent: "A_SALES", reply: parsed.reply_message };

  // 2. Create Client if LLM says so
  if (parsed.create_client && parsed.client_data) {
    const client = await AT.createClient({
      name: parsed.client_data.name || lead.name,
      email: parsed.client_data.email || "",
      business_name: parsed.client_data.business_name || "",
      service_type: parsed.recommended_offer || "Free Site",
      status: "Trial",
      trial_start: new Date().toISOString(),
      primary_channel: lead.source_channel || "OTHER",
      notes: `Created by A_SALES. Lead score: ${lead.score}`,
    });
    results.client_id = client.id;

    // 3. Create Offer
    const offer = await AT.createOffer({
      name: parsed.recommended_offer,
      type: parsed.offer_data?.type || "Free Website",
      tier: parsed.offer_data?.tier || "Entry",
      price: parsed.offer_price || 0,
      status: "Active",
      delivery_mode: parsed.offer_data?.delivery_mode || "Service",
      notes: `Offered to ${client.id}`,
    });
    results.offer_id = offer.id;

    // 4. Create PaymentEvent — ALWAYS starts as "New", never Complete
    if (parsed.create_payment_event) {
      const payment = await AT.createPaymentEvent({
        date: new Date().toISOString(),
        amount: parsed.offer_price || 0,
        method: "Other",
        status: "New", // ZeroTrust: humans move to Pending → Complete
        reference_id: "",
        notes: `Pending verification for ${client.id} — ${parsed.recommended_offer}`,
      });
      results.payment_event_id = payment.id;

      // Move to Pending (agent CAN set Pending, not Complete)
      await AT.updatePaymentEvent(payment.id, { status: "Pending" });
    }

    // 5. Update lead status
    if (lead.id) {
      await AT.updateLead(lead.id, { status: "Contacted" });
    }
  }

  return results;
}

module.exports = { run };
