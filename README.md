# Psychic Link CMS

A production-oriented, modular content management platform built for advisors and clients. Powered by **NestJS**, **Next.js**, **Prisma**, **PostgreSQL**, and **Redis** inside a **pnpm workspace monorepo**.

---

## Repository Layout

```
pl-cms/
├── apps/
│   ├── api/          # NestJS REST + WebSocket backend
│   └── web/          # Next.js + TailwindCSS frontend
├── packages/
│   ├── db/           # Prisma schema, migrations, generated client
│   └── shared/       # Shared TypeScript types / DTOs
├── infra/
│   └── docker-compose.yml   # PostgreSQL + Redis
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── .editorconfig
├── .prettierrc
└── .eslintrc.json
```

---

## Prerequisites

| Tool | Version |
|------|---------|
| Node.js | ≥ 20 LTS |
| pnpm | ≥ 9 |
| Docker + Compose | any recent |

Install pnpm if needed:

```bash
npm install -g pnpm@9
```

---

## Quick Start

### One-command setup

```bash
pnpm setup
```

That's it. The command will automatically:

1. Create `apps/api/.env` from `.env.example` (only if it doesn't already exist)
2. Install all workspace dependencies
3. Start PostgreSQL + Redis via Docker Compose (`infra/docker-compose.yml`)
4. Generate the Prisma client
5. Apply the initial database migration

> **Prerequisites**: [Node.js ≥ 20](https://nodejs.org/), [pnpm ≥ 9](https://pnpm.io/installation), and [Docker Desktop](https://www.docker.com/products/docker-desktop/) (or Docker + Compose CLI) must be installed and Docker must be running before executing `pnpm setup`.

> **Secrets**: After setup completes, open `apps/api/.env` and fill in `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, and any optional integration keys (PayPal, ShipStation, SMTP) before starting the app.

### Start the app

```bash
pnpm dev:api   # → http://localhost:3001/api/health
pnpm dev:web   # → http://localhost:3000
```

### Manual setup (optional)

If you prefer to run each step individually:

```bash
# 1 – Install dependencies
pnpm install

# 2 – Start infrastructure (Postgres + Redis)
docker compose -f infra/docker-compose.yml up -d

# 3 – Configure environment
cp apps/api/.env.example apps/api/.env
# Edit apps/api/.env – fill in DB credentials, JWT secrets, and PayPal keys

# 4 – Generate Prisma client & run migrations
pnpm db:generate
pnpm db:migrate:dev

# 5 – Start the servers
pnpm dev:api   # → http://localhost:3001/api/health
pnpm dev:web   # → http://localhost:3000
```

---

## Environment Variables (apps/api)

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | API listen port | `3001` |
| `DATABASE_URL` | Postgres connection string | `postgresql://plcms:plcms@localhost:5432/plcms` |
| `REDIS_URL` | Redis connection string | `redis://localhost:6379` |
| `JWT_ACCESS_SECRET` | JWT signing secret (access) | — |
| `JWT_REFRESH_SECRET` | JWT signing secret (refresh) | — |
| `JWT_ACCESS_EXPIRES_IN` | Access token TTL | `15m` |
| `JWT_REFRESH_EXPIRES_IN` | Refresh token TTL | `7d` |
| `PAYPAL_CLIENT_ID` | PayPal REST API client ID | — |
| `PAYPAL_CLIENT_SECRET` | PayPal REST API client secret | — |
| `PAYPAL_ENVIRONMENT` | `sandbox` or `live` | `sandbox` |
| `PAYPAL_WEBHOOK_ID` | PayPal webhook ID (from Developer Dashboard) | — |
| `WEB_BASE_URL` | Web app base URL (for PayPal return/cancel URLs) | `http://localhost:3000` |

---

## PayPal Advanced Checkout Setup

### 1 – Create a PayPal developer account

1. Go to [developer.paypal.com](https://developer.paypal.com/) and log in.
2. Navigate to **Apps & Credentials**.
3. Click **Create App**, choose **Merchant**, and give it a name.
4. Copy the **Client ID** and **Secret** for the **Sandbox** environment into `apps/api/.env`:

```env
PAYPAL_CLIENT_ID=your-sandbox-client-id
PAYPAL_CLIENT_SECRET=your-sandbox-client-secret
PAYPAL_ENVIRONMENT=sandbox
```

### 2 – Set up a Webhook (optional but recommended)

1. In the PayPal Developer Dashboard, select your app → **Webhooks** → **Add Webhook**.
2. Enter your webhook URL: `https://your-api-host/api/payments/paypal/webhook`
3. Select events:
   - `PAYMENT.CAPTURE.COMPLETED`
   - `PAYMENT.CAPTURE.DENIED`
4. Copy the **Webhook ID** into your `.env`:

```env
PAYPAL_WEBHOOK_ID=your-webhook-id
```

> **Local testing**: Use [ngrok](https://ngrok.com/) or [PayPal's mock webhook tool](https://developer.paypal.com/dashboard/webhooksimulator) to test webhooks locally.

### 3 – Expose the client ID to the frontend

Add to `apps/web/.env.local`:

```env
NEXT_PUBLIC_PAYPAL_CLIENT_ID=your-sandbox-client-id
```

Alternatively, the frontend fetches the client ID automatically from `GET /api/payments/paypal-client-id`.

### 4 – Sandbox testing

1. Go to **Sandbox** → **Accounts** in the Developer Dashboard.
2. Note the pre-created buyer and seller sandbox accounts.
3. Use the buyer account credentials when prompted by the PayPal button in the checkout flow.

### Payment flow

```
User clicks "Buy Now" → /shop/checkout
  ↓ PayPal button rendered
  ↓ POST /api/checkout/paypal-order    (creates DB order + PayPal order)
  ↓ User approves in PayPal popup
  ↓ POST /api/checkout/paypal-capture/:paypalOrderId  (captures payment, marks order CONFIRMED)
  ↓ Webhook: POST /api/payments/paypal/webhook        (secondary confirmation)
```

---

## Key Scripts

| Script | Description |
|--------|-------------|
| `pnpm setup` | **One-command local setup** (install, infra, env, migrate) |
| `pnpm dev:api` | Start API in watch mode |
| `pnpm dev:web` | Start Next.js dev server |
| `pnpm build` | Build all packages |
| `pnpm lint` | Lint all packages |
| `pnpm db:generate` | Regenerate Prisma client |
| `pnpm db:migrate:dev` | Create & apply new migration |
| `pnpm db:migrate:deploy` | Apply pending migrations (CI/prod) |

---

## Architecture Overview

### Backend (`apps/api`)

- **NestJS** with global `ConfigModule` (env validation), `ThrottlerModule` (rate limiting placeholder), and `PrismaModule` (global Prisma client).
- **Auth**: JWT access + refresh token pair. `JwtStrategy` + `RolesGuard` for role-based access control (`ADMIN | ADVISOR | CLIENT`).
- **Health**: `GET /api/health` via `@nestjs/terminus`.
- **WebSocket**: Socket.IO gateway at `/ws` with presence and message stubs.

### Database (`packages/db`)

Prisma schema with the following models:

| Model | Purpose |
|-------|---------|
| `User` | Core identity (role enum) |
| `AdvisorProfile` | Advisor details & rate |
| `ClientProfile` | Client details & minute balance |
| `AvailabilitySchedule` | Advisor weekly slots |
| `CallSession` | Tracked call with billing fields |
| `CallQueue` / `QueueAssignment` | Client queuing for an advisor |
| `Message` | Direct 1-to-1 messages |
| `BroadcastMessage` / `BroadcastTarget` | Admin broadcasts |
| `Page` | CMS static pages |
| `Post` | Blog/news posts |
| `MediaAsset` | Uploaded media library assets reused across CMS workflows |
| `Setting` | Key-value platform settings |
| `Module` | Pluggable feature modules |
| `Product` | Purchasable products (minute packs, etc.) |
| `Order` | Customer orders with PayPal tracking |
| `OrderItem` | Line items within an order |
| `Payment` | Payment records per order |
| `WalletTransaction` | Credit/debit entries for client balance |

### Frontend (`apps/web`)

Next.js 14 App Router with TailwindCSS.
Placeholder pages: `/` `/login` `/admin` `/advisor` `/client`.

---

## Roles

| Role | Description |
|------|-------------|
| `ADMIN` | Full platform access, settings, broadcast, audit |
| `ADVISOR` | Manage availability, accept calls, messaging |
| `CLIENT` | Browse advisors, join queues, messaging |

---

## Billing

Per-minute billing only. `CallSession.billedMinutes` tracks consumed minutes; `ClientProfile.balanceMinutes` tracks the client's prepaid balance. No call recording.

---

## CloudPanel Deployment & Web Installer

### 1 – Set environment variables in CloudPanel

In your CloudPanel vhost configuration, add the following environment variables (do **not** commit `.env` files):

| Variable | Description |
|----------|-------------|
| `NODE_ENV` | `production` |
| `PORT` | API listen port (default `3001`) |
| `DATABASE_URL` | PostgreSQL connection string |
| `REDIS_URL` | Redis connection string |
| `JWT_ACCESS_SECRET` | Secret for access tokens |
| `JWT_REFRESH_SECRET` | Secret for refresh tokens |
| `JWT_ACCESS_EXPIRES_IN` | e.g. `15m` |
| `JWT_REFRESH_EXPIRES_IN` | e.g. `7d` |
| `WEB_BASE_URL` | Public URL of the web app |
| `NEXT_PUBLIC_API_BASE_URL` | Public URL of the API (used by the web installer) |

Any additional integration secrets (PayPal, ShipStation, SMTP) should also be added here.

### 2 – Deploy the application

```bash
pnpm install
pnpm build          # or your CloudPanel deployment hook
```

### 3 – Visit `/install`

Open your browser to `https://<your-domain>/install`.

- The installer checks database connectivity and whether an admin already exists.
- Fill in the admin email, password (min 8 characters), and optional name.
- Click **Run Installation** — this will:
  1. Verify DB connectivity.
  2. Run `prisma migrate deploy` automatically (safe, idempotent).
  3. Seed default settings and modules.
  4. Create the first ADMIN user.
- Once complete, you are redirected to `/login`.

> **Security**: The installer returns HTTP 409 if an admin user already exists, effectively locking itself after first use.

### 4 – Log in

Use the admin credentials you just created at `/login`.

---

## Admin UI

The admin interface is available at `/admin` and is restricted to users with the `ADMIN` role.

### Logging In

1. Navigate to `http://localhost:3000/login`
2. Enter your admin email and password
3. On successful authentication you will be redirected to `/admin`

If your session has not been set up yet, visit `/install` first to create the initial admin user.

### Admin Navigation

| Page | URL | Description |
|------|-----|-------------|
| Dashboard | `/admin` | Overview with quick-action links |
| Pages | `/admin/pages` | CMS static pages – create, edit, publish/unpublish, delete |
| Posts | `/admin/posts` | Blog/news posts – create, edit, publish/unpublish, delete |
| Media | `/admin/media` | Media library (placeholder) |
| Users | `/admin/users` | List all users, change roles, reset passwords |
| Settings | `/admin/settings` | Structured public-site controls (homepage, menus, theme, reusable blocks) plus advanced key-value settings |
| Audit Log | `/admin/audit` | Recent admin activity log |
| Products | `/admin/products` | Product & variant management |
| Orders | `/admin/orders` | Order management & fulfilment |

Phase 8 adds lightweight public-site extension seams via settings keys:
- `site_homepage_blocks` for reusable landing-page block layout (featured pages/posts/CTA)
- `site_extension_points` for integration-friendly menu extension hooks

### Authentication Architecture

- Login submits to the Next.js API route `POST /api/auth/login` which calls the NestJS `/api/auth/login` endpoint and sets two **httpOnly, SameSite=Lax** cookies:
  - `access_token` – 15-minute JWT
  - `refresh_token` – 7-day JWT
- The Next.js **middleware** (`src/middleware.ts`) protects all `/admin/*` routes by decoding the access token and checking `role === 'ADMIN'`. Unauthenticated or non-admin users are redirected to `/login`.
- The **proxy route** (`/api/proxy/*`) automatically injects the `Authorization: Bearer <token>` header from the httpOnly cookie so client components never handle raw tokens.
- To refresh the session call `POST /api/auth/refresh` (happens automatically on next page load if the token is still valid in the refresh cookie).
- To log out click **Sign Out** in the sidebar (calls `POST /api/auth/logout` which deletes both cookies).
