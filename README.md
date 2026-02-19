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

### 1 – Install dependencies

```bash
pnpm install
```

### 2 – Start infrastructure (Postgres + Redis)

```bash
docker compose -f infra/docker-compose.yml up -d
```

### 3 – Configure environment

```bash
cp apps/api/.env.example apps/api/.env
# Edit apps/api/.env if your DB credentials differ
```

### 4 – Run Prisma migration & generate client

```bash
pnpm db:generate          # generate Prisma client
pnpm db:migrate:dev       # run initial migration (creates schema)
```

> On first run you will be prompted for a migration name – enter `init` or similar.

### 5 – Start the API

```bash
pnpm dev:api
# → http://localhost:3001/api/health
```

### 6 – Start the web app

```bash
pnpm dev:web
# → http://localhost:3000
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

---

## Key Scripts

| Script | Description |
|--------|-------------|
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
| `Setting` | Key-value platform settings |
| `Module` | Pluggable feature modules |
| `AuditLog` | Admin action trail |

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
