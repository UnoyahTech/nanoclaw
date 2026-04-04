import { describe, it, expect, vi } from 'vitest';

import { resolveDelivery, DeliveryAction } from './delivery.js';

describe('resolveDelivery', () => {
  it('sends short bare text as-is', () => {
    const result = resolveDelivery('Short response.', 'nova');
    expect(result).toEqual({
      type: 'inline',
      messages: ['Short response.'],
      attachment: null,
    });
  });

  it('smart-splits bare text between 2000-4000 chars', () => {
    const text = 'a'.repeat(1900) + '\n\n' + 'b'.repeat(1900);
    const result = resolveDelivery(text, 'nova');
    expect(result.type).toBe('split');
    expect(result.messages.length).toBeGreaterThan(1);
    result.messages.forEach((msg) => {
      expect(msg.length).toBeLessThanOrEqual(2000);
    });
    expect(result.attachment).toBeNull();
  });

  it('auto-summarizes and attaches bare text over 4000 chars', () => {
    const text = 'First paragraph with important info.\n\n' + 'a'.repeat(4500);
    const result = resolveDelivery(text, 'nova');
    expect(result.type).toBe('attachment');
    expect(result.messages).toHaveLength(1);
    expect(result.messages[0]).toContain('Full report attached below.');
    expect(result.messages[0]).toContain('First paragraph with important info.');
    expect(result.attachment).not.toBeNull();
    expect(result.attachment!.filename).toMatch(/^nova-\d{4}-\d{2}-\d{2}\.md$/);
    expect(result.attachment!.content).toBe(text);
  });

  it('auto-summary skips heading lines for first paragraph', () => {
    const text = '# Big Heading\n\n---\n\nActual first paragraph.\n\n' + 'a'.repeat(4500);
    const result = resolveDelivery(text, 'scout');
    expect(result.messages[0]).toContain('Actual first paragraph.');
    expect(result.messages[0]).not.toContain('# Big Heading');
  });

  it('uses summary + deliverable when both tags present', () => {
    const tagged =
      '<summary>Found 6 issues.</summary>\n<deliverable filename="audit.md"># Full Audit\nDetails.</deliverable>';
    const result = resolveDelivery(tagged, 'nova');
    expect(result.type).toBe('attachment');
    expect(result.messages).toEqual(['Found 6 issues.']);
    expect(result.attachment).toEqual({
      filename: 'audit.md',
      content: '# Full Audit\nDetails.',
    });
  });

  it('auto-generates summary when deliverable has no summary tag', () => {
    const tagged =
      '<deliverable filename="report.md">First paragraph of report.\n\nMore content here.</deliverable>';
    const result = resolveDelivery(tagged, 'remy');
    expect(result.type).toBe('attachment');
    expect(result.messages[0]).toContain('Full report attached below.');
    expect(result.messages[0]).toContain('First paragraph of report.');
    expect(result.attachment!.filename).toBe('report.md');
  });

  it('posts summary inline when no deliverable tag', () => {
    const tagged = '<summary>Quick update: all systems nominal.</summary>';
    const result = resolveDelivery(tagged, 'nova');
    expect(result.type).toBe('inline');
    expect(result.messages).toEqual(['Quick update: all systems nominal.']);
    expect(result.attachment).toBeNull();
  });

  it('generates fallback filename from agent name and date', () => {
    const tagged = '<deliverable># Report</deliverable>';
    const result = resolveDelivery(tagged, 'scout');
    expect(result.attachment!.filename).toMatch(/^scout-\d{4}-\d{2}-\d{2}\.md$/);
  });

  it('includes bare text alongside summary when both exist', () => {
    const tagged =
      'Extra context.\n<summary>The summary.</summary>\n<deliverable filename="r.md">Report.</deliverable>';
    const result = resolveDelivery(tagged, 'nova');
    expect(result.messages[0]).toContain('The summary.');
    // Bare text should be included in the inline message
    expect(result.messages[0]).toContain('Extra context.');
  });

  it('falls back to bare text on malformed tags', () => {
    const malformed = '<summary>Unclosed summary with <deliverable>also unclosed';
    const result = resolveDelivery(malformed, 'nova');
    expect(result.type).toBe('inline');
    expect(result.messages[0]).toBe(malformed);
    expect(result.attachment).toBeNull();
  });
});
