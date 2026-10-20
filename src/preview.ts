import type * as ohm from 'ohm-js';
import type { DeemValue } from './stdlib';

export type Expression =
  | { kind: 'value'; value: DeemValue }
  | { kind: 'reference'; name: string }
  | { kind: 'dice'; count: number; sides: number }
  | { kind: 'opaque'; source: string; reason: string }
  | { kind: 'operation'; operator: string; args: Expression[] };
export type PartialResult =
  | { status: 'value'; expression: Expression; value: DeemValue }
  | { status: 'residual'; expression: Expression }
  | { status: 'error'; expression?: Expression; error: Error };
export type Bounds = { min: number; max: number };
export type Explanation = { text: string; bounds?: Bounds; expression: Expression; unresolved: string[] };
export type ExplainStyle = 'compact' | 'descriptive' | 'technical';

type TreeNode = ohm.Node & { tree: Expression };

export class ExpressionTools {
  static semantics(grammar: ohm.Grammar) {
    const binary = (left: TreeNode, op: ohm.Node, right: TreeNode): Expression =>
      ({ kind: 'operation', operator: op.sourceString, args: [left.tree, right.tree] });
    const actions: ohm.ActionDict<Expression> = {
      _nonterminal(...children) {
        if (children.length === 1) { return (children[0] as TreeNode).tree; }
        throw new Error(`Unsupported syntax: ${this.sourceString}`);
      },
      TernaryExp(cond, _q, yes, _c, no) {
        return { kind: 'operation', operator: '?:', args: [cond.tree, yes.tree, no.tree] as Expression[] };
      },
      PriExp_paren(_l, exp, _r) { return exp.tree as Expression; },
      PriExp_pos(_op, exp) { return { kind: 'operation', operator: '+u', args: [exp.tree as Expression] }; },
      PriExp_neg(_op, exp) { return { kind: 'operation', operator: '-u', args: [exp.tree as Expression] }; },
      LogExp_not(_op, exp) { return { kind: 'operation', operator: '!', args: [exp.tree as Expression] }; },
      FunctionCall(name, _l, list, _r) {
        const args: Expression[] = [];
        if (list.children.length) {
          const argList = list.children[0]!;
          args.push((argList.children[0] as TreeNode).tree);
          for (const arg of argList.children[2]!.children) { args.push((arg as TreeNode).tree); }
        }
        return { kind: 'operation', operator: `call:${name.sourceString}`, args };
      },
      ident(_initial, _rest) {
        return this.sourceString.startsWith('#')
          ? { kind: 'reference', name: this.sourceString.slice(1) }
          : { kind: 'value', value: this.sourceString };
      },
      number(_num) { return { kind: 'value', value: parseFloat(this.sourceString) }; },
      bool(_val) { return { kind: 'value', value: this.sourceString === 'true' }; },
      nihil(_val) { return { kind: 'value', value: null }; },
      strlit_single_quote(_l, chars, _r) { return { kind: 'value', value: chars.sourceString }; },
      strlit_double_quote(_l, _chars, _r) {
        return { kind: 'opaque', source: this.sourceString, reason: 'string interpolation deferred' };
      },
      dice_multi(count, _d, sides) {
        return { kind: 'dice', count: parseInt(count.sourceString), sides: parseInt(sides.sourceString) };
      },
      dice_single(_d, sides) { return { kind: 'dice', count: 1, sides: parseInt(sides.sourceString) }; },
    };
    for (const rule of ['LogExp_and', 'LogExp_or', 'CompExp_lt', 'CompExp_gt', 'CompExp_eq',
      'CompExp_neq', 'CompExp_lte', 'CompExp_gte', 'AddExp_plus', 'AddExp_minus',
      'MulExp_times', 'MulExp_divide', 'ExpExp_power']) {
      actions[rule] = binary as ohm.Action<Expression>;
    }
    return grammar.createSemantics().addAttribute('tree', actions);
  }

  static serialize(expr: Expression, bindings: Record<string, DeemValue>, reserved = new Set<string>()): string {
    if (expr.kind === 'value') {
      let key = `__preview_${Object.keys(bindings).length}`;
      while (reserved.has(key) || Object.hasOwn(bindings, key)) { key += '_'; }
      bindings[key] = expr.value;
      return `#${key}`;
    }
    if (expr.kind === 'reference') { return `#${expr.name}`; }
    if (expr.kind === 'dice') { return `${expr.count}d${expr.sides}`; }
    if (expr.kind === 'opaque') { return expr.source; }
    const args = expr.args.map(arg => this.serialize(arg, bindings, reserved));
    if (expr.operator.startsWith('call:')) { return `${expr.operator.slice(5)}(${args.join(', ')})`; }
    if (expr.operator === '?:') { return `(${args[0]} ? ${args[1]} : ${args[2]})`; }
    if (args.length === 1) { return `(${expr.operator.replace('u', '')}${args[0]})`; }
    return `(${args[0]} ${expr.operator} ${args[1]})`;
  }

  static specialize(expr: Expression, resolve: (name: string) => Expression,
    evaluate: (expr: Expression) => DeemValue): Expression {
    if (expr.kind === 'reference') { return resolve(expr.name); }
    if (expr.kind !== 'operation') { return expr; }
    if (!expr.args.length) {
      const value = evaluate(expr);
      return value === undefined ? expr : { kind: 'value', value };
    }
    const first = this.specialize(expr.args[0]!, resolve, evaluate);
    if (first.kind === 'value') {
      if (expr.operator === '?:') {
        return this.specialize(expr.args[first.value ? 1 : 2]!, resolve, evaluate);
      }
      if ((expr.operator === '&&' && !first.value) || (expr.operator === '||' && first.value)) { return first; }
    }
    const args = [first];
    let deferred = first.kind !== 'value';
    for (const arg of expr.args.slice(1)) {
      try {
        const specialized = this.specialize(arg, resolve, evaluate);
        args.push(specialized);
        deferred ||= specialized.kind !== 'value';
      } catch (error) {
        if (!deferred) { throw error; }
        args.push(arg);
        deferred = true;
      }
    }
    const result: Expression = { ...expr, args };
    if (args.every(arg => arg.kind === 'value')) {
      const value = evaluate(result);
      // Some legacy core functions can return undefined despite DeemValue's type.
      if (value !== undefined) { return { kind: 'value', value }; }
    }
    return result;
  }

  static bounds(expr: Expression): Bounds | undefined {
    if (expr.kind === 'value' && typeof expr.value === 'number' && Number.isFinite(expr.value)) {
      return { min: expr.value, max: expr.value };
    }
    if (expr.kind === 'dice' && Number.isSafeInteger(expr.count) && expr.count >= 0
      && Number.isSafeInteger(expr.sides) && expr.sides > 0 && Number.isSafeInteger(expr.count * expr.sides)) {
      return { min: expr.count, max: expr.count * expr.sides };
    }
    if (expr.kind !== 'operation') { return undefined; }
    if (!expr.args.length) { return undefined; }
    const a = this.bounds(expr.args[0]!);
    const b = expr.args[1] && this.bounds(expr.args[1]);
    if (!a) { return undefined; }
    if (expr.operator === '-u') { return { min: -a.max, max: -a.min }; }
    if (expr.operator === '+u') { return a; }
    if (!b) { return undefined; }
    let values: number[];
    if (expr.operator === '+') { values = [a.min + b.min, a.max + b.max]; }
    else if (expr.operator === '-') { values = [a.min - b.max, a.max - b.min]; }
    else if (expr.operator === '*') { values = [a.min*b.min, a.min*b.max, a.max*b.min, a.max*b.max]; }
    else { return undefined; }
    if (!values.every(Number.isFinite)) { return undefined; }
    return { min: Math.min(...values), max: Math.max(...values) };
  }

  static explain(expression: Expression, style: ExplainStyle = 'compact', allowBounds = true): Explanation {
    const unresolved: string[] = [];
    let dice = 0;
    const render = (expr: Expression): string => {
      if (expr.kind === 'value') { return typeof expr.value === 'string' ? expr.value : JSON.stringify(expr.value); }
      if (expr.kind === 'reference') { unresolved.push(`#${expr.name}`); return expr.name; }
      if (expr.kind === 'opaque') { unresolved.push(expr.reason); return expr.source; }
      if (expr.kind === 'dice') {
        dice += expr.count;
        return style === 'descriptive' ? `roll ${expr.count} ${expr.sides}-sided dice` : `${expr.count}d${expr.sides}`;
      }
      const args = expr.args.map(render);
      if (expr.operator.startsWith('call:')) { unresolved.push(expr.operator.slice(5)); return `${expr.operator.slice(5)}(${args.join(', ')})`; }
      if (expr.operator === '?:') { return `if ${args[0]}, then ${args[1]}, otherwise ${args[2]}`; }
      if (args.length === 1) { return `${expr.operator.replace('u', '')}(${args[0]})`; }
      const words: Record<string, string> = {
        '>': 'is greater than', '<': 'is less than', '==': 'equals', '!=': 'does not equal',
        '>=': 'is at least', '<=': 'is at most', '&&': 'and', '||': 'or',
      };
      return `(${args[0]} ${style === 'technical' ? expr.operator : words[expr.operator] ?? expr.operator} ${args[1]})`;
    };
    let text = render(expression);
    const bounds = allowBounds ? this.bounds(expression) : undefined;
    if (bounds && dice > 0) {
      const range = `${bounds.min} to ${bounds.max}`;
      text = style === 'compact' && dice === 1 ? range : `${text} (${range})`;
    }
    return { expression, text, bounds, unresolved: [...new Set(unresolved)] };
  }
}
