/**
 * REVENUE AGENT 808 v2
 * Hybrid Loop: Sapiom Discovery → Claude Copy → Manual Site Build → Auto Follow-up
 * 
 * PIPELINE:
 * 1. Sapiom fetches lead's site + generates pain-point analysis
 * 2. Claude writes personalized cold email + subject line
 * 3. You build the landing page manually (90 min)
 * 4. Agent sends email with landing page link
 * 5. Telegram follow-up sequence (D+2, D+5)
 * 
 * SCALE TRIGGER: 5 closed deals → delegate builds to CTO.new
 */

import Groq from "groq-sdk";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// ─── SAPIOM CONFIG ────────────────────────────────────────────────────────────
const SAPIOM_API_KEY = process.env.SAPIOM_API_KEY;
const SAPIOM_DAILY_CAP = 50; // USD

// ─── LEAD PROFILES ────────────────────────────────────────────────────────────
const PHASE_1_LEADS = [
  {
    id: "6a22595e6aa031a0ef752a65",
    business_name: "Pipe Masters",
    location: "Honolulu, HI",
    industry: "Plumbing",
    search_query: "Pipe Masters plumbing Honolulu HI",
    pitch_angle: "SEO + emergency call capture — plumbers win on speed-to-rank",
    offer: "$499 Starter Pack",
  },
  {
    id: "6a22595e6aa031a0ef752a66",
    business_name: "Maid In Oahu",
    location: "Kailua, HI",
    industry: "Cleaning",
    search_query: "Maid In Oahu cleaning service Kailua Hawaii",
    pitch_angle: "Online booking + reputation — cleaning wins on trust signals",
    offer: "$499 Starter Pack",
  },
];

// ─── STEP 1: SAPIOM SCRAPE ────────────────────────────────────────────────────
async function sapiomScrape(lead) {
  console.log(`[SAPIOM] Scraping: ${lead.business_name}...`);

  // Search for the business
  const searchRes = await fetch("https://api.sapiom.com/v1/search", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${SAPIOM_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      query: lead.search_query,
      limit: 3,
    }),
  });

  if (!searchRes.ok) {
    throw new Error(`Sapiom search failed: ${searchRes.status}`);
  }

  const searchData = await searchRes.json();
  const topResult = searchData.results?.[0];

  if (!topResult?.url) {
    return { scraped: false, reason: "No URL found in search results" };
  }

  // Fetch the site content
  const fetchRes = await fetch("https://api.sapiom.com/v1/fetch", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${SAPIOM_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      url: topResult.url,
      extract: ["title", "description", "services", "contact", "reviews"],
    }),
  });

  if (!fetchRes.ok) {
    return { scraped: false, url: topResult.url, reason: "Fetch failed" };
  }

  const siteData = await fetchRes.json();

  return {
    scraped: true,
    url: topResult.url,
    title: siteData.title,
    description: siteData.description,
    services: siteData.services || [],
    contact: siteData.contact || {},
    reviews: siteData.reviews || [],
    raw: siteData,
  };
}

// ─── STEP 2: PAIN POINT ANALYSIS ─────────────────────────────────────────────
async function analyzePainPoints(lead, siteData) {
  console.log(`[GROQ] Analyzing pain points for ${lead.business_name}...`);

  const prompt = `You are a local business growth consultant in Hawaii.

Analyze this ${lead.industry} business and identify their top 3 digital pain points.

Business: ${lead.business_name}
Location: ${lead.location}
Website: ${siteData.url || "not found"}
Site Title: ${siteData.title || "N/A"}
Description: ${siteData.description || "N/A"}
Services Listed: ${JSON.stringify(siteData.services)}
Contact Info Found: ${JSON.stringify(siteData.contact)}
Reviews: ${JSON.stringify(siteData.reviews?.slice(0, 3))}

Pitch angle to focus on: ${lead.pitch_angle}

Return JSON only:
{
  "pain_points": ["pain 1", "pain 2", "pain 3"],
  "biggest_gap": "the single most urgent issue",
  "hook": "one sentence that would make the owner stop and read",
  "cta_angle": "what outcome to promise in the call-to-action"
}`;

  const completion = await groq.chat.completions.create({
    model: "llama3-70b-versatile",
    messages: [{ role: "user", content: prompt }],
    temperature: 0.4,
    response_format: { type: "json_object" },
  });

  return JSON.parse(completion.choices[0].message.content);
}

// ─── STEP 3: GENERATE COLD EMAIL ──────────────────────────────────────────────
async function generateColdEmail(lead, siteData, analysis) {
  console.log(`[GROQ] Writing cold email for ${lead.business_name}...`);

  const prompt = `You are Xavier, founder of XKSH808 — a local Hawaii web and SEO company.

Write a personalized cold email to the owner of ${lead.business_name} in ${lead.location}.

CONTEXT:
- Their site: ${siteData.url || "no site found"}
- Biggest gap: ${analysis.biggest_gap}
- Hook: ${analysis.hook}
- Offer: ${lead.offer} — ${lead.pitch_angle}
- CTA angle: ${analysis.cta_angle}

RULES:
- 4-6 sentences max. No fluff. No bullet points.
- Reference something specific about their business (use the hook).
- End with ONE clear ask (free audit or 15-min call).
- Sound like a real local person, not a corporation.
- Do NOT mention "AI" or "automation".

Return JSON only:
{
  "subject": "email subject line",
  "body": "full email body",
  "from_name": "Xavier | XKSH808",
  "estimated_read_time": "30 seconds"
}`;

  const completion = await groq.chat.completions.create({
    model: "llama3-70b-versatile",
    messages: [{ role: "user", content: prompt }],
    temperature: 0.6,
    response_format: { type: "json_object" },
  });

  return JSON.parse(completion.choices[0].message.content);
}

// ─── STEP 4: GENERATE LANDING PAGE BRIEF ─────────────────────────────────────
async function generateLandingPageBrief(lead, analysis) {
  console.log(`[BRIEF] Building site spec for ${lead.business_name}...`);

  return {
    headline: `Is ${lead.business_name} Losing Customers Online?`,
    subheadline: analysis.cta_angle,
    pain_points: analysis.pain_points,
    offer: lead.offer,
    cta_primary: "Get Your Free Audit",
    cta_secondary: "See What You're Missing",
    social_proof: "XKSH808 — Local Hawaii Web & SEO",
    color_scheme: lead.industry === "Plumbing" ? "navy + orange" : "teal + white",
    estimated_build_time: "90 minutes",
    deploy_to: "Netlify",
    // Once built, update lead record with landing_page_url
    // Then trigger sendOutreach() below
  };
}

// ─── STEP 5: SEND OUTREACH (called manually after site is built) ──────────────
async function sendOutreach(lead, email, landingPageUrl) {
  console.log(`[OUTREACH] Firing email to ${lead.business_name}...`);

  // Inject landing page link into email body
  const emailWithLink = {
    ...email,
    body: email.body + `\n\nI put together a quick look at what's possible for you here: ${landingPageUrl}`,
  };

  // TODO: Send via Gmail connector (OAuth authorized)
  // await gmailSend({ to: lead.email, subject: email.subject, body: emailWithLink.body });

  console.log(`[OUTREACH] Email ready to send:`);
  console.log(`TO: ${lead.email || "[ENRICH NEEDED]"}`);
  console.log(`SUBJECT: ${emailWithLink.subject}`);
  console.log(`BODY:\n${emailWithLink.body}`);

  return { queued: true, landing_page: landingPageUrl };
}

// ─── STEP 6: TELEGRAM FOLLOW-UP SEQUENCE ─────────────────────────────────────
function buildFollowUpSequence(lead) {
  return [
    {
      day: 0,
      message: `✅ Email sent to ${lead.business_name}. Landing page live. Watching for clicks.`,
      trigger: "immediate",
    },
    {
      day: 2,
      message: `📬 D+2 check-in: ${lead.business_name} — no response yet. Send SMS or call?`,
      trigger: "scheduled",
    },
    {
      day: 5,
      message: `🔥 D+5 final push: ${lead.business_name} — drop a voicemail. If no response, move to Cold.`,
      trigger: "scheduled",
    },
  ];
}

// ─── MAIN PIPELINE ────────────────────────────────────────────────────────────
export async function runPhase1Pipeline() {
  const results = [];

  for (const lead of PHASE_1_LEADS) {
    console.log(`\n${"=".repeat(50)}`);
    console.log(`PROCESSING: ${lead.business_name}`);
    console.log(`${"=".repeat(50)}`);

    try {
      // 1. Scrape
      const siteData = await sapiomScrape(lead);
      console.log(`[✅] Scraped: ${siteData.scraped} | URL: ${siteData.url}`);

      // 2. Analyze
      const analysis = await analyzePainPoints(lead, siteData);
      console.log(`[✅] Pain points: ${analysis.pain_points.join(", ")}`);

      // 3. Generate email
      const email = await generateColdEmail(lead, siteData, analysis);
      console.log(`[✅] Email subject: ${email.subject}`);

      // 4. Landing page brief (you build this manually)
      const brief = await generateLandingPageBrief(lead, analysis);
      console.log(`[✅] Site brief ready. Est. build: ${brief.estimated_build_time}`);

      // 5. Follow-up sequence
      const followUps = buildFollowUpSequence(lead);

      results.push({
        lead: lead.business_name,
        status: "READY_FOR_BUILD",
        site_url: siteData.url,
        email,
        brief,
        follow_ups: followUps,
        // Call sendOutreach(lead, email, landingPageUrl) after you build the site
      });

    } catch (err) {
      console.error(`[ERROR] ${lead.business_name}: ${err.message}`);
      results.push({ lead: lead.business_name, status: "ERROR", error: err.message });
    }
  }

  return results;
}

// ─── SCALE TRIGGER ─────────────────────────────────────────────────────────────
// When closedDeals >= 5, switch to CTO.new for automated builds
export function checkScaleTrigger(closedDeals) {
  if (closedDeals >= 5) {
    console.log("🚀 SCALE TRIGGER HIT — Delegate builds to CTO.new, go full autonomous");
    return { delegate_builds: true, mode: "FULL_AUTO" };
  }
  return { delegate_builds: false, mode: "HYBRID", remaining: 5 - closedDeals };
}
