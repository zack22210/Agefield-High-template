import process from 'node:process';
import {
  DEFAULT_SITE_URL,
  resolveSiteUrlEnvironment,
  SITE_URL_ENV_NAMES,
  tryNormalizeSiteUrl
} from '../src/config/site-url.ts';

// Add future build-time secrets here. Values are never printed.
const REQUIRED_BUILD_VARIABLES = [];
const failures = [];

console.log('Build environment validation');

for (const name of SITE_URL_ENV_NAMES) {
  const value = process.env[name];
  if (!value?.trim()) {
    console.log(`INFO: ${name} is not set.`);
    continue;
  }

  const normalized = tryNormalizeSiteUrl(value);
  if (normalized) {
    console.log(`OK: ${name} is set and normalizes to ${normalized}.`);
  } else {
    console.warn(
      `WARNING: ${name} is set but invalid. Expected an HTTP(S) origin or bare domain; ` +
      `example: https://example.com. The raw value was not printed.`
    );
  }
}

const resolution = resolveSiteUrlEnvironment(process.env);
if (resolution.usedFallback) {
  const reason = resolution.reason === 'invalid'
    ? `${resolution.source} could not be parsed`
    : 'no site URL variable is set';
  console.warn(
    `WARNING: ${reason}; using the safe template fallback ${DEFAULT_SITE_URL}. ` +
    'This URL issue does not block the build.'
  );
} else {
  console.log(`OK: canonical site origin comes from ${resolution.source}: ${resolution.url}.`);
}

const normalizedConfigured = SITE_URL_ENV_NAMES
  .map((name) => ({name, value: tryNormalizeSiteUrl(process.env[name])}))
  .filter((item) => item.value);
if (new Set(normalizedConfigured.map((item) => item.value)).size > 1) {
  console.warn(
    `WARNING: ${SITE_URL_ENV_NAMES.join(' and ')} resolve to different origins; ` +
    `${resolution.source} takes precedence.`
  );
}

for (const requirement of REQUIRED_BUILD_VARIABLES) {
  const value = process.env[requirement.name];
  if (!value?.trim()) {
    failures.push(`${requirement.name}: missing required build configuration (${requirement.description}).`);
  } else {
    console.log(`OK: ${requirement.name} is set (value hidden).`);
  }
}

if (failures.length > 0) {
  failures.forEach((message) => console.error(`ERROR: ${message}`));
  console.error(`Environment validation failed with ${failures.length} blocking issue(s).`);
  process.exitCode = 1;
} else {
  console.log('Environment validation passed. No sensitive values were printed.');
}
