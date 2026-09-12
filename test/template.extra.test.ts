import { describe, expect, it } from 'bun:test';
import { Table } from '../src/Table';
import { Template } from '../src/Template';
import type { GenerationSetting } from '../src/Generator';

describe('Template contextual helpers and overlays', () => {
  const setting: GenerationSetting = {
    terrain: new Table('terrain', 'kind').group('default', ['forest', 'swamp']),
    roomName: new Table('roomName', 'terrain')
      .group('forest', ['Moss Hall'])
      .group('swamp', ['Bog Shrine']),
    child: new Template('child', {
      label: '=defined("_terrain") ? lookup(roomName, #_terrain) : lookup(roomName, forest)',
      tone: '=oneOf(low, medium, high)',
    }),
    room: new Template('room', {
      _terrain: '=pick(gatherEntries(terrain, default), 0)',
      name: '=lookup(roomName, #_terrain)',
      hasEntry: '=hasEntry(roomName, #_terrain)',
      hasValue: '=hasValue(roomName, #name)',
      findGroup: '=findGroup(roomName, #name)',
      gathered: '=gather(terrain, 2)',
      generated: '=gen(child)',
      generatedIso: '=genIsolated(child)',
      list: '=genList(child, 2)',
      listIso: '=genListIsolated(child, 2)',
      mapped: '=mapGenList(child, gatherEntries(terrain, default), "_terrain")',
      healFx: '=fxHeal(5)',
      damageFx: '=fxDamage(2, fire)',
      evald: '=eval("1+2")',
      isDefined: '=defined(name)',
    }),
  };

  it('supports bootstrap contextual stdlib helper methods', () => {
    const out = setting.room;
    expect(out).toBeInstanceOf(Template);
    const result = (out as Template).assembleProperties({ seed: 'seed-1', __setting: setting });

    expect(result.name).toBeDefined();
    expect(result.hasEntry).toBe(true);
    expect(result.hasValue).toBe(true);
    expect(['forest', 'swamp']).toContain(result.findGroup);
    expect(Array.isArray(result.gathered)).toBe(true);
    expect(result.generated).toBeDefined();
    expect(result.generatedIso).toBeDefined();
    expect(Array.isArray(result.list)).toBe(true);
    expect(Array.isArray(result.listIso)).toBe(true);
    expect(Array.isArray(result.mapped)).toBe(true);
    expect(result.healFx).toEqual({ type: 'heal', amount: 5 });
    expect(result.damageFx).toEqual({ type: 'damage', amount: 2, kind: 'fire' });
    expect(result.evald).toBe(3);
    expect(result.isDefined).toBe(true);
  });

  it('supports overlay operators and remove command', () => {
    const templ = new Template('room', {
      name: 'Base',
      nums: [1],
      total: 3,
      flag: false,
      data: { a: 1 },
      '*overlay': {
        nums: [2, '=3'],
        total: 2,
        flag: true,
        data: { b: 2 },
      },
      '^replace': {
        name: '=#name + "!"',
      },
      '!remove': ['flag'],
      __no_id: true,
    });

    const out = templ.assembleProperties({ seed: 'seed-2' });
    expect(out.name).toBe('Base!');
    expect(out.nums).toEqual([1, 2, 3]);
    expect(out.total).toBe(5);
    expect(out.data).toEqual({ a: 1, b: 2 });
    expect(out.flag).toBeUndefined();
    expect(out.id).toBeUndefined();
  });

  it('throws when overlay value has unsupported type', () => {
    const templ = new Template('room', {
      '*overlay': {
        bad: undefined,
      },
    });
    expect(() => templ.assembleProperties({})).toThrow();
  });

  it('throws for invalid contextual helper usage', () => {
    const rt = Template.bootstrapDeem({ seed: 'seed-3' }, setting);
    expect(() => rt.evaluate('defined(1)', {})).toThrow();
    expect(() => rt.evaluate('lookup(missing, default)', {})).toThrow();
    expect(() => rt.evaluate('gatherEntries(missing, default)', {})).toThrow();
    expect(() => rt.evaluate('hasEntry(missing, default)', {})).toThrow();
    expect(() => rt.evaluate('hasValue(missing, x)', {})).toThrow();
    expect(() => rt.evaluate('findGroup(missing, x)', {})).toThrow();
  });
});
