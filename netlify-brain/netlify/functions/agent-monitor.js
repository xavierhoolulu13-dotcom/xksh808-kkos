// ============================================================
// /functions/agent-monitor — A_MON: Monitoring Agent
// Central logging endpoint — all other functions POST errors here
// Writes logs to Anytype (Spec/Asset type=Log)
// Updates Dashboard Header Stats + Wealth Stream
// ============================================================

const AT = require("../../lib/anytypeClient");

exports.handler = async (event) => {
  let body;
  try {
    body = JSON.parse(event.body || "{}");
  } catch {
    return respond(400, { error: "Invalid JSON" });
  }

  const {
    type = "GENERIC",
    source = "unknown",
    message = "",
    severity = "info",
    metrics = null,
    dashboard_update = null,
  } = body;

  const logged = [];
  const errors = [];

  try {
    // 1. Write incident log to Anytype
    if (message) {
      try {
        await AT.createLog({
          name: `[${severity.toUpperCase()}][${type}] ${source}`,
          type: "Log",
          source: "Other",
          summary: `${message} | ${new Date().toISOString()}`,
          status: "Active",
          url_file_ref: "",
        });
        logged.push({ type, source, severity });
      } catch (e) {
        errors.push(`Failed to write log: ${e.message}`);
      }
    }

    // 2. Update dashboard stats if provided
    if (dashboard_update) {
      try {
        await AT.updateDashboardStats({
          ...dashboard_update,
          updated_at: new Date().toISOString(),
        });
        logged.push({ action: "dashboard_updated", fields: Object.keys(dashboard_update) });
      } catch (e) {
        errors.push(`Dashboard update failed: ${e.message}`);
      }
    }

    // 3. Metrics health checks
    if (metrics) {
      const alerts = [];

      if (metrics.llm_latency_ms > 8000) {
        alerts.push(`High LLM latency: ${metrics.llm_latency_ms}ms`);
      }
      if (metrics.anytype_reachable === false) {
        alerts.push("Anytype unreachable");
      }
      if (metrics.error_rate > 0.1) {
        alerts.push(`High error rate: ${(metrics.error_rate * 100).toFixed(1)}%`);
      }

      if (alerts.length) {
        try {
          await AT.createLog({
            name: `[ALERT] System Health`,
            type: "Log",
            source: "Other",
            summary: alerts.join(" | "),
            status: "Active",
          });
        } catch (e) {
          errors.push(`Alert log failed: ${e.message}`);
        }
      }

      logged.push({ action: "health_check", alerts });
    }

    return respond(200, {
      agent: "A_MON",
      logged,
      errors: errors.length ? errors : undefined,
      timestamp: new Date().toISOString(),
    });

  } catch (err) {
    // Last resort — can't log to Anytype, just return error
    console.error("[A_MON] Critical failure:", err.message);
    return respond(500, { error: err.message });
  }
};

function respond(statusCode, body) {
  return { statusCode, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) };
}
