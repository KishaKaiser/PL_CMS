import { spawn } from 'node:child_process';

const isWindows = process.platform === 'win32';
const pnpm = isWindows ? 'pnpm.cmd' : 'pnpm';

const apiPort = process.env.API_PORT ?? '3001';
const webPort = process.env.WEB_PORT ?? process.env.PORT ?? '3000';
const internalApiBase = process.env.INTERNAL_API_BASE_URL ?? process.env.API_BASE_URL ?? `http://127.0.0.1:${apiPort}/api`;

const children = new Set();

function start(name, command, args, env) {
  const child = spawn(command, args, {
    env,
    stdio: 'inherit',
    shell: false,
  });

  children.add(child);

  child.on('exit', () => {
    children.delete(child);
  });

  child.on('error', (error) => {
    console.error(`${name} failed to start:`, error);
  });

  return child;
}

function stopAll(signal = 'SIGTERM') {
  for (const child of children) {
    if (!child.killed) {
      child.kill(signal);
    }
  }
}

function watch(child, name) {
  return new Promise((resolve) => {
    child.on('exit', (code, signal) => {
      resolve({ name, code, signal });
    });
  });
}

console.log(`Starting PL_CMS web on port ${webPort}.`);
console.log(`Starting PL_CMS API on internal port ${apiPort}.`);
console.log(`Web server API base: ${internalApiBase}`);

const api = start('API', pnpm, ['--filter', '@pl-cms/api', 'start'], {
  ...process.env,
  PORT: apiPort,
});

const web = start('Web', pnpm, ['--filter', '@pl-cms/web', 'exec', 'next', 'start', '-p', webPort], {
  ...process.env,
  PORT: webPort,
  API_BASE_URL: internalApiBase,
  INTERNAL_API_BASE_URL: internalApiBase,
});

process.on('SIGINT', () => {
  stopAll('SIGINT');
});

process.on('SIGTERM', () => {
  stopAll('SIGTERM');
});

watch(api, 'API').then((result) => {
  console.error(`${result.name} stopped. The website will stay online, but API-backed features will be unavailable.`);
  if (typeof result.code === 'number') {
    console.error(`${result.name} exit code: ${result.code}`);
  }
  if (result.signal) {
    console.error(`${result.name} signal: ${result.signal}`);
  }
});

const result = await watch(web, 'Web');

console.error(`${result.name} stopped.`);
stopAll();

if (typeof result.code === 'number') {
  process.exit(result.code);
}

process.exit(1);
