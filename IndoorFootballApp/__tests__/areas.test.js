/* eslint-env jest */
// The area suggestion list (feature 2, docs/features/profiles-and-registration.md, P5
// and P6): which names are suggested for what's typed, and in what order.

import { AREAS, MAX_SUGGESTIONS, suggestAreas } from '../src/constants/areas';

describe('suggestAreas', () => {
  test('"pur" suggests Mirpur and Mohammadpur, among the names it appears in', () => {
    // No name starts with "pur", so these are all names that contain it, A–Z.
    expect(suggestAreas('pur')).toEqual([
      'Gazipur',
      'Mirpur',
      'Mohammadpur',
      'Rampura',
      'Rangpur',
    ]);
  });

  test('upper/lower case and spaces at both ends are ignored', () => {
    expect(suggestAreas('  DHAN ')).toEqual(['Dhanmondi']);
    expect(suggestAreas('dhan')).toEqual(['Dhanmondi']);
  });

  test('names that start with the text come first, then names that contain it, each A–Z', () => {
    // "ba": starts Badda, Banani, Banasree, Baridhara, Barishal, Bashundhara…, contains
    // others; only the first 5 are shown.
    expect(suggestAreas('ba')).toEqual([
      'Badda',
      'Banani',
      'Banasree',
      'Baridhara',
      'Barishal',
    ]);
    // "gh": no name starts with it, so the ones that contain it, A–Z.
    expect(suggestAreas('gh')).toEqual([
      'Hazaribagh',
      'Lalbagh',
      'Malibagh',
      'Mymensingh',
      'Shahbagh',
    ]);
  });

  test(`at most ${MAX_SUGGESTIONS} suggestions`, () => {
    expect(suggestAreas('a')).toHaveLength(MAX_SUGGESTIONS);
  });

  test('nothing for empty text, unknown text, or a name typed in full', () => {
    expect(suggestAreas('')).toEqual([]);
    expect(suggestAreas('   ')).toEqual([]);
    expect(suggestAreas('Zzz')).toEqual([]);
    expect(suggestAreas('mirpur')).toEqual([]);
    expect(suggestAreas('Dhanmondi')).toEqual([]);
  });

  test('a longer text still matches part of a name ("Mirpur 10" is free text, not suggested)', () => {
    expect(suggestAreas('Mirpur 10')).toEqual([]);
    expect(suggestAreas('Mirp')).toEqual(['Mirpur']);
  });

  test('the list has the starter areas, each once', () => {
    expect(new Set(AREAS).size).toBe(AREAS.length);
    for (const name of ['Dhanmondi', 'Mirpur', 'Uttara', 'Gazipur', 'Sylhet']) {
      expect(AREAS).toContain(name);
    }
  });
});
