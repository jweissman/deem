import { describe, expect, it } from 'bun:test';
import Deem from '../src/deem';

const prettyOf = (expression: string): string => {
  const runtime = new Deem();
  const match = Deem.grammar.match(expression);
  if (!match.succeeded()) {
    throw new Error('parse failed');
  }
  const sem = (runtime as unknown as { semantics: (m: unknown) => { pretty: string } }).semantics(match);
  return sem.pretty;
};

describe('Deem pretty semantics', () => {
  it('formats arithmetic, comparisons, logic, ternary, and functions', () => {
    expect(prettyOf('1+2*3')).toContain('+');
    expect(prettyOf('1<2')).toContain('<');
    expect(prettyOf('1<=2')).toContain('<=');
    expect(prettyOf('1>=2')).toContain('>=');
    expect(prettyOf('1==2')).toContain('==');
    expect(prettyOf('1!=2')).toContain('!=');
    expect(prettyOf('true&&false')).toContain('&&');
    expect(prettyOf('true||false')).toContain('||');
    expect(prettyOf('!true')).toContain('!');
    expect(prettyOf('1<2?3:4')).toContain('?');
    expect(prettyOf('max(1,2,3)')).toContain('max(');
    expect(prettyOf('d6')).toContain('d6');
    expect(prettyOf('2d8')).toContain('2d8');
    expect(prettyOf('"abc"')).toBe('"abc"');
    expect(prettyOf("'abc'")).toBe("'abc'");
  });

  it('evaluates paren, unary, and single-die forms', () => {
    expect(Deem.evaluate('(1+2)')).toBe(3);
    expect(Deem.evaluate('+2')).toBe(2);
    expect(Deem.evaluate('-2')).toBe(-2);
  });

  it('throws for empty expressions', () => {
    expect(() => Deem.evaluate('')).toThrow();
  });

  it('throws parse errors for invalid expressions', () => {
    expect(() => Deem.evaluate('@@bad')).toThrow();
  });
});
