<p align="center">
  <img src="./public/favicon.svg" width="84" alt="ConciliaCore logo" />
</p>

<h1 align="center">ConciliaCore</h1>

<p align="center">
  <strong>Reliable payment reconciliation, from signed webhook to audited resolution.</strong>
</p>

<p align="center">
  Signed ingestion&nbsp; → &nbsp;transactional outbox&nbsp; → &nbsp;deterministic rules&nbsp; → &nbsp;operational cases
</p>

<p align="center">
  <img alt="Next.js 16" src="https://img.shields.io/badge/Next.js_16-111111?style=flat-square&logo=nextdotjs&logoColor=white" />
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white" />
  <img alt="PostgreSQL 17" src="https://img.shields.io/badge/PostgreSQL_17-4169E1?style=flat-square&logo=postgresql&logoColor=white" />
  <img alt="Docker" src="https://img.shields.io/badge/Docker-2496ED?style=flat-square&logo=docker&logoColor=white" />
  <a href="./LICENSE"><img alt="MIT License" src="https://img.shields.io/badge/License-MIT-2E7D62?style=flat-square" /></a>
</p>

<p align="center">
  <a href="#product-walkthrough"><strong>Product tour</strong></a>
  ·
  <a href="#architecture"><strong>Architecture</strong></a>
  ·
  <a href="#reliability-guarantees"><strong>Guarantees</strong></a>
  ·
  <a href="#run-locally"><strong>Run locally</strong></a>
  ·
  <a href="#testing-strategy"><strong>Tests</strong></a>
  ·
  <a href="#known-boundaries"><strong>Boundaries</strong></a>
</p>

<br />

<p align="center">
  <img src="./docs/images/dashboard.png" width="100%" alt="ConciliaCore reconciliation dashboard" />
</p>

<p align="center">
  <sub>Operations overview with reconciliation health, open exceptions, provider distribution, and recent activity.</sub>
</p>

## Engineering at a glance

| System property | Concrete implementation |
| --- | --- |
| **Durable ingestion** | The event, delivery record, and outbox entry commit atomically before the API returns `202 Accepted`. |
| **At-least-once processing** | Unique provider identities, idempotent upserts, conditional worker claims, bounded retries, and stale-lock recovery. |
| **Deterministic domain** | Reconciliation is a pure function; monetary rules operate on integer cents and produce stable case fingerprints. |
| **Human operations** | Exceptions carry evidence, ownership, lifecycle transitions, resolution history, and role-based actions. |
| **Tenant isolation** | The organization comes from the validated server-side session, never from a mutation body. |
| **Executable evidence** | Unit, route, PostgreSQL integration, and Playwright tests cover the critical guarantees and access rules. |

> [!NOTE]
> ConciliaCore is a production-oriented reference implementation, not a claim of production readiness. The [known boundaries](#known-boundaries) and remaining hardening work are documented explicitly.

## What the system solves

Payment providers and order systems do not always agree. A webhook may arrive more than once, a payment can reference an unknown order, an order can retain the wrong status, or the paid amount can differ from the expected amount.

ConciliaCore turns those inconsistencies into an explicit workflow:

1. Authenticate and validate the raw webhook request.
2. Persist the event before acknowledging receipt.
3. Publish work through a transactional outbox.
4. Materialize an idempotent local payment projection.
5. Run deterministic reconciliation rules.
6. Open, update, automatically close, or reopen exception cases.
7. Preserve the evidence and actor behind every operational decision.

This separation keeps transport reliability, business rules, and human investigation independently testable.

## Product walkthrough

### 01 — Role-aware access

The seeded environment includes administrator, analyst, and read-only auditor profiles. Authentication uses a signed session cookie, while role and organization membership are reloaded from the database for every validated session.

The interface defaults to Brazilian Portuguese and can be switched to English before authentication or from the authenticated header. The locale preference also drives server-rendered metadata, document language, currency, dates, and relative time.

<p align="center">
  <img src="./docs/images/login.png" width="100%" alt="ConciliaCore sign-in screen" />
</p>

<p align="center">
  <sub>Seeded roles make authorization behavior reproducible without requiring an external identity provider.</sub>
</p>

### 02 — Operational health

The dashboard summarizes processed volume, reconciliation rate, open exceptions, webhook delivery health, provider distribution, and recent activity. Its reliability view exposes delivery outcomes, duplicate handling, provider distribution, and the idempotency contract instead of hiding those concerns behind aggregate numbers.

<p align="center">
  <img src="./docs/images/reliability.png" width="100%" alt="ConciliaCore webhook reliability view" />
</p>

<p align="center">
  <sub>Delivery outcomes and duplicate handling remain visible to the operator.</sub>
</p>

### 03 — Engineering evidence

The product includes an engineering view that connects each behavior to its implementation evidence. It covers webhook verification, database constraints, outbox recovery, tenant scoping, deterministic decisions, and known limits.

<p align="center">
  <img src="./docs/images/engineering-guarantees.png" width="100%" alt="ConciliaCore engineering guarantees" />
</p>

<p align="center">
  <sub>Runtime behavior is connected to its concrete implementation and documented limitations.</sub>
</p>

### 04 — Case investigation

Each case exposes the triggered rule, related order and payment, monetary difference, structured evidence, current owner, lifecycle state, and resolution form. Administrators and analysts may claim and resolve cases; auditors remain read-only.

<p align="center">
  <img src="./docs/images/case-investigation.png" width="100%" alt="ConciliaCore exception investigation drawer" />
</p>

<p align="center">
  <sub>Every exception keeps the rule, financial context, evidence, owner, and decision in one workflow.</sub>
</p>

### 05 — Operational traceability

Authentication events, reconciliation runs, duplicate deliveries, case assignments, case resolutions, automatic transitions, and payment processing are recorded with actor, timestamp, entity, summary, and safe operational metadata.

<p align="center">
  <img src="./docs/images/audit-trail.png" width="100%" alt="ConciliaCore audit trail" />
</p>

<p align="center">
  <sub>Audit records expose who changed what, when it changed, and the safe metadata attached to the event.</sub>
</p>

## Architecture

The system is a modular monolith with an independently deployed worker. That boundary keeps domain rules and database transactions easy to inspect while isolating asynchronous processing, retries, and recovery from HTTP request handling.

```mermaid
flowchart LR
    Provider[Payment provider] -->|signed webhook| API[Next.js ingestion API]
    API -->|single transaction| DB[(PostgreSQL)]
    DB --> Event[Payment event]
    DB --> Delivery[Delivery record]
    DB --> Outbox[Outbox event]
    Worker[Background worker] -->|conditional claim| Outbox
    Worker -->|idempotent upsert| Payment[Payment projection]
    Payment --> Engine[Reconciliation engine]
    Orders[Orders] --> Engine
    Engine --> Cases[Exception cases]
    Cases --> Dashboard[Operations dashboard]
    Engine --> Audit[Audit log]
```

### Webhook ingestion sequence

```mermaid
sequenceDiagram
    participant P as Payment provider
    participant A as Ingestion API
    participant D as PostgreSQL
    participant W as Worker
    participant R as Reconciliation engine

    P->>A: Raw payload + provider + timestamp + HMAC
    A->>A: Enforce 256 KiB streaming limit
    A->>A: Validate timestamp, signature, JSON, and schema
    A->>D: Event + delivery + outbox in one transaction
    D-->>A: Commit
    A-->>P: 202 Accepted
    W->>D: Conditionally claim pending outbox item
    W->>D: Upsert payment and mark event processed
    W->>R: Reconcile organization
    R->>D: Publish cases, transitions, run result, and audits
```

The acknowledgement is sent only after the ingestion transaction commits. A successful `202` means the event was durably accepted for asynchronous processing; it does not claim that reconciliation has already completed.

## Reliability guarantees

| Concern | Implemented behavior | Evidence |
| --- | --- | --- |
| Request authenticity | HMAC-SHA256 covers `timestamp.provider.rawBody` and uses constant-time comparison | [`src/lib/crypto.ts`](./src/lib/crypto.ts) |
| Replay window | Signed timestamps must be within a five-minute tolerance | [webhook route](./src/app/api/webhooks/payments/%5BorganizationSlug%5D/route.ts) |
| Payload protection | The body is rejected while streaming once it exceeds 256 KiB | [webhook route](./src/app/api/webhooks/payments/%5BorganizationSlug%5D/route.ts) |
| Schema integrity | Zod validates the external event before persistence | [webhook route](./src/app/api/webhooks/payments/%5BorganizationSlug%5D/route.ts) |
| Secret storage | Webhook secrets use AES-256-GCM with a random IV | [`src/lib/crypto.ts`](./src/lib/crypto.ts) |
| Ingestion atomicity | Payment event, accepted delivery, and outbox message commit together | [webhook route](./src/app/api/webhooks/payments/%5BorganizationSlug%5D/route.ts) |
| Ingestion idempotency | `organization + provider + external event ID` is unique | [Prisma schema](./prisma/schema.prisma) |
| Materialization idempotency | Payment transactions are upserted by provider identity | [`src/lib/outbox.ts`](./src/lib/outbox.ts) |
| Worker concurrency | A conditional state update allows only one worker to claim a candidate | [`src/lib/outbox.ts`](./src/lib/outbox.ts) |
| Retry policy | Bounded exponential backoff with jitter and stale-lock recovery | [`src/lib/outbox.ts`](./src/lib/outbox.ts) |
| Monetary precision | Business rules compare integer cents, never floating-point currency | [reconciliation domain](./src/domain/reconciliation.ts) |
| Case identity | A deterministic fingerprint is unique within each organization | [domain rules](./src/domain/reconciliation.ts) and [schema](./prisma/schema.prisma) |
| Result publication | Case updates, lifecycle transitions, run completion, and audits share a serializable transaction | [reconciliation service](./src/lib/reconciliation-service.ts) |
| Transaction conflicts | Serializable conflicts are retried up to three times with explicit timeouts | [reconciliation service](./src/lib/reconciliation-service.ts) |
| Tenant isolation | Authenticated queries derive `organizationId` from the server-side session | [API routes](./src/app/api) |

The delivery model is **at least once with idempotent effects**. The project does not present itself as an exactly-once system.

## Reconciliation rules

The engine is a pure domain function. Given the same orders and payments, it produces the same findings and fingerprints.

| Finding | Trigger | Default severity |
| --- | --- | --- |
| `UNMATCHED_PAYMENT` | A payment cannot be associated with an order | High |
| `AMOUNT_MISMATCH` | Payment and order amounts differ | High or critical |
| `DUPLICATE_PAYMENT` | More than one confirmed payment targets the same order | High or critical |
| `ORDER_STATUS_MISMATCH` | A confirmed payment is not reflected in the order status | Medium or critical |
| `REFUND_MISMATCH` | A refunded payment is not reflected in the order | High |
| `MISSING_PAYMENT` | An order marked as paid has no confirmed transaction | High |

Rule evaluation is isolated from transport and persistence concerns in [`src/domain/reconciliation.ts`](./src/domain/reconciliation.ts).

## Case lifecycle

```mermaid
stateDiagram-v2
    [*] --> OPEN: finding detected
    OPEN --> IN_REVIEW: analyst claims case
    IN_REVIEW --> RESOLVED: human resolution
    OPEN --> RESOLVED: finding disappears
    IN_REVIEW --> RESOLVED: finding disappears
    RESOLVED --> OPEN: automatically resolved finding recurs
    RESOLVED --> RESOLVED: manual resolution is preserved
    OPEN --> DISMISSED: authorized decision
```

Automatic and manual resolutions are deliberately different:

- When an active finding disappears, the system closes it with an `AUTOMATIC` resolution source.
- If that fingerprint appears again, an automatically closed case is reopened.
- A manually resolved case remains resolved if the same fingerprint recurs.
- Reopenings and automatic closures produce dedicated audit events.

The integration test executes this complete lifecycle against a real PostgreSQL database.

## Authorization model

| Capability | Administrator | Analyst | Auditor |
| --- | :---: | :---: | :---: |
| View operational data | Yes | Yes | Yes |
| View audit evidence | Yes | Yes | Yes |
| Run reconciliation | Yes | Yes | No |
| Emit demo incidents | Yes | Yes | No |
| Assign and update cases | Yes | Yes | No |
| Resolve cases | Yes | Yes | No |
| Restore seeded demo data | Yes | No | No |

The UI hides unavailable actions for clarity, but authorization is enforced again on the server. The organization is never accepted from a mutation body; it is derived from the authenticated user.

## Technology stack

| Layer | Technology | Responsibility |
| --- | --- | --- |
| Web application | Next.js 16, React 19, TypeScript | App Router UI and route handlers |
| Persistence | PostgreSQL 17, Prisma 6 | Relational model, migrations, transactions, constraints |
| Background processing | Dedicated Node.js worker | Outbox consumption, retries, payment materialization |
| Validation and security | Zod, `jose`, bcrypt, Node crypto | Contracts, sessions, password hashing, HMAC, AES-GCM |
| Unit and domain tests | Vitest | Pure rules, authorization, crypto, route behavior |
| Integration tests | Vitest + PostgreSQL | Transactional case lifecycle with the real database |
| End-to-end tests | Playwright | Authentication, validation contracts, reconciliation workflow, RBAC, mobile navigation |
| Delivery | Docker Compose, GitHub Actions | Reproducible local environment and CI pipeline |

## Run locally

### Requirements

- Node.js 24 or newer
- Docker Desktop or a compatible Docker Engine

### Complete environment with Docker

```bash
docker compose up --build
```

This starts PostgreSQL, applies migrations, seeds synthetic data, and launches both the web application and the worker. Open [http://localhost:3000](http://localhost:3000).

### Manual development setup

```bash
npm ci
cp .env.example .env
npm run db:migrate
npm run db:seed
npm run dev
```

Start the worker in a second terminal:

```bash
npm run worker
```

### Demo accounts

| Role | Email | Password |
| --- | --- | --- |
| Administrator | `admin@conciliacore.dev` | `Demo@123` |
| Analyst | `analyst@conciliacore.dev` | `Demo@123` |
| Read-only auditor | `auditor@conciliacore.dev` | `Demo@123` |

> These credentials and all seeded business data are synthetic. They are provided only for local evaluation and must never be reused in a real environment.

### Emit signed webhook examples

With the application and worker running:

```bash
npm run demo:emit
```

The script signs each request with the same canonical input used by the server and sends representative payment events to the local endpoint.

## Testing strategy

```bash
npm run lint             # ESLint across application, tests, scripts, and config
npm run typecheck        # TypeScript without emitting files
npm test                 # 27 unit and route-level tests
npm run test:integration # PostgreSQL-backed reconciliation lifecycle
npm run test:e2e         # 4 browser/API journeys
npm run build            # Optimized Next.js production build
```

The current suite covers:

- deterministic reconciliation findings and fingerprints;
- money parsing and integer-cent arithmetic;
- role-based permissions;
- session and authentication behavior;
- HMAC signing and verification;
- webhook rejection, deduplication, and safe failure handling;
- automatic closure, recurrence reopening, and manual-resolution preservation;
- desktop and mobile operational journeys;
- read-only auditor enforcement through the API.

GitHub Actions runs static checks and unit tests first, then provisions PostgreSQL for migrations, seed validation, the integration test, and Playwright journeys.

## Security model

The public webhook endpoint is treated as the primary untrusted boundary. Before a payload reaches persistence, the route validates its byte size, organization, encrypted secret configuration, signed timestamp, provider-bound HMAC, JSON syntax, and schema.

Authenticated routes use an `HttpOnly`, `SameSite=Lax` session cookie with an eight-hour lifetime. The token stores only the user ID; current role and organization membership are read from PostgreSQL when the session is validated.

Global response headers deny framing, disable MIME sniffing, limit referrer disclosure, and turn off unused camera, microphone, and geolocation capabilities. Operational logs intentionally avoid raw financial payloads and credentials. See the complete [threat model](./docs/security.md) and [API contract](./docs/api.md).

## Known boundaries

The repository documents limits as explicitly as implemented guarantees:

- Delivery is at least once; downstream effects rely on idempotency.
- Timestamp validation narrows replay exposure, but the system does not persist provider nonces.
- Tenant isolation is enforced by application queries; PostgreSQL Row-Level Security is not enabled yet.
- Worker claims use a time-based lease without an owner token or heartbeat.
- Audit records are useful operational evidence, but they are not tamper-proof or stored in WORM storage.
- `dataRetentionDays` is modeled, but an automated purge job is not implemented.
- Rate limiting, MFA, password recovery, KMS-backed key rotation, and a production WAF remain deployment work.
- Demo-only mutation routes must be disabled or removed before a real deployment.

These constraints are not hidden behind architecture language. They define the next hardening steps in [`docs/architecture.md`](./docs/architecture.md) and [`docs/security.md`](./docs/security.md).

## Repository structure

```text
src/
  app/                  Next.js pages and API route handlers
    styles/             Ordered base and product-theme CSS slices
  components/           Application shells and shared UI
    dashboard/          Focused operational views, helpers, and types
  contracts/            Shared serializable boundary types
  domain/               Pure permissions and reconciliation rules
  lib/                  Auth, crypto, outbox, persistence, and services
  worker.ts             Background outbox consumer
prisma/
  migrations/           Versioned PostgreSQL migrations
  schema.prisma         Data model and database constraints
  seed.ts               Synthetic evaluation environment
tests/
  integration/          Real PostgreSQL lifecycle coverage
e2e/                    Browser and API journeys
docs/                   Architecture, API, and security documentation
.github/workflows/       Continuous integration pipeline
```

## Additional documentation

- [Architecture and transaction boundaries](./docs/architecture.md)
- [HTTP API and webhook contract](./docs/api.md)
- [Threat model and residual risks](./docs/security.md)
- [Contribution guidelines](./CONTRIBUTING.md)
- [Security reporting policy](./SECURITY.md)

## License

Distributed under the [MIT License](./LICENSE).
