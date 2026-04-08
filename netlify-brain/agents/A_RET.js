// ============================================================
// A_RET — Retention Agent
// Runs daily. Scans Clients + Leads for:
//   - Trial expirations
//   - Inactive clients
//   - Upsell opportunities
// Creates Tasks in Anytype. Optionally drafts outreach.
// ============================================================

const { callLLM } = require("../lib/groqRouter");
const AT = require("../lib/anytypeClient");

async function run({ clients = [], leads = [] }) {
  const tasks = [];
  const outreachDrafts = [];
  const now = new Date();

  // ── TRIAL EXPIRATION CHECK ────────────────────────────────
  for (const client of clients) {
    if (client.status === "Trial" && client.trial_end) {
      const trialEnd = new Date(client.trial_end);
      const daysLeft = Math.floor((trialEnd - now) / (1000 * 60 * 60 * 24));

      if (daysLeft <= 3 && daysLeft >= 0) {
        // Draft upsell message
        const llm = await callLLM([
          {
            role: "system",
            content: "You are A_RET, the Retention Agent for XKSH808. Draft a short, friendly upsell message for a client whose trial ends soon. Output JSON: { message }",
          },
          {
            role: "user",
            content: `Client: ${client.name}, Business: ${client.business_name}, Trial ends in ${daysLeft} days. Service: ${client.service_type}. Draft upgrade message.`,
          },
        ]);

        let draft;
        try {
          draft = JSON.parse(llm.content);
        } catch {
          draft = { message: `Hey ${client.name}, your trial ends in ${daysLeft} days. Ready to upgrade?` };
        }

        outreachDrafts.push({ client_id: client.id, message: draft.message, type: "trial_expiry" });

        await AT.createTask({
          name: `[TRIAL EXPIRING] ${client.name} — ${daysLeft} days left`,
          owner: "Xavier",
          due_date: trialEnd.toISOString(),
          status: "New",
          notes: `Auto-flagged by A_RET. Draft message ready.`,
        });

        tasks.push(`Trial expiring: ${client.name}`);
      }
    }

    // ── INACTIVITY CHECK ────────────────────────────────────
    if (client.status === "Active" && client.updated_at) {
      const lastUpdate = new Date(client.updated_at);
      const daysSinceUpdate = Math.floor((now - lastUpdate) / (1000 * 60 * 60 * 24));

      if (daysSinceUpdate > 14) {
        await AT.createTask({
          name: `[INACTIVE] ${client.name} — ${daysSinceUpdate} days no activity`,
          owner: "Xavier",
          due_date: now.toISOString(),
          status: "New",
          notes: "Auto-flagged by A_RET. Consider re-engagement.",
        });
        tasks.push(`Inactive client: ${client.name}`);
      }
    }
  }

  // ── LEAD STALL CHECK ─────────────────────────────────────
  for (const lead of leads) {
    if (["New", "Scored", "Contacted"].includes(lead.status) && lead.created_at) {
      const created = new Date(lead.created_at);
      const daysOld = Math.floor((now - created) / (1000 * 60 * 60 * 24));

      if (daysOld > 5) {
        await AT.createTask({
          name: `[STALLED LEAD] ${lead.name} — ${daysOld} days in "${lead.status}"`,
          owner: "Xavier",
          due_date: now.toISOString(),
          status: "New",
          notes: `Score: ${lead.score}. Source: ${lead.source_channel}. Auto-flagged by A_RET.`,
        });
        tasks.push(`Stalled lead: ${lead.name}`);
      }
    }
  }

  return {
    agent: "A_RET",
    tasks_created: tasks.length,
    tasks,
    outreach_drafts: outreachDrafts,
  };
}

module.exports = { run };
