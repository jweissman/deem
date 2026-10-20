import { describe, expect, it } from 'bun:test';
import Deem from '../src/deem';
import type { Expression } from '../src/preview';

const residual = (runtime: Deem, source: string | Expression, context = {}): Expression => {
  const result = runtime.partialEvaluate(source, context);
  if (result.status === 'error') { throw result.error; }
  return result.expression;
};

describe('expression previews', () => {
  it('specializes actual references and deterministic functions', () => {
    const d = new Deem();
    expect(d.partialEvaluate('2 * (#strength + 1)', { strength: 4 })).toMatchObject({ status: 'value', value: 10 });
    expect(d.preview('1d6 + #strength', { strength: 4 })).toMatchObject({
      status: 'residual', explanation: { text: '5 to 10', bounds: { min: 5, max: 10 } },
    });
    expect(d.partialEvaluate("round('bad')").status).toBe('error');
    expect(d.partialEvaluate('bad @').status).toBe('error');
  });

  it('resolves target conditions in stages', () => {
    const d = new Deem();
    const source = "1d6 + #modifier + (dig(#target, 'isUndead') ? 3 : 0)";
    const before = residual(d, source, { modifier: 4 });
    expect(d.explain(before).unresolved).toContain('#target');
    const after = residual(d, before, { target: { isUndead: true } });
    expect(d.explain(after).bounds).toEqual({ min: 8, max: 13 });
  });

  it('preserves the random stream and later execution across seeds', () => {
    const source = '2d6 + #modifier + (1d4 > 2 ? 1d8 : 1d10)';
    for (let seed = 0; seed < 30; seed++) {
      const original = new Deem({ seed });
      const specialized = new Deem({ seed });
      const expression = residual(specialized, source, { modifier: 4 });
      specialized.explain(expression);
      expect(specialized.execute(expression)).toBe(original.evaluate(source, { modifier: 4 }));
      expect(specialized.evaluate('1d20')).toBe(original.evaluate('1d20'));
    }
  });

  it('preserves lazy branches, operand results, coercion and grouping', () => {
    const d = new Deem();
    expect(d.partialEvaluate('false && #missing')).toMatchObject({ status: 'value', value: false });
    expect(d.partialEvaluate('true ? 3 : #missing')).toMatchObject({ status: 'value', value: 3 });
    expect(d.partialEvaluate("#condition ? round('bad') : 3").status).toBe('residual');
    expect(d.partialEvaluate("true ? round('bad') : 3").status).toBe('error');
    const expression = residual(d, '#x + 4 + 2');
    expect(d.execute(expression, { x: 'a' })).toBe('a42');
    expect(d.execute(residual(d, '+#x'), { x: 'a' })).toBe('a');
  });

  it('distinguishes absence, null, undefined and legacy magic fallback', () => {
    const d = new Deem();
    expect(d.partialEvaluate('#x').status).toBe('residual');
    expect(d.partialEvaluate('#x', { x: null })).toMatchObject({ status: 'value', value: null });
    expect(d.partialEvaluate('#x', { x: undefined } as never)).toMatchObject({ status: 'value', value: null });
    const magic = new Deem({ magicVars: { x: 7 } });
    expect(magic.partialEvaluate('#x', { x: null })).toMatchObject({ status: 'value', value: 7 });
    expect(d.execute(residual(d, "#x + '__preview_'", { x: 2 }))).toBe('2__preview_');
    expect(d.execute(residual(d, '#__preview_0 + 2'), { __preview_0: 5 })).toBe(7);
  });

  it('never invokes unknown, custom, random or contextual functions', () => {
    let calls = 0;
    const d = new Deem({ stdlib: { floor: () => { calls++; return 99; } } });
    for (const source of ['floor(2)', 'rand()', 'lookup(foo)', 'oneOf(1, 2)', '"#{1d6}"']) {
      expect(d.partialEvaluate(source).status).toBe('residual');
    }
    const contextual = new Deem({ contextualStdlib: () => { calls++; return {}; } });
    expect(contextual.partialEvaluate('1d6 + #x', { x: 3 }).status).toBe('residual');
    contextual.explain('1d6');
    expect(calls).toBe(0);
    expect(contextual.explain('1d6').bounds).toBeUndefined();
  });

  it('round trips values with bindings and preserves deferred error order', () => {
    const d = new Deem();
    const tree = residual(d, "#x + #__preview_1", { x: "a'#weird" });
    const serialized = d.serialize(tree, { __preview_1: 'b' });
    expect(d.evaluate(serialized.source, serialized.context)).toBe("a'#weirdb");
    expect(d.partialEvaluate("min(1, #missing, round('bad'))").status).toBe('residual');
    expect(d.partialEvaluate("if(true, 3, round('bad'))").status).toBe('error');
    expect(d.partialEvaluate('max()')).toMatchObject({ status: 'value', value: -Infinity });
    expect(d.execute(residual(d, 'max()'))).toBe(-Infinity);
    expect(d.partialEvaluate("dig(#obj, 'key')", { obj: { key: undefined } } as never).status).toBe('residual');
    expect(d.execute(residual(d, "dig(#obj, 'key')", { obj: { key: undefined } } as never))).toBeUndefined();
    expect(d.evaluate('d6')).toBe('d6');
    expect(d.explain('d6').bounds).toBeUndefined();
  });

  it('keeps distributions visible and declines unsupported bounds', () => {
    const d = new Deem();
    expect(d.explain('1d3').text).toBe('1 to 3');
    expect(d.explain('2d6').text).toContain('2d6');
    expect(d.explain('2d6', 'descriptive').text).toContain('2 6-sided dice');
    expect(d.explain('2d6').bounds).toEqual(d.explain('1d11 + 1').bounds);
    expect(d.explain('2d6').text).not.toBe(d.explain('1d11 + 1').text);
    for (const source of ['#x + 1d6', '1d6 / 2', '1d6 ^ 2', 'rand()', '1d0']) {
      expect(d.explain(source).bounds).toBeUndefined();
    }
    expect(d.explain('#strength > 12').text).toContain('strength is greater than 12');
  });
});
