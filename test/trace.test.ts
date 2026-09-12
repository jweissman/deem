import { describe, expect, it } from 'bun:test';
import {
  createExecutionTrace,
  formatTracePretty,
  formatTraceRaw,
  traceEvent,
  withTraceScope,
  type TraceEvent,
} from '../src/trace';

describe('trace utilities', () => {
  it('does not append events when trace is disabled or missing', () => {
    const trace = createExecutionTrace(false);
    traceEvent(trace, 'run.start', { type: 'room' });
    traceEvent(undefined, 'run.start', { type: 'room' });
    expect(trace.events).toEqual([]);
  });

  it('captures scope in trace events and restores scope after nested execution', () => {
    const trace = createExecutionTrace(true);
    withTraceScope(trace, 'prop:outer', () => {
      traceEvent(trace, 'generation.template.start', { type: 'room' });
      withTraceScope(trace, 'prop:inner', () => {
        traceEvent(trace, 'expression.evaluate.result', {
          expression: '=1+1',
          result: 2,
        });
      });
      traceEvent(trace, 'template.property.result', { key: 'outer', value: 'ok' });
    });

    expect(trace.scopes).toEqual([]);
    expect(trace.events[0]?.detail.scope).toEqual(['prop:outer']);
    expect(trace.events[1]?.detail.scope).toEqual(['prop:outer', 'prop:inner']);
    expect(trace.events[2]?.detail.scope).toEqual(['prop:outer']);
  });

  it('formats raw trace lines with event metadata', () => {
    const events: TraceEvent[] = [
      {
        at: '2026-01-01T00:00:00.000Z',
        step: 'run.start',
        detail: { type: 'room', scope: [] },
      },
    ];
    const raw = formatTraceRaw(events);
    expect(raw).toContain('2026-01-01T00:00:00.000Z');
    expect(raw).toContain('run.start');
    expect(raw).toContain('"type":"room"');
  });

  it('formats pretty trace as scope tree and links evaluation to result', () => {
    const events: TraceEvent[] = [
      { at: 't', step: 'run.start', detail: { type: 'room', seed: 's', count: 1, scenario: 'default', scope: [] } },
      { at: 't', step: 'generation.template.start', detail: { type: 'room', scope: [] } },
      {
        at: 't',
        step: 'expression.evaluate.result',
        detail: { expression: '=lookup(roomName, #_terrain)', result: 'Sunken Lodge', scope: ['prop:name'] },
      },
      {
        at: 't',
        step: 'template.property.result',
        detail: { key: 'name', value: 'Sunken Lodge', scope: ['prop:name'] },
      },
      {
        at: 't',
        step: 'lookup.pick',
        detail: { tableName: 'roomName', groupName: 'forest', pickedIndex: 2, picked: 'Sunken Lodge', scope: ['prop:name'] },
      },
      {
        at: 't',
        step: 'template.property.result',
        detail: { key: 'other', value: 'different', scope: ['prop:name'] },
      },
      { at: 't', step: 'run.complete', detail: { outputType: 'object', scope: [] } },
    ];

    const pretty = formatTracePretty(events);
    expect(pretty).toContain('name:');
    expect(pretty).toContain('eval "=lookup(roomName, #_terrain)" => "Sunken Lodge"');
    expect(pretty).toContain('lookup "roomName"["forest"] pick[2] => "Sunken Lodge"');
    expect(pretty).toContain('result "other" = "different"');
    expect(pretty.includes('result "name" = "Sunken Lodge"')).toBe(false);
  });

  it('handles unknown steps, non-array scope, and long values safely', () => {
    const longText = 'x'.repeat(220);
    const events: TraceEvent[] = [
      { at: 't', step: 'ignored.step', detail: { scope: 'not-an-array' } as unknown as Record<string, unknown> },
      {
        at: 't',
        step: 'expression.evaluate.result',
        detail: {
          expression: '=payload()',
          result: { value: longText },
          scope: ['prop:payload'],
        },
      },
    ];

    const pretty = formatTracePretty(events);
    expect(pretty).toContain('payload:');
    expect(pretty).toContain('eval "=payload()" =>');
    expect(pretty).toContain('...');
  });

  it('returns no-events marker for empty traces', () => {
    expect(formatTracePretty([])).toBe('no trace events');
    expect(formatTraceRaw([])).toBe('no trace events');
  });
});
