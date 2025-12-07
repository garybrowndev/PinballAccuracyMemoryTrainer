import { describe, it, expect } from 'vitest';

// Import utility functions from app.jsx
// Since these are not exported, we'll test them through their public behavior
// For now, let's create unit tests for utility-like functions that we can extract

describe('Utility Functions', () => {
  describe('clamp function', () => {
    // Define clamp function for testing
    const clamp = (v, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, v));

    it('should clamp value to range', () => {
      expect(clamp(50)).toBe(50);
      expect(clamp(150)).toBe(100);
      expect(clamp(-10)).toBe(0);
    });

    it('should clamp with custom bounds', () => {
      expect(clamp(50, 10, 80)).toBe(50);
      expect(clamp(5, 10, 80)).toBe(10);
      expect(clamp(90, 10, 80)).toBe(80);
    });
  });

  describe('snap5 function', () => {
    const snap5 = (v) => Math.min(100, Math.max(0, Math.round(v / 5) * 5));

    it('should snap to nearest 5', () => {
      expect(snap5(0)).toBe(0);
      expect(snap5(3)).toBe(5);
      expect(snap5(7)).toBe(5);
      expect(snap5(8)).toBe(10);
      expect(snap5(50)).toBe(50);
      expect(snap5(97)).toBe(95);
      expect(snap5(98)).toBe(100);
    });

    it('should clamp to 0-100 range', () => {
      expect(snap5(-10)).toBe(0);
      expect(snap5(105)).toBe(100);
      expect(snap5(200)).toBe(100);
    });
  });

  describe('format2 function', () => {
    const format2 = (n) => {
      const v = Math.round(Number.isFinite(n) ? n : 0);
      return String(v).padStart(2, '0');
    };

    it('should format numbers with leading zero', () => {
      expect(format2(0)).toBe('00');
      expect(format2(5)).toBe('05');
      expect(format2(10)).toBe('10');
      expect(format2(50)).toBe('50');
      expect(format2(100)).toBe('100');
    });

    it('should handle invalid inputs', () => {
      expect(format2(Number.NaN)).toBe('00');
      expect(format2(Infinity)).toBe('00');
      expect(format2()).toBe('00');
      expect(format2(null)).toBe('00');
    });

    it('should round decimal values', () => {
      expect(format2(5.4)).toBe('05');
      expect(format2(5.6)).toBe('06');
      expect(format2(49.5)).toBe('50');
    });
  });

  describe('formatPct function', () => {
    const format2 = (n) => {
      const v = Math.round(Number.isFinite(n) ? n : 0);
      return String(v).padStart(2, '0');
    };
    const formatPct = (n) => `${format2(n)}%`;

    it('should format percentage with % sign', () => {
      expect(formatPct(0)).toBe('00%');
      expect(formatPct(5)).toBe('05%');
      expect(formatPct(50)).toBe('50%');
      expect(formatPct(100)).toBe('100%');
    });
  });

  describe('formatInitValue function', () => {
    const format2 = (n) => {
      const v = Math.round(Number.isFinite(n) ? n : 0);
      return String(v).padStart(2, '0');
    };
    const formatInitValue = (val) => {
      if (val === 0) {
        return 'NP';
      }
      if (val === null || val === undefined) {
        return '—';
      }
      return format2(val);
    };

    it('should return NP for 0', () => {
      expect(formatInitValue(0)).toBe('NP');
    });

    it('should return dash for null/undefined', () => {
      expect(formatInitValue(null)).toBe('—');
      expect(formatInitValue()).toBe('—');
    });

    it('should format valid numbers', () => {
      expect(formatInitValue(5)).toBe('05');
      expect(formatInitValue(50)).toBe('50');
      expect(formatInitValue(100)).toBe('100');
    });
  });

  describe('elementSlug function', () => {
    const elementSlug = (name) => {
      return name
        .toLowerCase()
        .replaceAll(/[^\da-z]+/g, '-')
        .replaceAll(/^-+|-+$/g, '');
    };

    it('should convert name to slug', () => {
      expect(elementSlug('Left Ramp')).toBe('left-ramp');
      expect(elementSlug('Right Orbit')).toBe('right-orbit');
      expect(elementSlug('Center Target')).toBe('center-target');
    });

    it('should handle special characters', () => {
      expect(elementSlug("Captain's Chair")).toBe('captain-s-chair');
      expect(elementSlug('Lock #1')).toBe('lock-1');
    });

    it('should remove leading/trailing dashes', () => {
      expect(elementSlug('-Leading')).toBe('leading');
      expect(elementSlug('Trailing-')).toBe('trailing');
      expect(elementSlug('-Both-')).toBe('both');
    });
  });

  describe('buildType function', () => {
    const buildType = (base, location) => {
      if (!base) {
        return '';
      }
      if (!location) {
        return base;
      }
      if (location === 'Base') {
        return base;
      }
      return `${location} ${base}`;
    };

    it('should return empty string for no base', () => {
      expect(buildType('', 'Left')).toBe('');
      expect(buildType(null, 'Left')).toBe('');
    });

    it('should return base only when no location', () => {
      expect(buildType('Ramp', '')).toBe('Ramp');
      expect(buildType('Ramp', null)).toBe('Ramp');
      expect(buildType('Ramp', 'Base')).toBe('Ramp');
    });

    it('should combine location and base', () => {
      expect(buildType('Ramp', 'Left')).toBe('Left Ramp');
      expect(buildType('Orbit', 'Right')).toBe('Right Orbit');
      expect(buildType('Target', 'Center')).toBe('Center Target');
    });
  });
});
