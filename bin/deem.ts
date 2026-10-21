#!/usr/bin/env bun
import { initProject, listTemplates, runGeneration, type RunCliOptions, validateProject } from '../src/cli';
import { formatTracePretty, formatTraceRaw } from '../src/trace';

type ParsedArgs = {
  command: string;
  options: Record<string, string | boolean>;
  positional: string[];
};

const parseArgs = (argv: string[]): ParsedArgs => {
  const options: Record<string, string | boolean> = {};
  const positional: string[] = [];

  for (let i = 0; i < argv.length; i++) {
    const token = argv[i] ?? '';
    if (!token.startsWith('--')) {
      positional.push(token);
      continue;
    }

    const [key, rawVal] = token.replace(/^--/, '').split('=');
    if (!key) {
      continue;
    }
    if (rawVal !== undefined) {
      options[key] = rawVal;
      continue;
    }

    const next = argv[i + 1];
    if (next && !next.startsWith('--')) {
      options[key] = next;
      i += 1;
    } else {
      options[key] = true;
    }
  }

  return {
    command: positional[0] ?? 'help',
    options,
    positional: positional.slice(1),
  };
};

const printHelp = (): void => {
  process.stdout.write(
    [
      'deem CLI',
      '',
      'Usage:',
      '  deem init [dir] [--scenario <name>] [--force]',
      '  deem run [--type <template>] [--seed <seed>] [--count <n>] [--debug] [--trace] [--trace-format <pretty|raw>] [--allow-default-setting] [--scenario <name>] [--config <file>] [--settingDir <dir>] [--tables <file>] [--templates <file>]',
      '  deem gen <template> [options] (alias: g; accepts the same options as run)',
      '  deem list [--allow-default-setting] [--scenario <name>] [--config <file>] [--settingDir <dir>] [--tables <file>] [--templates <file>]',
      '  deem validate [--type <template>] [--allow-default-setting] [--scenario <name>] [--config <file>] [--settingDir <dir>] [--tables <file>] [--templates <file>]',
      '',
      'Examples:',
      '  deem init ./example --scenario default',
      '  deem run --settingDir ./example',
      '  deem g room --settingDir ./example',
      '  deem run --settingDir ./example --trace --trace-format pretty',
      '  deem list --settingDir ./example',
      '  deem validate --settingDir ./example',
      '',
    ].join('\n'),
  );
};

const asInt = (val: string | boolean | undefined): number | undefined => {
  if (typeof val !== 'string') {
    return undefined;
  }
  const parsed = parseInt(val, 10);
  if (Number.isNaN(parsed)) {
    return Number.NaN;
  }
  return parsed;
};

const runInit = (args: ParsedArgs): number => {
  const dir = (args.positional[0] as string | undefined) ?? process.cwd();
  const force = args.options.force === true;
  const scenario = typeof args.options.scenario === 'string' ? args.options.scenario : 'default';
  const created = initProject({ targetDir: dir, force, scenario });

  if (created.length === 0) {
    process.stdout.write('No files created. Use --force to overwrite existing files.\n');
    return 0;
  }

  process.stdout.write(`Initialized ${created.length} file(s):\n`);
  for (const path of created) {
    process.stdout.write(`- ${path}\n`);
  }
  return 0;
};

const runGen = (args: ParsedArgs): number => {
  const options: RunCliOptions = {
    type: typeof args.options.type === 'string' ? args.options.type : args.positional[0],
    seed: typeof args.options.seed === 'string' ? args.options.seed : undefined,
    count: asInt(args.options.count),
    trace: args.options.trace === true ? true : undefined,
    allowDefaultSetting: args.options['allow-default-setting'] === true ? true : undefined,
    scenario: typeof args.options.scenario === 'string' ? args.options.scenario : undefined,
    configPath: typeof args.options.config === 'string' ? args.options.config : undefined,
    settingDir: typeof args.options.settingDir === 'string' ? args.options.settingDir : undefined,
    tablesPath: typeof args.options.tables === 'string' ? args.options.tables : undefined,
    templatesPath: typeof args.options.templates === 'string' ? args.options.templates : undefined,
  };

  const debug = args.options.debug === true;
  const started = performance.now();
  let generated: number | undefined;
  let written: number | undefined;
  try {
    const result = runGeneration(options);
    generated = performance.now();
    process.stdout.write(`${JSON.stringify(result.output, null, 2)}\n`);
    written = performance.now();
    if (debug) {
      process.stderr.write(`[deem debug] seed=${JSON.stringify(result.resolved.seed)}\n`);
    }

    if (result.resolved.trace) {
      const traceFormat =
        args.options['trace-format'] === 'raw' || args.options['trace-format'] === 'pretty'
          ? String(args.options['trace-format'])
          : 'pretty';
      process.stderr.write('[deem trace]\n');
      process.stderr.write(
        `${traceFormat === 'raw' ? formatTraceRaw(result.trace) : formatTracePretty(result.trace)}\n`,
      );
    }
    return 0;
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    process.stderr.write(`${msg}\n`);
    return 1;
  } finally {
    if (debug) {
      const finished = performance.now();
      const timings = generated !== undefined && written !== undefined
        ? `generation=${(generated - started).toFixed(2)}ms output=${(written - generated).toFixed(2)}ms `
        : '';
      process.stderr.write(`[deem debug] ${timings}total=${(finished - started).toFixed(2)}ms\n`);
    }
  }
};

const runValidate = (args: ParsedArgs): number => {
  const options: RunCliOptions = {
    type: typeof args.options.type === 'string' ? args.options.type : undefined,
    allowDefaultSetting: args.options['allow-default-setting'] === true ? true : undefined,
    scenario: typeof args.options.scenario === 'string' ? args.options.scenario : undefined,
    configPath: typeof args.options.config === 'string' ? args.options.config : undefined,
    settingDir: typeof args.options.settingDir === 'string' ? args.options.settingDir : undefined,
    tablesPath: typeof args.options.tables === 'string' ? args.options.tables : undefined,
    templatesPath: typeof args.options.templates === 'string' ? args.options.templates : undefined,
  };

  if (args.command === 'list') {
    try {
      const templates = listTemplates(options);
      process.stdout.write(templates.length > 0 ? `${templates.join('\n')}\n` : 'No generation templates found.\n');
      return 0;
    } catch (error) {
      process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
      return 1;
    }
  }

  const result = validateProject(options);
  if (!result.ok) {
    for (const error of result.errors) {
      process.stderr.write(`${error}\n`);
    }
    return 1;
  }

  process.stdout.write('Configuration is valid.\n');
  if (result.resolved) {
    process.stdout.write(`${JSON.stringify(result.resolved, null, 2)}\n`);
  }
  return 0;
};

const main = (): number => {
  const args = parseArgs(Bun.argv.slice(2));

  if (args.command === 'help' || args.command === '--help' || args.command === '-h') {
    printHelp();
    return 0;
  }

  if (args.command === 'init') {
    return runInit(args);
  }

  if (args.command === 'run' || args.command === 'gen' || args.command === 'g') {
    return runGen(args);
  }

  if (args.command === 'validate' || args.command === 'list') {
    return runValidate(args);
  }

  process.stderr.write(`Unknown command: ${args.command}\n\n`);
  printHelp();
  return 1;
};

process.exit(main());
