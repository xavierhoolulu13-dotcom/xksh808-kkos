// ============================================================
// ANYTYPE CLIENT — HTTP Abstraction Layer
// Source of Truth: All reads/writes go through here
// ============================================================

const BASE_URL = process.env.ANYTYPE_API_URL || "http://localhost:31009";
const APP_KEY = process.env.ANYTYPE_APP_KEY || "";

async function anytypeRequest(method, path, body = null) {
  const opts = {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(APP_KEY ? { Authorization: `Bearer ${APP_KEY}` } : {}),
    },
  };
  if (body) opts.body = JSON.stringify(body);

  const res = await fetch(`${BASE_URL}${path}`, opts);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`[AnytypeClient] ${method} ${path} → ${res.status}: ${text}`);
  }
  return res.json();
}

// ── LEAD ──────────────────────────────────────────────────
async function createLead(data) {
  return anytypeRequest("POST", "/object/lead", data);
}
async function updateLead(id, data) {
  return anytypeRequest("PATCH", `/object/lead/${id}`, data);
}

// ── CLIENT ────────────────────────────────────────────────
async function createClient(data) {
  return anytypeRequest("POST", "/object/client", data);
}
async function updateClient(id, data) {
  return anytypeRequest("PATCH", `/object/client/${id}`, data);
}

// ── OFFER / LICENSE ───────────────────────────────────────
async function createOffer(data) {
  return anytypeRequest("POST", "/object/offer", data);
}
async function updateOffer(id, data) {
  return anytypeRequest("PATCH", `/object/offer/${id}`, data);
}

// ── PAYMENT EVENT ─────────────────────────────────────────
async function createPaymentEvent(data) {
  // Zero-Trust: always starts as NEW, never Complete
  return anytypeRequest("POST", "/object/payment_event", {
    ...data,
    status: "New",
  });
}
async function updatePaymentEvent(id, data) {
  // Guard: agents may not set status=Complete
  if (data.status === "Complete") {
    throw new Error("[ZeroTrust] Agents cannot set PaymentEvent.status=Complete. Human action required.");
  }
  return anytypeRequest("PATCH", `/object/payment_event/${id}`, data);
}
async function getPaymentEvent(id) {
  return anytypeRequest("GET", `/object/payment_event/${id}`);
}

// ── WORKFLOW ──────────────────────────────────────────────
async function createWorkflow(data) {
  return anytypeRequest("POST", "/object/workflow", data);
}
async function updateWorkflow(id, data) {
  return anytypeRequest("PATCH", `/object/workflow/${id}`, data);
}

// ── TASK ──────────────────────────────────────────────────
async function createTask(data) {
  return anytypeRequest("POST", "/object/task", data);
}

// ── DASHBOARD ─────────────────────────────────────────────
async function updateDashboardStats(data) {
  return anytypeRequest("POST", "/object/dashboard/update", data);
}

// ── CHANNEL ───────────────────────────────────────────────
async function getChannel(platform) {
  return anytypeRequest("GET", `/object/channel?platform=${platform}`);
}

// ── SPEC / LOG ────────────────────────────────────────────
async function createLog(data) {
  return anytypeRequest("POST", "/object/spec", {
    ...data,
    type: "Log",
  });
}

module.exports = {
  createLead, updateLead,
  createClient, updateClient,
  createOffer, updateOffer,
  createPaymentEvent, updatePaymentEvent, getPaymentEvent,
  createWorkflow, updateWorkflow,
  createTask,
  updateDashboardStats,
  getChannel,
  createLog,
};
