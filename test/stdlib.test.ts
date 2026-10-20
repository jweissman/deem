import { describe, expect, it } from 'bun:test';
import StandardLibrary from '../src/stdlib';

describe('StandardLibrary probability', () => {
  it('provides deterministic rand for same seed', () => {
    const aRaw = StandardLibrary.probability('seed-a');
    const bRaw = StandardLibrary.probability('seed-a');
    const a = aRaw.rand!;
    const b = bRaw.rand!;
    expect(a() as number).toBe(b() as number);
    expect(a(10) as number).toBeLessThan(10);
  });

  it('seeds distinct streams from strings with the same characters', () => {
    const draws = (seed: string) => { const r = StandardLibrary.probability(seed).rand!; return [r(), r(), r()]; };
    expect(draws('choice-12')).not.toEqual(draws('choice-21'));
    expect(draws('ab')).not.toEqual(draws('ba'));
  });

  it('covers oneOf pick sample roll rollWithDrop alliterate', () => {
    const pRaw = StandardLibrary.probability('seed-b');
    const p = {
      oneOf: pRaw.oneOf!,
      pick: pRaw.pick!,
      sample: pRaw.sample!,
      roll: pRaw.roll!,
      rollWithDrop: pRaw.rollWithDrop!,
      alliterate: pRaw.alliterate!,
    };
    expect(['a', 'b', 'c']).toContain(p.oneOf('a', 'b', 'c') as string);
    expect(p.pick(['x', 'y'], 1)).toBe('y');
    expect(p.pick(['x', 'y'])).not.toBeNull();
    expect(p.pick([], -1)).toBeNull();

    const sampled = p.sample(['a', 'b', 'c', 'd'], 2) as unknown[];
    expect(sampled.length).toBe(2);

    const roll = p.roll(2, 6) as number;
    expect(roll).toBeGreaterThanOrEqual(2);
    expect(roll).toBeLessThanOrEqual(12);

    const rollDrop = p.rollWithDrop(4, 6) as number;
    expect(rollDrop).toBeGreaterThanOrEqual(3);
    expect(rollDrop).toBeLessThanOrEqual(18);

    const allit = p.alliterate(['forest', 'field', 'stone'], 'f') as string;
    expect(allit.startsWith('f')).toBe(true);
    const fallback = p.alliterate(['stone', 'marsh'], 'f');
    expect(['stone', 'marsh']).toContain(fallback as string);
  });

  it('throws on invalid probability inputs', () => {
    const pRaw = StandardLibrary.probability('seed-c');
    const p = {
      oneOf: pRaw.oneOf!,
      pick: pRaw.pick!,
      sample: pRaw.sample!,
      roll: pRaw.roll!,
      rollWithDrop: pRaw.rollWithDrop!,
      alliterate: pRaw.alliterate!,
    };
    expect(() => p.oneOf()).toThrow();
    expect(() => p.pick('bad' as unknown as string[])).toThrow();
    expect(() => p.pick(['a'], 'x')).toThrow();
    expect(() => p.sample(['a'], 'x')).toThrow();
    expect(() => p.roll('x', 6)).toThrow();
    expect(() => p.rollWithDrop(2, 'x')).toThrow();
    expect(() => p.alliterate(['a'], 1)).toThrow();
    expect(() => p.alliterate(['a', 1] as unknown as string[], 'a')).toThrow();
  });
});

describe('StandardLibrary core', () => {
  const coreRaw = StandardLibrary.core;
  const core = {
    a_an: coreRaw.a_an!,
    count: coreRaw.count!,
    if: coreRaw.if!,
    round: coreRaw.round!,
    floor: coreRaw.floor!,
    ceil: coreRaw.ceil!,
    capitalize: coreRaw.capitalize!,
    humanize: coreRaw.humanize!,
    len: coreRaw.len!,
    sum: coreRaw.sum!,
    min: coreRaw.min!,
    max: coreRaw.max!,
    concat: coreRaw.concat!,
    dig: coreRaw.dig!,
    uniq: coreRaw.uniq!,
    distribute: coreRaw.distribute!,
    join: coreRaw.join!,
    first: coreRaw.first!,
    last: coreRaw.last!,
    roman: coreRaw.roman!,
  };

  it('covers common core functions', () => {
    expect(core.a_an('apple')).toBe('an apple');
    expect(core.count([1, 2, 3])).toBe(3);
    expect(core.if(true, 'x', 'y')).toBe('x');
    expect(core.round(1.6)).toBe(2);
    expect(core.floor(1.6)).toBe(1);
    expect(core.ceil(1.1)).toBe(2);
    expect(core.capitalize('hello')).toBe('Hello');
    expect(core.humanize('hello_world')).toBe('Hello World');
    expect(core.len('abc')).toBe(3);
    expect(core.len([1, 2])).toBe(2);
    expect(core.len({ a: 1, b: 2 })).toBe(2);
    expect(core.len(123)).toBe(0);

    expect(core.sum([1, 2, 3])).toBe(6);
    expect(core.sum([])).toBe(0);
    expect(core.sum([{ n: 2 }, { n: 3 }], 'n')).toBe(5);

    expect(core.min(3, 1, 2)).toBe(1);
    expect(core.max(3, 1, 2)).toBe(3);
    expect(core.concat([1], [2], null, undefined, 3)).toEqual([1, 2, 3]);

    expect(core.dig({ a: { b: 5 } }, 'a', 'b')).toBe(5);
    expect(core.dig({ a: { b: 5 } }, 'a', 'z')).toBeNull();
    expect(core.dig(null, 'a')).toBeNull();

    expect(core.uniq(['a', 'a', 'b'])).toEqual(['a', 'b']);
    expect(core.distribute(10, 3)).toEqual([4, 3, 3]);

    expect(core.join(['old_forest', 'ash_road'], ', ')).toBe('Old Forest, Ash Road');
    expect(core.first(['x', 'y'])).toBe('x');
    expect(core.first([])).toBeNull();
    expect(core.last(['x', 'y'])).toBe('y');
    expect(core.last([])).toBeNull();
    expect(core.roman(1994)).toBe('MCMXCIV');
  });

  it('throws on invalid core inputs', () => {
    expect(() => core.a_an(1)).toThrow();
    expect(() => core.round('x')).toThrow();
    expect(() => core.floor('x')).toThrow();
    expect(() => core.ceil('x')).toThrow();
    expect(() => core.capitalize(1)).toThrow();
    expect(() => core.humanize(1)).toThrow();

    expect(() => core.sum('x' as unknown as number[])).toThrow();
    expect(() => core.sum([{ n: 'bad' }], 'n')).toThrow();
    expect(() => core.sum([1], 1)).toThrow();
    expect(() => core.min(1, 'x')).toThrow();
    expect(() => core.max(1, 'x')).toThrow();

    expect(() => core.dig({ a: 1 }, {})).toThrow();
    expect(() => core.distribute('x', 2)).toThrow();
    expect(() => core.join('x' as unknown as string[], ',')).toThrow();
    expect(() => core.join(['a'], 1)).toThrow();
    expect(() => core.first('x' as unknown as string[])).toThrow();
    expect(() => core.last('x' as unknown as string[])).toThrow();
    expect(() => core.roman('x')).toThrow();
    expect(() => core.roman(0)).toThrow();
  });
});
