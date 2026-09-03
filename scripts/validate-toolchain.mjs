import {readFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const failures = [];
const warnings = [];
const packageJson = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
const lockfile = await readFile(path.join(root, 'pnpm-lock.yaml'), 'utf8');

const expectedNode = packageJson.engines?.node;
const packageManagerMatch = String(packageJson.packageManager ?? '').match(/^pnpm@(\d+\.\d+\.\d+)$/);
const expectedPnpm = packageManagerMatch?.[1];
const expectedNext = packageJson.dependencies?.next;

if (!/^\d+\.\d+\.\d+$/.test(String(expectedNode ?? ''))) {
  failures.push('package.json engines.node must be one exact x.y.z version.');
} else if (process.versions.node !== expectedNode) {
  failures.push(`Node.js version mismatch: expected ${expectedNode}, running ${process.versions.node}.`);
}

if (!expectedPnpm) failures.push('package.json packageManager must be an exact pnpm@x.y.z version.');
if (packageJson.engines?.pnpm !== expectedPnpm) {
  failures.push(`package.json engines.pnpm must exactly match packageManager (${expectedPnpm ?? 'missing'}).`);
}

function currentPnpmVersion() {
  const userAgent = process.env.npm_config_user_agent ?? '';
  const fromAgent = userAgent.match(/\bpnpm\/(\d+\.\d+\.\d+)\b/)?.[1];
  if (fromAgent) return fromAgent;
  const result = process.platform === 'win32'
    ? spawnSync(process.env.ComSpec ?? 'cmd.exe', ['/d', '/s', '/c', 'pnpm --version'], {encoding: 'utf8'})
    : spawnSync('pnpm', ['--version'], {encoding: 'utf8'});
  return result.status === 0 ? result.stdout.trim() : '';
}

const actualPnpm = currentPnpmVersion();
if (!actualPnpm) failures.push('Unable to determine the pnpm version.');
else if (expectedPnpm && actualPnpm !== expectedPnpm) {
  failures.push(`pnpm version mismatch: expected ${expectedPnpm}, running ${actualPnpm}.`);
}

if (!/^\d+\.\d+\.\d+$/.test(String(expectedNext ?? ''))) {
  failures.push('The Next.js dependency must use one exact x.y.z version.');
}

const lockVersion = lockfile.match(/^lockfileVersion:\s*['"]?([^'"\r\n]+)['"]?/m)?.[1];
if (lockVersion !== '9.0') failures.push(`pnpm-lock.yaml must use lockfileVersion 9.0; found ${lockVersion ?? 'none'}.`);
const lockNextSpecifier = lockfile.match(/^\s{6}next:\r?\n\s{8}specifier:\s*([^\r\n]+)/m)?.[1]?.trim().replace(/^['"]|['"]$/g, '');
if (lockNextSpecifier !== expectedNext) {
  failures.push(`Lockfile Next.js specifier (${lockNextSpecifier ?? 'missing'}) does not match package.json (${expectedNext ?? 'missing'}).`);
}

for (const [name, expected] of Object.entries({...packageJson.dependencies, ...packageJson.devDependencies})) {
  const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = lockfile.match(new RegExp(`^\\s{6}["']?${escapedName}["']?:\\r?\\n\\s{8}specifier:\\s*([^\\r\\n]+)`, 'm'));
  const actual = match?.[1]?.trim().replace(/^['"]|['"]$/g, '');
  if (actual !== expected) failures.push(`Lockfile specifier for ${name} (${actual ?? 'missing'}) does not match package.json (${expected}).`);
}

for (const versionFile of ['.node-version', '.nvmrc']) {
  try {
    const value = (await readFile(path.join(root, versionFile), 'utf8')).trim().replace(/^v/, '');
    if (value !== expectedNode) failures.push(`${versionFile} (${value}) does not match engines.node (${expectedNode}).`);
  } catch {
    failures.push(`${versionFile} is missing.`);
  }
}

warnings.forEach((message) => console.warn(`WARNING: ${message}`));
if (failures.length > 0) {
  failures.forEach((message) => console.error(`ERROR: ${message}`));
  console.error(`Toolchain validation failed with ${failures.length} issue(s).`);
  process.exitCode = 1;
} else {
  console.log(`Toolchain validation passed: Node.js ${expectedNode}, pnpm ${expectedPnpm}, Next.js ${expectedNext}, lockfile ${lockVersion}.`);
}
