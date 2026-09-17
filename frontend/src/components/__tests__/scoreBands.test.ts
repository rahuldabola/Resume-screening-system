import { describe, expect, it } from 'vitest';
import { bandFor } from '../scoreBands';

describe('bandFor', () => {
  it('labels the three bands', () => {
    expect(bandFor(85).label).toBe('Strong match');
    expect(bandFor(55).label).toBe('Moderate match');
    expect(bandFor(20).label).toBe('Weak match');
  });

  // The band edges are the whole contract of this module: a score of exactly
  // 70 is strong, and 69.9 is not.
  it('treats the boundaries as inclusive lower bounds', () => {
    expect(bandFor(70).label).toBe('Strong match');
    expect(bandFor(69.9).label).toBe('Moderate match');
    expect(bandFor(40).label).toBe('Moderate match');
    expect(bandFor(39.9).label).toBe('Weak match');
  });

  it('bands the ends of the range', () => {
    expect(bandFor(0).label).toBe('Weak match');
    expect(bandFor(100).label).toBe('Strong match');
  });

  /**
   * The light-theme stroke colours are chosen against white and the dark ones
   * against a dark surface. A band that returned the same colour for both
   * would be a colour someone cannot read in one of the two themes.
   */
  it('gives every band a distinct stroke per theme', () => {
    for (const score of [85, 55, 20]) {
      const band = bandFor(score);
      expect(band.stroke).toMatch(/^#[0-9a-f]{6}$/);
      expect(band.strokeDark).toMatch(/^#[0-9a-f]{6}$/);
      expect(band.stroke).not.toBe(band.strokeDark);
    }
  });

  it('gives each band its own colours, so two bands never look alike', () => {
    const strokes = [bandFor(85), bandFor(55), bandFor(20)].map((b) => b.stroke);
    expect(new Set(strokes).size).toBe(3);
  });
});
