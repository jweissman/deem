import Generator, { type GenerationSetting } from "./Generator";
import { Table } from "./Table";
import { type GenerationTemplateType } from "./GenerationTemplateType";
import { type DeemFunc, type DeemValue } from "./stdlib";

type Context = Record<string, DeemValue>;
type Random = (maxValue: number) => number;

export class Constraints {
  static table(setting: GenerationSetting, tableName: GenerationTemplateType): Table {
    const table = Generator.generationSource(tableName, setting);
    if (!table || !(table instanceof Table)) {
      throw new Error(`Table not found: ${tableName}`);
    }
    return table;
  }

  static agrees(fields: Context, name: string, wanted: DeemValue): boolean {
    if (name in fields) {
      return fields[name] === wanted;
    }
    const allowed = fields[`_${name}s`];
    return typeof allowed === 'object' && allowed !== null && !Array.isArray(allowed)
      && Boolean((allowed as Context)[String(wanted)]);
  }

  static fits(context: Context, row: DeemValue, ...names: DeemValue[]): boolean {
    if (typeof row !== 'object' || row === null || Array.isArray(row)) {
      throw new Error('fits() expects a table row');
    }
    return names.every((name) => {
      if (typeof name !== 'string') {
        throw new Error('fits() expects the names of dimensions');
      }
      return context[name] === undefined || Constraints.agrees(row as Context, name, context[name]);
    });
  }

  static owns(context: Context, setting: GenerationSetting, tableName: GenerationTemplateType,
    groupName: string): boolean {
    const table = Constraints.table(setting, tableName);
    const own = table.gatherEntries(groupName);
    return table.gatherEntries('default')
      .every((name) => typeof name !== 'string' || context[name] === undefined || own.includes(name));
  }

  static gatherEntries(source: { setting: GenerationSetting; random: () => Random }, tableName: GenerationTemplateType,
    groupName: string, count: number = -1): DeemValue[] {
    return Constraints.table(source.setting, tableName).gatherEntries(groupName, count, source.random());
  }

  static hasEntry(setting: GenerationSetting, tableName: GenerationTemplateType, groupName: string): boolean {
    return Constraints.table(setting, tableName).hasGroup(groupName);
  }

  static hasValue(setting: GenerationSetting, tableName: GenerationTemplateType, value: DeemValue): boolean {
    return Constraints.table(setting, tableName).containsValue(value);
  }

  static findGroup(setting: GenerationSetting, tableName: GenerationTemplateType, value: DeemValue): DeemValue {
    return Constraints.table(setting, tableName).findGroupForValue(value);
  }

  static functions(context: Context, setting: GenerationSetting, random: () => Random): Record<string, DeemFunc> {
    return {
      gatherEntries: Constraints.gatherEntries.bind(null, { setting, random }) as DeemFunc,
      hasEntry: Constraints.hasEntry.bind(null, setting) as DeemFunc,
      hasValue: Constraints.hasValue.bind(null, setting) as DeemFunc,
      findGroup: Constraints.findGroup.bind(null, setting) as DeemFunc,
      fits: Constraints.fits.bind(null, context) as DeemFunc,
      owns: Constraints.owns.bind(null, context, setting) as DeemFunc,
    };
  }
}
