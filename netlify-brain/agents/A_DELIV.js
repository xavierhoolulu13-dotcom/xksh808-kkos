// ============================================================
// A_DELIV — Delivery Agent
// Triggered ONLY when PaymentEvent.Status = "Complete"
// Zero-Trust: Always verify status before proceeding
// ============================================================

const { callLLM } = require("../lib/groqRouter");
const AT = require("../lib/anytypeClient");

async function run({ payment_event_id, client_id, offer_id }) {
  // ── ZERO-TRUST GATE ──────────────────────────────────────
  const payment = await AT.getPaymentEvent(payment_event_id);

  if (payment.status !== "Complete") {
    console.warn(`[A_DELIV] BLOCKED — PaymentEvent ${payment_event_id} status is "${payment.status}", not "Complete". Aborting.`);
    return {
      agent: "A_DELIV",
      status: "blocked",
      reason: `PaymentEvent.status = "${payment.status}". Zero-Trust gate: delivery requires human-verified Complete status.`,
    };
  }
  // ── GATE PASSED ──────────────────────────────────────────

  // 1. Build deliverable using LLM
  const llmResult = await callLLM([
    {
      role: "system",
      content: `You are A_DELIV, the Delivery Agent for XKSH808.
Given an offer type and client details, generate the deliverable configuration and next steps.
Output valid JSON only: { deliverable_type, deliverable_summary, setup_steps, estimated_completion }`,
    },
    {
      role: "user",
      content: `Payment confirmed. Client ID: ${client_id}. Offer ID: ${offer_id}. Payment Event: ${payment_event_id}. Generate deliverable config.`,
    },
  ]);

  let deliverable;
  try {
    deliverable = JSON.parse(llmResult.content);
  } catch {
    throw new Error(`[A_DELIV] LLM returned non-JSON: ${llmResult.content}`);
  }

  // 2. Create Workflow for this delivery
  const workflow = await AT.createWorkflow({
    name: `Delivery — ${client_id}`,
    department: "Delivery",
    status: "Running",
    trigger_type: "Payment Complete",
    last_run: new Date().toISOString(),
    notes: deliverable.deliverable_summary,
  });

  // 3. Update client to Active
  await AT.updateClient(client_id, {
    status: "Active",
    payment_received: true,
    notes: `Delivery initiated. Workflow: ${workflow.id}`,
  });

  // 4. Update Dashboard
  await AT.updateDashboardStats({
    increment_paid_clients: 1,
    increment_deliverables_running: 1,
  });

  return {
    agent: "A_DELIV",
    status: "initiated",
    workflow_id: workflow.id,
    deliverable,
    client_id,
  };
}

module.exports = { run };
