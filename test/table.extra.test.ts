import { describe, expect, it } from 'bun:test';
import { Table } from '../src/Table';

describe('Table additional branches', () => {
  it('throws for missing group lookups and invalid picks', () => {
    const table = new Table('t', 'kind').group('a', ['x']);
    expect(() => table.gatherEntries('missing')).toThrow();
    expect(() => table.optionsForPick('missing')).toThrow();
    expect(() => table.pick('a', false, () => 999)).toThrow();
  });

  it('returns null for findGroupForValue misses', () => {
    const table = new Table('t', 'kind').group('a', ['x']);
    expect(table.findGroupForValue('y')).toBeNull();
  });
});
