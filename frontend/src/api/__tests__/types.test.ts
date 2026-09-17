import { describe, expect, it } from 'vitest';
import { parseSkills } from '../types';

/**
 * Skills cross the wire as a JSON string inside a JSON body, because SQLite
 * has no array column. Every render path goes through this, so it has to
 * degrade to an empty list rather than throwing inside a component.
 */
describe('parseSkills', () => {
  it('parses a JSON-encoded list', () => {
    expect(parseSkills('["python","fastapi"]')).toEqual(['python', 'fastapi']);
  });

  it('parses an empty list', () => {
    expect(parseSkills('[]')).toEqual([]);
  });

  it.each([
    ['malformed JSON', '{not json'],
    ['an empty string', ''],
    ['a bare word', 'python'],
  ])('returns an empty list for %s rather than throwing', (_label, input) => {
    expect(parseSkills(input)).toEqual([]);
  });
});
