// import { WordCorruptor } from '../linguistics/Corruptor';
// import LanguageManager, { Concept, ConceptKind, conceptKinds, Conceptory, ConceptTemplate } from '../orsino/Language';
// import { Fighting } from '../orsino/rules/Fighting';
import Words from './words';

export type DeemValue = string | number | boolean | null | DeemValue[] | { [key: string]: DeemValue };
export type DeemFunc = (...args: any[]) => DeemValue;

export default class StandardLibrary {
  static rand = (seed: string | number) => {
    // simple seeded random generator (mulberry32)
    let s = typeof seed === 'number' ? seed : [...seed].reduce((a, b) => a + b.charCodeAt(0), 0);
    // console.warn(`Creating seeded random function with seed: ${seed} (numeric value: ${s})`);
    return function (max: number=-1) {
      s += 0x6D2B79F5;
      let t = Math.imul(s ^ s >>> 15, 1 | s);
      t ^= t + Math.imul(t ^ t >>> 7, 61 | t);
      const val = ((t ^ t >>> 14) >>> 0) / 4294967296;
      if (max > 0) {
        return Math.floor(val * max);
      }
      return val;
      // return [0.5, 0.6, 0.7][s++ % 3] as number; // deterministic sequence for testing
    }
  }

  static probability = (seed: string | number = 'default-seed'): Record<string, DeemFunc> => {
    const randFunc = StandardLibrary.rand(seed);
    return {
      rand: randFunc,
      oneOf: (...args: DeemValue[]) => {
        if (args.length === 0) {
          throw new Error('oneOf() expects at least one argument');
        }
        const picked = args[Math.floor(randFunc() * args.length)];
        // console.warn("Deem StandardLibrary.probabilityFunctions.oneOf(): picked=", picked);
        return picked ?? null;
      },
      pick: (arr: DeemValue[], index: DeemValue = -1) => {
        if (!Array.isArray(arr)) {
          throw new Error(`pick() expects an array, got: ${typeof arr}`);
        }
        if (arr.length === 0) {
          return null;
        }
        if (index === -1) {
          return arr[Math.floor(randFunc() * arr.length)] ?? null;
        } else {
          if (typeof index === 'number') {
            return arr[index % arr.length] ?? null;
          } else {
            throw new Error(`pick() received invalid index: ${JSON.stringify(index)} (type: ${typeof index})`);
          }
        }
      },
      sample: (arr: DeemValue[], count: DeemValue) => {
        if (typeof count !== 'number') {
          throw new Error(`sample() expects count to be a number, got: ${typeof count}`);
        }

        const sampled: DeemValue[] = [];

        const arrCopy = [...arr];
        for (let i = 0; i < count && arrCopy.length > 0; i++) {
          const index = Math.floor(randFunc() * arrCopy.length);
          const next = arrCopy.splice(index, 1)[0];
          if (next !== undefined) {
            sampled.push(next);
          }
        }
        return sampled;
      },
      roll: (count: DeemValue, sides: DeemValue) => {
        if (typeof count !== 'number' || typeof sides !== 'number') {
          throw new Error(`roll() expects count and sides to be numbers, got: ${typeof count} and ${typeof sides}`);
        }
        const rolls = Array.from({ length: count }, () => Math.floor(randFunc() * sides) + 1);
        const sum = rolls.reduce((a, b) => a + b, 0);
        // console.log(`roll(): rolled ${count}d${sides} => rolls: [${rolls.join(', ')}], sum: ${sum}`);
        return sum;
      },
      rollWithDrop: (count: DeemValue, sides: DeemValue) => {
        if (typeof count !== 'number' || typeof sides !== 'number') {
          throw new Error(`rollWithDrop() expects count and sides to be numbers, got: ${typeof count} and ${typeof sides}`);
        }
        const rolls = Array.from({ length: count }, () => Math.floor(randFunc() * sides) + 1);
        rolls.sort((a, b) => a - b);
        rolls.shift(); // drop the lowest
        return rolls.reduce((a, b) => a + b, 0);
      },
      alliterate: (options: DeemValue[], key: DeemValue) => {
        if (typeof key !== 'string') {
          throw new Error(`alliterate() expects key to be a string, got: ${typeof key}`);
        }
        if (!options.every(opt => typeof opt === 'string')) {
          throw new Error(`alliterate() expects all options to be strings, got: [${options.map(i => typeof i).join(', ')}]`);
        }
        const firstChar = key.charAt(0).toLowerCase();
        const filtered = options.filter(opt => (opt).charAt(0).toLowerCase() === firstChar);
        if (filtered.length > 0) {
          return filtered[Math.floor(randFunc() * filtered.length)] ?? null;
        }
        return options[Math.floor(randFunc() * options.length)] ?? null;
      },
    }
  }

  static core: Record<string, DeemFunc> = {
    a_an: (word: DeemValue) => {
      if (typeof word !== 'string') {
        throw new Error(`a_an() expects a string, got: ${typeof word}`);
      }
      const vowels = ['a', 'e', 'i', 'o', 'u'];
      return (vowels.includes(word.charAt(0).toLowerCase()) ? 'an' : 'a') + ' ' + word;
    },
    count: (arr: DeemValue[]) => { return arr.length },
    // rand: () => Math.random(),
    if: (cond: DeemValue, trueVal: DeemValue, falseVal: DeemValue) => (cond ? trueVal : falseVal),
    // oneOf: (...args: DeemValue[]) => {
    //   const picked = args[Math.floor(Math.random() * args.length)];
    //   // console.warn("Deem StandardLibrary.oneOf(): picked=", picked);
    //   return picked;
    // },
    // pick: (arr: DeemValue[], index: DeemValue = -1) => {
    //   if (!Array.isArray(arr)) {
    //     throw new Error(`pick() expects an array, got: ${typeof arr}`);
    //   }
    //   if (index === -1) {
    //     return arr[Math.floor(Math.random() * arr.length)]
    //   } else {
    //     if (typeof index === 'number') {
    //       return arr[index % arr.length];
    //     } else {
    //       throw new Error(`pick() received invalid index: ${JSON.stringify(index)} (type: ${typeof index})`);
    //     }
    //   }
    // },
    // sample: (arr: DeemValue[], count: DeemValue) => {
    //   if (typeof count !== 'number') {
    //     throw new Error(`sample() expects count to be a number, got: ${typeof count}`);
    //   }

    //   const sampled: DeemValue[] = [];

    //   const arrCopy = [...arr];
    //   for (let i = 0; i < count && arrCopy.length > 0; i++) {
    //     const index = Math.floor(Math.random() * arrCopy.length);
    //     sampled.push(arrCopy.splice(index, 1)[0]);
    //   }
    //   return sampled;
    // },
    round: (num: DeemValue) => {
      if (typeof num !== 'number') {
        throw new Error(`round() expects a number, got: ${typeof num}`);
      }
      return Math.round(num)
    },
    floor: (num: DeemValue) => {
      if (typeof num !== 'number') {
        throw new Error(`floor() expects a number, got: ${typeof num}`);
      }
      return Math.floor(num)
    },
    ceil: (num: DeemValue) => {
      if (typeof num !== 'number') {
        throw new Error(`ceil() expects a number, got: ${typeof num}`);
      }
      return Math.ceil(num)
    },
    capitalize: (str: DeemValue) => {
      if (typeof str !== 'string') {
        throw new Error(`capitalize() expects a string, got: ${typeof str} (${JSON.stringify(str)})`);
      }
      return str && str.charAt(0).toUpperCase() + str.slice(1)
    },
    humanize: (str: DeemValue) => {
      if (typeof str !== 'string') {
        throw new Error(`humanize() expects a string, got: ${typeof str}`);
      }
      return Words.humanize(str)
    },
    len: (obj: DeemValue) => {
      if (Array.isArray(obj) || typeof obj === 'string') {
        return obj.length;
      } else if (obj && typeof obj === 'object') {
        return Object.keys(obj).length;
      }
      return 0;
    },
    sum: (arr: DeemValue[], prop?: DeemValue) => {
      if (!Array.isArray(arr)) {
        throw new Error(`sum() expects an array, got: ${typeof arr}`);
      }
      if (arr.length === 0) {
        return 0;
      }
      if (!arr.every(item => typeof item === 'number' || (prop && typeof item === 'object'))) {
        throw new Error(`sum() expects an array of numbers or objects when property is specified, got: [${arr.map(i => typeof i).join(', ')}]`);
      }

      if (prop) {
        if (typeof prop !== 'string') {
          throw new Error(`sum() expects property name to be a string, got: ${typeof prop}`);
        }
        const numbers = arr.map(item => {
          if (typeof item === 'object' && item !== null && prop in item) {
            const it = item as { [key: string]: DeemValue };
            const val = it[prop];
            if (typeof val === 'number') {
              return val;
            } else {
              throw new Error(`sum() expected property '${prop}' to be a number, got: ${typeof val}`);
            }
          } else {
            return 0;
          }
        });

        // return objArray.reduce((acc, item) => acc + (item[prop] || 0), 0);
        return numbers.reduce((acc, val) => acc + val, 0);
      }
      const numArray: number[] = arr as number[];

      return numArray.reduce((acc, val) => acc + val, 0);
    },
    min: (...args: DeemValue[]) => {
      if (!args.every(item => typeof item === 'number')) {
        throw new Error(`min() expects all arguments to be numbers, got: [${args.map(i => typeof i).join(', ')}]`);
      }

      return Math.min(...args)
    },
    max: (...args: DeemValue[]) => {
      if (!args.every(item => typeof item === 'number')) {
        throw new Error(`max() expects all arguments to be numbers, got: [${args.map(i => typeof i).join(', ')}]`);
      }
      return Math.max(...args)
    },
    concat: (...args: DeemValue[]) => args.flat().filter((x) => x !== null && x !== undefined),

    // statMod: (stat: DeemValue) => {
    //   if (typeof stat !== 'number') {
    //     throw new Error(`statMod() expects a number, got: ${typeof stat}`);
    //   }
    //   return Fighting.statMod(stat);
    // },
    dig: (obj: DeemValue, ...path: DeemValue[]) => {
      if (typeof obj !== 'object' || obj === null) {
        return null;
      }
      if (!path.every(p => typeof p === 'string' || typeof p === 'number')) {
        throw new Error(`dig() expects path elements to be strings or numbers, got: [${path.map(p => typeof p).join(', ')}]`);
      }
      // @ts-expect-error -- dynamic prop access
      return path.reduce((acc, key) => {
        // return (acc && acc[key] !== undefined) ? acc[key] : null
        if (acc && typeof acc === 'object' && key in acc) {
          return (acc as Record<string, DeemValue>)[key];
        } else {
          return null;
          // throw new Error(`dig() could not find key '${key}' in object: ${JSON.stringify(acc)}`);
        }
      }, obj);
    },
    uniq: (arr: DeemValue[]) => {
      // console.warn("Deem StandardLibrary.uniq(): arr=", arr);
      return Array.from(new Set(arr))
    },
    distribute: (total: DeemValue, parts: DeemValue) => {
      if (typeof total !== 'number' || typeof parts !== 'number') {
        throw new Error(`distribute() expects total and parts to be numbers, got: ${typeof total} and ${typeof parts}`);
      }
      const base = Math.floor(total / parts);
      const remainder = total % parts;
      const distribution = Array(parts).fill(base);
      for (let i = 0; i < remainder; i++) {
        distribution[i]++;
      }
      return distribution.filter(x => x > 0) as DeemValue;
    },

    // translate: (languageName: DeemValue, ...concepts: DeemValue[]) => {
    //   // use default language (westron)
    //   const lang = LanguageManager.instance.getDictionary(languageName as string);
    //   if (!lang) {
    //     throw new Error(`translate() could not find default language 'westron'`);
    //   }
    //   return lang.translate(...concepts as Concept[]);
    // },

    // corrupt: (str: DeemValue, langKey: DeemValue) => {
    //   if (typeof str !== 'string') {
    //     throw new Error(`corrupt() expects a string, got: ${typeof str}`);
    //   }
    //   return WordCorruptor.mutate(str, langKey as 'westron' | 'khuzdul' | 'quenya') as DeemValue;
    // },

    // concepts: (conceptKind: DeemValue) => {
    //   if (typeof conceptKind !== 'string') {
    //     throw new Error(`concept() expects a string, got: ${typeof conceptKind}`);
    //   }
    //   const kind: ConceptKind = conceptKind as ConceptKind;
    //   if (!conceptKinds.includes(kind)) {
    //     throw new Error(`concept() received invalid concept kind: ${conceptKind}`);
    //   }
    //   const options = Conceptory.getConceptsByKind(kind);
    //   // const concept = options[Math.floor(Math.random() * options.length)];
    //   // return concept;
    //   return options;
    // },

    // conceptTemplate: (conceptTemplate: DeemValue) => {
    //   if (typeof conceptTemplate !== 'string') {
    //     throw new Error(`conceptory() expects a string, got: ${typeof conceptTemplate}`);
    //   }
    //   return Conceptory.generate(conceptTemplate as ConceptTemplate);
    // },

    join: (arr: DeemValue[], separator: DeemValue) => {
      if (!Array.isArray(arr)) {
        throw new Error(`join() expects an array, got: ${typeof arr}`);
      }
      if (typeof separator !== 'string') {
        throw new Error(`join() expects separator to be a string, got: ${typeof separator}`);
      }
      const items = arr.map(item => typeof item === "string" ? Words.humanize(item) : item)
      return (items as string[]).join(separator);
    },

    first: (arr: DeemValue[]) => {
      if (!Array.isArray(arr)) {
        throw new Error(`first() expects an array, got: ${typeof arr}`);
      }
      return arr.length > 0 ? (arr[0] ?? null) : null;
    },

    last: (arr: DeemValue[]) => {
      if (!Array.isArray(arr)) {
        throw new Error(`last() expects an array, got: ${typeof arr}`);
      }
      return arr.length > 0 ? (arr[arr.length - 1] ?? null) : null;
    },

    roman: (num: DeemValue) => {
      if (typeof num !== 'number') {
        throw new Error(`roman() expects a number, got: ${typeof num}`);
      }
      if (num <= 0 || num >= 4000) {
        throw new Error(`roman() expects a number between 1 and 3999, got: ${num}`);
      }
      const romanNumerals: { [key: number]: string } = {
        1000: 'M',
        900: 'CM',
        500: 'D',
        400: 'CD',
        100: 'C',
        90: 'XC',
        50: 'L',
        40: 'XL',
        10: 'X',
        9: 'IX',
        5: 'V',
        4: 'IV',
        1: 'I'
      };
      let result = '';
      let remaining = num;
      for (const value of Object.keys(romanNumerals).map(k => parseInt(k)).sort((a, b) => b - a)) {
        while (remaining >= value) {
          result += romanNumerals[value];
          remaining -= value;
        }
      }
      return result;
    }

  };

  // static meta: (context: Record<string, DeemValue>) => Record<string, DeemFunc> = (context) => {
  //   // console.log(`StandardLibrary.meta() called with context: ${JSON.stringify(context)}`);
  //   // const probability = StandardLibrary.probability(context.seed as string);

  //   return {
  //     // ...probability,
  //     eval: (expr: DeemValue) => Deem.evaluate(expr as string, context),
  //     defined: (varName: DeemValue) => {
  //       if (typeof varName !== 'string') {
  //         throw new Error(`defined() expects a string, got: ${typeof varName}`);
  //       }
  //       return context[varName] !== undefined;
  //     },
  //     lookup: ((
  //       tableName: GenerationTemplateType, groupName: string, condition?: string
  //     ) => {
  //       // console.warn(`Deem StandardLibrary.meta.lookup() called with tableName='${tableName}', groupName='${groupName}', seed='${context.seed}'`);
  //       return Generator.lookupInTable(
  //         tableName, groupName, false, condition, context, (max: number) => {
  //           // probability.rand()
  //           let val = Math.floor(probability.rand() as number * max);
  //           console.log(`Deem StandardLibrary.meta.lookup(): generated random value ${val} (max: ${max}) using seed '${context.seed}'`);
  //           return val;
  //         }
  //       );
  //     }) as DeemFunc
  //   }
  // }
}