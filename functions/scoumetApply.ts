import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

/**
 * SCØUMET Apply Engine — Browser Use powered
 * 
 * Actions:
 *   - apply: Launch Browser Use agent to apply to a focus group opportunity
 *   - scan:  Scout legit focus group platforms for new sports opportunities
 *   - status: Get status of a running Browser Use session
 */

const BROWSER_USE_API_KEY = Deno.env.get('BROWSER_USE_API_KEY');
const BROWSER_USE_BASE = 'https://api.browser-use.com/api/v1';

async function browserUseRun(task: string, sessionId?: string) {
  const body: Record<string, unknown> = { task };
  if (sessionId) body.session_id = sessionId;

  const res = await fetch(`${BROWSER_USE_BASE}/run-task`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${BROWSER_USE_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Browser Use API error: ${res.status} — ${err}`);
  }
  return res.json();
}

async function browserUseCreateSession() {
  const res = await fetch(`${BROWSER_USE_BASE}/sessions`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${BROWSER_USE_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({}),
  });
  if (!res.ok) throw new Error(`Session create failed: ${res.status}`);
  return res.json();
}

async function browserUseGetTask(taskId: string) {
  const res = await fetch(`${BROWSER_USE_BASE}/task/${taskId}`, {
    headers: { 'Authorization': `Bearer ${BROWSER_USE_API_KEY}` },
  });
  if (!res.ok) throw new Error(`Get task failed: ${res.status}`);
  return res.json();
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const { action, opportunityId, taskId, sessionId } = body;

    // ── SCAN: Scout legit platforms for sports focus groups ──
    if (action === 'scan') {
      const task = `
        You are a research assistant scouting for PAID focus group and research study opportunities.
        Search these legitimate platforms for SPORTS-related studies:
        1. Go to https://app.respondent.io/respondents/studies and list any sports-related studies
        2. Go to https://www.usertesting.com/get-paid-to-test and check for sports app tests
        3. Go to https://www.focusgroup.com and search for sports studies
        
        For each opportunity found, extract:
        - title
        - platform name  
        - direct URL
        - pay rate
        - estimated duration
        - brief description
        
        Return results as a JSON array. Only include REAL opportunities you actually find on the pages.
        DO NOT include Apex Focus Group or similar scam sites.
      `;

      const result = await browserUseRun(task);
      return Response.json({ 
        ok: true, 
        action: 'scan',
        task_id: result.id || result.task_id,
        live_url: result.live_url,
        status: result.status,
        message: 'Scan started — check status with action=status&taskId=...'
      });
    }

    // ── STATUS: Check a running task ──
    if (action === 'status') {
      if (!taskId) return Response.json({ error: 'taskId required' }, { status: 400 });
      const result = await browserUseGetTask(taskId);
      return Response.json({ ok: true, ...result });
    }

    // ── APPLY: Auto-apply to an approved opportunity ──
    if (action === 'apply') {
      if (!opportunityId) return Response.json({ error: 'opportunityId required' }, { status: 400 });

      // Fetch the opportunity record
      const opp = await base44.asServiceRole.entities.FocusGroupOpportunity.get(opportunityId);
      if (!opp) return Response.json({ error: 'Opportunity not found' }, { status: 404 });
      if (opp.status !== 'approved') return Response.json({ error: 'Opportunity not approved' }, { status: 400 });

      // Create a persistent session so we can hand control to Xavier for login/captcha
      const session = await browserUseCreateSession();
      const liveUrl = session.live_url;

      // Build the application task
      const applyTask = `
        You are applying to a paid research study for Xavier, a Hawaii-based web professional.
        
        Platform: ${opp.platform}
        Study: ${opp.title}
        URL: ${opp.url}
        Category: ${opp.category}
        
        Steps:
        1. Navigate to ${opp.url}
        2. Find the registration or application form
        3. Fill in the participant profile:
           - Interests/Category: Sports (casual viewer and die-hard fan)
           - Location: Hawaii, USA
           - Device: Smartphone with camera, reliable internet
           - Availability: Flexible, remote preferred
        4. If you reach a login/account creation step — STOP and output "HUMAN_LOGIN_REQUIRED" 
        5. If you hit a CAPTCHA — STOP and output "CAPTCHA_REQUIRED"
        6. If the form is complete and ready to submit — output "READY_TO_SUBMIT" and wait
        7. Otherwise complete the submission and output "SUBMITTED"
        
        At each step, describe exactly what you did and what you see.
      `;

      // Start the task on the persistent session
      const taskResult = await browserUseRun(applyTask, session.id);

      // Update the opportunity with session tracking info
      await base44.asServiceRole.entities.FocusGroupOpportunity.update(opportunityId, {
        notes: JSON.stringify({ 
          session_id: session.id, 
          task_id: taskResult.id || taskResult.task_id,
          live_url: liveUrl,
          started_at: new Date().toISOString()
        }),
        status: 'applied',
        applied_at: new Date().toISOString(),
      });

      return Response.json({
        ok: true,
        action: 'apply',
        opportunity: opp.title,
        platform: opp.platform,
        session_id: session.id,
        task_id: taskResult.id || taskResult.task_id,
        live_url: liveUrl,
        message: `Browser Use agent started. Watch live at: ${liveUrl}. If login/captcha needed, you'll be prompted.`,
      });
    }

    return Response.json({ error: 'Invalid action. Use: scan | apply | status' }, { status: 400 });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
