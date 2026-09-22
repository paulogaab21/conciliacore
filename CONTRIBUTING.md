# Contributing

This repository welcomes focused fixes and proposals that preserve the guarantees documented in the project.

## Development environment

Use Node.js 24 and PostgreSQL 17. The shortest way to start every process is:

```bash
docker compose up --build
```

For local development, follow the [README](README.md#run-locally) and keep the web application and worker running in separate terminals.

## Before opening a pull request

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

Changes to authentication, authorization, multi-tenancy, webhook ingestion, or asynchronous processing must also include a negative test. When a change affects a visible user journey, run `npm run test:e2e` with PostgreSQL configured.

## Review criteria

- operational data queries remain scoped by `organizationId`;
- replayable effects remain idempotent;
- monetary values remain integer cents;
- webhook responses are not sent before persistence commits;
- new rules have stable fingerprints and cover both the expected and conflicting paths;
- logs do not include secrets, passwords, or complete financial payloads;
- documentation describes every new guarantee and the boundary where it ends.

## Commits

Prefer small, imperative commits that explain the change, for example:

```text
Add timestamp validation to webhook signatures
Keep tenant scope in case assignment query
Document worker lease recovery
```

Do not include `.env` files, database dumps, local reports, or real data.
