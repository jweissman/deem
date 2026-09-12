import Deem from "./deem";
import { type DeemValue } from "./stdlib";
import { Table } from "./Table";
import { Template } from "./Template";
import { type GenerationTemplateType } from "./GenerationTemplateType";
import { traceEvent, type ExecutionTrace } from "./trace";

export type GenerationSetting = Record<string, Template | Table>;
export type LookupInTableOptions = {
  condition?: string;
  context?: Record<string, DeemValue>;
  setting?: GenerationSetting;
  trace?: ExecutionTrace;
  randomFunc?: (maxValue: number) => number;
};

export type GeneratorOptions = {
  __deemRuntime?: Deem;
  __setting?: GenerationSetting;
  __trace?: ExecutionTrace;
  _index?: number;

  setting?: string;
  background?: string;

  key?: string;
  _key?: string;

  name?: string;
  _name?: string;

  forename?: string;

  race?: string;

  count?: number;
  __count?: number;

  group?: string;

  class?: string;
  gender?: string;
  targetCr?: number;
  _targetCr?: number;
  _moduleLevel?: number;

  // playerControlled?: boolean;
  animal_type?: string;
  animal_aspect?: string;

  monster_type?: string;
  monster_aspect?: string;
  age_category?: string;
  color?: string;
  element?: string;
  rank?: string;

  _loot_rank?: string;
  _plane_name?: string;


  seed?: string;
}
export type GeneratedValue = Record<string, DeemValue>;

export default class Generator {
  static genList(
    type: GenerationTemplateType,
    options: GeneratorOptions = {},
    count: number = 1
  ): GeneratedValue[] {
    if (count === 0) {
      return [];
    }
    const items: GeneratedValue[] = [];
    while (items.length < count) {
      const i = items.length;
      const item: GeneratedValue = this.gen(type, { ...options, _index: i }) as GeneratedValue;
      items.push(item);
    }

    return items;
  }

  static gen(
    type: GenerationTemplateType,
    options: GeneratorOptions = {}
  ): GeneratedValue | GeneratedValue[] {
    const setting = options.__setting ?? Generator.defaultSetting();

    const templ = Generator.generationSource(type, setting);
    if (!templ) {
      throw new Error('No template found for type: ' + type);
    }

    const runtime = options.__deemRuntime
      ?? Template.bootstrapDeem(
        options as unknown as Record<string, DeemValue>,
        setting,
        options.__trace,
      );
    const optionsWithRuntime: GeneratorOptions = {
      ...options,
      __deemRuntime: runtime,
      __setting: setting,
      __trace: options.__trace,
    };

    if (optionsWithRuntime.__count && optionsWithRuntime.__count > 1) {
      return this.genList(type, { ...optionsWithRuntime, __count: undefined }, optionsWithRuntime.__count);
    } else if (optionsWithRuntime.count && optionsWithRuntime.count > 1) {
      return this.genList(type, { ...optionsWithRuntime, count: undefined }, optionsWithRuntime.count);
    }

    if (templ instanceof Template) {
      traceEvent(optionsWithRuntime.__trace, 'generation.template.start', { type });
      const assembled = templ.assembleProperties(optionsWithRuntime); //, this);
      traceEvent(optionsWithRuntime.__trace, 'generation.template.complete', {
        type,
        keys: Object.keys(assembled),
      });
      return assembled;
    } else if (templ instanceof Table) {
      let group = optionsWithRuntime.group || 'default';
      if (optionsWithRuntime[templ.discriminator as keyof GeneratorOptions]) {
        group = optionsWithRuntime[templ.discriminator as keyof GeneratorOptions] as string;
      }
      const rand = runtime.stdlib.rand as ((max?: number) => number) | undefined;
      const randomFunc = (maxValue: number) => {
        if (!rand) {
          return Math.floor(Math.random() * maxValue);
        }
        return rand(maxValue) as number;
      };
      const candidates = templ.optionsForPick(group);
      if (!candidates || candidates.length === 0) {
        throw new Error(`No options available in table ${templ.name} for group ${group}`);
      }
      const pickedIndex = randomFunc(candidates.length);
      const picked = candidates[pickedIndex];
      if (picked === undefined) {
        throw new Error(`No option selected for ${templ.name}/${group}`);
      }
      traceEvent(optionsWithRuntime.__trace, 'generation.table.pick', {
        type,
        table: templ.name,
        group,
        candidateCount: candidates.length,
        pickedIndex,
        picked,
      });
      return picked as GeneratedValue;
    } else {
      throw new Error('Invalid template type for generation: ' + type);
    }
  }

  public static lookupInTable(
    tableName: GenerationTemplateType,
    groupName: string,
    globallyUnique: boolean = false,
    options: LookupInTableOptions = {},
  ): DeemValue {
    const condition = options.condition;
    const context = options.context ?? {};
    const setting = options.setting ?? Generator.defaultSetting();
    const trace = options.trace;
    const randomFunc = options.randomFunc ?? ((max: number) => Math.floor(Math.random() * max));
    const table = Generator.generationSource(tableName, setting);
    if (!table || !(table instanceof Table)) {
      throw new Error(`Table not found: ${tableName}`);
    }

    const availableOptions = table.optionsForPick(groupName);
    if (!availableOptions || availableOptions.length === 0) {
      throw new Error(`No options found for group ${groupName} in table ${tableName}`);
    }

    traceEvent(trace, 'lookup.start', {
      tableName,
      groupName,
      globallyUnique,
      condition: condition ?? null,
      candidateCount: availableOptions.length,
    });

    if (condition) {
      const conditionMatches = availableOptions.map((option) => {
        const conditionResult = Deem.evaluate(condition, {
          __it: option,
          ...context
        });
        return {
          option,
          passed: Boolean(conditionResult),
        };
      });
      const filteredOptions = conditionMatches.filter((x) => x.passed).map((x) => x.option);
      traceEvent(trace, 'lookup.condition.result', {
        tableName,
        groupName,
        condition,
        matches: conditionMatches,
        keptCount: filteredOptions.length,
      });

      if (filteredOptions.length === 0) {
        console.warn(`No options in group ${groupName} of table ${tableName} satisfy condition: ${condition} -- returning first available option.`, { npc_role: context.npc_role });
        const fallback = availableOptions[0];
        if (fallback === undefined) {
          throw new Error(`No options available in group ${groupName} of table ${tableName}`);
        }
        traceEvent(trace, 'lookup.fallback', {
          tableName,
          groupName,
          reason: 'no-condition-matches',
          fallback,
        });
        return fallback;
      }
      let choice: DeemValue;
      if (globallyUnique) {
        const uniqueOptions = filteredOptions.filter(option => !table.pickedOptions.has(option));
        if (uniqueOptions.length === 0) {
          throw new Error(`No globally unique options left in group ${groupName} of table ${tableName} satisfying condition: ${condition}`);
        }
        const pickedIndex = randomFunc(uniqueOptions.length);
        const picked = uniqueOptions[pickedIndex];
        if (picked === undefined) {
          throw new Error(`No unique option selected for ${tableName}/${groupName}`);
        }
        choice = picked;
        table.pickedOptions.add(choice);
        traceEvent(trace, 'lookup.pick', {
          tableName,
          groupName,
          globallyUnique: true,
          candidateCount: uniqueOptions.length,
          pickedIndex,
          picked: choice,
        });
      } else {
        const pickedIndex = randomFunc(filteredOptions.length);
        const picked = filteredOptions[pickedIndex];
        if (picked === undefined) {
          throw new Error(`No option selected for ${tableName}/${groupName}`);
        }
        choice = picked;
        traceEvent(trace, 'lookup.pick', {
          tableName,
          groupName,
          globallyUnique: false,
          candidateCount: filteredOptions.length,
          pickedIndex,
          picked: choice,
        });
      }
      return choice;
    } else {
      if (globallyUnique) {
        const uniqueOptions = availableOptions.filter(option => !table.pickedOptions.has(option));
        if (uniqueOptions.length === 0) {
          console.warn(`No more unique options available in table ${table.name} for group ${groupName}, resetting picked options.`);
          table.pickedOptions.clear();
          return this.lookupInTable(tableName, groupName, globallyUnique, options);
        }

        const pickedIndex = randomFunc(uniqueOptions.length);
        const picked = uniqueOptions[pickedIndex];
        if (picked === undefined) {
          throw new Error(`No unique option selected for ${tableName}/${groupName}`);
        }
        table.pickedOptions.add(picked);
        traceEvent(trace, 'lookup.pick', {
          tableName,
          groupName,
          globallyUnique: true,
          candidateCount: uniqueOptions.length,
          pickedIndex,
          picked,
        });
        return picked;
      }

      const pickedIndex = randomFunc(availableOptions.length);
      const picked = availableOptions[pickedIndex];
      if (picked === undefined) {
        throw new Error(`No option selected for ${tableName}/${groupName}`);
      }
      traceEvent(trace, 'lookup.pick', {
        tableName,
        groupName,
        globallyUnique: false,
        candidateCount: availableOptions.length,
        pickedIndex,
        picked,
      });
      return picked;
    }
  }

  public static gatherKeysFromTable(
    tableName: GenerationTemplateType,
    count: number,
    condition?: string,
    setting: GenerationSetting = Generator.defaultSetting(),
  ): DeemValue[] {
    const table = Generator.generationSource(tableName, setting);
    if (!table || !(table instanceof Table)) {
      throw new Error(`Table not found: ${tableName}`);
    }
    const ret = table.gatherKeys(count);

    if (condition) {
      for (const key of ret.slice()) {
        const conditionResult = Deem.evaluate(condition, {
          __it: this.lookupInTable(tableName, key, false, { setting })
        });
        if (!conditionResult) {
          ret.splice(ret.indexOf(key), 1);
        }
      }
    }

    return ret;
  }

  static generationSource(type: GenerationTemplateType, source: GenerationSetting): Template | Table | null {
    return source[type] || null;
  }

  static defaultSetting(): GenerationSetting {
    return {
      module: new Template('module', {}),
      loot: new Template('loot', {}),
      animal: new Template('animal', {
          name: '=oneOf("Wolf", "Bear", "Giant Spider", "Giant Snake", "Giant Giant")',
          cr: '=oneOf(0.25, 0.5, 1, 2, 3)',
          hp: 25,
          ac: '=10 + floor(cr * 2)',
          str: '=floor(cr * 2) + rand(1, 6)',
          dex: '=floor(cr * 2) + rand(1, 6)',
          con: '=floor(cr * 2) + rand(1, 6)',
          int: '=floor(cr * 2) + rand(1, 6)',
          wis: '=floor(cr * 2) + rand(1, 6)',
          cha: '=floor(cr * 2) + rand(1, 6)',
        }),
      dungeon: new Template('dungeon', {
          name: '=oneOf("The Cursed Crypt", "The Forgotten Keep", "The Shadowed Caverns", "The Lost Temple", "The Haunted Catacombs")',
          description: '=oneOf("A dark and eerie place filled with traps and monsters.", "An ancient ruin with hidden secrets.", "A labyrinthine cave system teeming with danger.", "A forgotten temple guarded by undead.", "A sprawling catacomb haunted by restless spirits.")',
          difficulty: '=oneOf("Easy", "Medium", "Hard", "Deadly")',
          size: '=oneOf("Small", "Medium", "Large")',
          theme: '=oneOf("Undead", "Beasts", "Traps", "Magic", "Mixed")'
        }),
      monster: new Template('monster', {
          name: '=oneOf("Goblin", "Orc", "Troll", "Bandit", "Skeleton")',
          cr: '=oneOf(0.25, 0.5, 1, 2, 3)',
          hp: 50, //'=lookup(name, cr) * 10 + rand(1, 10)',
          ac: '=10 + floor(cr * 2)',
          str: '=floor(cr * 2) + rand(1, 6)',
          dex: '=floor(cr * 2) + rand(1, 6)',
          con: '=floor(cr * 2) + rand(1, 6)',
          int: '=floor(cr * 2) + rand(1, 6)',
          wis: '=floor(cr * 2) + rand(1, 6)',
          cha: '=floor(cr * 2) + rand(1, 6)',
        }),
      treasure: new Table('treasure', 'type')
          .group('negligible', ['a rusty sword', 'a small pouch of coins', 'a healing potion', 'an old map', 'a silver ring'])
          .group('normal', ['a finely crafted dagger', 'a bag of gold coins', 'a potion of strength', 'a mysterious amulet', 'a rare gemstone'])
          .group('minor', ['a powerful potion', 'a bag of gems', 'a magical scroll', 'a rare artifact', 'a golden amulet'])
          .group('major', ['a magical staff', 'a chest of gold', 'an ultra-rare gem', 'an enchanted armor', 'a powerful artifact'])
          .group('legendary', ['a legendary sword', 'a chest of ancient treasures', 'the crown of a lost king', 'a mythical artifact', 'a powerful arcane relic']),
      maleName: new Table('maleName', 'race')
          .group('human', ['John', 'Michael', 'David', 'James', 'Robert'])
          .group('elf', ['Eldarion', 'Faelar', 'Theren', 'Aelar', 'Caladrel'])
          .group('dwarf', ['Thorin', 'Balin', 'Dwalin', 'Gimli', 'Durin']),
      femaleName: new Table('femaleName', 'race')
          .group('human', ['Jane', 'Emily', 'Sarah', 'Jessica', 'Lisa'])
          .group('elf', ['Aelene', 'Lia', 'Sylvara', 'Fayeth', 'Mythra'])
          .group('dwarf', ['Dis', 'Hilda', 'Gerta', 'Sigrid', 'Astrid']),
      androgynousName: new Table('androgynousName', 'race')
          .group('human', ['Alex', 'Taylor', 'Jordan', 'Morgan', 'Casey'])
          .group('elf', ['Rynn', 'Sage', 'Quinn', 'Aeris', 'Lior'])
          .group('dwarf', ['Kari', 'Runa', 'Tora', 'Vala', 'Eira']),
        // name: new Table('gender', 'sex')
        //   .group('male', ['John', 'Michael', 'David', 'James', 'Robert'])
        //   .group('female', ['Jane', 'Emily', 'Sarah', 'Jessica', 'Lisa'])
        //   .group('neutral', ['Alex', 'Taylor', 'Jordan', 'Morgan', 'Casey']),
      surname: new Table('occupation', 'category')
          .group('Artist', ['Fletcher', 'Shoesmith', 'Baker', 'Tailor', 'Mason', 'Smith', 'Carpenter'])
          .group('Engineer', ['Leach', 'Wright', 'Turner'])
          .group('Merchant', ['Porter', 'Hawker', 'Cheeseman', 'Nutter'])
          .group('Adventurer', ['Forester', 'Hunter', 'Latimer', 'Taverner']),
      pc: new Template('pc', {
          gender: '=oneOf(male, female, neutral)',
          _firstName: '=lookup(name, #gender)',
          age: '=4d10+16',
          occupation: '=oneOf(Artist, Engineer, Merchant, Adventurer)',
          _lastName: '=lookup(surname, #occupation)',
          name: '=#_firstName + " " + #_lastName',
          str: '=3d6 + 2',
          dex: '=3d6',
          con: '=3d6',
          int: '=3d6',
          wis: '=3d6',
          cha: '=3d6',
          hp: '=10 + #con',
        }),
      npc: new Template('npc', {
          gender: '=oneOf(male, female, neutral)',
          _firstName: '=lookup(name, #gender)',
          _lastName: '=oneOf(Ford, Smith, Johnson, Brown, Davis, Miller)',
          name: '=#_firstName + " " + #_lastName',
          age: '=4d10+16',
          role: '=oneOf(Shopkeeper, Guard, Villager)'
        }),
      room: new Template('room', {
          // _kind: '=oneOf(tavern, marketplace, library, alleyway, hall)',
          narrative: '=oneOf("A dimly lit tavern", "A bustling marketplace", "A quiet library", "A shadowy alleyway", "A grand hall")',
          size: '=oneOf(small, medium, large)',
          _encounterChance: '=oneOf(0.2, 0.4, 0.6)',
          _hasTreasure: '=oneOf(true, false)',
          treasure: '=if(#_hasTreasure, lookup(treasure, minor), nihil)',
          encounter: '=if(rand() < #_encounterChance, gen("encounter"), nihil)'
        }),
      encounter: new Template('encounter', {
          name: '=oneOf("Goblin Ambush", "Bandit Raid", "Wild Animal Attack", "Mysterious Stranger", "Lost Traveler")',
          difficulty: '=oneOf("Easy", "Medium", "Hard", "Deadly")',
          // description can be added with a oneOf(...) expression as needed.
        })
    };
  }
}