// ============================================================
// /functions/agent-retention — A_RET: Retention Agent
// Scheduled: daily cron (08:00 HST)
// Scans: Clients, Leads, Trial expirations, Inactivity, Upsells
// Creates: Tasks in Anytype + drafts outreach via Groq
// ============================================================

const { callLLM } = require("../../lib/groqRouter");
const AT = require("../../lib/anytypeClient");
const MON = require("../../agents/A_MON");

exports.handler = async (event) => {
  const results = {
    agent: "A_RET",
    run_at: new Date().toISOString(),
    tasks_created: [],
    outreach_drafts: [],
    errors: [],
  };

  try {
    // In production: fetch from Anytype
    // const clients = await AT.listClients();
    // const leads = await AT.listLeads();
    // Stubbed — replace with real Anytype list calls
    const clients = event?.queryStringParameters?.mock ? getMockClients() : [];
    const leads = event?.queryStringParameters?.mock ? getMockLeads() : [];

    const now = new Date();

    // ── TRIAL EXPIRATION SCAN ─────────────────────────────
    for (const client of clients.filter(c => c.status === "Trial")) {
      if (!client.trial_end) continue;
      const trialEnd = new Date(client.trial_end);
      const daysLeft = Math.floor((trialEnd - now) / 864e5);

      if (daysLeft <= 3 && daysLeft >= 0) {
        const llm = await callLLM([
          {
            role: "system",
            content: `You are A_RET for XKSH808. Draft a short, warm upsell message for a trial client.
Output ONLY JSON: { "message": "..." }`,
          },
          {
            role: "user",
            content: `Client: ${client.name}, Business: ${client.business_name || "their business"}, Service: ${client.service_type}, Trial ends in ${daysLeft} days. Draft upgrade nudge.`,
          },
        ]);

        let draft = { message: `Hey ${client.name}, your trial ends in ${daysLeft} days — ready to upgrade?` };
        try { draft = JSON.parse(llm.content); } catch {}

        await AT.createTask({
          name: `[TRIAL EXPIRING] ${client.name} — ${daysLeft} day(s) left`,
          owner: "Xavier",
          due_date: trialEnd.toISOString(),
          status: "New",
          notes: `Auto by A_RET. Draft: "${draft.message}"`,
        });

        results.tasks_created.push(`Trial expiring: ${client.name} (${daysLeft}d)`);
        results.outreach_drafts.push({ client: client.name, type: "trial_expiry", message: draft.message });
      }
    }

    // ── INACTIVITY SCAN ───────────────────────────────────
    for (const client of clients.filter(c => c.status === "Active")) {
      const lastUpdate = new Date(client.updated_at || client.created_at || now);
      const daysSince = Math.floor((now - lastUpdate) / 864e5);

      if (daysSince > 14) {
        await AT.createTask({
          name: `[INACTIVE] ${client.name} — ${daysSince} days quiet`,
          owner: "Xavier",
          due_date: now.toISOString(),
          status: "New",
          notes: "Auto by A_RET. Consider re-engagement or upsell.",
        });
        results.tasks_created.push(`Inactive: ${client.name} (${daysSince}d)`);
      }
    }

    // ── STALLED LEAD SCAN ─────────────────────────────────
    for (const lead of leads.filter(l => ["New", "Scored", "Contacted"].includes(l.status))) {
      const created = new Date(lead.created_at || now);
      const daysOld = Math.floor((now - created) / 864e5);

      if (daysOld > 5) {
        await AT.createTask({
          name: `[STALLED] ${lead.name} — ${daysOld}d in "${lead.status}"`,
          owner: "Xavier",
          due_date: now.toISOString(),
          status: "New",
          notes: `Score: ${lead.score}. Channel: ${lead.source_channel}. Auto by A_RET.`,
        });
        results.tasks_created.push(`Stalled lead: ${lead.name}`);
      }
    }

    // ── UPDATE DASHBOARD ──────────────────────────────────
    await AT.updateDashboardStats({
      active_trials: clients.filter(c => c.status === "Trial").length,
      paid_clients: clients.filter(c => c.status === "Active" && c.payment_received).length,
    });

    return respond(200, results);

  } catch (err) {
    await MON.logIncident({
      type: "AGENT_RETENTION_ERROR",
      source: "agent-retention.js",
      message: err.message,
      severity: "error",
    });
    return respond(500, { error: err.message, partial_results: results });
  }
};

function getMockClients() {
  return [
    { id: "c1", name: "Kai Makoa", business_name: "Kai's Plumbing", status: "Trial", service_type: "Starter", trial_end: new Date(Date.now() + 2 * 864e5).toISOString(), payment_received: false, updated_at: new Date().toISOString() },
  ];
}
function getMockLeads() {
  return [
    { id: "l1", name: "Island Auto", status: "New", score: "Warm", source_channel: "TG", created_at: new Date(Date.now() - 7 * 864e5).toISOString() },
  ];
}

function respond(statusCode, body) {
  return { statusCode, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) };
}
