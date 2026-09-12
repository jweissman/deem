import { describe, expect, it } from 'bun:test';
import Generator, { type GenerationSetting, type GeneratorOptions } from '../src/Generator';
import { Table } from '../src/Table';
import { Template } from '../src/Template';
import Deem from '../src/deem';

describe('Generator additional branches', () => {
  const setting: GenerationSetting = {
    listType: new Table('listType', 'kind').group('alpha', ['a', 'b']).group('beta', ['c']),
    item: new Template('item', {
      value: '=lookup(listType, alpha)',
    }),
  };

  it('covers genList count zero and generationSource miss', () => {
    expect(Generator.genList('item', { __setting: setting }, 0)).toEqual([]);
    expect(Generator.generationSource('missing', setting)).toBeNull();
  });

  it('covers table generation branch with discriminator override', () => {
    const out = Generator.gen('listType', {
      __setting: setting,
      ['kind']: 'beta',
      seed: 'seed-g1',
    } as unknown as GeneratorOptions) as unknown;
    expect(out).toBe('c');
  });

  it('covers __count and count fanout branches', () => {
    const viaCount = Generator.gen('item', {
      __setting: setting,
      count: 2,
      seed: 'seed-g2',
    });
    expect(Array.isArray(viaCount)).toBe(true);

    const viaMagicCount = Generator.gen('item', {
      __setting: setting,
      __count: 2,
      seed: 'seed-g3',
    });
    expect(Array.isArray(viaMagicCount)).toBe(true);
  });

  it('throws when type is missing', () => {
    expect(() => Generator.gen('missing', { __setting: setting })).toThrow();
  });

  it('covers gatherKeys condition filter and missing table error', () => {
    const gatherSetting: GenerationSetting = {
      t: new Table('t', 'g').group('one', ['a']).group('two', ['b']),
    };

    const keys = Generator.gatherKeysFromTable('t', 4, '#__it == a', gatherSetting);
    expect(Array.isArray(keys)).toBe(true);

    expect(() => Generator.gatherKeysFromTable('missing', 1, undefined, gatherSetting)).toThrow();
  });

  it('covers default setting construction and one default template run', () => {
    const defaults = Generator.defaultSetting();
    expect(defaults.room).toBeDefined();
    const room = Generator.gen('room', {
      __setting: defaults,
      seed: 'seed-g4',
    });
    expect(room).toBeDefined();
  });

  it('covers table generation fallback rng and error branches', () => {
    const tableSetting: GenerationSetting = {
      loot: new Table('loot', 'kind').group('default', ['x']),
    };

    const rtNoRand = new Deem();
    delete (rtNoRand.stdlib as Record<string, unknown>).rand;
    const fallbackPick = Generator.gen('loot', {
      __setting: tableSetting,
      __deemRuntime: rtNoRand,
    }) as unknown;
    expect(fallbackPick).toBe('x');

    const rtBadRand = new Deem({ stdlib: { rand: () => 999 as unknown as number } });
    expect(() => Generator.gen('loot', {
      __setting: tableSetting,
      __deemRuntime: rtBadRand,
    })).toThrow();

    const emptySetting: GenerationSetting = {
      empty: new Table('empty', 'kind').group('default', []),
    };
    expect(() => Generator.gen('empty', { __setting: emptySetting })).toThrow();
  });

  it('covers invalid generation source type branch', () => {
    const invalidSetting = { broken: {} } as unknown as GenerationSetting;
    expect(() => Generator.gen('broken', { __setting: invalidSetting })).toThrow('Invalid template type');
  });
});
