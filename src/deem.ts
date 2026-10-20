import { ExpressionTools, type Expression, type PartialResult, type ExplainStyle } from './preview';
import * as ohm from 'ohm-js';
// @ts-expect-error Bun text imports are resolved at runtime.
import source from './deem.ohm' with { type: "text" };
import StandardLibrary, { type DeemFunc, type DeemValue } from './stdlib';

type EvalContext = {
  [key: string]: DeemValue
}
type EvalArgs = { context?: EvalContext };
type EvalSemantics = { eval: (context: EvalContext) => DeemValue };
type EvalNode = ohm.Node & EvalSemantics;

type DeemOptions = {
  seed?: string | number;
  magicVars?: Record<string, DeemValue>;
  stdlib?: Record<string, DeemFunc>;
  contextualStdlib?: (context: EvalContext) => Record<string, DeemFunc>;
};

export default class Deem {
  static colorize = (str: string, color: string) => `\x1b[${color}m${str}\x1b[0m`;
  static grammar = ohm.grammar(source);
  static defaultInstance = new Deem();

  private static previewSemanticsCache?: ReturnType<typeof ExpressionTools.semantics>;
  private get previewSemantics() { return Deem.previewSemanticsCache ??= ExpressionTools.semantics(Deem.grammar); }
  private static sharedSemantics?: ReturnType<typeof Deem.createSemantics>;
  private static active?: Deem;
  private get semantics() { return Deem.sharedSemantics ??= Deem.createSemantics(); }
  // Parsed expressions by source text; templates evaluate the same expressions many times.
  private static parsed = new Map<string, ohm.MatchResult>();
  static parse(expression: string): ohm.MatchResult {
    let match = Deem.parsed.get(expression);
    if (!match) {
      match = Deem.grammar.match(expression);
      if (Deem.parsed.size >= 10000) { Deem.parsed.clear(); }
      Deem.parsed.set(expression, match);
    }
    return match;
  }
  private previewContextual: boolean;

  magicVars: Record<string, DeemValue>;
  stdlib: { [key: string]: DeemFunc };
  private contextualStdlib: (context: EvalContext) => Record<string, DeemFunc>;

  constructor(options: DeemOptions = {}) {
    this.previewContextual = options.contextualStdlib !== undefined;
    this.magicVars = options.magicVars ?? {};
    this.stdlib = {
      ...StandardLibrary.core,
      ...StandardLibrary.probability(options.seed ?? 'default-seed'),
      ...(options.stdlib ?? {}),
    };
    this.previewRoll = this.stdlib.roll!;
    this.contextualStdlib = options.contextualStdlib ?? (() => ({}));
  }

  private resolveStdlib(context: EvalContext): { [key: string]: DeemFunc } {
    return {
      ...this.stdlib,
      ...this.contextualStdlib(context),
    };
  }

  private requireFunction(name: string, context: EvalContext): DeemFunc {
    const func = this.resolveStdlib(context)[name];
    if (!func) {
      throw new Error(`Unknown function: ${name}`);
    }
    return func;
  }

  // One semantics serves every instance; the instance evaluating is `Deem.active`.
  private static createSemantics() {
    const runtime = { get active() { return Deem.active!; } };
    return Deem.grammar.createSemantics().addOperation<DeemValue>('eval(context)', {
    Exp(exp) {
      const ctx = (this.args as EvalArgs).context || {};
      return (exp as EvalNode).eval(ctx);
    },
    LogExp_and(left, _, right) {
      const ctx = (this.args as EvalArgs).context || {};
      return (left as EvalNode).eval(ctx) && (right as EvalNode).eval(ctx);
    },
    LogExp_or(left, _, right) {
      const ctx = (this.args as EvalArgs).context || {};
      return (left as EvalNode).eval(ctx) || (right as EvalNode).eval(ctx);
    },
    LogExp_not(_not, exp) {
      const ctx = (this.args as EvalArgs).context || {};
      return !(exp as EvalNode).eval(ctx);
    },
    TernaryExp(cond, _q, trueExp, _c, falseExp) {
      const ctx = (this.args as EvalArgs).context || {};
      const condition = (cond as EvalNode).eval(ctx);
      if (condition) {
        return (trueExp as EvalNode).eval(ctx);
      } else {
        return (falseExp as EvalNode).eval(ctx);
      }
    },
    CompExp_lt(left, _, right) {
      const ctx = (this.args as EvalArgs).context || {};
      const lhs = (left as EvalNode).eval(ctx) as number;
      const rhs = (right as EvalNode).eval(ctx) as number;
      return lhs < rhs;
    },
    CompExp_gt(left, _, right) {
      const ctx = (this.args as EvalArgs).context || {};
      const lhs = (left as EvalNode).eval(ctx) as number;
      const rhs = (right as EvalNode).eval(ctx) as number;
      return lhs > rhs;
    },
    CompExp_eq(left, _, right) {
      const ctx = (this.args as EvalArgs).context || {};
      const lhs = (left as EvalNode).eval(ctx);
      const rhs = (right as EvalNode).eval(ctx);
      return lhs === rhs;
    },
    CompExp_neq(left, _, right) {
      const ctx = (this.args as EvalArgs).context || {};
      const lhs = (left as EvalNode).eval(ctx);
      const rhs = (right as EvalNode).eval(ctx);
      return lhs !== rhs;
    },
    CompExp_lte(left, _, right) {
      const ctx = (this.args as EvalArgs).context || {};
      const lhs = (left as EvalNode).eval(ctx) as number;
      const rhs = (right as EvalNode).eval(ctx) as number;
      return lhs <= rhs;
    },
    CompExp_gte(left, _, right) {
      const ctx = (this.args as EvalArgs).context || {};
      const lhs = (left as EvalNode).eval(ctx) as number;
      const rhs = (right as EvalNode).eval(ctx) as number;
      return lhs >= rhs;
    },
    AddExp_plus(left, _, right) {
      const ctx = (this.args as EvalArgs).context || {};
      const lhs = (left as EvalNode).eval(ctx) as number;
      const rhs = (right as EvalNode).eval(ctx) as number;
      return lhs + rhs;
    },
    AddExp_minus(left, _, right) {
      const ctx = (this.args as EvalArgs).context || {};
      const lhs = (left as EvalNode).eval(ctx) as number;
      const rhs = (right as EvalNode).eval(ctx) as number;
      return lhs - rhs;
    },
    MulExp_times(left, _, right) {
      const ctx = (this.args as EvalArgs).context || {};
      const lhs = (left as EvalNode).eval(ctx) as number;
      const rhs = (right as EvalNode).eval(ctx) as number;
      return lhs * rhs;
    },
    MulExp_divide(left, _, right) {
      const ctx = (this.args as EvalArgs).context || {};
      const lhs = (left as EvalNode).eval(ctx) as number;
      const rhs = (right as EvalNode).eval(ctx) as number;
      return lhs / rhs;
    },
    ExpExp_power(left, _, right) {
      const ctx = (this.args as EvalArgs).context || {};
      const base = (left as EvalNode).eval(ctx) as number;
      const power = (right as EvalNode).eval(ctx) as number;
      return Math.pow(base, power);
    },
    PriExp_paren(_open, exp, _close) {
      const ctx = (this.args as EvalArgs).context || {};
      return (exp as EvalNode).eval(ctx)
    },
    PriExp_pos(_plus, exp) {
      const ctx = (this.args as EvalArgs).context || {}; return (exp as EvalNode).eval(ctx);
    },
    PriExp_neg(_minus, exp) {
      const ctx = (this.args as EvalArgs).context || {};
      const val = (exp as EvalNode).eval(ctx) as number;
      return -val;
    },
    FunctionCall(ident, _open, argList, _close) {
      const ctx = (this.args as EvalArgs).context || {};
      const funcName = (ident as EvalNode).eval(ctx) as string;
      const args = [];
      for (const arg of argList.children) {
        const argValue = (arg as EvalNode).eval(ctx);
        args.push(argValue);
      }
      const func = runtime.active.requireFunction(funcName, ctx);

      let ret = null;
      ret = func(...args.flat());
      return ret;
    },
    ArgList(first, _comma, rest) {
      const ctx = (this.args as EvalArgs).context || {};
      const firstValue = (first as EvalNode).eval(ctx);
      const restValues = [];
      for (const arg of rest.children) {
        const argValue = (arg as EvalNode).eval(ctx);
        restValues.push(argValue);
      }
      const args = [firstValue, ...restValues];
      return args;
    },
    bool(_val) { return (this.sourceString === 'true'); },
    number(_num) { return (parseFloat(this.sourceString)); },
    nihil(_val) { return (null); },
    ident(_initial, _rest) {
      const name = this.sourceString;
      const ctx = (this.args as EvalArgs).context || {}
      if (name.startsWith('#')) {
        const key = name.slice(1);
        const value = (this.args as EvalArgs).context?.[key] ?? runtime.active.magicVars[key];
        if (value === undefined) {
          if (Object.keys(ctx).includes(key)) {
            return null;
          }
          throw new Error(`Undefined variable: ${key} (available: ${Object.keys(ctx).join(', ')}); (magic: ${Object.keys(runtime.active.magicVars).join(', ')})`);
        }
        return value as DeemValue;
      }
      return (this.sourceString);
    },
    strlit_single_quote(_open, chars, _close) {
      return (chars.sourceString);
    },
    strlit_double_quote(_open, chars, _close) {
      // return chars.sourceString;
      const raw = chars.sourceString;
      const ctx = (this.args as EvalArgs).context || {};
      // interpolate #{expressions}
      let result = '';
      let cursor = 0;
      const regex = /#\{(.*?)\}/g;
      let match;
      while ((match = regex.exec(raw)) !== null) {
        const before = raw.slice(cursor, match.index);
        result += before;
        const expr = match[1] ?? '';
        const exprValue = runtime.active.evaluate(expr, ctx) as string;
        result += exprValue;
        cursor = match.index + match[0].length;
      }
      result += raw.slice(cursor);
      // interpolate #variables
      result = result.replace(/#([a-zA-Z_][a-zA-Z0-9_]*)/g, (_, varName) => {
        const variable = String(varName);
        const value = ctx[variable] ?? runtime.active.magicVars[variable];
        if (value === undefined) {
          // debugger;
          throw new Error(`Undefined variable in string interpolation: ${varName} (available: ${Object.keys((this.args as EvalArgs).context || {}).join(', ')}); (magic: ${Object.keys(runtime.active.magicVars).join(', ')})`);
        }
        return value as string;
      });
      return result;
    },
    dice_multi(count, _d, sides) {
      // const ctx = (this.args as EvalArgs).context || {};
      // const rollFunc = ctx.roll as unknown as Roll;
      // if (ctx.roll !== undefined && ctx.roll !== null && typeof ctx.roll === 'function') {
      //   let sum = 0;
      //   for (let i = 0; i < parseInt(count.sourceString); i++) {
      //     const result = rollFunc(
      //       ctx.subject as unknown as Combatant,
      //       ctx.description as string,
      //       parseInt(sides.sourceString)
      //     );
      //     sum += result.amount;
      //   }
      //   return sum;
      // }

      const ctx = (this.args as EvalArgs).context || {};
      const roll = runtime.active.requireFunction('roll', ctx);
      return roll(parseInt(count.sourceString), parseInt(sides.sourceString)) as DeemValue;
    },
    dice_single(_d, sides) {
      // const ctx = (this.args as EvalArgs).context || {};
      // if (ctx.roll) {
      //   const rollFunc = ctx.roll as unknown as Roll;
      //   const result = rollFunc(
      //     ctx.subject as unknown as Combatant,
      //     ctx.description as string,
      //     parseInt(sides.sourceString)
      //   );
      //   return result.amount;
      // }
      const ctx = (this.args as EvalArgs).context || {};
      const roll = runtime.active.requireFunction('roll', ctx);
      return roll(1, parseInt(sides.sourceString));
      // return Math.floor(
      //   // Math.random() * parseInt(sides.sourceString)
      //   Deem.stdlib.rand(parseInt(sides.sourceString))
      // ) + 1;
    }
  }).addAttribute<string>('pretty', {
    Exp(exp) { return exp.pretty as string; },
    LogExp_and(left, _, right) { return `${left.pretty} && ${right.pretty}`; },
    LogExp_or(left, _, right) { return `${left.pretty} || ${right.pretty}`; },
    LogExp_not(_not, exp) { return `!${exp.pretty}`; },
    TernaryExp(cond, _q, trueExp, _c, falseExp) { return `${cond.pretty} ? ${trueExp.pretty} : ${falseExp.pretty}`; },
    CompExp_lt(left, _, right) { return `${left.pretty} < ${right.pretty}`; },
    CompExp_gt(left, _, right) { return `${left.pretty} > ${right.pretty}`; },
    CompExp_lte(left, _, right) { return `${left.pretty} <= ${right.pretty}`; },
    CompExp_gte(left, _, right) { return `${left.pretty} >= ${right.pretty}`; },
    CompExp_eq(left, _, right) { return `${left.pretty} == ${right.pretty}`; },
    CompExp_neq(left, _, right) { return `${left.pretty} != ${right.pretty}`; },
    AddExp_plus(left, _, right) { return `${left.pretty} + ${right.pretty}`; },
    AddExp_minus(left, _, right) { return `${left.pretty} - ${right.pretty}`; },
    MulExp_times(left, _, right) { return `${left.pretty} * ${right.pretty}`; },
    MulExp_divide(left, _, right) { return `${left.pretty} / ${right.pretty}`; },
    ExpExp_power(left, _, right) { return `${left.pretty} ^ ${right.pretty}`; },
    PriExp_paren(_open, exp, _close) { return `(${exp.pretty})`; },
    PriExp_pos(_plus, exp) { return `+${exp.pretty}`; },
    PriExp_neg(_minus, exp) { return `-${exp.pretty}`; },
    FunctionCall(ident, _open, argList, _close) {
      const funcName = ident.pretty as string;
      const args = argList.children.map(arg => arg.pretty as string).flat();
      return `${funcName}(${args.join(', ')})`;
    },
    ArgList(first, _comma, rest) {
      return [first.pretty as string, ...rest.children.map(arg => arg.pretty as string)].join(', ');
    },
    bool(_val) { return this.sourceString; },
    number(_num) { return this.sourceString; },
    nihil(_val) { return 'nihil'; },
    ident(_initial, _rest) {
      const name = this.sourceString;

      return name;
    },
    strlit_double_quote(_open, chars, _close) {
      return `"${chars.sourceString}"`;
    },
    strlit_single_quote(_open, chars, _close) {
      return `'${chars.sourceString}'`;
    },
    dice_multi(count, _d, sides) { return `${count.sourceString}d${sides.sourceString}`; },
    dice_single(_d, sides) { return `d${sides.sourceString}`; }
  });
  }

  parse(expression: string): Expression {
    const match = Deem.parse(expression.startsWith('=') ? expression.slice(1) : expression);
    if (match.failed()) { throw new Error(match.message); }
    return (this.previewSemantics(match) as { tree: Expression }).tree;
  }

  private previewSafe(expr: Expression): boolean {
    if (expr.kind === 'opaque') { return false; }
    if (expr.kind === 'dice') {
      return !this.previewContextual && this.stdlib.roll === this.previewRoll;
    }
    if (expr.kind !== 'operation') { return true; }
    if (expr.operator.startsWith('call:')) {
      const name = expr.operator.slice(5);
      if (this.previewContextual || !Object.hasOwn(StandardLibrary.core, name)
        || this.stdlib[name] !== StandardLibrary.core[name]) { return false; }
    }
    return expr.args.every(arg => this.previewSafe(arg));
  }

  private previewRoll: DeemFunc;

  partialEvaluate(input: string | Expression, context: EvalContext = {}): PartialResult {
    let expression: Expression | undefined;
    try {
      expression = typeof input === 'string' ? this.parse(input) : input;
      if (!this.previewSafe(expression)) { return { status: 'residual', expression }; }
      const resolve = (name: string): Expression => {
        if (!Object.hasOwn(context, name) && !Object.hasOwn(this.magicVars, name)) {
          return { kind: 'reference', name };
        }
        // Match the legacy evaluator's nullish fallback, including explicit undefined.
        const value = context[name] ?? this.magicVars[name];
        if (value === undefined && !Object.keys(context).includes(name)) {
          throw new Error(`Undefined variable: ${name}`);
        }
        return { kind: 'value', value: value === undefined ? null : value };
      };
      expression = ExpressionTools.specialize(expression, resolve, expr => this.execute(expr));
      return expression.kind === 'value'
        ? { status: 'value', expression, value: expression.value }
        : { status: 'residual', expression };
    } catch (error) {
      return { status: 'error', expression, error: error instanceof Error ? error : new Error(String(error)) };
    }
  }

  serialize(expression: Expression, context: EvalContext = {}) {
    const bindings: EvalContext = { ...context };
    const reserved = new Set(Object.keys(this.magicVars));
    const visit = (expr: Expression): void => {
      if (expr.kind === 'reference') { reserved.add(expr.name); }
      if (expr.kind === 'opaque') {
        for (const match of expr.source.matchAll(/#([a-zA-Z0-9_#]+)/g)) { reserved.add(match[1]!); }
      }
      if (expr.kind === 'operation') { expr.args.forEach(visit); }
    };
    visit(expression);
    return { source: ExpressionTools.serialize(expression, bindings, reserved), context: bindings };
  }

  execute(expression: Expression, context: EvalContext = {}): DeemValue {
    const serialized = this.serialize(expression, context);
    return this.evaluate(serialized.source, serialized.context);
  }

  explain(input: string | Expression, style: ExplainStyle = 'compact') {
    const expression = typeof input === 'string' ? this.parse(input) : input;
    return ExpressionTools.explain(expression, style, this.previewSafe(expression));
  }

  preview(input: string | Expression, context: EvalContext = {}, style: ExplainStyle = 'compact') {
    const result = this.partialEvaluate(input, context);
    return result.status === 'error' ? result : { ...result, explanation: this.explain(result.expression, style) };
  }

  static evaluate(
    expression: string,
    context: Record<string, DeemValue> = {}
  ): DeemValue {
    return Deem.defaultInstance.evaluate(expression, context);
  }

  evaluate(
    expression: string,
    context: Record<string, DeemValue> = {}
  ): DeemValue {
    if (expression === null || expression === undefined || expression.trim() === '') {
      throw new Error('Cannot evaluate empty expression');
    }

    // if we have a leading =, then we can remove it
    if (expression.startsWith('=')) {
      expression = expression.slice(1);
    }

    const match = Deem.parse(expression);
    if (match.succeeded()) {
      const sem = this.semantics(match) as {
        eval: (context: Record<string, DeemValue>) => DeemValue
      };
      // const prettyExpr: string = sem.pretty as string;
      let ret: DeemValue = null;
      const previous = Deem.active;
      Deem.active = this;
      try {
        ret = sem.eval(context);
      } catch (e) {
        console.warn("Error evaluating expression:", expression);
        throw new Error(`Error evaluating expression: ${expression}\n${(e as Error).message}`);
      } finally {
        Deem.active = previous;
      }
      return ret;
    } else {
      // @ts-expect-error types are incomplete?
      throw new Error('Failed to parse expression: ' + expression + '\n' + match.message);
    }
  }
}