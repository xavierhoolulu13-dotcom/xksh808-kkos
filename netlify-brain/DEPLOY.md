# KKOS Netlify Brain — Deployment Guide

## Step 1 — Prerequisites
- Node.js 18+
- Netlify CLI: `npm install -g netlify-cli`
- Groq API key from console.groq.com
- Anytype running locally (port 31009) or via HTTP bridge

## Step 2 — Install dependencies
```bash
cd netlify-brain
npm init -y
npm install node-fetch
```

## Step 3 — Set environment variables in Netlify dashboard
```
GROQ_API_KEY=your_groq_key_here
ANYTYPE_API_URL=http://localhost:31009
ANYTYPE_APP_KEY=your_anytype_key_if_needed
```

## Step 4 — Deploy to Netlify
```bash
netlify login
netlify init
netlify deploy --prod
```

## Step 5 — Set webhook endpoints in each channel
- **Telegram**: Set webhook to `https://your-site.netlify.app/.netlify/functions/router`
- **WhatsApp**: Point webhook to same URL with platform=WA
- **Google Sites widget**: POST to router with platform=SITE
- **Instagram/FB**: Meta webhook → router with platform=IG

## Step 6 — Test the pipeline
```bash
curl -X POST https://your-site.netlify.app/.netlify/functions/router \
  -H "Content-Type: application/json" \
  -d '{"type":"inbound_message","platform":"TG","sender":"TestUser","message":"I need a website for my plumbing business ASAP"}'
```

## Step 7 — Wire A_DELIV trigger
When you verify payment in Anytype and set PaymentEvent.status = "Complete":
```bash
curl -X POST https://your-site.netlify.app/.netlify/functions/router \
  -H "Content-Type: application/json" \
  -d '{"type":"payment_complete","payment_event_id":"xxx","client_id":"yyy","offer_id":"zzz"}'
```

## Endpoints
| Endpoint | Method | Purpose |
|---|---|---|
| /.netlify/functions/router | POST | Main channel router |
| /.netlify/functions/retention | POST/GET | Daily A_RET scan |

## Zero-Trust Reminder
**NEVER** automate PaymentEvent.status → "Complete". 
That field is human-only in Anytype Mission Control.
