// Shared helpers for the local-development scripts.
//
// Deliberately zero dependencies: these run before `npm install` has happened
// anywhere, so they may only use Node built-ins.

import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const useColour = process.stdout.isTTY && !process.env.NO_COLOR;
const wrap = (code) => (s) => (useColour ? `\u001b[${code}m${s}\u001b[0m` : s);

export const bold = wrap('1');
export const dim = wrap('2');
export const red = wrap('31');
export const green = wrap('32');
export const yellow = wrap('33');
export const blue = wrap('34');
export const magenta = wrap('35');
export const cyan = wrap('36');

let stepNumber = 0;
export function step(title) {
  stepNumber += 1;
  console.log(`\n${bold(cyan(`[${stepNumber}/9]`))} ${bold(title)}`);
}

export function ok(message) {
  console.log(`      ${green('✓')} ${message}`);
}

export function info(message) {
  console.log(`      ${dim(message)}`);
}

export function warn(message) {
  console.log(`      ${yellow('!')} ${message}`);
}

/**
 * Stops with an explanation a non-developer can act on, rather than a stack
 * trace. `fix` is printed as the literal next thing to do.
 */
export function fail(problem, fix) {
  console.error(`\n${red(bold('✗ Stopped:'))} ${problem}`);
  if (fix) console.error(`\n${bold('What to do:')}\n${fix}\n`);
  process.exit(1);
}

/**
 * Runs a command, streaming its output. `shell: true` is what makes `npm` and
 * `npx` resolve on Windows, where they are .cmd files rather than binaries.
 */
export function run(command, args, { cwd = ROOT, env, quiet = false } = {}) {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd,
      shell: true,
      stdio: quiet ? ['ignore', 'pipe', 'pipe'] : 'inherit',
      env: { ...process.env, ...env },
    });

    let output = '';
    if (quiet) {
      child.stdout.on('data', (d) => { output += d; });
      child.stderr.on('data', (d) => { output += d; });
    }

    child.on('error', () => resolve({ code: 1, output }));
    child.on('close', (code) => resolve({ code: code ?? 1, output }));
  });
}

/** Runs a command and stops the whole script if it fails. */
export async function mustRun(command, args, options = {}) {
  const result = await run(command, args, options);
  if (result.code !== 0) {
    if (options.quiet && result.output) console.error(result.output);
    fail(
      `\`${command} ${args.join(' ')}\` failed.`,
      options.hint ?? 'Read the error above, fix it, then run `npm run setup` again.',
    );
  }
  return result;
}

// ─── Safety ─────────────────────────────────────────────────────────────────

import fs from 'node:fs';

/** Reads KEY=value pairs from a .env file. Good enough for a sanity check. */
export function readEnvFile(file) {
  if (!fs.existsSync(file)) return null;
  const values = {};
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (match) values[match[1]] = match[2].replace(/^["']|["']$/g, '');
  }
  return values;
}

export const pointsAtThisMachine = (value = '') =>
  /(^|@|\/\/)(localhost|127\.0\.0\.1)(:|\/|$)/.test(value);

/**
 * Refuses to continue when this checkout is configured against the deployed
 * system. Without it, a local API would happily read and write Cloud SQL.
 */
export function assertLocalEnvironment() {
  const api = readEnvFile(path.join(ROOT, 'apps', 'api', '.env'));
  const web = readEnvFile(path.join(ROOT, 'apps', 'web', '.env.local'));
  const problems = [];

  if (api?.DATABASE_URL && !pointsAtThisMachine(api.DATABASE_URL)) {
    problems.push(
      '  apps/api/.env points at a database that is NOT on this machine.\n' +
        '  Running would read and write the real, live data.',
    );
  }
  if (web?.NEXT_PUBLIC_API_URL && !pointsAtThisMachine(web.NEXT_PUBLIC_API_URL)) {
    problems.push(
      '  apps/web/.env.local points the website at the live API,\n' +
        '  not the one on this machine.',
    );
  }

  if (problems.length) {
    fail(
      'This folder is configured to talk to the live, deployed system.\n\n' +
        problems.join('\n\n'),
      'Move those files aside, then run setup again:\n\n' +
        '  mv apps/api/.env apps/api/.env.cloud\n' +
        '  mv apps/web/.env.local apps/web/.env.local.cloud\n' +
        '  npm run setup\n\n' +
        'Nothing is deleted — you can move them back whenever you like.',
    );
  }
}
