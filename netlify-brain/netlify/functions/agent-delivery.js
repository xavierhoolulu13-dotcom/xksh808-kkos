// ============================================================
// /functions/agent-delivery — A_DELIV: Delivery Agent
// Trigger: POST when PaymentEvent.Status = "Complete" (human set)
// Zero-Trust Gate: Verifies status before ANY action
// ============================================================

const { callLLM } = require("../../lib/groqRouter");
const AT = require("../../lib/anytypeClient");
const MON = require("../../agents/A_MON");

exports.handler = async (event) => {
  let body;
  try {
    body = JSON.parse(event.body || "{}");
  } catch {
    return respond(400, { error: "Invalid JSON" });
  }

  const { payment_event_id, client_id, offer_id } = body;

  if (!payment_event_id || !client_id || !offer_id) {
    return respond(400, { error: "payment_event_id, client_id, and offer_id are all required" });
  }

  try {
    // ── ZERO-TRUST GATE — mandatory check ──────────────────
    const payment = await AT.getPaymentEvent(payment_event_id);

    if (payment.status !== "Complete") {
      await MON.logIncident({
        type: "ZERO_TRUST_BLOCK",
        source: "agent-delivery.js",
        message: `Blocked — PaymentEvent ${payment_event_id} is "${payment.status}", not "Complete"`,
        severity: "warn",
      });
      return respond(403, {
        error: "Zero-Trust Gate: Delivery blocked",
        reason: `PaymentEvent.status = "${payment.status}". Only a human can set this to "Complete" in Anytype.`,
        payment_event_id,
      });
    }
    // ── GATE PASSED ────────────────────────────────────────

    // 1. Generate deliverable config via LLM
    const llmResult = await callLLM([
      {
        role: "system",
        content: `You are A_DELIV, the Delivery Agent for XKSH808.
Payment has been human-verified. Generate the deliverable configuration.
Output ONLY valid JSON:
{
  "deliverable_type": "Website|Bot|OS Setup|Branding|Other",
  "deliverable_summary": "one-sentence description",
  "setup_steps": ["step 1", "step 2", "step 3"],
  "estimated_completion": "X business days",
  "client_message": "message to send client confirming delivery started"
}`,
      },
      {
        role: "user",
        content: `Client ID: ${client_id}\nOffer ID: ${offer_id}\nPayment Event: ${payment_event_id}\nGenerate delivery config.`,
      },
    ]);

    let deliverable;
    try {
      deliverable = JSON.parse(llmResult.content);
    } catch {
      throw new Error(`LLM non-JSON: ${llmResult.content}`);
    }

    // 2. Create Workflow for this delivery
    const workflow = await AT.createWorkflow({
      name: `DELIV — ${client_id} — ${deliverable.deliverable_type}`,
      department: "Delivery",
      status: "Running",
      trigger_type: "Payment Complete",
      last_run: new Date().toISOString(),
      success_rate: 0,
      notes: deliverable.deliverable_summary,
    });

    // 3. Activate client
    await AT.updateClient(client_id, {
      status: "Active",
      payment_received: true,
      notes: `Delivery initiated ${new Date().toISOString()}. Workflow: ${workflow.id}. ETA: ${deliverable.estimated_completion}`,
    });

    // 4. Update Dashboard
    await AT.updateDashboardStats({
      increment_paid_clients: 1,
      increment_deliverables_running: 1,
    });

    return respond(200, {
      agent: "A_DELIV",
      status: "initiated",
      workflow_id: workflow.id,
      deliverable,
      client_id,
      offer_id,
      payment_event_id,
    });

  } catch (err) {
    await MON.logIncident({
      type: "AGENT_DELIVERY_ERROR",
      source: "agent-delivery.js",
      message: err.message,
      severity: "error",
    });
    return respond(500, { error: err.message });
  }
};

function respond(statusCode, body) {
  return { statusCode, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) };
}
