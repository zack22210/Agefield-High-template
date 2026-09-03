import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import path from 'node:path';
import test from 'node:test';
import {
  DEFAULT_SITE_URL,
  normalizeSiteUrl,
  resolveSiteUrlEnvironment,
  tryNormalizeSiteUrl
} from '../src/config/site-url.ts';

const validCases = [
  ['bare domain', 'example.com', 'https://example.com'],
  ['HTTPS URL', 'https://example.com', 'https://example.com'],
  ['trailing slash', 'https://example.com/', 'https://example.com'],
  ['whitespace', '  https://example.com/  ', 'https://example.com'],
  ['single quotes', "'https://example.com/'", 'https://example.com'],
  ['double quotes', '"https://example.com/"', 'https://example.com'],
  ['Markdown link', '[https://example.com](https://example.com/)', 'https://example.com'],
  ['path is reduced to the origin', 'https://example.com/wiki/', 'https://example.com']
];

for (const [name, input, expected] of validCases) {
  test(`normalizes ${name}`, () => assert.equal(normalizeSiteUrl(input), expected));
}

test('uses the safe default for an empty value', () => {
  assert.equal(normalizeSiteUrl(''), DEFAULT_SITE_URL);
  assert.deepEqual(resolveSiteUrlEnvironment({}), {
    url: DEFAULT_SITE_URL,
    source: 'default',
    usedFallback: true,
    reason: 'missing'
  });
});

test('uses the safe default for a completely invalid value', () => {
  assert.equal(tryNormalizeSiteUrl('not a valid site url !!!'), null);
  assert.deepEqual(resolveSiteUrlEnvironment({NEXT_PUBLIC_SITE_URL: 'not a valid site url !!!'}), {
    url: DEFAULT_SITE_URL,
    source: 'NEXT_PUBLIC_SITE_URL',
    usedFallback: true,
    reason: 'invalid'
  });
});

test('prefers NEXT_PUBLIC_SITE_URL over SITE_URL', () => {
  assert.deepEqual(
    resolveSiteUrlEnvironment({NEXT_PUBLIC_SITE_URL: 'primary.example', SITE_URL: 'secondary.example'}),
    {url: 'https://primary.example', source: 'NEXT_PUBLIC_SITE_URL', usedFallback: false}
  );
});

test('rejects credentials and non-HTTP protocols', () => {
  assert.equal(tryNormalizeSiteUrl('https://user:secret@example.com'), null);
  assert.equal(tryNormalizeSiteUrl('javascript:alert(1)'), null);
});

test('environment validation reports an invalid URL without leaking it or blocking the build', () => {
  const {NEXT_PUBLIC_SITE_URL: _publicUrl, SITE_URL: _serverUrl, ...environment} = process.env;
  const invalid = 'invalid URL token=do-not-print';
  const result = spawnSync(process.execPath, [path.resolve('scripts/validate-env.mjs')], {
    encoding: 'utf8',
    env: {...environment, NEXT_PUBLIC_SITE_URL: invalid}
  });
  const output = `${result.stdout}${result.stderr}`;
  assert.equal(result.status, 0);
  assert.match(output, /NEXT_PUBLIC_SITE_URL is set but invalid/);
  assert.match(output, /safe template fallback/);
  assert.doesNotMatch(output, /do-not-print/);
});
