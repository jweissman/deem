export type TraceEvent = {
  step: string;
  at: string;
  detail: Record<string, unknown>;
};

export type ExecutionTrace = {
  enabled: boolean;
  events: TraceEvent[];
  scopes: string[];
};

export const createExecutionTrace = (enabled: boolean): ExecutionTrace => ({
  enabled,
  events: [],
  scopes: [],
});

export const traceEvent = (
  trace: ExecutionTrace | undefined,
  step: string,
  detail: Record<string, unknown> = {},
): void => {
  if (!trace || !trace.enabled) {
    return;
  }

  trace.events.push({
    step,
    at: new Date().toISOString(),
    detail: {
      ...detail,
      scope: [...trace.scopes],
    },
  });
};

export const withTraceScope = <T>(
  trace: ExecutionTrace | undefined,
  scope: string,
  action: () => T,
): T => {
  if (!trace || !trace.enabled) {
    return action();
  }

  trace.scopes.push(scope);
  try {
    return action();
  } finally {
    trace.scopes.pop();
  }
};

type TraceNode = {
  key: string;
  lines: string[];
  children: Map<string, TraceNode>;
};

const createNode = (key: string): TraceNode => ({
  key,
  lines: [],
  children: new Map<string, TraceNode>(),
});

const formatValue = (value: unknown): string => {
  if (typeof value === 'string') {
    return JSON.stringify(value);
  }
  if (typeof value === 'number' || typeof value === 'boolean' || value === null) {
    return String(value);
  }
  const raw = JSON.stringify(value);
  if (raw.length <= 160) {
    return raw;
  }
  return `${raw.slice(0, 157)}...`;
};

const scopeFromEvent = (event: TraceEvent): string[] => {
  const candidate = event.detail.scope;
  if (!Array.isArray(candidate)) {
    return [];
  }
  return candidate.filter((x): x is string => typeof x === 'string');
};

const ensureScopeNode = (root: TraceNode, scope: string[]): TraceNode => {
  let node = root;
  for (const segment of scope) {
    let next = node.children.get(segment);
    if (!next) {
      next = createNode(segment);
      node.children.set(segment, next);
    }
    node = next;
  }
  return node;
};

const lineForEvent = (event: TraceEvent): string | null => {
  const d = event.detail;
  if (event.step === 'run.start') {
    return `run ${formatValue(d.type)} seed=${formatValue(d.seed)} count=${formatValue(d.count)} scenario=${formatValue(d.scenario)}`;
  }
  if (event.step === 'run.complete') {
    return `run complete output=${formatValue(d.outputType)}`;
  }
  if (event.step === 'generation.template.start') {
    return `generate template ${formatValue(d.type)}`;
  }
  if (event.step === 'generation.template.complete') {
    return `template ${formatValue(d.type)} complete keys=${formatValue(d.keys)}`;
  }
  if (event.step === 'expression.evaluate.result') {
    return `eval ${formatValue(d.expression)} => ${formatValue(d.result)}`;
  }
  if (event.step === 'lookup.condition.result') {
    return `filter ${formatValue(d.condition)} kept ${formatValue(d.keptCount)} of ${formatValue((d.matches as unknown[] | undefined)?.length ?? 0)}`;
  }
  if (event.step === 'lookup.pick') {
    return `lookup ${formatValue(d.tableName)}[${formatValue(d.groupName)}] pick[${formatValue(d.pickedIndex)}] => ${formatValue(d.picked)}`;
  }
  if (event.step === 'lookup.fallback') {
    return `lookup fallback => ${formatValue(d.fallback)}`;
  }
  if (event.step === 'template.property.result') {
    return `result ${formatValue(d.key)} = ${formatValue(d.value)}`;
  }
  if (event.step === 'template.id.generated') {
    return `id ${formatValue(d.id)}`;
  }
  return null;
};

const renderNode = (node: TraceNode, depth: number): string[] => {
  const pad = '  '.repeat(depth);
  const lines: string[] = [];

  if (node.key.length > 0) {
    const scopeLabel = node.key.startsWith('prop:') ? node.key.slice(5) : node.key;
    lines.push(`${pad}${scopeLabel}:`);
  }

  const linePad = '  '.repeat(node.key.length > 0 ? depth + 1 : depth);
  for (const line of node.lines) {
    lines.push(`${linePad}- ${line}`);
  }

  for (const child of node.children.values()) {
    lines.push(...renderNode(child, node.key.length > 0 ? depth + 1 : depth));
  }

  return lines;
};

export const formatTracePretty = (events: TraceEvent[]): string => {
  if (events.length === 0) {
    return 'no trace events';
  }

  const root = createNode('');
  const lastEvalByScope = new Map<string, string>();
  for (const event of events) {
    const scope = scopeFromEvent(event);
    const scopeKey = scope.join('/');

    if (event.step === 'expression.evaluate.result') {
      const marker = formatValue(event.detail.result);
      lastEvalByScope.set(scopeKey, marker);
    }

    if (event.step === 'template.property.result') {
      const evalMarker = lastEvalByScope.get(scopeKey);
      const resultMarker = formatValue(event.detail.value);
      if (evalMarker && evalMarker === resultMarker) {
        continue;
      }
    }

    const node = ensureScopeNode(root, scope);
    const line = lineForEvent(event);
    if (line) {
      node.lines.push(line);
    }
  }

  return renderNode(root, 0).join('\n');
};

export const formatTraceRaw = (events: TraceEvent[]): string => {
  if (events.length === 0) {
    return 'no trace events';
  }

  return events
    .map((event) => `- ${event.at} ${event.step} ${JSON.stringify(event.detail)}`)
    .join('\n');
};
