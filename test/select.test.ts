import { expect, it } from 'bun:test';
import Generator from '../src/Generator';
import { Template } from '../src/Template';
import { Table } from '../src/Table';

it('select uses active-context functions, candidate binding, weights and strict empty results', () => {
  const setting = {
    options: new Table('options', 'kind').group('a', [{ key: 'a' }, { key: 'a' }]).group('b', [{ key: 'b' }]),
    constraints: new Table('constraints', 'kind').group('allowed', ['b']),
    example: new Template('example', { __no_id: true,
      chosen: `=select(options, default, '(!defined("wanted")) || dig(#__it, "key") == #wanted')` }),
    nested: new Template('nested', { __no_id: true,
      chosen: `=select(options, default, 'dig(#__it, "key") == lookup(constraints, allowed)')` }),
  };
  const runtime = Template.bootstrapDeem({ seed: 'strict-selection' }, setting);
  const options = { wanted: 'b', __it: { key: 'wrong-outer-value' }, __setting: setting, __deemRuntime: runtime };
  expect(Generator.gen('example', options)).toMatchObject({ chosen: { key: 'b' } });
  expect(Generator.gen('nested', options)).toMatchObject({ chosen: { key: 'b' } });
  const invalid = { ...options, wanted: 'missing' };
  expect(() => Generator.gen('example', invalid)).toThrow('No matching options');
  let weighted: number | undefined;
  expect(Generator.lookupInTable('options', 'default', false, {
    setting, strict: true, condition: 'true', randomFunc: max => { weighted = max; return 2; },
  })).toEqual({ key: 'b' });
  expect(weighted).toBe(3);
});

it('gen accepts scoped object overrides without changing inheritance or adding parameter fields to output', () => {
  const setting = {
    child: new Template('child', { __no_id: true, level: 1, inherited: '="#terrain"' }),
    parent: new Template('parent', { __no_id: true, _parameters: { level: 4 }, '*result': '=gen(child, #_parameters)' }),
  };
  const runtime = Template.bootstrapDeem({ seed: 'parameters' }, setting);
  const options = { terrain: 'forest', __setting: setting, __deemRuntime: runtime };
  expect(Generator.gen('parent', options)).toEqual({ level: 4, inherited: 'forest' });
  expect(Generator.gen('child', options)).toEqual({ level: 1, inherited: 'forest' });
  expect(() => runtime.evaluate('gen(child, 3)', { terrain: 'forest' })).toThrow('parameters must be an object');
});

it('selects only candidates that own every requested dimension', () => {
  const setting = {
    owners: new Table('owners', 'family').group('dragon', ['lineage', 'maturity']).group('humanoid', ['classId'])
      .group('animal', []),
    families: new Table('families', 'terrain').group('any', ['animal', 'humanoid', 'dragon']),
    pick: new Template('pick', { __no_id: true, family: `=select(families, any,
      'count(definedOf(except(gatherEntries(owners, "default"), gatherEntries(owners, #__it)))) == 0')` }),
  };
  const runtime = Template.bootstrapDeem({ seed: 'owners' }, setting);
  const pick = (request: Record<string, string>) =>
    Generator.gen('pick', { __setting: setting, __deemRuntime: runtime, ...request } as Parameters<typeof Generator.gen>[1]);
  for (let i = 0; i < 8; i++) {
    expect(pick({ lineage: 'red' })).toEqual({ family: 'dragon' });
    expect(pick({ classId: 'ranger' })).toEqual({ family: 'humanoid' });
  }
  expect(() => pick({ lineage: 'red', classId: 'ranger' })).toThrow('No matching options');
  expect(runtime.evaluate('gatherEntries(owners, default)', {})).toEqual(['lineage', 'maturity', 'classId']);
  expect(runtime.evaluate('except(gatherEntries(owners, default), gatherEntries(owners, dragon))', {})).toEqual(['classId']);
});
