# Brown Nation API

Production-ready e-commerce backend for Brown Nation, built as a modular monolith with NestJS, Fastify, Prisma and PostgreSQL.

## 1. Project Overview

REST API covering authentication, product catalog, shopping cart, orders, inventory and payments for a small-to-medium e-commerce storefront. Designed to be simple to run and reason about while staying production-ready: JWT auth with refresh rotation, RBAC, transactional inventory-safe order creation, a pluggable payment/storage/email abstraction, structured logging, and a consistent API response envelope.

## 2. Technology Stack

| Concern | Choice |
|---|---|
| Framework | NestJS 11 (Fastify adapter), TypeScript 5.9 (strict mode) |
| Database | PostgreSQL 16 + Prisma ORM 6 |
| Auth | JWT (access + refresh), Argon2id password hashing |
| Validation | class-validator / class-transformer, global `ValidationPipe` |
| Docs | Swagger / OpenAPI (`@nestjs/swagger`) |
| Logging | Pino (`nestjs-pino`), structured JSON, redacted secrets |
| Security | `@fastify/helmet`, CORS via env, `@nestjs/throttler` rate limiting |
| Object storage | S3-compatible abstraction (AWS S3 / Cloudflare R2 / MinIO) |
| Payments | Provider abstraction — Mock (dev) and Stripe |
| Testing | Jest (unit), Jest + Supertest (E2E), separate test database |

> **Note on versions:** TypeScript 7, Prisma 7 and ESLint 10's newest peer chain were checked against the rest of the toolchain before pinning. `ts-jest` and `typescript-eslint` currently hard-cap support below TypeScript 6.1, and Prisma 7 changes the generator/client API significantly, so this project pins **TypeScript 5.9.3** and **Prisma 6.19.3** — the newest versions that are still fully interoperable with the whole toolchain — while everything else (NestJS, ESLint, Fastify, Jest, etc.) is on its true latest release.

## 3. Architecture

Modular monolith — no microservices. Each domain owns its controller/service/DTOs; controllers stay thin and delegate to services.

```
src/
├── main.ts              # bootstrap (Fastify, Swagger, listen)
├── bootstrap.ts          # shared app config (pipes/filters/interceptors/security) — used by main.ts AND e2e tests
├── app.module.ts
├── common/                # decorators, guards, filters, interceptors, DTOs, utils shared across modules
├── config/                # env validation + typed configuration namespaces
├── database/              # PrismaService/PrismaModule (global)
├── auth/                  # signup/login/refresh/logout/forgot/reset, JWT strategy + guard
├── users/                 # user profile + admin user management
├── categories/
├── products/               # catalog CRUD, search/filter/sort/pagination
├── storage/                # S3-compatible file storage abstraction
├── cart/
├── inventory/              # atomic stock reservation/release
├── orders/                 # transactional order creation, status lifecycle
├── payments/                # PaymentProvider abstraction (Mock/Stripe) + webhook handling
├── email/                   # EmailProvider abstraction (Mock/SMTP)
└── health/                  # liveness + DB connectivity check
```

Global request pipeline (see `src/bootstrap.ts`): Helmet → CORS → rate limiting → JWT auth guard (with `@Public()` opt-out) → roles guard (`@Roles()`) → validation pipe (whitelist + transform) → controller → response envelope interceptor → global exception filter.

### Key design decisions

- **Response envelope**: every response is `{ success: true, data }` or `{ success: false, error: { code, message, details? } }`. Health checks opt out via `@RawResponse()` so infra probes get the raw Terminus payload.
- **Money as decimal strings**: `price`, order totals, etc. are Prisma `Decimal` fields and are serialized as **strings** (e.g. `"123.45"`) rather than floats, to avoid floating-point rounding errors on currency. Parse them on the client as needed.
- **Never trust the client for price/stock**: cart and order creation always re-read the current product price and stock from the database; nothing price-related is ever accepted from the request body.
- **Inventory race safety**: stock is decremented with a single atomic `UPDATE ... WHERE stockQuantity >= quantity`, guarded inside the same Prisma transaction as order/order-item creation. If the guarded update affects 0 rows, the whole transaction rolls back — no oversell, no need for `SELECT ... FOR UPDATE`.
- **Order items snapshot** product name/SKU/price at purchase time, independent of later product edits.
- **Refresh token rotation**: only an Argon2 hash of the current refresh token is stored per user; each refresh call rotates it. A refresh token that doesn't match the stored hash is treated as reuse/theft and immediately revokes the session.
- **Password reset tokens** use a selector+verifier pattern (`<recordId>.<rawSecret>`): the raw secret is never persisted, only its Argon2 hash; tokens are single-use and TTL-bound.
- **RBAC** is a simple `UserRole` enum (`CUSTOMER`/`ADMIN`) + `@Roles()` decorator + guard — intentionally not a full permission system, but the guard/decorator seam makes it straightforward to evolve into one later.

## 4. Prerequisites

- Node.js 20.11+ (developed against Node 24)
- Docker (for local PostgreSQL + MinIO) — or a PostgreSQL 16 instance of your own
- npm

## 5. Installation

```bash
cd backend
npm install
cp .env.example .env   # edit values as needed
```

## 6. Environment Variables

See `.env.example` for the full list with defaults. Highlights:

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Postgres connection string |
| `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` | ≥32-char secrets, validated on startup |
| `JWT_ACCESS_EXPIRES_IN` / `JWT_REFRESH_EXPIRES_IN` | e.g. `15m`, `7d` |
| `CORS_ORIGIN` | comma-separated allow-list; never `*` with credentials in production |
| `THROTTLE_TTL_MS` / `THROTTLE_LIMIT` | global rate limit window/limit |
| `S3_ENDPOINT`, `S3_BUCKET`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`, `S3_FORCE_PATH_STYLE`, `S3_PUBLIC_URL` | any S3-compatible provider (AWS S3 / R2 / MinIO) |
| `PAYMENT_PROVIDER` | `mock` (default, safe for local dev) or `stripe` |
| `EMAIL_PROVIDER` | `mock` (logs emails) or `smtp` |

All env vars are validated on startup via `class-validator` (`src/config/env.validation.ts`); the app refuses to boot with missing/invalid config.

## 7. Database Setup (local Docker)

```bash
docker compose up -d postgres minio
```

This starts Postgres on `localhost:55432` (ports are non-default to avoid clashing with anything else already running locally) with both the `brown_nation` and `brown_nation_test` databases created, plus MinIO (S3-compatible storage) on `localhost:59000` (API) / `localhost:59001` (console). Adjust `docker-compose.yml` / `.env` if you'd rather use the standard `5432`/`9000` ports.

## 8. Prisma Migrations

```bash
npm run prisma:generate     # regenerate the Prisma client
npm run prisma:migrate      # create/apply a dev migration
npm run prisma:migrate:deploy  # apply existing migrations (CI/production)
npm run prisma:studio       # browse the DB
```

## 9. Seed Data

```bash
npm run prisma:seed
```

Creates:
- Admin: `admin@brownnation.com` / `AdminPass123`
- Customer: `customer@brownnation.com` / `CustomerPass123`
- 3 categories, 6 sample tea products

## 10. Running Locally

```bash
npm run start:dev
```

- API: `http://localhost:3000`
- Swagger UI: `http://localhost:3000/docs`
- Health check: `http://localhost:3000/health`

## 11. Running Tests

```bash
npm test              # unit tests
npm run test:cov      # unit tests with coverage
npm run test:e2e      # E2E tests against a real Postgres (uses .env.test / brown_nation_test)
```

E2E tests run against a **separate database** (`brown_nation_test`, configured via `.env.test`) so they never touch development data. Run `npm run prisma:migrate:deploy` (with `DATABASE_URL` pointed at the test DB, or simply `NODE_ENV=test` sourced) once before the first `test:e2e` run. Rate limiting is disabled in the `test` environment (`skipIf` in `ThrottlerModule`) so rapid repeated requests in a test suite don't trip it.

## 12. Swagger Documentation

Available at `/docs` whenever `SWAGGER_ENABLED=true` (default in dev). JWT Bearer auth is pre-configured — click "Authorize" and paste an access token to call protected endpoints from the UI.

## 13. Production Build

```bash
npm run build
npm run start:prod
```

Run `npm run prisma:migrate:deploy` before starting in production. Set `SWAGGER_ENABLED=false` if you don't want the docs publicly exposed, and set real (non-mock) `PAYMENT_PROVIDER` / `EMAIL_PROVIDER` values with their corresponding secrets.

## 14. Deployment Considerations

- Provide real, high-entropy `JWT_ACCESS_SECRET`/`JWT_REFRESH_SECRET` values (never reuse the ones in `.env.example`).
- Set `CORS_ORIGIN` to your actual frontend origin(s) — the app refuses `origin: *` when combined with credentials.
- Point `S3_*` at your real bucket (AWS S3 or Cloudflare R2 both work unmodified; only the endpoint/credentials change).
- For Stripe: set `PAYMENT_PROVIDER=stripe`, `STRIPE_SECRET_KEY`, and `STRIPE_WEBHOOK_SECRET`, and point Stripe's webhook at `POST /payments/webhook`.
- `npm audit` currently flags a transitive `js-yaml` advisory pulled in by `@nestjs/swagger`'s Swagger UI assets (YAML parsing DoS). This app never parses untrusted YAML, so it's not exploitable here, but keep an eye on upstream `@nestjs/swagger` for the fix.
- The health endpoint (`/health`) only checks DB connectivity — point your orchestrator's liveness/readiness probe at it.

## Modules

`AuthModule`, `UsersModule`, `CategoriesModule`, `ProductsModule`, `StorageModule`, `CartModule`, `InventoryModule`, `OrdersModule`, `PaymentsModule`, `EmailModule`, `HealthModule`, plus shared `CommonModule`-style code under `src/common/`, `src/config/`, `src/database/`.

## Assumptions & Known Gaps

- Shipping is a simple flat-rate rule (₹99, free above ₹999 subtotal) — swap `orders.service.ts`'s constants for a real shipping/tax engine if needed.
- No coupon/discount system — `Order.discount` exists in the schema and defaults to 0, ready to be wired up.
- Products have a single flat price/stock (no per-variant pricing) — the frontend's storefront (`frontend/src/lib/types/catalog.ts`) was reconciled to this same flat model.
- No refresh token is issued via httpOnly cookie — tokens are returned in the JSON response body and the frontend is responsible for storage. Switch to a cookie-based flow if you need XSS-hardened refresh token storage.
