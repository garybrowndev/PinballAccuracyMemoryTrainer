/* eslint-disable import/named, import/no-unresolved */
import { describe, it, expect, beforeEach, vi } from 'vitest';

import {
  secureClear,
  secureGetItem,
  secureRemoveItem,
  secureSetItem,
  getWhitelistedKeys,
} from '../../src/utils/secure-storage';
/* eslint-enable import/named, import/no-unresolved */

describe('Secure Storage - XSS Prevention', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  describe('secureSetItem', () => {
    it('should sanitize malicious script tags', () => {
      const maliciousData = {
        name: '<script>alert("XSS")</script>Normal Text',
        value: 100,
      };

      secureSetItem('rows', maliciousData);
      const retrieved = secureGetItem('rows');

      expect(retrieved.name).not.toContain('<script>');
      expect(retrieved.name).toBe('Normal Text');
    });

    it('should sanitize iframe injection attempts', () => {
      const maliciousData = {
        description: '<iframe src="evil.com"></iframe>Safe content',
      };

      secureSetItem('rows', maliciousData);
      const retrieved = secureGetItem('rows');

      expect(retrieved.description).not.toContain('<iframe');
      expect(retrieved.description).toBe('Safe content');
    });

    it('should sanitize javascript: protocol', () => {
      const maliciousData = {
        link: 'javascript:alert("XSS")',
      };

      secureSetItem('rows', maliciousData);
      const retrieved = secureGetItem('rows');

      expect(retrieved.link).not.toContain('javascript:');
      expect(retrieved.link).toBe('alert("XSS")');
    });

    it('should sanitize inline event handlers', () => {
      const maliciousData = {
        html: '<div onclick="alert(1)">Click me</div>',
      };

      secureSetItem('rows', maliciousData);
      const retrieved = secureGetItem('rows');

      expect(retrieved.html).not.toMatch(/onclick=/i);
      expect(retrieved.html).toContain('Click me');
    });

    it('should reject non-whitelisted keys', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {
        // Mock implementation
      });

      const result = secureSetItem('maliciousKey', { data: 'test' });

      expect(result).toBe(false);
      expect(consoleSpy).toHaveBeenCalled();
      expect(localStorage.getItem('maliciousKey')).toBeNull();
    });

    it('should handle nested objects with malicious content', () => {
      const maliciousData = {
        user: {
          name: '<script>evil()</script>John',
          profile: {
            bio: '<iframe>hack</iframe>Developer',
          },
        },
      };

      secureSetItem('userSettings', maliciousData);
      const retrieved = secureGetItem('userSettings');

      expect(retrieved.user.name).not.toContain('<script>');
      expect(retrieved.user.profile.bio).not.toContain('<iframe>');
    });

    it('should handle arrays with malicious content', () => {
      const maliciousData = [
        { name: '<script>alert(1)</script>Item 1' },
        { name: 'javascript:void(0)Item 2' },
      ];

      secureSetItem('rows', maliciousData);
      const retrieved = secureGetItem('rows');

      expect(retrieved[0].name).not.toContain('<script>');
      expect(retrieved[1].name).not.toContain('javascript:');
    });

    it('should reject data exceeding size limit', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {
        // Mock implementation
      });
      const largeData = 'x'.repeat(6_000_000); // 6MB

      const result = secureSetItem('rows', largeData);

      expect(result).toBe(false);
      expect(consoleSpy).toHaveBeenCalled();
    });
  });

  describe('secureGetItem', () => {
    it('should return null for non-whitelisted keys', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {
        // Mock implementation
      });

      localStorage.setItem('maliciousKey', JSON.stringify({ data: 'test' }));
      const result = secureGetItem('maliciousKey');

      expect(result).toBeNull();
      expect(consoleSpy).toHaveBeenCalled();
    });

    it('should handle corrupted localStorage data gracefully', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {
        // Mock implementation
      });

      localStorage.setItem('rows', 'invalid json {{{');
      const result = secureGetItem('rows');

      expect(result).toBeNull();
      expect(consoleSpy).toHaveBeenCalled();
    });

    it('should return null for non-existent keys', () => {
      const result = secureGetItem('darkMode');
      expect(result).toBeNull();
    });
  });

  describe('secureRemoveItem', () => {
    it('should remove whitelisted keys', () => {
      secureSetItem('darkMode', true);
      expect(localStorage.getItem('darkMode')).not.toBeNull();

      secureRemoveItem('darkMode');
      expect(localStorage.getItem('darkMode')).toBeNull();
    });

    it('should reject removal of non-whitelisted keys', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {
        // Mock implementation
      });

      const result = secureRemoveItem('maliciousKey');

      expect(result).toBe(false);
      expect(consoleSpy).toHaveBeenCalled();
    });
  });

  describe('secureClear', () => {
    it('should clear only whitelisted keys', () => {
      secureSetItem('rows', []);
      secureSetItem('darkMode', true);
      localStorage.setItem('nonWhitelisted', 'should remain');

      secureClear();

      expect(localStorage.getItem('rows')).toBeNull();
      expect(localStorage.getItem('darkMode')).toBeNull();
      expect(localStorage.getItem('nonWhitelisted')).not.toBeNull();
    });
  });

  describe('getWhitelistedKeys', () => {
    it('should return only whitelisted keys that exist', () => {
      secureSetItem('rows', []);
      secureSetItem('darkMode', true);
      localStorage.setItem('nonWhitelisted', 'test');

      const keys = getWhitelistedKeys();

      expect(keys).toContain('rows');
      expect(keys).toContain('darkMode');
      expect(keys).not.toContain('nonWhitelisted');
    });
  });
});
