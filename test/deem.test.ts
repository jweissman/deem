import { describe, it, expect } from 'bun:test';
import Deem from '../src/deem';
import { DeemValue } from '../src/deem/stdlib';

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
});