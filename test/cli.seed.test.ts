import { expect, it } from 'bun:test';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { initProject, runGeneration } from '../src/cli';

it('uses fresh seeds by default and preserves explicit and configured seeds', () => {
  const root = mkdtempSync(join(tmpdir(), 'deem-seed-'));
  try {
    initProject({ targetDir: root });
    const first = runGeneration({ settingDir: root });
    const second = runGeneration({ settingDir: root });
    expect(first.resolved.seed).not.toBe(second.resolved.seed);
    const replay = runGeneration({ settingDir: root, seed: first.resolved.seed });
    expect(replay.output).toEqual(first.output);
    writeFileSync(join(root, 'deem.run.json'), JSON.stringify({ type: 'room', seed: 'configured' }));
    expect(runGeneration({ settingDir: root }).resolved.seed).toBe('configured');
    expect(runGeneration({ settingDir: root, seed: 'override' }).resolved.seed).toBe('override');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
