# VOID-HEADLESS
## XKSH808 KKOS — Sovereign Agent Runtime

RSIS808 ANYCOM AI — TG + WA + Discord unified pipeline.

---

## SETUP

1. Copy .env.example → .env
2. Fill in your tokens
3. npm install
4. npm run start

---

## TOKENS YOU NEED

| Token | Where to get it |
|---|---|
| TG_BOT_TOKEN | @BotFather on Telegram |
| DISCORD_BOT_TOKEN | discord.com/developers |
| WA_PHONE_NUMBER_ID | Meta Business → WhatsApp API |
| WA_ACCESS_TOKEN | Meta Business → WhatsApp API |
| OPENAI_API_KEY | platform.openai.com |
| OPERATOR_CHAT_ID | Your Telegram chat ID — message @userinfobot |

---

## ARCHITECTURE

```
[TG] [WA] [Discord]
      ↓
  RSIS808 Router
  (intent classify)
      ↓
  ┌─────────────┐
  │ AMANDA      │ ← general + support
  │ A_LEAD      │ ← lead qualification
  │ ARC         │ ← operator commands
  └─────────────┘
      ↓
  Actuator Engine
  (reply + log + alert)
```

---

## AGENT ROLES

- *AMANDA* — Public client-facing agent. Warm, closes leads.
- *A_LEAD* — Qualifies inbound leads. Scores Hot/Warm/Cold.
- *ARC* — Operator command layer. Xavier only.
- *RSIS808* — Error daemon. Blocks spam. Alerts operator.

---

Built by XKSH808 · Honolulu, Hawaii 🌺
