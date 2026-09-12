import { describe, expect, it } from 'bun:test';
import { Table } from '../src/Table';

describe('Table', () => {
  it('gathers keys deterministically with provided random function', () => {
    const table = new Table('loot', 'rank')
      .group('low', ['a'])
      .group('mid', ['b'])
      .group('high', ['c']);

    const keys = table.gatherKeys(3, () => 1);
    expect(keys).toEqual(['mid', 'mid', 'mid']);
  });

  it('gathers unique entries by removing from a working copy', () => {
    const table = new Table('names', 'kind').group('default', ['a', 'b', 'c']);
    const entries = table.gatherEntries('default', 2, () => 0);
    expect(entries).toEqual(['a', 'b']);
  });

  it('supports globally unique picks with reset behavior', () => {
    const table = new Table('coin', 'kind').group('default', ['x']);
    const first = table.pick('default', true, () => 0);
    const second = table.pick('default', true, () => 0);
    expect(first).toBe('x');
    expect(second).toBe('x');
  });

  it('can check group and reverse lookup values', () => {
    const table = new Table('kind', 'disc')
      .group('forest', ['stag', 'boar'])
      .group('swamp', ['toad']);

    expect(table.hasGroup('forest')).toBe(true);
    expect(table.containsValue('toad')).toBe(true);
    expect(table.findGroupForValue('stag')).toBe('forest');
    expect(table.findGroupForValue('missing')).toBeNull();
  });
});
