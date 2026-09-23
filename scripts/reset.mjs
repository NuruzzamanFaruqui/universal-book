// Empties the local database and starts over:
//
//   npm run db:reset
//
// Only ever affects the Docker container on this machine.

import path from 'node:path';
import { ROOT, mustRun, run, ok, bold, red, green } from './lib.mjs';

const API_DIR = path.join(ROOT, 'apps', 'api');
const DATABASE_URL = 'postgresql://universalbook:localdev@localhost:5433/universalbook';
const env = { DATABASE_URL };

console.log(`\n${bold(red('This deletes every book and account in your LOCAL database.'))}`);
console.log('The live site is not affected.\n');
console.log('Starting in 5 seconds — press Ctrl+C to cancel.');
await new Promise((resolve) => setTimeout(resolve, 5000));

await mustRun('docker', ['compose', 'up', '-d', '--wait']);
await mustRun('npx', ['prisma', 'db', 'push', '--force-reset'], {
  cwd: API_DIR,
  env,
});
ok('Database emptied and rebuilt');

await run('node', ['prisma/seed.js'], { cwd: API_DIR, env });
console.log(`\n${green(bold('✓ Done.'))} Run \`npm run dev\`.\n`);
