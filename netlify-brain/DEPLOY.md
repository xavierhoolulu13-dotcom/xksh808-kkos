# KKOS Netlify Brain — Full Deployment Guide

## File Structure
```
netlify-brain/
├── netlify/
│   └── functions/
│       ├── router.js            ← L0 channel router (TG/WA/Sites)
│       ├── agent-lead.js        ← A_LEAD: score + save leads
│       ├── agent-sales.js       ← A_SALES: qualify + create client/offer/payment
│       ├── agent-delivery.js    ← A_DELIV: delivery (Zero-Trust gated)
│       ├── agent-retention.js   ← A_RET: daily scan (trials, upsells, stalls)
│       └── agent-monitor.js     ← A_MON: central log + dashboard stats
├── agents/
│   ├── A_LEAD.js
│   ├── A_SALES.js
│   ├── A_DELIV.js
│   ├── A_RET.js
│   └── A_MON.js
├── lib/
│   ├── groqRouter.js            ← Groq LLM with fallbacks
│   └── anytypeClient.js         ← Anytype HTTP abstraction
├── netlify.toml
├── MESSAGE_CONTRACTS.md
└── DEPLOY.md
```

---

## Step 1 — Prerequisites
- Node.js 18+
- Netlify account (free tier works)
- Netlify CLI: `npm install -g netlify-cli`
- Groq API key: https://console.groq.com

## Step 2 — Install
```bash
cd netlify-brain
npm init -y
npm install node-fetch
```

## Step 3 — Environment Variables
Set these in Netlify Dashboard → Site → Environment Variables:

| Variable | Value |
|---|---|
| GROQ_API_KEY | your Groq key |
| TELEGRAM_BOT_TOKEN | from @BotFather |
| WHATSAPP_API_KEY | Meta Cloud API key |
| ANYTYPE_API_URL | http://localhost:31009 or your bridge URL |
| ANYTYPE_APP_KEY | optional Anytype auth key |
| NETLIFY_URL | https://your-site.netlify.app |

## Step 4 — Deploy
```bash
netlify login
netlify init          # link to your Netlify site
netlify deploy --prod
```

## Step 5 — Wire Webhooks
After deploy, your base URL is: `https://your-site.netlify.app`

### Telegram
```bash
curl "https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://your-site.netlify.app/.netlify/functions/router"
```

### WhatsApp (Meta)
- Go to Meta Developer Console → Webhooks
- Set callback URL: `https://your-site.netlify.app/.netlify/functions/router`
- Subscribe to: `messages`

### Google Sites Widget
- Point widget POST to: `https://your-site.netlify.app/.netlify/functions/router`
- Payload: `{ "channel": "SITE", "user_id": "...", "message": "..." }`

## Step 6 — Test Full Pipeline
```bash
# Test lead intake (Telegram format)
curl -X POST https://your-site.netlify.app/.netlify/functions/router \
  -H "Content-Type: application/json" \
  -d '{"update_id":1,"message":{"from":{"id":12345},"chat":{"id":12345},"text":"I need a website for my plumbing business ASAP"}}'

# Test manual delivery trigger (after human sets PaymentEvent=Complete in Anytype)
curl -X POST https://your-site.netlify.app/.netlify/functions/agent-delivery \
  -H "Content-Type: application/json" \
  -d '{"payment_event_id":"PAY123","client_id":"CLI456","offer_id":"OFF789"}'

# Test retention scan
curl -X POST https://your-site.netlify.app/.netlify/functions/agent-retention \
  -H "Content-Type: application/json" \
  -d '{"mock":"true"}'
```

## Step 7 — Schedule Retention + Monitor
In netlify.toml, add scheduled functions:
```toml
[functions."agent-retention"]
  schedule = "0 18 * * *"   # 8am HST daily

[functions."agent-monitor"]
  schedule = "0 */6 * * *"  # every 6 hours
```

---

## Endpoints

| Endpoint | Method | Purpose |
|---|---|---|
| /.netlify/functions/router | POST | Main channel router (TG/WA/Sites) |
| /.netlify/functions/agent-lead | POST | Score + save new lead |
| /.netlify/functions/agent-sales | POST | Qualify + client/offer/payment |
| /.netlify/functions/agent-delivery | POST | Delivery (Zero-Trust gated) |
| /.netlify/functions/agent-retention | POST | Daily retention scan |
| /.netlify/functions/agent-monitor | POST | Central error/metric logging |

---

## Zero-Trust Money Path

```
A_SALES creates PaymentEvent → status="Pending"
         ↓
External payment (Cash App / Stripe / PayPal)
         ↓
YOU verify funds manually
         ↓
YOU set PaymentEvent.status = "Complete" in Anytype
         ↓
POST to /agent-delivery with payment_event_id + client_id + offer_id
         ↓
A_DELIV verifies status=Complete → initiates delivery
```

⚠️ NO AGENT CAN SET PaymentEvent.status = "Complete". EVER.
