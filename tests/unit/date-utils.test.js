import { describe, it, expect } from 'vitest';
import {
  parse, fmt, addDays,
  isBiz, countBiz, subtractBiz, evalToBusinessDays,
} from '../lib/core.js';

// 2026-01-01 = Thursday  →  2026-01-05 = Monday
const MON_JAN05 = parse('2026-01-05');
const FRI_JAN09 = parse('2026-01-09');
const FRI_JAN23 = parse('2026-01-23');

describe('parse / fmt round-trip', () => {
  it('parse returns midnight local date', () => {
    const d = parse('2026-01-05');
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(0);   // 0-indexed
    expect(d.getDate()).toBe(5);
  });

  it('fmt produces ISO date string', () => {
    expect(fmt(new Date(2026, 0, 5))).toBe('2026-01-05');
  });

  it('single-digit month and day are zero-padded', () => {
    expect(fmt(new Date(2026, 0, 9))).toBe('2026-01-09');
  });

  it('parse then fmt is identity', () => {
    expect(fmt(parse('2026-07-04'))).toBe('2026-07-04');
  });
});

describe('addDays', () => {
  it('adds positive days', () => {
    expect(fmt(addDays(MON_JAN05, 4))).toBe('2026-01-09');
  });

  it('adds zero days → same date', () => {
    expect(fmt(addDays(MON_JAN05, 0))).toBe('2026-01-05');
  });

  it('adds negative days (subtraction)', () => {
    expect(fmt(addDays(MON_JAN05, -1))).toBe('2026-01-04');  // Sun
  });

  it('does not mutate the input', () => {
    const before = fmt(MON_JAN05);
    addDays(MON_JAN05, 7);
    expect(fmt(MON_JAN05)).toBe(before);
  });
});

describe('isBiz', () => {
  const empty = new Set();

  it('Monday is a business day', () => {
    expect(isBiz(parse('2026-01-05'), empty)).toBe(true); // Mon
  });

  it('Friday is a business day', () => {
    expect(isBiz(parse('2026-01-09'), empty)).toBe(true); // Fri
  });

  it('Saturday is not a business day', () => {
    expect(isBiz(parse('2026-01-03'), empty)).toBe(false); // Sat
  });

  it('Sunday is not a business day', () => {
    expect(isBiz(parse('2026-01-04'), empty)).toBe(false); // Sun
  });

  it('weekday that is a holiday is not a business day', () => {
    const hols = new Set(['2026-01-05']);
    expect(isBiz(parse('2026-01-05'), hols)).toBe(false);
  });

  it('weekday not in holiday set is a business day', () => {
    const hols = new Set(['2026-01-06']);
    expect(isBiz(parse('2026-01-05'), hols)).toBe(true);
  });
});

describe('countBiz', () => {
  const empty = new Set();

  it('Mon–Fri with no holidays = 5', () => {
    expect(countBiz(MON_JAN05, FRI_JAN09, empty)).toBe(5);
  });

  it('Mon–Sun spans a weekend, only 5 biz days', () => {
    const sun = parse('2026-01-11');
    expect(countBiz(MON_JAN05, sun, empty)).toBe(5);
  });

  it('single business day = 1', () => {
    expect(countBiz(MON_JAN05, MON_JAN05, empty)).toBe(1);
  });

  it('holiday reduces count', () => {
    const hols = new Set(['2026-01-07']); // Wed
    expect(countBiz(MON_JAN05, FRI_JAN09, hols)).toBe(4);
  });

  it('three weeks (Mon Jan 5 to Fri Jan 23) with no holidays = 15', () => {
    expect(countBiz(MON_JAN05, FRI_JAN23, empty)).toBe(15);
  });
});

describe('subtractBiz', () => {
  const empty = new Set();

  it('subtracting 5 biz days from Friday lands on the previous Monday', () => {
    // Jan 9 (Fri) - 5 biz days → Jan 5 (Mon)
    expect(fmt(subtractBiz(FRI_JAN09, 5, empty))).toBe('2026-01-05');
  });

  it('subtracting 10 biz days from Jan 23 (Fri) → Jan 12 (Mon)', () => {
    // Jan 23 - 10 biz days = Jan 12
    expect(fmt(subtractBiz(FRI_JAN23, 10, empty))).toBe('2026-01-12');
  });

  it('subtracting 0 biz days → same date', () => {
    expect(fmt(subtractBiz(MON_JAN05, 0, empty))).toBe('2026-01-05');
  });

  it('skips weekends when counting back', () => {
    // subtractBiz counts end itself as day 1, then goes back.
    // Jan 12 (Mon) - 2 biz days: day1=Jan12, step back → day2=Jan9 (Fri, skipping Sat/Sun)
    expect(fmt(subtractBiz(parse('2026-01-12'), 2, empty))).toBe('2026-01-09');
  });
});

describe('evalToBusinessDays', () => {
  const empty = new Set();

  it('unit=days returns value unchanged', () => {
    expect(evalToBusinessDays({ value: 7, unit: 'days' }, empty, '2026-01-23')).toBe(7);
  });

  it('unit=weeks returns value × 5', () => {
    expect(evalToBusinessDays({ value: 2, unit: 'weeks' }, empty, '2026-01-23')).toBe(10);
  });

  it('unit=months counts biz days in calendar month window', () => {
    // 1 month before 2026-02-01 = 2026-01-01 … 2026-02-01
    // Jan 2026 biz days: 22 (Feb 1 is Sun, not counted)
    expect(evalToBusinessDays({ value: 1, unit: 'months' }, empty, '2026-02-01')).toBe(22);
  });

  it('unit=months with holidays reduces count', () => {
    const hols = new Set(['2026-01-12']); // one holiday in January
    expect(evalToBusinessDays({ value: 1, unit: 'months' }, hols, '2026-02-01')).toBe(21);
  });
});
