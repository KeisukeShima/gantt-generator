/**
 * Tests for migrateConfig — backwards-compatibility transformations.
 */
import { describe, it, expect } from 'vitest';
import { migrateConfig } from '../lib/core.js';

// Minimal valid new-format config (has `releases`)
const newFormat = {
  projectName: 'Test Project',
  startDate:   '2026-01-05',
  ganttUnit:   'weeks',
  holidays:    { national: [], company: [] },
  phaseTypes:  [{ name: '開発', color: '#3B82F6' }],
  people:      [],
  releases: [{
    id:          'r1',
    name:        'リリース1',
    color:       '#6D28D9',
    startDate:   '2026-01-05',
    releaseDate: '2026-01-23',
    evalPeriod:  { value: 2, unit: 'weeks' },
    showEvalZone: true,
    evalZone:    { label: 'リリース評価', color: '#8B5CF6' },
    epicKey:     '',
    items:       [],
  }],
};

// Old format (items at top level, no releases)
const oldFormat = {
  projectName: 'Old Project',
  startDate:   '2026-01-05',
  releaseDate: '2026-01-23',
  evalPeriod:  { value: 3, unit: 'weeks' },
  showEvalZone: true,
  evalZone:    { label: 'リリース評価', color: '#8B5CF6' },
  epicKey:     'OLD-1',
  ganttUnit:   'weeks',
  holidays:    { national: [], company: [] },
  phaseTypes:  [{ name: '開発', color: '#3B82F6' }],
  people:      [],
  items: [
    { name: 'Item A', category: '', note: '', phases: [{ type: '開発', days: 5 }] },
  ],
};

describe('new-format config passes through unchanged', () => {
  it('releases array is preserved', () => {
    const result = migrateConfig(newFormat);
    expect(result.releases).toHaveLength(1);
    expect(result.releases[0].id).toBe('r1');
    expect(result.releases[0].name).toBe('リリース1');
  });

  it('does not add a second release', () => {
    const result = migrateConfig(newFormat);
    expect(result.releases).toHaveLength(1);
  });

  it('input is not mutated (deep clone)', () => {
    migrateConfig(newFormat);
    expect(newFormat.releases[0].id).toBe('r1'); // unchanged
  });
});

describe('old-format migration (items at top level)', () => {
  it('items are moved into releases[0].items', () => {
    const result = migrateConfig(oldFormat);
    expect(result.releases).toHaveLength(1);
    expect(result.releases[0].items).toHaveLength(1);
    expect(result.releases[0].items[0].name).toBe('Item A');
  });

  it('top-level items key is removed', () => {
    const result = migrateConfig(oldFormat);
    expect(result.items).toBeUndefined();
  });

  it('top-level releaseDate is moved to releases[0].releaseDate', () => {
    const result = migrateConfig(oldFormat);
    expect(result.releases[0].releaseDate).toBe('2026-01-23');
    expect(result.releaseDate).toBeUndefined();
  });

  it('top-level evalPeriod is moved to releases[0].evalPeriod', () => {
    const result = migrateConfig(oldFormat);
    expect(result.releases[0].evalPeriod).toEqual({ value: 3, unit: 'weeks' });
    expect(result.evalPeriod).toBeUndefined();
  });

  it('top-level epicKey is moved to releases[0].epicKey', () => {
    const result = migrateConfig(oldFormat);
    expect(result.releases[0].epicKey).toBe('OLD-1');
    expect(result.epicKey).toBeUndefined();
  });

  it('releases[0] gets a generated id', () => {
    const result = migrateConfig(oldFormat);
    expect(typeof result.releases[0].id).toBe('string');
    expect(result.releases[0].id.length).toBeGreaterThan(0);
  });
});

describe('field removal', () => {
  it('removes the legacy evalPhase field', () => {
    const input = { ...newFormat, evalPhase: '要件定義' };
    const result = migrateConfig(input);
    expect(result.evalPhase).toBeUndefined();
  });
});

describe('default field injection for releases', () => {
  it('release missing evalPeriod gets default { value:4, unit:"weeks" }', () => {
    const input = {
      ...newFormat,
      releases: [{ ...newFormat.releases[0], evalPeriod: undefined }],
    };
    const result = migrateConfig(input);
    expect(result.releases[0].evalPeriod).toEqual({ value: 4, unit: 'weeks' });
  });

  it('release missing evalZone gets default evalZone', () => {
    const input = {
      ...newFormat,
      releases: [{ ...newFormat.releases[0], evalZone: undefined }],
    };
    const result = migrateConfig(input);
    expect(result.releases[0].evalZone).toEqual({ label: 'リリース評価', color: '#8B5CF6' });
  });

  it('release missing showEvalZone defaults to true', () => {
    const input = {
      ...newFormat,
      releases: [{ ...newFormat.releases[0], showEvalZone: undefined }],
    };
    const result = migrateConfig(input);
    expect(result.releases[0].showEvalZone).toBe(true);
  });

  it('release with showEvalZone=false keeps false', () => {
    const input = {
      ...newFormat,
      releases: [{ ...newFormat.releases[0], showEvalZone: false }],
    };
    const result = migrateConfig(input);
    expect(result.releases[0].showEvalZone).toBe(false);
  });

  it('release missing id gets a generated id', () => {
    const input = {
      ...newFormat,
      releases: [{ ...newFormat.releases[0], id: undefined }],
    };
    const result = migrateConfig(input);
    expect(typeof result.releases[0].id).toBe('string');
    expect(result.releases[0].id.length).toBeGreaterThan(0);
  });

  it('config with no releases at all gets empty releases array', () => {
    const input = { projectName: 'Empty', startDate: '2026-01-05', holidays: { national: [], company: [] }, phaseTypes: [], people: [] };
    const result = migrateConfig(input);
    expect(Array.isArray(result.releases)).toBe(true);
    expect(result.releases).toHaveLength(0);
  });
});
