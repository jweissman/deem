# deem

A tiny template-based generative DSL.

## Tables

Tables are lists organized by a 'discriminator' or category.

```
"hitPoints": {
    "discriminator": "class",
    "groups": {
      "warrior": 10,
      "mage": 6,
      "thief": 8,
      "cleric": 8,
      "bard": 6,
      "ranger": 8
    }
  }
```

Use Deem's builtin `lookup` to extract values (ie `lookup(hitPoints, "thief")` would retrieve the value 8.)

If the value is an array, lookup will sample randomly, so that you can also use this to createbias tables.

## Templates

Templates are plain JSON objects whose values can have _Deem_ expressions. Any key whose valueis prefixed by `=` will be evaluated during generation. Consider this template that shows off a lot of the capabilities:

```json
"monster": {
    "_terrain": "=oneOf(forest, cave, swamp, mountain, snow, desert)",
    "race": "=oneOf(goblin, kobold, orc, human, ogre, troll, dragon)",
    "type": "=lookup(monsterType, #race)",
    "forename": "=lookup(monsterName, #race)",
    "_class": "=capitalize(#_terrain) + \" \" + capitalize(#race) + \" \" + #type",
    "name": "=#forename + \", \" + #_class",
    "_baseHp": "=lookup(monsterBaseHp, #race)",
    "_hpVariance": "=lookup(monsterHpVariance, #race)",
    "maxHp": "=#_baseHp + round(rand()*#_hpVariance)",
    "level": "=lookup(monsterLevel, #race)",
    "str": "=lookup(monsterStr, #race)",
    "dex": "=lookup(monsterDex, #race)",
    "con": "=lookup(monsterCon, #race)",
    "int": "=lookup(monsterInt, #race)",
    "wis": "=lookup(monsterWis, #race)",
    "cha": "=lookup(monsterCha, #race)",
    "_naturalArmor": "=lookup(monsterNaturalArmor, #race)",
    "ac": "=10 + #_naturalArmor + floor((#dex-10)/2)",
    "attacks": "=lookup(monsterAttacks, #race)",
    "weapon": "=lookup(monsterWeapon, #race)",
    "damageDie": "=lookup(attackDice, #weapon)",
    "_damageBonus": "=floor((#str-10)/2)",
    "xp": "=lookup(monsterXp, #race)",
    "gp": "=lookup(monsterGold, #race)",

    "*terrainModifier": "=lookup(monsterTerrainModifier, #_terrain)",
    "hp": "=#maxHp"
  }
```

Deem will work through the structure key by key and evaluate the value expressions in order, allowing you to
construct complex assembly mechanisms. Here's some example output for this template:

```
┌───────────┬──────────────────────────────┐
│           │ Values                       │
├───────────┼──────────────────────────────┤
│      race │ orc                          │
│      type │ Berserker                    │
│  forename │ Norgorak                     │
│      name │ Norgorak, Snow Orc Berserker │
│     maxHp │ 10                           │
│     level │ 2                            │
│       str │ 16                           │
│       dex │ 11                           │
│       con │ 17                           │
│       int │ 8                            │
│       wis │ 8                            │
│       cha │ 8                            │
│        ac │ 13                           │
│   attacks │ 1                            │
│    weapon │ mace                         │
│ damageDie │ 6                            │
│        xp │ 50                           │
│        gp │ 2d10                         │
│        hp │ 10                           │
└───────────┴──────────────────────────────┘
```

## Deem Evaluation

All expressions starting with `=` will get evaluated by Deem. 
Assembled values flow hierarchically down and are available in sub-generations (ie if you call`gen(entity)` or `genList(entity, count)` as part of an expression.)

The engine supports the following features:

- Arithmetic (eg `1+2`, `2*3^4`, `5/10`)
- Dice notation (eg `1d3`, `2d10`)
- Comparisons (`==`, `!=`, `>`, `<`, `>=`, `<=`)
- Boolean logic (`||`, `&&`, unary not `!`)
- Use `#variableName` to reference any other field already assembled in the template (`"name":"=#forename + \", \" + #type"`)

Note there are special key structures that give additional hints to assembly:
- Keys with `_` are omitted from final output structure so can be useful for intermediate values
- Keys prefixed with `*` merge their result into the parent object. That is, if the result of evaluating a star-prefixed key is itself an object, all values are 'overlaid' onto matching already-assembled values (any values from the overlay object will be added to the assembled value matching that key). For instance, with the terrain modification above:
```json
"*terrainModifier": "=lookup(terrainMods, #terrain)"
```

If `terrainMods` returns `{con: -1, dex: 1}`, those values are added to the monster's base stats, creating variants like "Swamp Goblin" with adjusted attributes.
- Keys prefixed with `^` merge their result but we attempt to evaluate the target template first. For instance
```
    "^dungeonOverlay": "=lookup(dungeonOverlay, #building_type)"
```
If there is a table `dungeonOverlay` we would evaluate elements in the matching object definition as if it were a template.
- Keys prefixed with `!` are special directives (only `!remove` for now which takes a list of keys to remove from the generated output)

There is also a special directive `__no_id` which omits the generation of a template id field (including an id field with the template name and a random key is the default for all templates)


## Deem Builtins

- `if(condition, true_value, false_value)`: apply a logical condition (there is also a builtinternary if it is not possible/desirable to evaluate both true and false conditions, ie `condition ? true_value : false_value`)
- `gen()`: call generate again and create a subentity
- `genList(entity, count)`: call `gen` multiple times and return the list of entities; note `genList` will also inject `_index` to generated item context
- `mapGenList(type, items, prop)`: identical to `genList` but build an entity for each value in `items`, feeding each generation the value of the item as a key (named by `prop`) into the generation options

### Table helpers
- `lookup(tableName, value)`: select randomly from a table, indexed by value
- `lookupUnique(tableName, value)`: select randomly from a table, indexed by value, avoiding duplicates until group is consumed (and then resetting)
- `hasEntry(tableName, value)` returns true if there is any group with key `value`
- `hasValue(tableName, value)` returns true if any group contains `value` in its list
- `findGroup(tableName, value)` does a reverse lookup of the group in a table from the value list

### List helpers
- `concat(item1, item2...)` flattens all arguments into a single array and removes null/undefined
- `uniq(arr)` returns only unique items from an array
- `distribute(total, parts)` returns an array distributing the total value into buckets (countof buckets given by `parts`)

### Value extraction
- `dig(obj, ...path)` can extract values from within nested structures/subgenerations

### Randomness
- `oneOf(item1, item2...)`: select randomly from a list
- `pick(arr)`: select randomly from an array
- `sample(arr, count)`: sample `count` elements from a population given by `array`
- `rand()`: random number between 0 and 1
- `roll(dieCount, dieSides)` rolls a die of `dieSides` faces `dieCount` times
- `rollWithDrop(dieCount, dieSides)` rolls a die of `dieSides` faces `dieCount` times, dropping the lowest value

### Math
- `round(number)` rounds to the nearest whole number
- `ceil(number)` and `floor(number)` round up and down to the nearest whole number respectively
- `min(item1, item2...)` and `max(item1, item2...)` for minimum and maximum values
- `sum(arr, prop?)` sums the values in a list, or of objects by property if `prop` is specified (string value of key in objects)
- `count(array)`: measures length of an array
- `len(obj)`: measures string or object length

### Words
- `capitalize(string)` returns the given string value with the first character capitalized
- `humanize(string)` 'humanizes' a string, removing underscores and splitting camelCase and then capitalizing each word