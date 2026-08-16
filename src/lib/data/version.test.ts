import { describe, it, expect } from 'vitest';
import { DATA_FORMAT_VERSION } from './version';

describe('DATA_FORMAT_VERSION', () => {
  it('1 이상의 정수다', () => {
    expect(Number.isInteger(DATA_FORMAT_VERSION)).toBe(true);
    expect(DATA_FORMAT_VERSION).toBeGreaterThanOrEqual(1);
  });
});
