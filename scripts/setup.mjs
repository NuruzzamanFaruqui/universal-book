// One-time setup for running Universal Book on your own machine.
//
//   npm run setup
//
// Safe to run again at any time: it never overwrites an .env file you already
// have, and it never touches anything outside this folder and its own Docker
// database container.

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { ROOT, step, ok, info, warn, fail, run, mustRun, assertLocalEnvironment,
         bold, green, cyan, dim } from './lib.mjs';

const API_DIR = path.join(ROOT, 'apps', 'api');
const WEB_DIR = path.join(ROOT, 'apps', 'web');
const API_ENV = path.join(API_DIR, '.env');
const WEB_ENV = path.join(WEB_DIR, '.env.local');

const LOCAL_DATABASE_URL =
  'postgresql://universalbook:localdev@localhost:5433/universalbook';
const LOCAL_API_URL = 'http://localhost:8080';

console.log(bold('\n📚 Universal Book — local setup\n'));
console.log(dim('   This takes a few minutes the first time, mostly downloading.'));

// ─── 1. Node ────────────────────────────────────────────────────────────────

step('Checking Node.js');
const major = Number(process.versions.node.split('.')[0]);
if (major < 20) {
  fail(
    `This project needs Node.js 20 or newer. You have ${process.versions.node}.`,
    'Install the "LTS" version from https://nodejs.org, close VS Code,\n' +
      'open it again, then run `npm run setup`.',
  );
}
ok(`Node.js ${process.versions.node}`);

// ─── 2. Docker ──────────────────────────────────────────────────────────────

step('Checking Docker');
const dockerHint =
  'Install Docker Desktop from https://www.docker.com/products/docker-desktop\n' +
  'Open it and wait until it says "Engine running", then run `npm run setup` again.';

if ((await run('docker', ['--version'], { quiet: true })).code !== 0) {
  fail('Docker is not installed. It is what runs the database.', dockerHint);
}
if ((await run('docker', ['info'], { quiet: true })).code !== 0) {
  fail('Docker is installed but not running.', dockerHint);
}
ok('Docker is running');

// ─── 3. Existing settings files ─────────────────────────────────────────────

step('Checking for existing settings');
assertLocalEnvironment();
ok('No conflicting settings');

// ─── 4. Settings files ──────────────────────────────────────────────────────

step('Writing settings files');

if (fs.existsSync(API_ENV)) {
  ok('apps/api/.env already exists — left alone');
} else {
  fs.writeFileSync(
    API_ENV,
    `# Local development settings. Created by \`npm run setup\`.
# This file is ignored by git and never leaves your machine.

# The database running in Docker (see docker-compose.yml).
DATABASE_URL=${LOCAL_DATABASE_URL}

# Signs login tokens. Randomly generated just for you.
JWT_SECRET=${crypto.randomBytes(48).toString('base64')}

NODE_ENV=development
PORT=8080
APP_URL=http://localhost:3000

# ─── Optional ────────────────────────────────────────────────────────────────
# Everything below is optional. The app runs fine without it.
#
# ANTHROPIC_API_KEY  — the AI writing features. Without it they show a friendly
#                      "AI is unavailable" message instead of working.
# STRIPE_SECRET_KEY  — buying credits with a card. Without it, use the seeded
#                      account, which already has credits.
# SMTP_* / RESEND_API_KEY — sending real email. Without them, password-reset
#                      links are printed into the terminal instead, which is
#                      what you want locally anyway.

ANTHROPIC_API_KEY=
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
`,
  );
  ok('apps/api/.env created (with a fresh random JWT_SECRET)');
}

if (fs.existsSync(WEB_ENV)) {
  ok('apps/web/.env.local already exists — left alone');
} else {
  fs.writeFileSync(
    WEB_ENV,
    `# Local development settings. Created by \`npm run setup\`.
# Points the website at the API running on this machine instead of the live one.

NEXT_PUBLIC_API_URL=${LOCAL_API_URL}
`,
  );
  ok('apps/web/.env.local created');
}

// ─── 5. Database ────────────────────────────────────────────────────────────

step('Starting the database');
info('First run downloads PostgreSQL — about 80 MB.');
await mustRun('docker', ['compose', 'up', '-d', '--wait'], {
  hint:
    'Make sure Docker Desktop is running, then try again.\n' +
    'If port 5433 is already taken, change it in docker-compose.yml.',
});
ok('Database running on port 5433');

// ─── 6 & 7. Dependencies ────────────────────────────────────────────────────

step('Installing the API packages');
info('Several minutes the first time. Warnings are normal.');
await mustRun('npm', ['install'], { cwd: API_DIR });
ok('API packages installed');

step('Installing the website packages');
await mustRun('npm', ['install'], { cwd: WEB_DIR });
ok('Website packages installed');

// ─── 8. Schema ──────────────────────────────────────────────────────────────

step('Creating the database tables');
const prismaEnv = { DATABASE_URL: LOCAL_DATABASE_URL };
await mustRun('npx', ['prisma', 'generate'], { cwd: API_DIR, env: prismaEnv });
await mustRun('npx', ['prisma', 'db', 'push'], {
  cwd: API_DIR,
  env: prismaEnv,
});
ok('Tables created');

// ─── 9. Demo accounts ───────────────────────────────────────────────────────

step('Creating demo accounts');
const seeded = await run('node', ['prisma/seed.js'], { cwd: API_DIR, env: prismaEnv, quiet: true });
if (seeded.code === 0) {
  ok('Demo accounts ready');
} else {
  warn('Could not create the demo accounts — you can still register your own.');
  info(seeded.output.trim().split('\n').slice(-3).join('\n      '));
}

// ─── Done ───────────────────────────────────────────────────────────────────

console.log(`
${green(bold('✓ Setup finished.'))}

${bold('Now run:')}

    ${cyan('npm run dev')}

Then open ${cyan('http://localhost:3000')} in your browser.

${bold('Sign in with:')}

    Email     ${cyan('author@local.test')}
    Password  ${cyan('Password123!')}

That account already has 500 credits, so nothing asks you to pay.
`);
