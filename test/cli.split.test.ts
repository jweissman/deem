import { expect, it } from 'bun:test';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runGeneration } from '../src/cli';

it('reads a scenario whose tables and templates are split across files by domain', () => {
  const root = mkdtempSync(join(tmpdir(), 'deem-split-'));
  try {
    const tables = join(root, 'data', 'world', 'tables'), templates = join(root, 'data', 'world', 'templates');
    mkdirSync(tables, { recursive: true });
    mkdirSync(templates, { recursive: true });
    writeFileSync(join(tables, 'beasts.json'), JSON.stringify({
      beast: { discriminator: 'terrain', groups: { forest: ['wolf'] } } }));
    writeFileSync(join(tables, 'places.json'), JSON.stringify({
      glade: { discriminator: 'kind', groups: { default: ['Moss Hall'] } } }));
    writeFileSync(join(templates, 'encounter.json'), JSON.stringify({
      encounter: { __no_id: true, where: '=lookup(glade, default)', what: '=lookup(beast, forest)' } }));
    const run = runGeneration({ settingDir: root, scenario: 'world', type: 'encounter', seed: 'split' });
    expect(run.output).toEqual({ where: 'Moss Hall', what: 'wolf' });
    writeFileSync(join(tables, 'more.json'), JSON.stringify({ beast: { discriminator: 'x', groups: { a: ['b'] } } }));
    expect(() => runGeneration({ settingDir: root, scenario: 'world', type: 'encounter', seed: 'split' }))
      .toThrow('beast is defined twice');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
