import { describe, expect, it } from 'bun:test';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { initProject, listTemplates } from '../src/cli';

describe('deem list', () => {
  const withProject = (check: (root: string) => void): void => {
    const root = mkdtempSync(join(tmpdir(), 'deem-list-'));
    try {
      initProject({ targetDir: root, scenario: 'alpha' });
      check(root);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  };

  it('lists sorted templates without requiring a configured type or including tables', () => {
    withProject((root) => {
      writeFileSync(join(root, 'deem.run.json'), JSON.stringify({ scenario: 'alpha' }));
      expect(listTemplates({ settingDir: root })).toEqual(['encounter', 'room']);

    });
  });

  it('uses explicit template paths and supports empty template collections', () => {
    withProject((root) => {
      writeFileSync(join(root, 'custom.json'), JSON.stringify({ zebra: { name: 'Z' }, apple: { name: 'A' } }));
      expect(listTemplates({ settingDir: root, templatesPath: 'custom.json' })).toEqual(['apple', 'zebra']);
      writeFileSync(join(root, 'custom.json'), '{}');
      expect(listTemplates({ settingDir: root, templatesPath: 'custom.json' })).toEqual([]);
    });
  });

  it('reports invalid templates', () => {
    withProject((root) => {
      writeFileSync(join(root, 'data/alpha/templates/deem.templates.json'), '{"broken":{}}');
      expect(() => listTemplates({ settingDir: root })).toThrow('must include at least one property');

    });
  });

  it('uses legacy project files without a run configuration', () => {
    withProject((root) => {
      rmSync(join(root, 'deem.run.json'));
      writeFileSync(join(root, 'deem.tables.json'), '{}');
      writeFileSync(join(root, 'deem.templates.json'), '{"legacy":{"name":"Legacy"}}');
      expect(listTemplates({ settingDir: root })).toEqual(['legacy']);
    });
  });
});
