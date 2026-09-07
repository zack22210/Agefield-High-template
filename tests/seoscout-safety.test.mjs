import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

const root = process.cwd();

test('phase-B scripts pin and verify the approved SEOScout source', async () => {
  const common = await readFile(path.join(root, 'scripts', 'seoscout-common.ps1'), 'utf8');
  assert.match(common, /https:\/\/github\.com\/libin257\/seoscout\.git/);
  assert.match(common, /\$SeoScoutPinnedCommit = '[0-9a-f]{40}'/);
  assert.match(common, /remote get-url origin/);
  assert.match(common, /status --porcelain --untracked-files=all/);
  assert.match(common, /patched_files/);
  assert.match(common, /\$SeoScoutExpectedPatchHashes/);
  assert.match(common, /seoscout\/core\/youtube\.py/);
  assert.match(common, /seoscout\/collect\.py/);
});

test('repair is explicit, recoverable, and health runs before shared code', async () => {
  const packageJson = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
  const wrapper = await readFile(path.join(root, 'scripts', 'seoscout.ps1'), 'utf8');
  const setup = await readFile(path.join(root, 'scripts', 'setup-seoscout.ps1'), 'utf8');

  assert.ok(packageJson.scripts['seoscout:health']);
  assert.ok(packageJson.scripts['seoscout:repair']);
  assert.match(wrapper, /Assert-SeoScoutInstallation -SharedPath \$SharedPath/);
  assert.match(setup, /backups\\\$timestamp/);
  assert.match(setup, /Invoke-VerifiedClone/);
  assert.doesNotMatch(wrapper, /seoscout\.exe/);
});

test('project secrets stay untracked and noninteractive pnpm does not prompt', async () => {
  const gitignore = await readFile(path.join(root, '.gitignore'), 'utf8');
  const workspace = await readFile(path.join(root, 'pnpm-workspace.yaml'), 'utf8');
  const common = await readFile(path.join(root, 'scripts', 'seoscout-common.ps1'), 'utf8');
  const wrapper = await readFile(path.join(root, 'scripts', 'seoscout.ps1'), 'utf8');
  const setup = await readFile(path.join(root, 'scripts', 'setup-seoscout.ps1'), 'utf8');
  assert.match(gitignore, /^seoscout\/\.env$/m);
  assert.match(workspace, /^verifyDepsBeforeRun: false$/m);
  assert.match(common, /Get-SeoScoutSharedKeysPath/);
  assert.match(common, /keys\.env/);
  assert.match(common, /Ensure-SeoScoutProjectEnv/);
  assert.match(wrapper, /Ensure-SeoScoutProjectEnv -ProjectRoot \$ProjectRoot -SharedPath \$SharedPath/);
  assert.match(setup, /Ensure-SeoScoutProjectEnv -ProjectRoot \$ProjectRoot -SharedPath \$SharedPath/);
  assert.doesNotMatch(common, /SERPER_API_KEY=[A-Za-z0-9]{16,}/);
  assert.doesNotMatch(wrapper, /LLM_API_KEY=sk-/);
  assert.doesNotMatch(setup, /LLM_API_KEY=sk-/);
});

test('collect extracts transcripts for the top 3-5 videos by view count', async () => {
  const patch = await readFile(path.join(root, 'scripts', 'patch-seoscout-trafilatura.py'), 'utf8');
  const wrapper = await readFile(path.join(root, 'scripts', 'seoscout.ps1'), 'utf8');
  const envExample = await readFile(path.join(root, 'seoscout', '.env.example'), 'utf8');
  assert.match(patch, /select_top_viewed_youtube/);
  assert.match(patch, /view_count/);
  assert.match(patch, /limit = max\(3, min\(int\(max_k or 5\), 5\)\)/);
  assert.doesNotMatch(patch, /youtube_metadata_content/);
  assert.match(wrapper, /YOUTUBE_EXTRACT_TOP_K' -Default 5 -Min 3 -Max 5/);
  assert.match(envExample, /YOUTUBE_EXTRACT_TOP_K=5/);
});
