import * as fc from 'fast-check';
import { describe, it } from 'vitest';

// Property-based tests for helper functions using fast-check
// These tests verify mathematical properties hold for all possible inputs

// Helper functions extracted for testing
const clamp = (v, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, v));
const snap5 = (v) => Math.min(100, Math.max(0, Math.round(v / 5) * 5));

describe('Property-Based Tests for Helper Functions', () => {
  describe('clamp', () => {
    it('should always return a value within bounds', () => {
      fc.assert(
        fc.property(
          fc.float({ min: -1000, max: 1000, noNaN: true }),
          fc.float({ min: 0, max: 50, noNaN: true }),
          fc.float({ min: 50, max: 100, noNaN: true }),
          (value, lo, hi) => {
            fc.pre(lo <= hi); // Precondition: lo must be <= hi
            const result = clamp(value, lo, hi);
            return result >= lo && result <= hi;
          }
        )
      );
    });

    it('should be idempotent (clamping twice gives same result)', () => {
      fc.assert(
        fc.property(
          fc.float({ min: -1000, max: 1000, noNaN: true }),
          fc.float({ min: 0, max: 50, noNaN: true }),
          fc.float({ min: 50, max: 100, noNaN: true }),
          (value, lo, hi) => {
            fc.pre(lo <= hi);
            const result1 = clamp(value, lo, hi);
            const result2 = clamp(result1, lo, hi);
            return result1 === result2;
          }
        )
      );
    });

    it('should return value unchanged if already within bounds', () => {
      fc.assert(
        fc.property(fc.float({ min: 0, max: 100, noNaN: true }), (value) => {
          const result = clamp(value, 0, 100);
          return result === value;
        })
      );
    });

    it('should return lo if value is below lo', () => {
      fc.assert(
        fc.property(
          fc.float({ min: -1000, max: -1, noNaN: true }),
          fc.float({ min: 0, max: 100, noNaN: true }),
          (value, lo) => {
            const result = clamp(value, lo, 100);
            return result === lo;
          }
        )
      );
    });

    it('should return hi if value is above hi', () => {
      fc.assert(
        fc.property(
          fc.float({ min: 101, max: 1000, noNaN: true }),
          fc.float({ min: 0, max: 100, noNaN: true }),
          (value, hi) => {
            const result = clamp(value, 0, hi);
            return result === hi;
          }
        )
      );
    });
  });

  describe('snap5', () => {
    it('should always return a multiple of 5', () => {
      fc.assert(
        fc.property(fc.float({ min: -1000, max: 1000, noNaN: true }), (value) => {
          const result = snap5(value);
          return result % 5 === 0;
        })
      );
    });

    it('should always return a value between 0 and 100', () => {
      fc.assert(
        fc.property(fc.float({ min: -1000, max: 1000, noNaN: true }), (value) => {
          const result = snap5(value);
          return result >= 0 && result <= 100;
        })
      );
    });

    it('should be idempotent (snapping twice gives same result)', () => {
      fc.assert(
        fc.property(fc.float({ min: -1000, max: 1000, noNaN: true }), (value) => {
          const result1 = snap5(value);
          const result2 = snap5(result1);
          return result1 === result2;
        })
      );
    });

    it('should round to nearest multiple of 5', () => {
      fc.assert(
        fc.property(fc.integer({ min: 0, max: 100 }), (value) => {
          const result = snap5(value);
          const distance = Math.abs(result - value);
          return distance <= 2.5;
        })
      );
    });

    it('should map all values in range [0, 2.5) to 0', () => {
      fc.assert(
        fc.property(fc.double({ min: 0, max: 2.49, noNaN: true }), (value) => {
          return snap5(value) === 0;
        })
      );
    });

    it('should map all values in range [97.5, infinity) to 100', () => {
      fc.assert(
        fc.property(fc.float({ min: 97.5, max: 1000, noNaN: true }), (value) => {
          return snap5(value) === 100;
        })
      );
    });

    it('should maintain order (if a < b, then snap5(a) <= snap5(b))', () => {
      fc.assert(
        fc.property(
          fc.float({ min: 0, max: 100, noNaN: true }),
          fc.float({ min: 0, max: 100, noNaN: true }),
          (a, b) => {
            fc.pre(a < b);
            const snapA = snap5(a);
            const snapB = snap5(b);
            return snapA <= snapB;
          }
        )
      );
    });
  });

  describe('clamp + snap5 composition', () => {
    it('should produce valid percentage values when composed', () => {
      fc.assert(
        fc.property(fc.float({ min: -1000, max: 1000, noNaN: true }), (value) => {
          const clamped = clamp(value, 0, 100);
          const snapped = snap5(clamped);
          return snapped >= 0 && snapped <= 100 && snapped % 5 === 0;
        })
      );
    });

    it('should be equivalent to snap5 alone (since snap5 clamps internally)', () => {
      fc.assert(
        fc.property(fc.float({ min: -1000, max: 1000, noNaN: true }), (value) => {
          const composed = snap5(clamp(value, 0, 100));
          const direct = snap5(value);
          return composed === direct;
        })
      );
    });
  });
});
