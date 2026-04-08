// ============================================================
// RETENTION FUNCTION — Scheduled daily via Netlify
// Calls A_RET with current Clients + Leads from Anytype
// ============================================================

const RET = require("../../agents/A_RET");
const MON = require("../../agents/A_MON");

exports.handler = async () => {
  try {
    // In production: fetch clients + leads from Anytype API
    // Stubbed here for portability
    const clients = []; // await AT.listClients()
    const leads = [];   // await AT.listLeads()

    const result = await RET.run({ clients, leads });

    return {
      statusCode: 200,
      body: JSON.stringify(result),
    };
  } catch (err) {
    await MON.logIncident({
      type: "RETENTION_CRON_FAILED",
      source: "retention.js",
      message: err.message,
      severity: "error",
    });
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
