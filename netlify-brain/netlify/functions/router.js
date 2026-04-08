// ============================================================
// CHANNEL ROUTER — L0 → L1
// Handles inbound from: Telegram, WhatsApp, IG/FB, Google Sites
// Routes to: A_LEAD → A_SALES → A_DELIV (via Zero-Trust gate)
// ============================================================

const LEAD = require("../../agents/A_LEAD");
const SALES = require("../../agents/A_SALES");
const DELIV = require("../../agents/A_DELIV");
const MON = require("../../agents/A_MON");

exports.handler = async (event) => {
  const start = Date.now();
  let body;

  try {
    body = JSON.parse(event.body || "{}");
  } catch {
    return respond(400, { error: "Invalid JSON body" });
  }

  const { type, platform, message, sender, lead, payment_event_id, client_id, offer_id } = body;

  try {
    // ── INBOUND MESSAGE → A_LEAD ──────────────────────────
    if (type === "inbound_message") {
      const leadResult = await LEAD.run({
        message,
        channel: sender,
        channelPlatform: platform || "OTHER",
      });

      // Auto-escalate to A_SALES if Hot or Urgency >= 4
      if (leadResult.escalate_to_sales) {
        const salesResult = await SALES.run({
          lead: leadResult.lead_data,
          message,
          conversationHistory: [],
        });

        await MON.checkSystemHealth({ llmLatencyMs: Date.now() - start, anytypeReachable: true });

        return respond(200, {
          pipeline: ["A_LEAD", "A_SALES"],
          lead: leadResult,
          sales: salesResult,
        });
      }

      return respond(200, { pipeline: ["A_LEAD"], lead: leadResult });
    }

    // ── SALES CONTINUATION ────────────────────────────────
    if (type === "sales_message") {
      const salesResult = await SALES.run({
        lead: lead || {},
        message,
        conversationHistory: body.history || [],
      });
      return respond(200, { pipeline: ["A_SALES"], sales: salesResult });
    }

    // ── DELIVERY TRIGGER (human set PaymentEvent=Complete) ─
    if (type === "payment_complete") {
      if (!payment_event_id || !client_id || !offer_id) {
        return respond(400, { error: "payment_event_id, client_id, offer_id required" });
      }
      const delivResult = await DELIV.run({ payment_event_id, client_id, offer_id });
      return respond(200, { pipeline: ["A_DELIV"], delivery: delivResult });
    }

    return respond(400, { error: `Unknown event type: ${type}` });

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

function respond(statusCode, body) {
  return {
    statusCode,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  };
}
