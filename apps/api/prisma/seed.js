/**
 * Demo accounts for local development.
 *
 * Idempotent — running it twice changes nothing. It only ever touches the
 * database in DATABASE_URL, which `npm run setup` points at the local Docker
 * container.
 *
 * CommonJS and a real file on disk on purpose: Prisma 7's driver adapter cannot
 * be initialised from `node -e`.
 */

const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const bcrypt = require('bcryptjs');

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('DATABASE_URL is not set. Run `npm run setup` from the project root.');
  process.exit(1);
}

// Refuse to seed anything that is not on this machine. A demo account with a
// published password must never reach a deployed database.
if (!/(@|\/\/)(localhost|127\.0\.0\.1)(:|\/)/.test(DATABASE_URL)) {
  console.error('Refusing to seed: DATABASE_URL does not point at localhost.');
  process.exit(1);
}

const PASSWORD = 'Password123!';

const ACCOUNTS = [
  {
    email: 'author@local.test',
    name: 'Local Author',
    creditBalance: 500,
    bio: 'A demo account for local development.',
  },
  {
    // Matches the allowlist in admin.controller.ts, so /universalbook-admin
    // is reachable while developing. Local database only.
    email: 'faruqui.swe@diu.edu.bd',
    name: 'Local Admin',
    creditBalance: 500,
    bio: 'Local admin account.',
  },
];

async function main() {
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: DATABASE_URL }),
  });

  try {
    const passwordHash = await bcrypt.hash(PASSWORD, 12);

    for (const account of ACCOUNTS) {
      await prisma.user.upsert({
        where: { email: account.email },
        // Leave an existing account's password and credits alone, so re-running
        // setup never wipes work in progress.
        update: {},
        create: { ...account, passwordHash, emailVerified: true },
      });
      console.log(`  ready: ${account.email}`);
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
