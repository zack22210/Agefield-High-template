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

function parseVersion(value) {
  const match = String(value ?? '').match(/^(\d+)\.(\d+)\.(\d+)$/);
  return match ? match.slice(1).map(Number) : null;
}

function compareVersions(left, right) {
  for (let index = 0; index < 3; index += 1) {
    if (left[index] !== right[index]) return left[index] - right[index];
  }
  return 0;
}

const nodeRangeMatch = String(expectedNode ?? '').match(/^>=(\d+\.\d+\.\d+) <(\d+)$/);
const minimumNode = parseVersion(nodeRangeMatch?.[1]);
const maximumNodeMajor = Number(nodeRangeMatch?.[2]);
const actualNode = parseVersion(process.versions.node);

if (!minimumNode || !Number.isInteger(maximumNodeMajor) || maximumNodeMajor !== minimumNode[0] + 1) {
  failures.push('package.json engines.node must be a bounded range such as >=24.18.0 <25.');
} else if (!actualNode || compareVersions(actualNode, minimumNode) < 0 || actualNode[0] >= maximumNodeMajor) {
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
    const pinnedNode = parseVersion(value);
    if (!pinnedNode) failures.push(`${versionFile} must contain one exact x.y.z version.`);
    else if (minimumNode && maximumNodeMajor && (compareVersions(pinnedNode, minimumNode) < 0 || pinnedNode[0] >= maximumNodeMajor)) {
      failures.push(`${versionFile} (${value}) is outside engines.node (${expectedNode}).`);
    }
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
  console.log(`Toolchain validation passed: Node.js ${process.versions.node} (${expectedNode}), pnpm ${expectedPnpm}, Next.js ${expectedNext}, lockfile ${lockVersion}.`);
}
