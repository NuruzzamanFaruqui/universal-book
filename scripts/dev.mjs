// Runs everything needed to use the site locally:
//
//   npm run dev
//
// Starts the database if it is not already up, then the API and the website
// together, with their output interleaved and labelled. Ctrl+C stops both.

import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, run, fail, assertLocalEnvironment, bold, dim, green, magenta, cyan } from './lib.mjs';

if (!fs.existsSync(path.join(ROOT, 'apps', 'api', 'node_modules'))) {
  fail('This project has not been set up on this machine yet.', 'Run:\n\n  npm run setup');
}

// Never let a local run touch the deployed database.
assertLocalEnvironment();

console.log(bold('\n📚 Universal Book\n'));

process.stdout.write(dim('   Starting the database… '));
const db = await run('docker', ['compose', 'up', '-d', '--wait'], { quiet: true });
if (db.code !== 0) {
  console.log('');
  fail('The database would not start.', 'Open Docker Desktop, wait until it says "Engine running",\nthen run `npm run dev` again.');
}
console.log(green('ready'));

const services = [
  { name: 'api', colour: magenta, cwd: 'apps/api', args: ['run', 'start:dev'] },
  { name: 'web', colour: cyan, cwd: 'apps/web', args: ['run', 'dev'] },
];

const children = [];
let shuttingDown = false;

for (const service of services) {
  const child = spawn('npm', service.args, {
    cwd: path.join(ROOT, service.cwd),
    shell: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  const label = service.colour(bold(service.name.padEnd(3)));
  const prefix = (chunk) => {
    for (const line of chunk.toString().split('\n')) {
      if (line.trim()) console.log(`${label} ${dim('│')} ${line}`);
    }
  };

  child.stdout.on('data', prefix);
  child.stderr.on('data', prefix);
  child.on('close', (code) => {
    if (shuttingDown) return;
    console.log(`${label} ${dim('│')} stopped (exit ${code})`);
    stop(code ?? 1);
  });

  children.push(child);
}

console.log(`
   ${bold('Website')}   ${cyan('http://localhost:3000')}
   ${bold('API')}       ${dim('http://localhost:8080/api')}

   ${dim('Sign in as author@local.test / Password123!')}
   ${dim('Press Ctrl+C to stop.')}
`);

function stop(code = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const child of children) {
    try { child.kill('SIGTERM'); } catch { /* already gone */ }
  }
  // The database is left running on purpose — starting it again is slow, and
  // it costs nothing idle. `npm run db:stop` shuts it down.
  setTimeout(() => process.exit(code), 400);
}

process.on('SIGINT', () => stop(0));
process.on('SIGTERM', () => stop(0));
