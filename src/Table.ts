import { type DeemValue } from "./stdlib";

export class Table {
  private groups: Record<string, DeemValue[]> = {};

  constructor(public name: string, public discriminator: string) { }

  group(name: string, items: DeemValue[]): this {
    this.groups[name] = items;
    return this;
  }

  gatherKeys(count: number, randomFunc: (maxValue: number) => number = (max) => Math.floor(Math.random() * max)): string[] {
    const allKeys = Object.keys(this.groups);
    if (count <= 0) {
      return allKeys;
    }

    const keys: string[] = [];
    for (let i = 0; i < count; i++) {
      const key = allKeys[randomFunc(allKeys.length)] ?? allKeys[0];
      if (!key) {
        break;
      }
      keys.push(key);
    }
    return keys;
  }

  gatherEntries(groupName: string, count: number = -1, randomFunc: (maxValue: number) => number = (max) => Math.floor(Math.random() * max)): DeemValue[] {
    // As in lookup and select, 'default' means every entry unless the table has a group of that name.
    const group = this.groups[groupName] ?? (groupName === 'default' ? Object.values(this.groups).flat() : undefined);
    if (group === undefined) {
      throw new Error(`Group not found in table ${this.discriminator} (group: ${groupName})`);
    }
    if (count <= 0 || count >= group.length) {
      return group;
    }

    const entries: DeemValue[] = [];
    const groupCopy = [...group];
    for (let i = 0; i < count; i++) {
      const index = randomFunc(groupCopy.length);
      const next = groupCopy.splice(index, 1)[0];
      if (next !== undefined) {
        entries.push(next);
      }
    }
    return entries;
  }

  pickedOptions: Set<DeemValue> = new Set();
  optionsForPick(groupName: string): DeemValue[] | null {
    let options: DeemValue[] = [];
    if (groupName === 'default') {
      return Object.values(this.groups).flat();
    }

    const group = this.groups[groupName];
    if (group === undefined) {
      throw new Error(`Group not found in table ${this.name} (group: ${groupName})`);
    }
    options = group;

    return options;
  }

  pick(groupName: string, globallyUnique: boolean = false, randomFunc: (maxValue: number) => number = (max) => Math.floor(Math.random() * max)): DeemValue {
    const options = this.optionsForPick(groupName);
    // if (groupName === 'default') {
    //   const allItems = Object.values(this.groups).flat();
    //   options = allItems[Math.floor(Math.random() * allItems.length)] as DeemValue[];
    // }

    // if (groupName === null) {
    //   // console.warn(`No group name provided for table ${this.discriminator}`);
    //   return {};
    // }

    // const group = this.groups[groupName];
    // if (group === undefined) {
    //   throw new Error(`Group not found in table ${this.name} (group: ${groupName})`);
    //   // console.warn(`Group '${groupName}' not found in table '${this.name}'`);
    //   return {};
    // }
    // // return group[Math.floor(Math.random() * group.length)];
    // options = group;

    // if not an array, return the single value
    if (!Array.isArray(options)) {
      return options;
    }

    if (globallyUnique) {
      const availableOptions = options.filter(opt => !this.pickedOptions.has(opt));
      if (availableOptions.length === 0) {
        // throw new Error(`No more unique options available in table ${this.name} for group ${groupName}`);
        // could reset options for this group here instead but good to be able to throw just to see what's missing
        console.warn(`No more unique options available in table ${this.name} for group ${groupName}, resetting picked options.`);
        this.pickedOptions.clear();
        return this.pick(groupName, globallyUnique, randomFunc);
      }
      const choice = availableOptions[randomFunc(availableOptions.length)];
      if (choice === undefined) {
        throw new Error(`No choice available in table ${this.name} for group ${groupName}`);
      }
      this.pickedOptions.add(choice);
      return choice;
    }

    const picked = options[randomFunc(options.length)];
    if (picked === undefined) {
      throw new Error(`No options available in table ${this.name} for group ${groupName}`);
    }
    return picked;
  }

  hasGroup(groupName: string): boolean {
    // const exists = this.groups.hasOwnProperty(groupName);
    const exists = groupName in this.groups;
    return exists;
  }

  containsValue(value: string | number | boolean | DeemValue[] | { [key: string]: DeemValue; } | null): boolean {
    const exists = Object.values(this.groups).some(group => group.includes(value));
    // console.log(`Checking if table '${this.name}' contains value:`, value, '=>', exists);
    return exists;
  }

  findGroupForValue(value: string | number | boolean | DeemValue[] | { [key: string]: DeemValue; } | null) {
    for (const [groupName, items] of Object.entries(this.groups)) {
      if (items.includes(value)) {
        return groupName;
      }
    }
    return null;
  }
}
