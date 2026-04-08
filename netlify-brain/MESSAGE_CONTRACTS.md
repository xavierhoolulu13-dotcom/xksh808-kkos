# KKOS Message Contracts — L0 → L1 → L2

## L0 → ROUTER (inbound_message)
```json
{
  "type": "inbound_message",
  "platform": "TG | WA | IG | SITE",
  "sender": "string",
  "message": "string",
  "timestamp": "ISO8601"
}
```

## ROUTER → A_LEAD
```json
{
  "message": "string",
  "channel": "string",
  "channelPlatform": "TG | WA | IG | SITE | OTHER"
}
```

## A_LEAD → A_SALES (escalation)
```json
{
  "lead_id": "string",
  "score": "Hot | Warm | Cold",
  "urgency": 1-5,
  "lead_data": { ...Lead fields },
  "escalate_to_sales": true
}
```

## A_SALES → Anytype
Creates:
- Client: { name, email, business_name, service_type, status="Trial", primary_channel }
- Offer: { name, type, tier, price, status="Active", delivery_mode }
- PaymentEvent: { date, amount, method, status="New"→"Pending", reference_id }

## HUMAN → Anytype (Zero-Trust Gate)
```
PaymentEvent.status: "Pending" → "Complete"
Only performed manually in Anytype Mission Control.
```

## Anytype (PaymentEvent.status=Complete) → A_DELIV
```json
{
  "type": "payment_complete",
  "payment_event_id": "string",
  "client_id": "string",
  "offer_id": "string"
}
```

## A_RET → Anytype (Tasks)
```json
{
  "name": "string",
  "owner": "Xavier",
  "due_date": "ISO8601",
  "status": "New",
  "notes": "string"
}
```

## A_MON → Anytype (Log)
```json
{
  "name": "string",
  "type": "Log",
  "source": "Other",
  "summary": "string",
  "status": "Active"
}
```

## Zero-Trust State Machine
```
PaymentEvent.status:
NEW ──(A_SALES)──► PENDING ──(HUMAN ONLY)──► COMPLETE ──(A_DELIV)──► [delivery runs]
                                                         └──(optional)──► REFUNDED
```
