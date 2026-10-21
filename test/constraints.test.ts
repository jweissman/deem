import { expect, it } from 'bun:test';
import Generator from '../src/Generator';
import { Template } from '../src/Template';
import { Table } from '../src/Table';

it('fits matches a row to the dimensions the context asks for, by field or by a _<name>s map, and ignores the rest', () => {
  const setting = {
    kinds: new Table('kinds', 'family').group('animal', [
      { body: 'wolf', _terrains: { forest: true, frost: true } },
      { body: 'spider', _terrains: { cave: true } },
    ]),
    pick: new Template('pick', { __no_id: true, kind: `=select(kinds, animal, 'fits(#__it, "terrain", "body")')` }),
  };
  const runtime = Template.bootstrapDeem({ seed: 'fits' }, setting);
  const pick = (request: Record<string, string>) => Generator.gen('pick',
    { __setting: setting, __deemRuntime: runtime, ...request } as Parameters<typeof Generator.gen>[1]);
  for (let i = 0; i < 6; i++) {
    expect(pick({ terrain: 'cave' })).toEqual({ kind: { body: 'spider', _terrains: { cave: true } } });
    expect(pick({ terrain: 'forest', body: 'wolf' })).toMatchObject({ kind: { body: 'wolf' } });
  }
  expect(() => pick({ terrain: 'cave', body: 'wolf' })).toThrow('No matching options');
  expect(() => runtime.evaluate('fits(3, "terrain")', {})).toThrow('fits() expects a table row');
});

it('owns asks whether a group holds every dimension the context defines among a table\'s entries', () => {
  const setting = {
    owners: new Table('owners', 'family').group('dragon', ['lineage', 'maturity']).group('humanoid', ['classId']),
    families: new Table('families', 'terrain').group('any', ['humanoid', 'dragon']),
    pick: new Template('pick', { __no_id: true, family: `=select(families, any, 'owns(owners, #__it)')` }),
  };
  const runtime = Template.bootstrapDeem({ seed: 'owns' }, setting);
  const pick = (request: Record<string, string>) => Generator.gen('pick',
    { __setting: setting, __deemRuntime: runtime, ...request } as Parameters<typeof Generator.gen>[1]);
  for (let i = 0; i < 6; i++) {
    expect(pick({ lineage: 'red' })).toEqual({ family: 'dragon' });
    expect(pick({ classId: 'ranger' })).toEqual({ family: 'humanoid' });
  }
  expect(() => pick({ lineage: 'red', classId: 'ranger' })).toThrow('No matching options');
  expect(runtime.evaluate('owns(owners, dragon)', { maturity: 'ancient' })).toBe(true);
  expect(runtime.evaluate('owns(owners, humanoid)', { maturity: 'ancient' })).toBe(false);
});
