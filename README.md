# deem

A tiny template-based generative DSL.

## CLI

This package now includes a `deem` CLI.

### Initialize a runnable example

Run this in an empty folder (or use `--force` to overwrite existing files):

```bash
deem init ./example --scenario default
```

This writes:

- `data/default/tables/deem.tables.json`
- `data/default/templates/deem.templates.json`
- `deem.run.json`

### Generate from the CLI

```bash
deem run --settingDir ./example
deem gen room --settingDir ./example
deem g room --settingDir ./example
```

`gen` and `g` are aliases for `run` and accept the template as a positional
argument. An explicit `--type` takes precedence over the positional template.

Each run uses a random seed unless `--seed` or a `seed` in `deem.run.json` is
provided. Supply a fixed seed for reproducible generation. Newly initialized
projects omit the seed so generation varies by default.

Optional flags:

- `--type <template>`
- `--seed <seed>`
- `--count <n>`
- `--scenario <name>`
- `--config <path>`
- `--tables <path>`
- `--templates <path>`
- `--settingDir <dir>`
- `--debug` (prints timings and the resolved seed to stderr)
- `--trace` (prints execution trace)
- `--trace-format <pretty|raw>` (default `pretty`)
- `--allow-default-setting` (fallback to built-in setting if scenario files are missing)

`--debug` works with `run`, `gen`, and `g`, independently of `--trace`:

```bash
deem g room --debug
```

It reports generation time (including config validation and setting loading),
JSON serialization/write time, and total command time in milliseconds. Total
includes trace formatting when enabled, and excludes process startup. Failed
runs report elapsed total time. The resolved seed is printed on successful runs
so a random run can be replayed with `--seed`. Generated JSON stays on stdout.

### List generation templates

```bash
deem list --settingDir ./example
```

Prints template names alphabetically, one per line (for the example: `encounter`
and `room`). Uses the same configuration, scenario, and file path resolution as
`run`, and validates the setting's JSON structure. Tables are excluded. No
configured generation type is required. Supports `--scenario`, `--config`,
`--settingDir`, `--tables`, `--templates`, and `--allow-default-setting`.

### Validate configuration

```bash
deem validate --settingDir ./example
```

Validation checks:

- run config shape (`deem.run.json`)
- required generation type (from config or `--type`)
- tables and templates JSON structure
- scenario path resolution
- generation type exists in the resolved setting

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

A row may carry a frequency instead of being repeated: `{"__weight": 3, "kind": "wolf"}` draws exactly as three copies of the row (without the `__weight` field), and `{"__weight": 5, "__value": "animal"}` weights a plain value. Weights must be positive integers.

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
- `gatherEntries(tableName, group)` returns a group's entries; `default` (when the table has no group of that name) returns every entry
- `select(tableName, group, predicate)` selects as `lookup` does among rows for which the single-quoted predicate holds (the candidate is `#__it`), and fails when none does
- `fits(row, name...)` says whether a row agrees with what the context asks: for each named dimension the context defines, the row's field of that name equals it, or the row's `_<name>s` map holds it (`{"_terrains": {"cave": true}}` fits `terrain` `cave`). Dimensions the context leaves undefined constrain nothing, so `select(kinds, animal, 'fits(#__it, "terrain", "body")')` reads as the constraint it is
- `owns(tableName, group)` says whether a group holds every name the context defines among all of the table's entries: with a table of the dimensions each family owns, `select(families, any, 'owns(dimensions, #__it)')` picks only a family that can honour every dimension asked for

### List helpers
- `concat(item1, item2...)` flattens all arguments into a single array and removes null/undefined
- `uniq(arr)` returns only unique items from an array
- `except(list, removed)` returns the elements of `list` that are not in `removed`
- `definedOf(names)` returns the names that are defined in the current context (`owns` is the common use of it, by name)
- `distribute(total, parts)` returns an array distributing the total value into buckets (countof buckets given by `parts`)

### Value extraction
- `dig(obj, ...path)` can extract values from within nested structures/subgenerations

### Randomness
- `oneOf(item1, item2...)`: select randomly from a list
- `pick(arr)`: select randomly from an array
- `sample(arr, count)`: sample `count` elements from a population given by `array`
- `rand()`: random number between 0 and 1. String seeds are hashed (FNV-1a), so distinct strings, anagrams included, give distinct streams
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
## Expressions before execution

`Deem` instances also expose `parse`, `partialEvaluate`, `explain`, `preview`,
`serialize`, and `execute`. Existing `evaluate` behavior is unchanged.

Previews evaluate core functions only. A supplied function that is deterministic and side-effect free can be declared
pure, so previews fold it: `new Deem({ stdlib: { statMod }, pure: ['statMod'] }).preview('statMod(#strength) + 1d6',
{ strength: 14 })` gives `2 + 1d6`.

```ts
const deem = new Deem({ seed: 'combat' });
const before = deem.preview(
  "2d6 + #modifier + (dig(#target, 'isUndead') ? 3 : 0)",
  { modifier: 4 },
);
if (before.status !== 'error') {
  const after = deem.preview(before.expression, { target: { isUndead: true } });
  if (after.status !== 'error') {
    console.log(after.explanation.text);   // ((2d6 + 4) + 3) (9 to 19)
    console.log(after.explanation.bounds); // { min: 9, max: 19 }
    const damage = deem.execute(after.expression); // First random draws occur here.
  }
}
```

Run `bun examples/ability-preview.ts` for an executable example with original and
specialized execution using identical seeds.

`partialEvaluate(string | Expression, context)` returns a discriminated result:
`{ status: 'value', value, expression }`, `{ status: 'residual', expression }`, or
`{ status: 'error', error, expression? }`. The exported `Expression` union has
value, reference, dice, operation, and opaque nodes. Missing references remain
reference nodes; dice remain dice nodes. Deferred calls retain their function
names and argument trees. Opaque nodes include the reason for deferral.

`explain(string | Expression, style?)` returns `{ expression, text, bounds?,
unresolved }`. Styles are `compact` (default), `descriptive`, and `technical`.
Single-die bounded arithmetic can use a compact range; multiple dice retain
notation/mechanics alongside the range, so `2d6` and `1d11 + 1` remain distinct.
Bounds are finite numerical enclosures, not probability distributions or a
promise that every value inside the interval is attainable. Bounds currently
cover numeric constants, ordinary dice, unary signs, addition, subtraction, and
multiplication. Unsupported operations have no bounds. Text is a basic renderer,
not a complete natural-language grammar; callers should inspect `unresolved`
before using fallback function syntax or interpolated strings in player UI.

`preview(input, context, style?)` composes specialization and explanation. It
returns the partial result with an `explanation` on success. `execute(tree,
remainingContext?)` evaluates through the existing evaluator. `serialize(tree,
remainingContext?)` returns `{ source, context }` that can be passed to
`evaluate(source, context)`. The accompanying bindings are required: Deem syntax
cannot express arbitrary object literals, nonfinite numbers, or all strings.
Trees retain values directly, including object identity; they are inspectable
in-memory representations, not a general JSON persistence format.

### Semantics and current limits

The expression tree is derived from the existing Ohm grammar. There is no second
parser or evaluator: constant folding and execution use the original evaluator.
The previous `pretty` attribute formats parse trees but cannot encode arbitrary
resolved values, so it is insufficient for residual-expression round trips.

* Context references use `#name`; bare names are string values. Property access
  uses `dig(#target, 'isUndead')`. The existing grammar parses `d6` as an identifier
  before considering dice; use `1d6`. This compatibility quirk is unchanged.
* Missing references normally throw during execution. Previews preserve them.
  Explicit null/undefined follows legacy evaluation: nullish context values fall
  back to magic variables; present undefined without a fallback becomes null.
  Absence remains unknown rather than becoming null. `dig` on a known object with
  a missing property returns null, as in ordinary evaluation.
* Arithmetic retains grouping and JavaScript coercion, including unary `+`'s
  legacy identity behavior. `1d6 + #strength + 2` with strength 4 becomes
  `(1d6 + 4) + 2`, not `1d6 + 6`. No reassociation, cancellation, or random-draw
  elimination is performed. Known lazy conditions select only the required
  branch; errors behind unresolved predecessors remain deferred. The `if()`
  function stays eager, unlike the ternary operator.
* Unmodified built-in core functions are eligible for folding when arguments are
  known. Probability functions (`rand`, `roll`, `pick`, `sample`, `oneOf`,
  `rollWithDrop`, `alliterate`) stay deferred. Explicit `roll()` is currently a
  deferred call rather than a dice node, with no inferred bounds.
* Custom functions, overridden core functions, lookup/generation helpers,
  double-quoted interpolation, and contextual dispatch are not invoked by a
  preview. An expression containing such a node is conservatively preserved in
  its entirety, since a call could mutate context before another reference is
  read. Contextual callbacks are never invoked to discover their capabilities.
  Dice with a custom/contextual roll implementation have no inferred bounds.
  Known short-circuits around unsupported nodes are also left unchanged in this
  first implementation. A future explicit purity/capability registry could
  permit more reduction without guessing from function names.
* Supply plain Deem data, and treat known context, magic variables, core function
  implementations, and resolved object values as stable for the lifetime of a
  specialization. Rebuild previews when actor state changes. Accessor-bearing
  objects and external mutations are outside the preview contract. Switching to
  a different runtime/function implementation can also invalidate a preview.

For Kyr, keep the original expression as the rule source. Build a preview with
actor context, specialize its tree again when a target is selected, and render
`explanation.text` with optional structured bounds and unresolved-state UI.
Execute the resulting tree only on ability use, with the same runtime function
semantics and remaining context. Recompute from the original expression when a
previously known attribute changes. No separate player description formula or
Kyr changes are required by these APIs.
