import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import Generator, { type GeneratedValue, type GenerationSetting } from './Generator';
import { Table } from './Table';
import { Template, type TemplateProps } from './Template';
import { type DeemValue } from './stdlib';
import { createExecutionTrace, traceEvent, type TraceEvent } from './trace';

type JsonObject = Record<string, unknown>;

type TableDefinition = {
  discriminator: string;
  groups: Record<string, DeemValue | DeemValue[]>;
};

type TemplateDefinition = Record<string, TemplateProps>;

type ProjectScaffold = {
  tables: Record<string, TableDefinition>;
  templates: TemplateDefinition;
};

export type RunCliOptions = {
  type?: string;
  seed?: string;
  count?: number;
  trace?: boolean;
  allowDefaultSetting?: boolean;
  scenario?: string;
  settingDir?: string;
  configPath?: string;
  tablesPath?: string;
  templatesPath?: string;
};

export type ResolvedRunOptions = {
  type: string;
  seed: string;
  count: number;
  trace: boolean;
  allowDefaultSetting: boolean;
  scenario: string;
  settingDir: string;
  configPath: string;
  tablesPath: string;
  templatesPath: string;
};

export type ValidateResult = {
  ok: boolean;
  errors: string[];
  resolved?: ResolvedRunOptions;
};

type InitProjectOptions = {
  targetDir: string;
  scenario?: string;
  force?: boolean;
};

type RunConfigFile = {
  type?: string;
  seed?: string;
  count?: number;
  trace?: boolean;
  allowDefaultSetting?: boolean;
  scenario?: string;
  tablesPath?: string;
  templatesPath?: string;
};

const parseJsonFile = (path: string): JsonObject => {
  const raw = readFileSync(path, 'utf8');
  return JSON.parse(raw) as JsonObject;
};

const ensureArray = (value: DeemValue | DeemValue[]): DeemValue[] => {
  return Array.isArray(value) ? value : [value];
};

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
};

const resolvePath = (baseDir: string, maybeRelative: string): string => {
  if (maybeRelative.startsWith('/')) {
    return maybeRelative;
  }
  return resolve(baseDir, maybeRelative);
};

const defaultScenarioPath = (
  settingDir: string,
  scenario: string,
  kind: 'tables' | 'templates',
): string => {
  const filename = kind === 'tables' ? 'deem.tables.json' : 'deem.templates.json';
  return join(settingDir, 'data', scenario, kind, filename);
};

const legacyPath = (settingDir: string, kind: 'tables' | 'templates'): string => {
  return join(settingDir, kind === 'tables' ? 'deem.tables.json' : 'deem.templates.json');
};

const readRunConfigFile = (configPath: string): { config: RunConfigFile; errors: string[] } => {
  if (!existsSync(configPath)) {
    return { config: {}, errors: [] };
  }

  try {
    const raw = parseJsonFile(configPath);
    if (!isRecord(raw)) {
      return { config: {}, errors: [`Run config at ${configPath} must be a JSON object.`] };
    }
    return { config: raw as unknown as RunConfigFile, errors: [] };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { config: {}, errors: [`Unable to parse run config at ${configPath}: ${message}`] };
  }
};

const validateRunConfig = (config: RunConfigFile): string[] => {
  const errors: string[] = [];
  if (config.type !== undefined && typeof config.type !== 'string') {
    errors.push('Run config field "type" must be a string.');
  }
  if (config.seed !== undefined && typeof config.seed !== 'string') {
    errors.push('Run config field "seed" must be a string.');
  }
  if (config.trace !== undefined && typeof config.trace !== 'boolean') {
    errors.push('Run config field "trace" must be a boolean.');
  }
  if (config.allowDefaultSetting !== undefined && typeof config.allowDefaultSetting !== 'boolean') {
    errors.push('Run config field "allowDefaultSetting" must be a boolean.');
  }
  if (config.count !== undefined) {
    if (typeof config.count !== 'number' || !Number.isInteger(config.count) || config.count <= 0) {
      errors.push('Run config field "count" must be a positive integer.');
    }
  }
  if (config.scenario !== undefined && typeof config.scenario !== 'string') {
    errors.push('Run config field "scenario" must be a string.');
  }
  if (config.tablesPath !== undefined && typeof config.tablesPath !== 'string') {
    errors.push('Run config field "tablesPath" must be a string path.');
  }
  if (config.templatesPath !== undefined && typeof config.templatesPath !== 'string') {
    errors.push('Run config field "templatesPath" must be a string path.');
  }
  return errors;
};

const resolveRunOptions = (options: RunCliOptions, requireType = true): ValidateResult => {
  const errors: string[] = [];
  const settingDir = resolve(options.settingDir ?? process.cwd());
  const configPath = resolve(options.configPath ?? join(settingDir, 'deem.run.json'));

  const runConfigResult = readRunConfigFile(configPath);
  errors.push(...runConfigResult.errors);
  errors.push(...validateRunConfig(runConfigResult.config));

  const runConfig = runConfigResult.config;
  const allowDefaultSettingCandidate = options.allowDefaultSetting ?? runConfig.allowDefaultSetting ?? false;
  if (typeof allowDefaultSettingCandidate !== 'boolean') {
    errors.push('allowDefaultSetting must be a boolean.');
  }
  const scenario = options.scenario ?? runConfig.scenario ?? 'default';

  const scenarioTablesPath = defaultScenarioPath(settingDir, scenario, 'tables');
  const scenarioTemplatesPath = defaultScenarioPath(settingDir, scenario, 'templates');
  const fallbackTablesPath = legacyPath(settingDir, 'tables');
  const fallbackTemplatesPath = legacyPath(settingDir, 'templates');

  const candidateTablesPath = options.tablesPath
    ?? runConfig.tablesPath
    ?? (existsSync(scenarioTablesPath) ? scenarioTablesPath : fallbackTablesPath);

  const candidateTemplatesPath = options.templatesPath
    ?? runConfig.templatesPath
    ?? (existsSync(scenarioTemplatesPath) ? scenarioTemplatesPath : fallbackTemplatesPath);

  const tablesPath = resolvePath(settingDir, candidateTablesPath);
  const templatesPath = resolvePath(settingDir, candidateTemplatesPath);

  const type = options.type ?? runConfig.type;
  if (requireType && (!type || typeof type !== 'string')) {
    errors.push('No generation type provided. Set "type" in deem.run.json or pass --type.');
  }

  const seedCandidate = options.seed ?? runConfig.seed ?? randomUUID();
  if (typeof seedCandidate !== 'string') {
    errors.push('Seed must be a string.');
  }

  const countCandidate = options.count ?? runConfig.count ?? 1;
  if (typeof countCandidate !== 'number' || !Number.isInteger(countCandidate) || countCandidate <= 0) {
    errors.push('Count must be a positive integer.');
  }

  const traceCandidate = options.trace ?? runConfig.trace ?? false;
  if (typeof traceCandidate !== 'boolean') {
    errors.push('Trace must be a boolean.');
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    errors,
    resolved: {
      type: type as string,
      seed: seedCandidate as string,
      count: countCandidate,
      trace: traceCandidate,
      allowDefaultSetting: allowDefaultSettingCandidate,
      scenario,
      settingDir,
      configPath,
      tablesPath,
      templatesPath,
    },
  };
};

const loadAndValidateTableData = (
  tablesPath: string,
): { tables?: Record<string, TableDefinition>; errors: string[] } => {
  if (!existsSync(tablesPath)) {
    return { errors: [`Missing tables file: ${tablesPath}`] };
  }

  try {
    const raw = parseJsonFile(tablesPath);
    if (!isRecord(raw)) {
      return { errors: [`Tables file ${tablesPath} must be a JSON object.`] };
    }

    const errors: string[] = [];
    for (const [tableName, tableValue] of Object.entries(raw)) {
      if (!isRecord(tableValue)) {
        errors.push(`Table "${tableName}" must be an object.`);
        continue;
      }
      if (typeof tableValue.discriminator !== 'string' || tableValue.discriminator.length === 0) {
        errors.push(`Table "${tableName}" must include a non-empty discriminator string.`);
      }
      if (!isRecord(tableValue.groups)) {
        errors.push(`Table "${tableName}" must include a groups object.`);
        continue;
      }

      if (Object.keys(tableValue.groups).length === 0) {
        errors.push(`Table "${tableName}" must include at least one group.`);
      }

      for (const [groupName, groupValue] of Object.entries(tableValue.groups)) {
        if (groupValue === undefined) {
          errors.push(`Table "${tableName}" group "${groupName}" has undefined value.`);
        }
        if (Array.isArray(groupValue) && groupValue.length === 0) {
          errors.push(`Table "${tableName}" group "${groupName}" cannot be an empty array.`);
        }
        for (const row of Array.isArray(groupValue) ? groupValue : []) {
          const weight = Table.weighted(row) ? (row as Record<string, unknown>).__weight : 1;
          if (typeof weight !== 'number' || !Number.isInteger(weight) || weight < 1) {
            errors.push(`Table "${tableName}" group "${groupName}" has a __weight that is not a positive integer.`);
          }
        }
      }
    }

    return {
      tables: raw as unknown as Record<string, TableDefinition>,
      errors,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { errors: [`Unable to parse tables file ${tablesPath}: ${message}`] };
  }
};

const loadAndValidateTemplateData = (templatesPath: string): { templates?: TemplateDefinition; errors: string[] } => {
  if (!existsSync(templatesPath)) {
    return { errors: [`Missing templates file: ${templatesPath}`] };
  }

  try {
    const raw = parseJsonFile(templatesPath);
    if (!isRecord(raw)) {
      return { errors: [`Templates file ${templatesPath} must be a JSON object.`] };
    }

    const errors: string[] = [];
    for (const [templateName, templateValue] of Object.entries(raw)) {
      if (!isRecord(templateValue)) {
        errors.push(`Template "${templateName}" must be an object.`);
        continue;
      }
      if (Object.keys(templateValue).length === 0) {
        errors.push(`Template "${templateName}" must include at least one property.`);
      }
    }

    return {
      templates: raw as unknown as TemplateDefinition,
      errors,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { errors: [`Unable to parse templates file ${templatesPath}: ${message}`] };
  }
};

export const defaultScaffold = (): ProjectScaffold => ({
  tables: {
    terrain: {
      discriminator: 'kind',
      groups: {
        default: ['forest', 'swamp', 'cavern', 'ruins'],
      },
    },
    roomName: {
      discriminator: 'terrain',
      groups: {
        forest: ['Moss Hall', 'Briar Den', 'Sunken Lodge'],
        swamp: ['Murk Gallery', 'Reed Vault', 'Bog Shrine'],
        cavern: ['Echo Gate', 'Shard Court', 'Basalt Wake'],
        ruins: ['Broken Atrium', 'Ash Archive', 'Silent Forum'],
      },
    },
  },
  templates: {
    encounter: {
      name: '=oneOf("Goblin Scouts", "Lost Pilgrims", "Bandit Cell")',
      danger: '=oneOf(low, medium, high)',
    },
    room: {
      _terrain: '=pick(gatherEntries(terrain, default), 0)',
      name: '=lookup(roomName, #_terrain)',
      hasEncounter: '=rand() > 0.35',
      encounter: '=if(#hasEncounter, gen(encounter), nihil)',
      summary: '=#name + " in " + #_terrain',
    },
  },
});

export const buildSetting = (
  tables: Record<string, TableDefinition>,
  templates: TemplateDefinition,
): GenerationSetting => {
  const setting: GenerationSetting = {};

  for (const [name, tableDef] of Object.entries(tables)) {
    const table = new Table(name, tableDef.discriminator);
    for (const [group, value] of Object.entries(tableDef.groups)) {
      table.group(group, ensureArray(value));
    }
    setting[name] = table;
  }

  for (const [name, templateDef] of Object.entries(templates)) {
    setting[name] = new Template(name, templateDef);
  }

  return setting;
};

export const initProject = (initOptions: InitProjectOptions): string[] => {
  const outDir = resolve(initOptions.targetDir);
  const scenario = initOptions.scenario ?? 'default';
  const force = initOptions.force ?? false;

  mkdirSync(outDir, { recursive: true });
  const tablesFile = defaultScenarioPath(outDir, scenario, 'tables');
  const templatesFile = defaultScenarioPath(outDir, scenario, 'templates');
  const runFile = join(outDir, 'deem.run.json');

  const scaffold = defaultScaffold();
  const writes: Array<{ path: string; payload: unknown }> = [
    { path: tablesFile, payload: scaffold.tables },
    { path: templatesFile, payload: scaffold.templates },
    {
      path: runFile,
      payload: {
        scenario,
        type: 'room',
        count: 1,
        trace: true,
      },
    },
  ];

  const created: string[] = [];
  for (const item of writes) {
    if (!force && existsSync(item.path)) {
      continue;
    }
    mkdirSync(dirname(item.path), { recursive: true });
    writeFileSync(item.path, `${JSON.stringify(item.payload, null, 2)}\n`, 'utf8');
    created.push(item.path);
  }

  return created;
};

const loadSetting = (resolved: ResolvedRunOptions): { setting: GenerationSetting; errors: string[] } => {
  const tablesExists = existsSync(resolved.tablesPath);
  const templatesExists = existsSync(resolved.templatesPath);
  const allowDefaultSetting = resolved.allowDefaultSetting;

  if (!tablesExists && !templatesExists) {
    if (allowDefaultSetting) {
      return { setting: Generator.defaultSetting(), errors: [] };
    }
    return {
      setting: Generator.defaultSetting(),
      errors: [
        `Missing scenario files: ${resolved.tablesPath} and ${resolved.templatesPath}`,
      ],
    };
  }

  if (!tablesExists || !templatesExists) {
    const missing = !tablesExists ? resolved.tablesPath : resolved.templatesPath;
    return { setting: Generator.defaultSetting(), errors: [`Missing scenario file: ${missing}`] };
  }

  const tableResult = loadAndValidateTableData(resolved.tablesPath);
  const templateResult = loadAndValidateTemplateData(resolved.templatesPath);
  const errors = [...tableResult.errors, ...templateResult.errors];

  if (errors.length > 0 || !tableResult.tables || !templateResult.templates) {
    return { setting: Generator.defaultSetting(), errors };
  }

  return {
    setting: buildSetting(tableResult.tables, templateResult.templates),
    errors,
  };
};

export const listTemplates = (options: RunCliOptions = {}): string[] => {
  const result = resolveRunOptions(options, false);
  if (!result.ok || !result.resolved) {
    throw new Error(result.errors.join('\n'));
  }
  const loaded = loadSetting(result.resolved);
  if (loaded.errors.length > 0) {
    throw new Error(loaded.errors.join('\n'));
  }
  return Object.keys(loaded.setting)
    .filter((name) => loaded.setting[name] instanceof Template)
    .sort();
};

export const validateProject = (options: RunCliOptions = {}): ValidateResult => {
  const resolvedResult = resolveRunOptions(options);
  if (!resolvedResult.ok || !resolvedResult.resolved) {
    return resolvedResult;
  }

  const settingResult = loadSetting(resolvedResult.resolved);
  if (settingResult.errors.length > 0) {
    return {
      ok: false,
      errors: settingResult.errors,
      resolved: resolvedResult.resolved,
    };
  }

  const typeName = resolvedResult.resolved.type;
  if (!Generator.generationSource(typeName, settingResult.setting)) {
    return {
      ok: false,
      errors: [
        `Unknown generation type: ${typeName}. Available: ${Object.keys(settingResult.setting).sort().join(', ')}`,
      ],
      resolved: resolvedResult.resolved,
    };
  }

  return {
    ok: true,
    errors: [],
    resolved: resolvedResult.resolved,
  };
};

export const runGeneration = (options: RunCliOptions): {
  output: GeneratedValue | GeneratedValue[];
  trace: TraceEvent[];
  resolved: ResolvedRunOptions;
} => {
  const validation = validateProject(options);
  if (!validation.ok || !validation.resolved) {
    throw new Error(validation.errors.join('\n'));
  }

  const resolved = validation.resolved;
  const loaded = loadSetting(resolved);
  if (loaded.errors.length > 0) {
    throw new Error(loaded.errors.join('\n'));
  }

  const trace = createExecutionTrace(resolved.trace);
  traceEvent(trace, 'run.start', {
    type: resolved.type,
    seed: resolved.seed,
    count: resolved.count,
    scenario: resolved.scenario,
    tablesPath: resolved.tablesPath,
    templatesPath: resolved.templatesPath,
  });

  const output = Generator.gen(resolved.type, {
    seed: resolved.seed,
    count: resolved.count,
    __setting: loaded.setting,
    __trace: trace,
  });

  traceEvent(trace, 'run.complete', {
    type: resolved.type,
    count: resolved.count,
    outputType: Array.isArray(output) ? 'array' : 'object',
  });

  return { output, trace: trace.events, resolved };
};
