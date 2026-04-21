/**
 * Tests for evalToBusinessDays and evalStart calculation
 * (the core of the evaluation period feature).
 */
import { describe, it, expect } from 'vitest';
import { evalToBusinessDays, subtractBiz, parse, fmt } from '../lib/core.js';

// No holidays for most tests to keep arithmetic simple
const empty = new Set();

describe('evalToBusinessDays boundary cases', () => {
  it('0 weeks → 0 biz days', () => {
    expect(evalToBusinessDays({ value: 0, unit: 'weeks' }, empty, '2026-01-23')).toBe(0);
  });

  it('4 weeks → 20 biz days', () => {
    expect(evalToBusinessDays({ value: 4, unit: 'weeks' }, empty, '2026-01-23')).toBe(20);
  });

  it('0 days → 0', () => {
    expect(evalToBusinessDays({ value: 0, unit: 'days' }, empty, '2026-01-23')).toBe(0);
  });

  it('1 day → 1', () => {
    expect(evalToBusinessDays({ value: 1, unit: 'days' }, empty, '2026-01-23')).toBe(1);
  });
});

describe('evalStart derivation', () => {
  // evalStart = subtractBiz(releaseDate, evalBD, hols)
  // Release Jan 23 (Fri), eval 2 weeks = 10 biz days → evalStart = Jan 12 (Mon)
  it('2-week eval from Jan 23 → evalStart Jan 12', () => {
    const evalBD    = evalToBusinessDays({ value: 2, unit: 'weeks' }, empty, '2026-01-23');
    const evalStart = subtractBiz(parse('2026-01-23'), evalBD, empty);
    expect(fmt(evalStart)).toBe('2026-01-12');
  });

  // Release Jan 16 (Fri), eval 2 weeks = 10 biz days → evalStart = Jan 5 (Mon)
  it('2-week eval from Jan 16 → evalStart Jan 5', () => {
    const evalBD    = evalToBusinessDays({ value: 2, unit: 'weeks' }, empty, '2026-01-16');
    const evalStart = subtractBiz(parse('2026-01-16'), evalBD, empty);
    expect(fmt(evalStart)).toBe('2026-01-05');
  });

  it('holiday in eval window pushes evalStart one day earlier', () => {
    // Jan 12 is evalStart without holiday; if Jan 14 (Wed) is holiday,
    // we need 11 calendar biz days to get 10 biz days → evalStart = Jan 9 (Fri)
    const hols      = new Set(['2026-01-14']); // Wed in the eval window
    const evalBD    = evalToBusinessDays({ value: 2, unit: 'weeks' }, hols, '2026-01-23');
    // weeks unit is always value*5 regardless of holidays
    expect(evalBD).toBe(10);
    const evalStart = subtractBiz(parse('2026-01-23'), evalBD, hols);
    // counting back 10 biz days skips Jan 14 (holiday) so we land on Jan 9
    expect(fmt(evalStart)).toBe('2026-01-09');
  });
});
