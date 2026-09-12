import { describe, expect, it } from 'bun:test';
import Generator, { type GenerationSetting } from '../src/Generator';
import { Table } from '../src/Table';
import { createExecutionTrace } from '../src/trace';

const makeSetting = (): GenerationSetting => ({
  loot: new Table('loot', 'rank')
    .group('common', ['rope', 'torch', 'rations'])
    .group('rare', ['wand']),
});

describe('Generator lookup tracing', () => {
  it('records lookup pick details', () => {
    const setting = makeSetting();
    const trace = createExecutionTrace(true);

    const value = Generator.lookupInTable('loot', 'common', false, {
      setting,
      trace,
      randomFunc: () => 1,
    });

    expect(value).toBe('torch');
    const pick = trace.events.find((e) => e.step === 'lookup.pick');
    expect(pick).toBeDefined();
    expect(pick?.detail.groupName).toBe('common');
    expect(pick?.detail.pickedIndex).toBe(1);
  });

  it('records condition matches and fallback when no options pass', () => {
    const setting = makeSetting();
    const trace = createExecutionTrace(true);

    const value = Generator.lookupInTable('loot', 'common', false, {
      setting,
      trace,
      condition: '#__it == dragonEgg',
      randomFunc: () => 0,
    });

    expect(value).toBe('rope');
    expect(trace.events.some((e) => e.step === 'lookup.condition.result')).toBe(true);
    expect(trace.events.some((e) => e.step === 'lookup.fallback')).toBe(true);
  });

  it('supports globally unique picks and traces each choice', () => {
    const table = new Table('coin', 'kind').group('default', ['a', 'b']);
    const setting: GenerationSetting = { coin: table };
    const trace = createExecutionTrace(true);

    const first = Generator.lookupInTable('coin', 'default', true, {
      setting,
      trace,
      randomFunc: () => 0,
    });
    const second = Generator.lookupInTable('coin', 'default', true, {
      setting,
      trace,
      randomFunc: () => 0,
    });

    expect(first).toBe('a');
    expect(second).toBe('b');
    const picks = trace.events.filter((e) => e.step === 'lookup.pick');
    expect(picks.length).toBe(2);
  });

  it('records table generation pick events', () => {
    const table = new Table('roomType', 'kind').group('default', ['cave']);
    const setting: GenerationSetting = { roomType: table };
    const trace = createExecutionTrace(true);

    const result = Generator.gen('roomType', {
      __setting: setting,
      __trace: trace,
      seed: 'trace-seed',
    }) as unknown;

    expect(result).toBe('cave');
    expect(trace.events.some((e) => e.step === 'generation.table.pick')).toBe(true);
  });

  it('covers condition + globally unique exhaustion path', () => {
    const table = new Table('single', 'kind').group('default', ['a']);
    const setting: GenerationSetting = { single: table };

    const first = Generator.lookupInTable('single', 'default', true, {
      setting,
      condition: '#__it == a',
      randomFunc: () => 0,
    });
    expect(first).toBe('a');

    expect(() => Generator.lookupInTable('single', 'default', true, {
      setting,
      condition: '#__it == a',
      randomFunc: () => 0,
    })).toThrow();
  });

  it('covers lookup index error paths', () => {
    const table = new Table('single', 'kind').group('default', ['a']);
    const setting: GenerationSetting = { single: table };

    expect(() => Generator.lookupInTable('single', 'default', false, {
      setting,
      condition: '#__it == a',
      randomFunc: () => 10,
    })).toThrow();

    expect(() => Generator.lookupInTable('single', 'default', true, {
      setting,
      randomFunc: () => 10,
    })).toThrow();

    expect(() => Generator.lookupInTable('single', 'default', false, {
      setting,
      randomFunc: () => 10,
    })).toThrow();
  });

  it('covers globally unique reset recursion and empty-group error', () => {
    const table = new Table('only', 'kind').group('default', ['x']);
    const setting: GenerationSetting = { only: table };

    const a = Generator.lookupInTable('only', 'default', true, { setting, randomFunc: () => 0 });
    const b = Generator.lookupInTable('only', 'default', true, { setting, randomFunc: () => 0 });
    expect(a).toBe('x');
    expect(b).toBe('x');

    const emptyTable = new Table('empty', 'kind').group('default', []);
    const emptySetting: GenerationSetting = { empty: emptyTable };
    expect(() => Generator.lookupInTable('empty', 'default', false, {
      setting: emptySetting,
      randomFunc: () => 0,
    })).toThrow();
  });
});
