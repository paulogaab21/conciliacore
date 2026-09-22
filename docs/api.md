# HTTP contracts

This document describes the HTTP behavior implemented by the current codebase. It separates the authenticated management API from the public payment webhook because they expose different error details and trust different callers.

## Conventions

- All request and response bodies are JSON unless stated otherwise.
- Authenticated routes derive the organization and role from the server-side session. They never accept `organizationId` from the client.
- Timestamps returned by the API use ISO 8601 strings in UTC.
- Monetary values use integer cents.
- Unsupported methods are handled by Next.js with `405 Method Not Allowed`.
- Route handlers are dynamic and are not cached.

### Management API errors

Known management API errors use one stable envelope:

```json
{
  "error": "Human-readable description",
  "code": "ERROR_CODE"
}
```

Malformed JSON returns `400` with `INVALID_JSON`. Schema failures return `400` with `VALIDATION_ERROR` and a `details` array containing Zod issues. Unexpected failures return `500` with `INTERNAL_ERROR`; internal exception details are not sent to the caller.

Common authorization responses:

| Status | Code | Meaning |
| --- | --- | --- |
| `401` | `UNAUTHORIZED` | no valid session |
| `403` | `FORBIDDEN` | authenticated role cannot perform the operation |
| `404` | `NOT_FOUND` | the resource does not exist in the caller's organization |

## Session

The session is stored in the `conciliacore_session` cookie. It is `HttpOnly`, `SameSite=Lax`, valid for eight hours, and receives the `Secure` flag when `NEXT_PUBLIC_APP_URL` uses HTTPS. The token contains only the user ID; role and organization membership are reloaded from PostgreSQL on each validated request.

### `POST /api/auth/login`

Request:

```json
{
  "email": "admin@conciliacore.dev",
  "password": "Demo@123"
}
```

Constraints:

- `email` must be valid and is normalized to lowercase;
- `password` must contain between 8 and 128 characters.

Success — `200`:

```json
{
  "ok": true,
  "redirectTo": "/app"
}
```

Invalid credentials return `401` with `INVALID_CREDENTIALS`. The response is intentionally identical for an unknown email and an incorrect password.

### `POST /api/auth/logout`

Expires the session cookie. If a valid session exists, the action is recorded in the audit log.

Success — `200`:

```json
{ "ok": true }
```

## Management routes

| Method | Route | Authorization | Purpose |
| --- | --- | --- | --- |
| `GET` | `/api/dashboard` | authenticated | operational snapshot for the current organization |
| `GET` | `/api/cases` | authenticated | filtered exception queue |
| `GET` | `/api/cases/:id` | authenticated | one exception from the current organization |
| `PATCH` | `/api/cases/:id` | administrator or analyst | change status or ownership |
| `POST` | `/api/cases/:id/resolve` | administrator or analyst | record a manual resolution |
| `POST` | `/api/reconciliation/run` | administrator or analyst | run reconciliation synchronously |

Every identifier lookup includes the session's `organizationId` before data is returned or changed.

### `GET /api/dashboard`

Returns one bounded operational snapshot:

```json
{
  "organization": {},
  "session": {},
  "metrics": {},
  "dailyVolume": [],
  "providerBreakdown": [],
  "cases": [],
  "payments": [],
  "orders": [],
  "auditLogs": [],
  "latestRun": null
}
```

The response contains seven days of volume, at most 20 recent cases, 12 payments, 12 orders, 12 audit entries, and the latest reconciliation run. `latestRun` is `null` before the first run.

### `GET /api/cases`

Optional query parameters are validated. Unknown enum values return `400` with `VALIDATION_ERROR` rather than being silently ignored.

| Parameter | Allowed values |
| --- | --- |
| `status` | `OPEN`, `IN_REVIEW`, `RESOLVED`, `DISMISSED` |
| `severity` | `LOW`, `MEDIUM`, `HIGH`, `CRITICAL` |
| `type` | `UNMATCHED_PAYMENT`, `AMOUNT_MISMATCH`, `DUPLICATE_PAYMENT`, `ORDER_STATUS_MISMATCH`, `REFUND_MISMATCH`, `MISSING_PAYMENT` |

Success — `200`:

```json
{ "cases": [] }
```

### `GET /api/cases/:id`

Success — `200`:

```json
{ "case": {} }
```

Returns `404` with `NOT_FOUND` when the identifier does not belong to the caller's organization.

### `PATCH /api/cases/:id`

At least one field is required:

```json
{
  "status": "IN_REVIEW",
  "assignedToId": "user-id"
}
```

- `status` accepts `OPEN`, `IN_REVIEW`, or `DISMISSED`. Manual resolution uses the dedicated endpoint.
- `assignedToId` accepts a user ID from the same organization or `null` to remove ownership.

Success — `200`:

```json
{ "case": {} }
```

An assignee outside the current organization returns `400` with `INVALID_ASSIGNEE`.

### `POST /api/cases/:id/resolve`

Request:

```json
{
  "resolution": "Payment confirmed with the provider and order status corrected."
}
```

The trimmed explanation must contain between 10 and 500 characters. The case update and its audit entry commit in the same database transaction.

Success — `200`:

```json
{ "case": {} }
```

### `POST /api/reconciliation/run`

Runs the deterministic reconciliation engine for the caller's organization. This operation is synchronous from the management API perspective.

Success — `200`:

```json
{ "run": {} }
```

## Payment webhook

### `POST /api/webhooks/payments/:organizationSlug`

This route is public and does not use the session cookie. It returns deliberately small error bodies and records safe delivery diagnostics internally.

Headers:

| Header | Required | Contract |
| --- | :---: | --- |
| `Content-Type: application/json` | no | recommended; the implementation validates the raw body as JSON regardless of this header |
| `X-ConciliaCore-Timestamp` | yes | Unix seconds within five minutes of server time |
| `X-ConciliaCore-Signature` | yes | `sha256=<hexadecimal HMAC>`; the prefix is optional |
| `X-Payment-Provider` | no | 2–32 letters, digits, `_`, or `-`; normalized to lowercase, otherwise `custom` |
| `X-Delivery-Id` | no | delivery trace identifier; a server-generated value is used when absent |
| `X-Event-Type` | no | diagnostic value used only when a request fails before payload validation |

The canonical signed input is:

```text
<timestamp>.<normalized-provider>.<raw-body>
```

Example payload:

```json
{
  "event_id": "evt-123",
  "type": "payment.confirmed",
  "transaction_id": "tx-987",
  "order_id": "ORD-1048",
  "amount_cents": 18990,
  "currency": "BRL",
  "occurred_at": "2026-09-20T15:30:00.000Z"
}
```

Field constraints:

| Field | Contract |
| --- | --- |
| `event_id` | string, 3–200 characters; provider event identity |
| `type` | `payment.confirmed` or `payment.refunded` |
| `transaction_id` | string, 3–200 characters |
| `order_id` | optional nullable string, 1–200 characters when present |
| `amount_cents` | positive integer up to `2,147,483,647` |
| `currency` | three-character string; defaults to `BRL` and is stored uppercase |
| `occurred_at` | ISO 8601 datetime |

The idempotency identity is `(organization, normalized provider, event_id)`. `X-Delivery-Id` is diagnostic metadata, not the deduplication key.

Relevant responses:

| Status | Body | Meaning |
| --- | --- | --- |
| `202` | `{ "accepted": true, "eventId": "..." }` | event and outbox entry committed |
| `200` | `{ "accepted": true, "duplicate": true }` | external event identity already exists |
| `400` | `{ "error": "..." }` with optional `details` | invalid JSON or schema |
| `401` | `{ "error": "Invalid signature" }` | invalid signature or stale timestamp |
| `404` | `{ "error": "Endpoint not found" }` | organization slug not found |
| `413` | `{ "error": "Payload too large" }` | declared or streamed body exceeds 256 KiB |
| `500` | `{ "error": "Unable to accept the event" }` | event was not accepted |

A `202` acknowledges durable ingestion, not completed reconciliation. The worker processes the outbox asynchronously. Delivery semantics are at least once with idempotent effects.

## Demo-only routes

| Method | Route | Authorization | Response |
| --- | --- | --- | --- |
| `POST` | `/api/demo/event` | administrator or analyst in `acme-commerce` | `{ "ok": true, "scenario": "..." }` |
| `POST` | `/api/demo/reset` | administrator in `acme-commerce` | `{ "ok": true }` |

`POST /api/demo/event` accepts:

```json
{ "scenario": "unmatched_payment" }
```

Allowed scenarios are `amount_mismatch`, `unmatched_payment`, and `duplicate_payment`.

These endpoints exist to make the local demonstration reproducible. They must be disabled or removed before a real deployment.
