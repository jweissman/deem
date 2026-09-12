import { describe, expect, it } from 'bun:test';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildSetting, defaultScaffold, initProject, runGeneration, validateProject } from '../src/cli';

describe('CLI helpers', () => {
  it('builds runtime setting objects from scaffold JSON', () => {
    const scaffold = defaultScaffold();
    const setting = buildSetting(scaffold.tables, scaffold.templates);
    expect(Object.keys(setting).includes('room')).toBe(true);
    expect(Object.keys(setting).includes('terrain')).toBe(true);
  });

  it('initializes project files and preserves files without force', () => {
    const root = mkdtempSync(join(tmpdir(), 'deem-cli-'));
    try {
      const first = initProject({ targetDir: root, force: false, scenario: 'default' });
      const second = initProject({ targetDir: root, force: false, scenario: 'default' });
      expect(first.length).toBe(3);
      expect(second.length).toBe(0);

      const tables = JSON.parse(readFileSync(join(root, 'data/default/tables/deem.tables.json'), 'utf8')) as Record<string, unknown>;
      expect(tables.terrain).toBeDefined();
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('runs generation using initialized project files', () => {
    const root = mkdtempSync(join(tmpdir(), 'deem-run-'));
    try {
      initProject({ targetDir: root, force: true, scenario: 'default' });
      const result = runGeneration({
        settingDir: root,
      });
      expect(result.trace.length).toBeGreaterThan(2);
      expect(result.output).toBeDefined();
      expect(result.resolved.type).toBe('room');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('validates scenario-based config and files', () => {
    const root = mkdtempSync(join(tmpdir(), 'deem-validate-'));
    try {
      initProject({ targetDir: root, force: true, scenario: 'alpha' });
      const result = validateProject({ settingDir: root, scenario: 'alpha' });
      expect(result.ok).toBe(true);
      expect(result.errors.length).toBe(0);
      expect(result.resolved?.scenario).toBe('alpha');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('fails validation when type is missing from options and config', () => {
    const root = mkdtempSync(join(tmpdir(), 'deem-validate-fail-'));
    try {
      initProject({ targetDir: root, force: true, scenario: 'default' });
      const runPath = join(root, 'deem.run.json');
      const runConfig = JSON.parse(readFileSync(runPath, 'utf8')) as Record<string, unknown>;
      delete runConfig.type;
      writeFileSync(runPath, `${JSON.stringify(runConfig, null, 2)}\n`, 'utf8');

      const result = validateProject({ settingDir: root });
      expect(result.ok).toBe(false);
      expect(result.errors.some((e) => e.includes('No generation type provided'))).toBe(true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('uses CLI overrides over run config values', () => {
    const root = mkdtempSync(join(tmpdir(), 'deem-run-override-'));
    try {
      initProject({ targetDir: root, force: true, scenario: 'default' });
      const result = runGeneration({
        settingDir: root,
        type: 'encounter',
        count: 2,
        seed: 'override-seed',
        trace: false,
      });
      expect(result.resolved.type).toBe('encounter');
      expect(result.resolved.count).toBe(2);
      expect(result.resolved.seed).toBe('override-seed');
      expect(Array.isArray(result.output)).toBe(true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('records detailed trace with expression and lookup events when trace is enabled', () => {
    const root = mkdtempSync(join(tmpdir(), 'deem-trace-detail-'));
    try {
      initProject({ targetDir: root, force: true, scenario: 'default' });
      const result = runGeneration({
        settingDir: root,
        trace: true,
      });

      expect(result.trace.length).toBeGreaterThan(2);
      expect(result.trace.some((e) => e.step === 'expression.evaluate.result')).toBe(true);
      expect(result.trace.some((e) => e.step === 'lookup.pick')).toBe(true);
      expect(result.trace.some((e) => e.step === 'template.property.result')).toBe(true);

      const lookupEvent = result.trace.find((e) => e.step === 'lookup.pick');
      expect(lookupEvent).toBeDefined();
      expect(typeof lookupEvent?.detail.tableName).toBe('string');
      expect(typeof lookupEvent?.detail.pickedIndex).toBe('number');
      expect(Array.isArray(lookupEvent?.detail.scope)).toBe(true);

      const expressionEvent = result.trace.find((e) => e.step === 'expression.evaluate.result');
      expect(expressionEvent).toBeDefined();
      expect(typeof expressionEvent?.detail.expression).toBe('string');
      expect(Array.isArray(expressionEvent?.detail.scope)).toBe(true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('returns empty trace when trace is disabled', () => {
    const root = mkdtempSync(join(tmpdir(), 'deem-trace-off-'));
    try {
      initProject({ targetDir: root, force: true, scenario: 'default' });
      const result = runGeneration({
        settingDir: root,
        trace: false,
      });
      expect(result.trace).toEqual([]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('fails validation when scenario files are missing by default', () => {
    const root = mkdtempSync(join(tmpdir(), 'deem-missing-scenario-'));
    try {
      writeFileSync(join(root, 'deem.run.json'), JSON.stringify({ type: 'room' }, null, 2), 'utf8');
      const result = validateProject({ settingDir: root });
      expect(result.ok).toBe(false);
      expect(result.errors.some((e) => e.includes('Missing scenario files'))).toBe(true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('allows default setting fallback when requested', () => {
    const root = mkdtempSync(join(tmpdir(), 'deem-fallback-'));
    try {
      writeFileSync(join(root, 'deem.run.json'), JSON.stringify({ type: 'room' }, null, 2), 'utf8');
      const result = validateProject({ settingDir: root, allowDefaultSetting: true });
      expect(result.ok).toBe(true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('fails validation when requested type does not exist in resolved setting', () => {
    const root = mkdtempSync(join(tmpdir(), 'deem-unknown-type-'));
    try {
      initProject({ targetDir: root, force: true, scenario: 'default' });
      const result = validateProject({ settingDir: root, type: 'notATemplate' });
      expect(result.ok).toBe(false);
      expect(result.errors.some((e) => e.includes('Unknown generation type'))).toBe(true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('fails validation for empty table group arrays', () => {
    const root = mkdtempSync(join(tmpdir(), 'deem-empty-group-'));
    try {
      initProject({ targetDir: root, force: true, scenario: 'default' });
      const tablesPath = join(root, 'data/default/tables/deem.tables.json');
      const tables = JSON.parse(readFileSync(tablesPath, 'utf8')) as Record<string, any>;
      tables.terrain.groups.default = [];
      writeFileSync(tablesPath, `${JSON.stringify(tables, null, 2)}\n`, 'utf8');

      const result = validateProject({ settingDir: root });
      expect(result.ok).toBe(false);
      expect(result.errors.some((e) => e.includes('cannot be an empty array'))).toBe(true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('fails validation for empty template objects', () => {
    const root = mkdtempSync(join(tmpdir(), 'deem-empty-template-'));
    try {
      initProject({ targetDir: root, force: true, scenario: 'default' });
      const templatesPath = join(root, 'data/default/templates/deem.templates.json');
      const templates = JSON.parse(readFileSync(templatesPath, 'utf8')) as Record<string, any>;
      templates.room = {};
      writeFileSync(templatesPath, `${JSON.stringify(templates, null, 2)}\n`, 'utf8');

      const result = validateProject({ settingDir: root });
      expect(result.ok).toBe(false);
      expect(result.errors.some((e) => e.includes('must include at least one property'))).toBe(true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
