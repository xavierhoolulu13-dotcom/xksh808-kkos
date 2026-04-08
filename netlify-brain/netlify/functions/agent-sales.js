// ============================================================
// /functions/agent-sales — A_SALES: Sales Desk Agent
// Input: lead + conversation history + latest message
// Output: reply + Anytype objects created (Client, Offer, PaymentEvent)
// Zero-Trust: NEVER sets PaymentEvent.status = "Complete"
// ============================================================

const { callLLM } = require("../../lib/groqRouter");
const AT = require("../../lib/anytypeClient");
const MON = require("../../agents/A_MON");

const SYSTEM_PROMPT = `
You are A_SALES, the Sales Desk Agent for XKSH808 — a Hawaii web/SEO company.
You qualify leads, recommend the right service, and guide them to payment.

Service Catalog:
- Free Website (Entry) — $0 — hook to get them started
- Starter Pack (Core) — $297 — web + basic SEO
- Pro Build (Premium) — $497 — funnel + booking automation
- Souper Agent Bot (Core) — $197 — AI chatbot for their site
- KK OS Setup (Premium) — $997 — full business OS deployment

Rules:
- Always try to upsell: Free → Starter → Pro
- Qualify: What's their biggest pain point? Do they have a budget?
- NEVER say payment is confirmed. That happens offline.
- Payment methods: Cash App $XKSH808 | Stripe link | PayPal
- End every closing message with payment instructions.

Output ONLY valid JSON:
{
  "reply_message": "what to say to the user",
  "stage": "qualifying|proposing|closing",
  "recommended_offer": "offer name",
  "offer_price": 0,
  "offer_type": "Free Website|Upgrade Pack|Branding|OS Setup|AOB|Souper Agent|Other",
  "offer_tier": "Entry|Core|Premium",
  "delivery_mode": "Service|Download|Access|License",
  "create_client": true|false,
  "create_payment_event": true|false,
  "client_data": { "name": "", "email": "", "business_name": "" }
}
`;

exports.handler = async (event) => {
  let body;
  try {
    body = JSON.parse(event.body || "{}");
  } catch {
    return respond(400, { error: "Invalid JSON" });
  }

  const { lead = {}, message, history = [] } = body;

  if (!message) return respond(400, { error: "message required" });

  try {
    // 1. Build conversation context
    const messages = [
      { role: "system", content: SYSTEM_PROMPT },
      ...history.map(h => ({ role: h.role, content: h.content })),
      {
        role: "user",
        content: `Lead context: ${JSON.stringify(lead)}\nLatest message: "${message}"`,
      },
    ];

    const llmResult = await callLLM(messages, { temperature: 0.4 });

    let parsed;
    try {
      parsed = JSON.parse(llmResult.content);
    } catch {
      throw new Error(`LLM non-JSON: ${llmResult.content}`);
    }

    const result = {
      agent: "A_SALES",
      stage: parsed.stage,
      reply: parsed.reply_message,
      recommended_offer: parsed.recommended_offer,
    };

    // 2. Create Client if closing stage
    if (parsed.create_client && parsed.client_data) {
      const client = await AT.createClient({
        name: parsed.client_data.name || lead.name || "Unknown",
        email: parsed.client_data.email || "",
        business_name: parsed.client_data.business_name || "",
        service_type: parsed.recommended_offer || "Free Site",
        status: "Trial",
        trial_start: new Date().toISOString(),
        trial_end: new Date(Date.now() + 14 * 864e5).toISOString(), // 14 days
        primary_channel: lead.source_channel || "OTHER",
        payment_received: false,
        notes: `Created by A_SALES. Lead score: ${lead.score || "Unknown"}`,
      });
      result.client_id = client.id;

      // 3. Create Offer
      const offer = await AT.createOffer({
        name: parsed.recommended_offer,
        type: parsed.offer_type || "Free Website",
        tier: parsed.offer_tier || "Entry",
        price: parsed.offer_price || 0,
        status: "Active",
        delivery_mode: parsed.delivery_mode || "Service",
        notes: `Proposed to ${client.id} by A_SALES`,
      });
      result.offer_id = offer.id;

      // 4. Create PaymentEvent — Zero-Trust: starts as New → agent sets Pending only
      if (parsed.create_payment_event) {
        const payment = await AT.createPaymentEvent({
          date: new Date().toISOString(),
          amount: parsed.offer_price || 0,
          method: "Other",
          status: "New",
          reference_id: "",
          notes: `Awaiting human verification. Client: ${client.id}. Offer: ${offer.id}.`,
        });

        // Agent CAN set Pending — cannot set Complete
        await AT.updatePaymentEvent(payment.id, { status: "Pending" });
        result.payment_event_id = payment.id;
        result.payment_status = "Pending — awaiting human verification in Anytype";
      }

      // 5. Update lead to Contacted
      if (lead.id) {
        await AT.updateLead(lead.id, { status: "Contacted" });
      }
    }

    return respond(200, result);

  } catch (err) {
    await MON.logIncident({
      type: "AGENT_SALES_ERROR",
      source: "agent-sales.js",
      message: err.message,
      severity: "error",
    });
    return respond(500, { error: err.message });
  }
};

function respond(statusCode, body) {
  return { statusCode, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) };
}
