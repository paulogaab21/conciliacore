# Security model

The purpose of this document is to separate implemented controls from desired controls. It does not claim that the application is suitable for real financial data without an additional review.

## Protected assets

- user credentials and sessions;
- the secret used to validate webhooks for each organization;
- original event payloads and identities;
- an organization's orders, payments, cases, and evidence;
- the history of operational actions.

## Trust boundaries

### Public webhook endpoint

This is the primary unauthenticated entry point. Before interpreting JSON, the route:

1. consumes the request body as a stream and stops reading above 256 KiB;
2. calculates a payload hash for the delivery record;
3. loads and decrypts the organization's secret;
4. verifies the timestamp window and the HMAC-SHA256 over timestamp, provider, and raw body using constant-time comparison;
5. validates the schema and field limits with Zod.

Only after these steps does the event enter the persistence transaction.

### Management API

Dashboard, case, simulation, and reconciliation routes require a valid session. The organization is not accepted from the request body; it comes from the user record reloaded from the database.

Mutations verify the role on the server. Hiding a button in the interface is not treated as an authorization control.

### Worker

The worker trusts events that have already been persisted. Even so, it materializes payments with an `upsert` and unique constraints because retries and concurrency are part of the expected behavior.

## Implemented controls

| Risk | Current control |
| --- | --- |
| payload, provider, or timestamp tampering | HMAC-SHA256 over the canonical input |
| variable-time signature comparison | `timingSafeEqual` |
| secret disclosure from the database | AES-256-GCM with a random IV |
| plaintext passwords | bcrypt with cost 12 |
| login timing differences for unknown accounts | bcrypt comparison against a fixed fallback hash |
| JavaScript token theft | `HttpOnly` cookie |
| long-lived sessions | 8-hour expiration |
| stale authorization embedded in a JWT | token contains only `userId`; role comes from the database |
| framing, MIME sniffing, or unnecessary browser capabilities | global `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, and `Permissions-Policy` headers |
| oversized payload | 256 KiB limit while reading the stream |
| duplicate event | unique constraint on the external event identity |
| duplicate payment | unique constraint on the materialized transaction |
| accidental cross-organization access | `organizationId` filters in operational routes |
| missing or weak application secret | environment validated with Zod on first access and cached |

## Demo data

Names, values, and seeded credentials are synthetic. The public password `Demo@123` must not be reused outside this environment.

Simulation and restore routes require a session, verify the role, and accept only the `acme-commerce` organization. In a real deployment, these routes must be removed or protected by an explicit demo configuration.

## Residual threats and boundaries

### Webhook replay

The signature includes the timestamp and provider, accepts a maximum five-minute window, and binds those values to the body. The `event_id` constraint makes a nominal replay idempotent. Within the window, the same event can still be resent and will be recognized as a duplicate; a compromised sender can still create new valid identities. A future version can persist nonces when a provider supplies them.

### Tenant isolation

Isolation currently lives in the application layer. There is no Row-Level Security and not every relationship has a composite constraint. A future query that omits `organizationId` could expose data. The planned defense combines RLS, transaction-scoped tenant context, and negative cross-organization tests.

### Audit integrity

Audit records allow application actions to be reconstructed, but a user with direct database access can modify them. There is no hash chain, signature, WORM storage, or SIEM export.

### Encryption and keys

One application key encrypts webhook secrets. Envelope encryption, KMS integration, key versioning, and rotation are not implemented yet. Payloads and evidence do not use field-level encryption.

### Edge protection

Rate limiting, WAF, a deployment-specific CSP, MFA, progressive login lockout, and password recovery are outside the current scope. Audit IP data should trust `X-Forwarded-For` only behind a controlled proxy.

### Retention

`dataRetentionDays` exists in the data model, but no job applies deletion. The interface must not be interpreted as a retention or LGPD compliance guarantee.

## Deployment configuration

- generate distinct, random values for `AUTH_SECRET` and `ENCRYPTION_KEY`;
- use HTTPS in `NEXT_PUBLIC_APP_URL` so the session cookie receives the `Secure` flag;
- do not reuse Compose credentials or demo passwords;
- restrict PostgreSQL access;
- apply migrations as a controlled deployment step;
- remove or disable demo routes;
- centralize logs without storing payloads or secrets;
- add rate limiting before exposing the endpoint publicly.

## Vulnerability reporting

Do not publish sensitive details in an issue. Use **GitHub Security Advisories** to send a private report with impact, reproduction steps, and a suggested fix.
