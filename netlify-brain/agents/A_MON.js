// ============================================================
// A_MON — Monitoring Agent
// Monitors: LLM errors, API failures, missing data, latencies
// Logs incidents to Anytype (Spec / Log type)
// Updates Header Stats + Wealth Stream
// ============================================================

const AT = require("../lib/anytypeClient");

const incidents = [];

async function logIncident({ type, source, message, severity = "warn" }) {
  const incident = {
    timestamp: new Date().toISOString(),
    type,
    source,
    message,
    severity,
  };

  incidents.push(incident);
  console.error(`[A_MON][${severity.toUpperCase()}] ${source}: ${message}`);

  try {
    await AT.createLog({
      name: `[${type}] ${source}`,
      type: "Log",
      source: "Other",
      summary: message,
      status: "Active",
      url_file_ref: "",
    });
  } catch (e) {
    console.error("[A_MON] Failed to write log to Anytype:", e.message);
  }

  return incident;
}

async function updateStats({ clients = [], paymentEvents = [], workflows = [] }) {
  try {
    const activeTrials = clients.filter(c => c.status === "Trial").length;
    const paidClients = clients.filter(c => c.status === "Active" && c.payment_received).length;
    const deliverablesRunning = workflows.filter(w => w.status === "Running").length;
    const mrr = paymentEvents
      .filter(p => p.status === "Complete")
      .reduce((sum, p) => sum + (p.amount || 0), 0);

    await AT.updateDashboardStats({
      active_trials: activeTrials,
      paid_clients: paidClients,
      deliverables_running: deliverablesRunning,
      mrr,
      updated_at: new Date().toISOString(),
    });

    return { activeTrials, paidClients, deliverablesRunning, mrr };
  } catch (e) {
    await logIncident({
      type: "DASHBOARD_UPDATE_FAILED",
      source: "A_MON",
      message: e.message,
      severity: "error",
    });
  }
}

async function checkSystemHealth({ llmLatencyMs = 0, anytypeReachable = true }) {
  const alerts = [];

  if (llmLatencyMs > 8000) {
    await logIncident({
      type: "HIGH_LLM_LATENCY",
      source: "Groq",
      message: `LLM response took ${llmLatencyMs}ms`,
      severity: "warn",
    });
    alerts.push("High LLM latency");
  }

  if (!anytypeReachable) {
    await logIncident({
      type: "ANYTYPE_UNREACHABLE",
      source: "AnytypeClient",
      message: "Anytype API did not respond",
      severity: "critical",
    });
    alerts.push("Anytype unreachable");
  }

  return { agent: "A_MON", alerts, incidents_logged: incidents.length };
}

module.exports = { logIncident, updateStats, checkSystemHealth };
