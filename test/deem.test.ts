import { describe, it, expect } from 'bun:test';
import Deem from '../src/deem';
import { type DeemValue } from '../src/stdlib';
import Generator from '../src/Generator';
import { Template } from '../src/Template';

const expectDeem = (expression: string, expected: any) => {
  it(`evaluates ${expression} to be ${expected}`, () => {
    const ret = Deem.evaluate(expression);
    expect(ret).toBe(expected as DeemValue);
  });
};

describe('Deem', () => {
  describe("arithmetic", () => {
    expectDeem('2 + 3', 5);
    expectDeem('1 + 2 + 3', 6);
    expectDeem('10 - 4', 6);
    expectDeem('2 * 3', 6);
    expectDeem('8 / 2', 4);
    expectDeem('10 / 0', Infinity);
    expectDeem('2 ^ 3', 8);
  });

  describe("comparison", () => {
    expectDeem('5 > 3', true);
    expectDeem('2 < 4', true);
    expectDeem('5 == 5', true);
    expectDeem('5 != 3', true);
    expectDeem('5 >= 5', true);
    expectDeem('3 <= 5', true);
  });

  describe("builtins", () => {
    it('should return a random number between 0 and 1', () => {
      const result = Deem.evaluate('rand()');
      expect(result).toBeGreaterThanOrEqual(0);
      expect(result).toBeLessThan(1);
    });

    it('should return one of the provided options', () => {
      const result = Deem.evaluate('oneOf(Apple, Banana, Cherry)');
      expect(result).toMatch(/Apple|Banana|Cherry/);
    });

    it('should evaluate if statements', () => {
      expect(Deem.evaluate('if(true, 1, 0)')).toBe(1);
      expect(Deem.evaluate('if(false, 1, 0)')).toBe(0);
    });
  });

  describe("logical operators", () => {
    expectDeem('true && false', false);
    expectDeem('true || false', true);
    expectDeem('!true', false);
  });

  it('should roll dice', () => {
    const result = Deem.evaluate('2d6');
    expect(result).toBeGreaterThanOrEqual(2);
    expect(result).toBeLessThanOrEqual(12);
  });

  it('should handle combined expressions', () => {
    const result = Deem.evaluate('1 + 2d4 * 3');
    expect(result).toBeGreaterThanOrEqual(1 + 2 * 3); // Minimum: 1 + (2*3)
    expect(result).toBeLessThanOrEqual(1 + 8 * 3);    // Maximum: 1 + (4*3)
  });

  it('should handle functions', () => {
    expect(Deem.evaluate('oneOf(Apple, Banana, Cherry)')).toMatch(/Apple|Banana|Cherry/);
  });

  it('should handle strlit', () => {
    expect(Deem.evaluate('"Hello," + " " + "world!"')).toBe('Hello, world!');
  });

  it('should handle single-quote string literals', () => {
    expect(Deem.evaluate("'Hello,' + ' ' + 'world!'")).toBe('Hello, world!');
  });

  it('should handle mixed string literals', () => {
    expect(Deem.evaluate('"Hello," + \' \' + "world!"')).toBe('Hello, world!');
  });

  it('should handle nested expressions', () => {
    expect(Deem.evaluate('if(1 + 1 == 2, "yes", "no")')).toBe('yes');
  });

  it('should handle conditional literals', () => {
    expect(Deem.evaluate('true ? "yes" : "no"')).toBe('yes');
    expect(Deem.evaluate('false ? "yes" : "no"')).toBe('no');
  });

  it("should interpolate simple expressions in strings", () => {
    expect(Deem.evaluate('"The sum of 2 and 3 is #{2 + 3} and the product of 3 and 4 is #{3 * 4}"')).toBe('The sum of 2 and 3 is 5 and the product of 3 and 4 is 12');
    expect(Deem.evaluate('"The contextual value is #value"', { value: 42 })).toBe('The contextual value is 42');

    // does NOT interpolate single-quoted strings
    expect(Deem.evaluate("'The sum of 2 and 3 is #{2 + 3} and the product of 3 and 4 is #{3 * 4}'")).toBe('The sum of 2 and 3 is #{2 + 3} and the product of 3 and 4 is #{3 * 4}');
  });

  describe('instance-seeded runtime', () => {
    it('produces identical sequences with the same seed', () => {
      const left = new Deem({ seed: 'same-seed' });
      const right = new Deem({ seed: 'same-seed' });

      const leftResults = [
        left.evaluate('rand()'),
        left.evaluate('oneOf(alpha, beta, gamma)'),
        left.evaluate('2d6'),
        left.evaluate('alliterate(concat(apple, apricot, berry), apricot)'),
      ];
      const rightResults = [
        right.evaluate('rand()'),
        right.evaluate('oneOf(alpha, beta, gamma)'),
        right.evaluate('2d6'),
        right.evaluate('alliterate(concat(apple, apricot, berry), apricot)'),
      ];

      expect(leftResults).toEqual(rightResults);
    });

    it('uses independent RNG streams per instance', () => {
      const first = new Deem({ seed: 'stream-seed' });
      const second = new Deem({ seed: 'stream-seed' });

      first.evaluate('rand()');
      first.evaluate('rand()');

      const a = first.evaluate('rand()') as number;
      const b = second.evaluate('rand()') as number;
      expect(a).not.toBe(b);
    });
  });

  describe('contextual stdlib reentrancy', () => {
    it('does not leak nested evaluation context back into caller', () => {
      const holder: { runtime: Deem | null } = { runtime: null };
      holder.runtime = new Deem({
        contextualStdlib: (context) => ({
          ctx: (name: DeemValue) => {
            if (typeof name !== 'string') {
              throw new Error('ctx(name) expects a string key');
            }
            return context[name] ?? null;
          },
          gen: (key: DeemValue) => {
            if (typeof key !== 'string') {
              throw new Error('gen(key) expects a string key');
            }
            return holder.runtime?.evaluate('ctx(inner)', { inner: `nested:${key}` }) ?? null;
          },
        }),
      });

      const value = holder.runtime.evaluate('ctx(outer) + "|" + gen(foo) + "|" + ctx(outer)', {
        outer: 'OUTER',
      });

      expect(value).toBe('OUTER|nested:foo|OUTER');
    });
  });

  describe('template and generator integration', () => {
    it('produces deterministic output with the same seed', () => {
      const first = Generator.gen('room', { seed: 'room-seed' });
      const second = Generator.gen('room', { seed: 'room-seed' });
      expect(first).toEqual(second);
    });

    it('keeps outer context stable across nested gen calls in one expression', () => {
      const custom = new Template('module', {
        label: '=oneOf(outerA, outerB, outerC)',
        final: '=if(defined(label) && gen(encounter) != nihil && defined(label), #label, missing)',
      });

      const result = custom.assembleProperties({
        seed: 'nested-seed',
      }) as Record<string, DeemValue>;

      expect(result.final).toBe(result.label);
    });
  });
});