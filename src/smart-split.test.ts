import { describe, it, expect } from 'vitest';

import { smartSplit } from './smart-split.js';

describe('smartSplit', () => {
  it('returns single-element array for short text', () => {
    const result = smartSplit('Hello world', 2000);
    expect(result).toEqual(['Hello world']);
  });

  it('returns single-element array for exactly 2000 chars', () => {
    const text = 'a'.repeat(2000);
    const result = smartSplit(text, 2000);
    expect(result).toEqual([text]);
  });

  it('splits on heading boundary', () => {
    const text =
      'a'.repeat(1900) +
      '\n\n## Section Two\n\nMore content here padding' +
      'x'.repeat(100);
    const result = smartSplit(text, 2000);
    expect(result).toHaveLength(2);
    expect(result[0]).toBe('a'.repeat(1900));
    expect(result[1]).toBe(
      '## Section Two\n\nMore content here padding' + 'x'.repeat(100),
    );
  });

  it('splits on horizontal rule when no heading found', () => {
    const text =
      'a'.repeat(1900) +
      '\n\n---\n\nMore content here padding' +
      'x'.repeat(100);
    const result = smartSplit(text, 2000);
    expect(result).toHaveLength(2);
    expect(result[0]).toBe('a'.repeat(1900));
    expect(result[1]).toBe('More content here padding' + 'x'.repeat(100));
  });

  it('splits on double newline (paragraph) when no heading or rule', () => {
    const text =
      'a'.repeat(1900) +
      '\n\nSecond paragraph with more text padding' +
      'x'.repeat(100);
    const result = smartSplit(text, 2000);
    expect(result).toHaveLength(2);
    expect(result[0]).toBe('a'.repeat(1900));
    expect(result[1]).toBe(
      'Second paragraph with more text padding' + 'x'.repeat(100),
    );
  });

  it('splits on single newline as fallback', () => {
    const text =
      'a'.repeat(1950) +
      '\nMore text on next line that pushes over the limit easily';
    const result = smartSplit(text, 2000);
    expect(result).toHaveLength(2);
    expect(result[0]).toBe('a'.repeat(1950));
    expect(result[1]).toBe(
      'More text on next line that pushes over the limit easily',
    );
  });

  it('hard cuts at maxLength when no break found', () => {
    const text = 'a'.repeat(3000);
    const result = smartSplit(text, 2000);
    expect(result).toHaveLength(2);
    expect(result[0]).toBe('a'.repeat(2000));
    expect(result[1]).toBe('a'.repeat(1000));
  });

  it('handles multiple splits for very long text', () => {
    const section = 'a'.repeat(1800) + '\n\n';
    const text = section.repeat(3) + 'final';
    const result = smartSplit(text, 2000);
    expect(result.length).toBeGreaterThanOrEqual(3);
    result.forEach((chunk) => {
      expect(chunk.length).toBeLessThanOrEqual(2000);
    });
  });

  it('prefers heading split over paragraph split', () => {
    // Both a paragraph break and a heading exist — heading pattern has higher priority
    // so the splitter should find the heading boundary first
    const text =
      'a'.repeat(1500) +
      '\n\nParagraph break\n\n## Heading\n\nAfter heading' +
      'x'.repeat(500);
    const result = smartSplit(text, 2000);
    // The split should happen at the heading boundary (highest-priority match)
    expect(result[0]).not.toContain('## Heading');
  });

  it('returns empty array for empty string', () => {
    const result = smartSplit('', 2000);
    expect(result).toEqual([]);
  });

  it('trims whitespace from chunks', () => {
    const text =
      'a'.repeat(1900) + '\n\n\n\n## Next\n\nContent padding' + 'x'.repeat(100);
    const result = smartSplit(text, 2000);
    result.forEach((chunk) => {
      expect(chunk).toBe(chunk.trim());
    });
  });
});
