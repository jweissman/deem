import { describe, expect, it } from 'bun:test';
import Words from '../src/words';

describe('Words', () => {
  it('formats ordinals', () => {
    expect(Words.ordinal(1)).toBe('1st');
    expect(Words.ordinal(2)).toBe('2nd');
    expect(Words.ordinal(3)).toBe('3rd');
    expect(Words.ordinal(11)).toBe('11th');
  });

  it('humanizes strings and article helpers', () => {
    expect(Words.humanize('iceDragon_name')).toBe('Ice Dragon Name');
    expect(Words.a_an('owl')).toBe('an owl');
    expect(Words.remove_article('the tower')).toBe('tower');
  });

  it('capitalizes and humanizes list strings', () => {
    expect(Words.capitalize('hUNTER')).toBe('Hunter');
    expect(Words.humanizeList(['a'])).toBe('a');
    expect(Words.humanizeList(['a', 'b'])).toBe('a and b');
    expect(Words.humanizeList(['a', 'b', 'c'])).toBe('a, b, and c');
  });

  it('humanizes numbers for larger magnitudes', () => {
    expect(Words.humanizeNumber(950)).toBe('950');
    expect(Words.humanizeNumber(1200)).toBe('1.2K');
    expect(Words.humanizeNumber(2500000)).toBe('2.5M');
  });
});
