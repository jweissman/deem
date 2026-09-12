// src/orsino/Template.ts
import Deem from "./deem";
import { type DeemFunc, type DeemValue } from "./stdlib";
import Generator, { type GenerationSetting, type GeneratorOptions } from "./Generator";
// import { StatusModifications } from "./Status";
import { Table } from "./Table";
import { type GenerationTemplateType } from "./GenerationTemplateType";
import deepCopy from "./deepCopy";
import { traceEvent, type ExecutionTrace, withTraceScope } from "./trace";

export type TemplateProps = Record<string, string | number | boolean | object>;
export class Template {
  constructor(
    public type: GenerationTemplateType,
    public props: TemplateProps = {}
  ) { }

  static bootstrapDeem(
    context: Record<string, DeemValue> = {},
    setting: GenerationSetting = Generator.defaultSetting(),
    trace?: ExecutionTrace,
  ): Deem {
    const holder: { runtime: Deem | null } = { runtime: null };
    const runtime = new Deem({
      seed: (typeof context.seed === 'string' || typeof context.seed === 'number')
        ? context.seed
        : 'default-seed',
      contextualStdlib: (activeContext) => ({
        eval: (expr: DeemValue) => {
          const rt = holder.runtime;
          if (!rt) {
            throw new Error('Deem runtime is not initialized');
          }
          return rt.evaluate(expr as string, activeContext);
        },
        defined: (varName: DeemValue) => {
          if (typeof varName !== 'string') {
            throw new Error(`defined() expects a string, got: ${typeof varName}`);
          }
          return activeContext[varName] !== undefined;
        },
        lookup: ((
          tableName: GenerationTemplateType, groupName: string, condition?: string
        ) => {
          const rand = runtime.stdlib.rand as ((max?: number) => number) | undefined;
          const randomFunc = (maxValue: number) => {
            if (!rand) {
              return Math.floor(Math.random() * maxValue);
            }
            return rand(maxValue) as number;
          };
          return Generator.lookupInTable(
            tableName,
            groupName,
            false,
            { condition, context: activeContext, setting, randomFunc, trace },
          );
        }) as DeemFunc,
        lookupUnique: ((tableName: GenerationTemplateType, groupName: string) =>
          Generator.lookupInTable(tableName, groupName, true, { setting, trace })
        ) as DeemFunc,

        gatherEntries: ((tableName: GenerationTemplateType, groupName: string, count: number = -1) => {
          const table = Generator.generationSource(tableName, setting);
          if (!table || !(table instanceof Table)) {
            throw new Error(`Table not found: ${tableName}`);
          }
          const rand = runtime.stdlib.rand as ((max?: number) => number) | undefined;
          const randomFunc = (maxValue: number) => {
            if (!rand) {
              return Math.floor(Math.random() * maxValue);
            }
            return rand(maxValue) as number;
          };
          return table.gatherEntries(groupName, count, randomFunc);
        }) as DeemFunc,

        hasEntry: ((tableName: GenerationTemplateType, groupName: string) => {
          const table = Generator.generationSource(tableName, setting);
          if (!table || !(table instanceof Table)) {
            throw new Error(`Table not found: ${tableName}`);
          }
          return table.hasGroup(groupName);
        }) as DeemFunc,
        hasValue: ((tableName: GenerationTemplateType, value: DeemValue) => {
          const table = Generator.generationSource(tableName, setting);
          if (!table || !(table instanceof Table)) {
            throw new Error(`Table not found: ${tableName}`);
          }
          return table.containsValue(value);
        }) as DeemFunc,
        findGroup: ((tableName: GenerationTemplateType, value: DeemValue) => {
          const table = Generator.generationSource(tableName, setting);
          if (!table || !(table instanceof Table)) {
            throw new Error(`Table not found: ${tableName}`);
          }
          return table.findGroupForValue(value);
        }) as DeemFunc,

        gather: ((
          tableName: GenerationTemplateType, count: number = -1, condition?: string
        ) => Generator.gatherKeysFromTable(tableName, count, condition, setting)) as DeemFunc,

        gen: ((type: GenerationTemplateType) => {
          return Generator.gen(type, {
            ...activeContext,
            __deemRuntime: runtime,
            __setting: setting,
            __trace: trace,
          });
        }) as DeemFunc,
        genIsolated: ((type: GenerationTemplateType) => {
          return Generator.gen(type, { __deemRuntime: runtime, __setting: setting, __trace: trace });
        }) as DeemFunc,
        genList: ((type: GenerationTemplateType, count: number = 1) => {
          return Generator.genList(type, {
            ...activeContext,
            __deemRuntime: runtime,
            __setting: setting,
            __trace: trace,
          }, count);
        }) as DeemFunc,
        genListIsolated: ((type: GenerationTemplateType, count: number = 1) => {
          return Generator.genList(type, { __deemRuntime: runtime, __setting: setting, __trace: trace }, count);
        }) as DeemFunc,

        mapGenList: ((
          type: GenerationTemplateType,
          ...itemsAndProps: DeemValue[]
        ) => {
          const results = [];

      // for (let i = 0; i < items.length; i++) {
      //   const item = items[i];
      //   const index = i;
      //   const genOptions: GeneratorOptions = { ...context, [property]: item, _index: index };
      //   const genResult = Generator.gen(type, genOptions);
      //   results.push(genResult);
      // }

      // need to take arbitrary list of items1, properties1, items2, properties2, ...
          const pairCount = Math.floor(itemsAndProps.length / 2);
          const propertiesList: Record<string, DeemValue>[] = [];

          const minItems = Math.min(...Array.from({ length: pairCount }, (_, p) => {
            const items: DeemValue[] = itemsAndProps[p * 2] as DeemValue[];
            return items.length;
          }));

          for (let p = 0; p < pairCount; p++) {
            const items: DeemValue[] = itemsAndProps[p * 2] as DeemValue[];
            const property: string = itemsAndProps[p * 2 + 1] as string;

        // ensure we have a properties object for each item
            for (let i = 0; i < items.length; i++) {
              const item = items[i];
              if (item === undefined) {
                continue;
              }
              if (!propertiesList[i]) {
                propertiesList[i] = {};
              }
              const propertyBag = propertiesList[i];
              if (propertyBag) {
                propertyBag[property] = item;
              }
            }
          }

      // now generate with each properties object
          for (let i = 0; i < minItems; i++) {
            const props = propertiesList[i] ?? {};
            const genOptions: GeneratorOptions = {
              ...activeContext,
              ...props,
              _index: i,
              __deemRuntime: runtime,
              __setting: setting,
              __trace: trace,
            };
            const genResult = Generator.gen(type, genOptions);
            results.push(genResult);
          }

          return results;
        }) as DeemFunc,

        fxHeal: ((amount: number | string) => ({ type: 'heal', amount })) as DeemFunc,
        fxDamage: ((amount: number | string, damageType?: string) => ({ type: 'damage', amount, kind: damageType })) as DeemFunc,
      }),
    });

    holder.runtime = runtime;
    return runtime;
  }

  assembleProperties(
    options: Record<string, DeemValue | Deem | GenerationSetting | ExecutionTrace> = {},
    // _generator: any
  ): Record<string, any> {
    const optionBag = { ...options };
    const runtimeFromOptions = optionBag.__deemRuntime;
    const settingFromOptions = optionBag.__setting;
    const traceFromOptions = optionBag.__trace;
    delete optionBag.__deemRuntime;
    delete optionBag.__setting;
    delete optionBag.__trace;
    const localContext: Record<string, DeemValue> = optionBag as Record<string, DeemValue>;
    const assembled: Record<string, DeemValue> = {};
    const setting = settingFromOptions as GenerationSetting | undefined;
    const trace = traceFromOptions as ExecutionTrace | undefined;
    const runtime = (runtimeFromOptions as Deem | undefined)
      ?? Template.bootstrapDeem(localContext, setting ?? Generator.defaultSetting(), trace);

    traceEvent(trace, 'template.assemble.start', {
      template: this.type,
      propertyCount: Object.keys(this.props).length,
    });

    // Object.entries(this.props).forEach(([key, value]) => {
    for (const [key, value] of Object.entries(this.props)) {
      // console.log(`Assembling property: ${key} with value:`, value);
      const context: Record<string, DeemValue> = {
        ...localContext,
        ...assembled,
        '_self': assembled,
      };
      let shouldResolve = localContext[key] === undefined;
      let effectiveKey = key;
      if (effectiveKey.startsWith(">")) {
        effectiveKey = key.substring(1);
        shouldResolve = true;
      }
      const resolved: DeemValue = withTraceScope(trace, `prop:${effectiveKey}`, () => {
        traceEvent(trace, 'template.property.start', {
          template: this.type,
          key: effectiveKey,
          sourceKey: key,
          shouldResolve,
        });
        const nextValue = shouldResolve
          ? (Template.evaluatePropertyExpression(value, context, runtime, trace, {
            template: this.type,
            key: effectiveKey,
          }) as unknown as DeemValue)
          : (localContext[effectiveKey] ?? null);
        traceEvent(trace, 'template.property.result', {
          template: this.type,
          key: effectiveKey,
          value: nextValue,
        });
        return nextValue;
      });

      // it felt like we needed deep copy here to prevent any mutations from affecting the original template
      assembled[effectiveKey] = deepCopy(resolved) as DeemValue;

      localContext[effectiveKey] = assembled[effectiveKey] ?? null;

      if (effectiveKey.startsWith("!")) {
        // handle special commands (just !remove for now)
        if (effectiveKey === "!remove" && Array.isArray(assembled[effectiveKey])) {
          for (const propToRemove of assembled[effectiveKey] as DeemValue[]) {
            delete assembled[propToRemove as string];
            delete localContext[propToRemove as string];
          }
        }
        continue;
      }

      if (effectiveKey.startsWith("*") || effectiveKey.startsWith("^")) {
        // we have evaluated the value (confirm we have gotten an object) 
        // then 'overlay' (add) each property onto the context
        // Object.entries(assembled[key] || {}).forEach(([k, v]) => {
        for (const [k, originalValue] of Object.entries(assembled[effectiveKey] || {})) {
          let v = originalValue;

          // if it's an array, we want to concatenate it
          if (Array.isArray(v)) {
            if (v.some((el: any) => typeof el === 'string' && el.startsWith("="))) {
              // throw new Error(`Cannot overlay unevaluated expression in array for property ${k}: ${v}`);
              // v = v.map(async (el: any) => {
              for (let i = 0; i < v.length; i++) {
                let el = v[i];
                if (typeof el === 'string' && el.startsWith("=")) {
                  el = Template.evaluatePropertyExpression(el, context, runtime, trace, {
                    template: this.type,
                    key: k,
                    overlayFrom: effectiveKey,
                  });
                }
                v[i] = el;
              }
              // console.log("Evaluated overlaid array for property", k, ":", v);
            }

            assembled[k] = (assembled[k] as DeemValue[] || []).concat(v);
          } else if (typeof v === 'number') {
            assembled[k] = (assembled[k] as number || 0) + v;
          } else if (typeof v === 'string') {
            if (effectiveKey.startsWith("^")) {
              // console.log(`Evaluating overlaid property ${k} with expression: ${v}`);
              // deem evaluate the string before overlaying
              v = Template.evaluatePropertyExpression(v, { ...context, ...assembled }, runtime, trace, {
                template: this.type,
                key: k,
                overlayFrom: effectiveKey,
              });
            }
            // console.log(`Adding ${k}=${v} to context (was ${localContext[k]})`);
            // just replace!
            assembled[k] = v; // + (assembled[k] || '');
            // localContext[k] = assembled[k];
          } else if (typeof v === 'boolean') {
            assembled[k] = v || assembled[k] || false;
          } else if (typeof v === 'object' && v !== null) {
            // assume obj?
            assembled[k] = { ...v, ...((assembled[k] as Record<string, DeemValue>) || {}) };
          } else {
            // assembled[k] = v + (assembled[k] || null);
            throw new Error(`Cannot overlay property ${k} with value of type ${typeof v}`);
          }
          localContext[k] = assembled[k] ?? null;
        }
      }

      // console.log(`Assembled property: ${key} =`, assembled[key]);
    }

    // omit internal/overlay properties starting with '_' or '*'
    Object.keys(assembled).forEach(key => {
      if (key.startsWith('_') || key.startsWith('*') || key.startsWith('^') || key.startsWith('!')) {
        delete assembled[key];
      }
    });

    let provideIdentifier = true;
    if (this.props['__no_id'] === true || options['__no_id'] === true) {
      provideIdentifier = false;
    }

    if (!assembled.id && provideIdentifier) {
      const rand = runtime.stdlib.rand as ((max?: number) => number) | undefined;
      const chunk = rand
        ? Math.floor((rand() as number) * 2176782336).toString(36).padStart(6, '0').slice(0, 6)
        : Math.random().toString(36).substring(2, 8);
      assembled.id = `${this.type}:${chunk}`;
      traceEvent(trace, 'template.id.generated', {
        template: this.type,
        id: assembled.id,
      });
    }

    traceEvent(trace, 'template.assemble.complete', {
      template: this.type,
      outputKeys: Object.keys(assembled),
    });

    return {
      // id: `${this.type}:${Math.random().toString(36).substring(2, 8)}`,
      ...assembled
    };
  }

  static evaluatePropertyExpression(
    expr: unknown,
    context: Record<string, DeemValue>,
    runtime: Deem = Deem.defaultInstance,
    trace?: ExecutionTrace,
    detail: Record<string, unknown> = {},
  ): DeemValue {
    if (!expr || typeof expr !== 'string') {
      return expr as DeemValue;
    }

    if (expr.startsWith("=")) {
      try {
        traceEvent(trace, 'expression.evaluate.start', {
          ...detail,
          expression: expr,
        });
        const value = runtime.evaluate(expr, context);
        traceEvent(trace, 'expression.evaluate.result', {
          ...detail,
          expression: expr,
          result: value,
        });
        return value;
      } catch (e) {
        console.error(`Error evaluating expression ${expr}`, e);
        traceEvent(trace, 'expression.evaluate.error', {
          ...detail,
          expression: expr,
          error: e instanceof Error ? e.message : String(e),
        });

        // return null;
        throw e;
      }
    }

    return expr;
  }
}
