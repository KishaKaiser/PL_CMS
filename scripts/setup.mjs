#!/usr/bin/env node
/**
 * scripts/setup.mjs
 *
 * One-command local developer setup for the PL_CMS pnpm monorepo.
 * Run via:  pnpm setup
 *
 * Steps performed:
 *   1. Copy apps/api/.env.example → apps/api/.env  (only when .env is absent)
 *   2. Install all workspace dependencies            (pnpm install)
 *   3. Start local infrastructure                   (docker compose up -d)
 *   4. Generate the Prisma client                   (pnpm db:generate)
 *   5. Apply / create the initial DB migration      (pnpm db:migrate:dev)
 */

import { execSync } from 'child_process';
import { existsSync, copyFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

/** Run a shell command, inheriting stdio so progress is visible. */
function run(cmd) {
  console.log(`\n▶  ${cmd}`);
  execSync(cmd, { stdio: 'inherit', cwd: root });
}

// ── Step 1: .env ─────────────────────────────────────────────────────────────
const envSrc = resolve(root, 'apps/api/.env.example');
const envDst = resolve(root, 'apps/api/.env');

if (!existsSync(envDst)) {
  console.log('\n📋  Creating apps/api/.env from .env.example …');
  copyFileSync(envSrc, envDst);
  console.log(
    '    ✔  Created. Open apps/api/.env and fill in any required secrets\n' +
      '       (JWT secrets, PayPal credentials, etc.) before starting the app.',
  );
} else {
  console.log('\n✔  apps/api/.env already exists – skipping copy.');
}

// ── Step 2: Install dependencies ─────────────────────────────────────────────
run('pnpm install');

// ── Step 3: Infrastructure ───────────────────────────────────────────────────
try {
  run('docker compose -f infra/docker-compose.yml up -d');
} catch {
  console.error(
    '\n❌  Docker Compose failed. Please ensure Docker is installed and running,\n' +
      '    then re-run `pnpm setup` (or just `docker compose -f infra/docker-compose.yml up -d`).',
  );
  process.exit(1);
}

// ── Step 4: Prisma client ────────────────────────────────────────────────────
run('pnpm db:generate');

// ── Step 5: Migrations ───────────────────────────────────────────────────────
// --name init is only consumed by Prisma when it needs to create a brand-new
// migration file (fresh repo with no migrations folder yet). When migration
// files already exist in the repository, Prisma simply applies any that are
// pending and the --name flag is silently ignored.
run('pnpm db:migrate:dev -- --name init');

// ── Done ─────────────────────────────────────────────────────────────────────
console.log('\n✅  Setup complete!');
console.log('    Start the app with:');
console.log('      pnpm dev:api   →  http://localhost:3001/api/health');
console.log('      pnpm dev:web   →  http://localhost:3000');
