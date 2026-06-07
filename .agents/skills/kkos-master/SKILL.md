---
name: kkos-master
description: KKOS Master Control — audits automations, checks system health, wires agents together, and dispatches tasks across the XKSH808 pipeline. The single command center for the entire operation.
argument-hint: [command] — status | health | run [agent] | wire [from->to] | leads | sync
---

# KKOS MASTER CONTROL SKILL

The central nervous system for XKSH808. Runs on Groq llama-3.3-70b-versatile.

## Commands
- `status`     — Full system status: automations, agents, integrations
- `health`     — Ping all connected services (Groq, Gmail, GitHub, Telegram, Sheets)
- `leads`      — Pull current lead pipeline, score hot/warm/cold
- `run [agent]` — Manually trigger an agent (lead | sales | delivery | wealth)
- `wire`       — Show agent wiring map (who talks to who)
- `sync`       — Force sync leads → Google Sheets

## Agent Map
- LEAD ENGINE    → Scrapes, scores, queues leads
- SALES DESK     → Drafts + sends pitch emails via Gmail  
- DELIVERY QUEUE → Triggered only after payment confirmed (Zero-Trust Gate)
- WEALTH ENGINE  → Tracks revenue, MRR, payment events

## Zero-Trust Rule
Delivery workflow NEVER starts without PaymentEvent = Complete (human verified).
