import { describe, it, expect } from 'vitest';

import { parseAgentOutput, ParsedOutput } from './output-parser.js';

describe('parseAgentOutput', () => {
  it('returns bare text when no tags present', () => {
    const result = parseAgentOutput('Hello, this is a simple response.');
    expect(result).toEqual({
      summary: null,
      deliverable: null,
      bareText: 'Hello, this is a simple response.',
    });
  });

  it('parses summary tag', () => {
    const input = '<summary>Key findings here.</summary>\n\nSome extra text.';
    const result = parseAgentOutput(input);
    expect(result.summary).toBe('Key findings here.');
    expect(result.bareText).toBe('Some extra text.');
    expect(result.deliverable).toBeNull();
  });

  it('parses deliverable tag with filename', () => {
    const input =
      '<deliverable filename="audit.md"># Full Report\n\nContent here.</deliverable>';
    const result = parseAgentOutput(input);
    expect(result.deliverable).toEqual({
      content: '# Full Report\n\nContent here.',
      filename: 'audit.md',
    });
    expect(result.bareText).toBe('');
  });

  it('parses deliverable tag without filename', () => {
    const input = '<deliverable># Report\n\nContent.</deliverable>';
    const result = parseAgentOutput(input);
    expect(result.deliverable).toEqual({
      content: '# Report\n\nContent.',
      filename: null,
    });
  });

  it('parses both summary and deliverable', () => {
    const input = [
      '<summary>Found 6 issues. Full report attached.</summary>',
      '',
      '<deliverable filename="charis-audit-2026-04.md">',
      '# Technical Audit',
      '## Findings',
      'Details here.',
      '</deliverable>',
    ].join('\n');
    const result = parseAgentOutput(input);
    expect(result.summary).toBe('Found 6 issues. Full report attached.');
    expect(result.deliverable?.filename).toBe('charis-audit-2026-04.md');
    expect(result.deliverable?.content).toContain('# Technical Audit');
    expect(result.bareText).toBe('');
  });

  it('does not confuse HTML tags with our tags', () => {
    const input =
      'The site has <meta> tags and <div> elements that need fixing.';
    const result = parseAgentOutput(input);
    expect(result.summary).toBeNull();
    expect(result.deliverable).toBeNull();
    expect(result.bareText).toBe(input);
  });

  it('handles deliverable containing HTML-like content', () => {
    const input = [
      '<deliverable filename="audit.md">',
      '# Audit',
      'Missing <meta description> on 3 pages.',
      'The <title> tag is too long.',
      '</deliverable>',
    ].join('\n');
    const result = parseAgentOutput(input);
    expect(result.deliverable?.content).toContain('<meta description>');
    expect(result.deliverable?.content).toContain('<title>');
  });

  it('treats malformed/unclosed tags as bare text', () => {
    const input =
      '<summary>This summary is never closed and just keeps going...';
    const result = parseAgentOutput(input);
    expect(result.summary).toBeNull();
    expect(result.bareText).toBe(input);
  });

  it('treats unclosed deliverable as bare text', () => {
    const input = '<deliverable filename="test.md">Content without closing tag';
    const result = parseAgentOutput(input);
    expect(result.deliverable).toBeNull();
    expect(result.bareText).toBe(input);
  });

  it('strips internal tags (already handled upstream but parser is safe)', () => {
    const input = '<internal>thinking...</internal>The actual response.';
    const result = parseAgentOutput(input);
    expect(result.bareText).toBe('The actual response.');
  });

  it('handles empty summary tag', () => {
    const input = '<summary></summary>Some bare text.';
    const result = parseAgentOutput(input);
    expect(result.summary).toBeNull();
    expect(result.bareText).toBe('Some bare text.');
  });

  it('handles empty deliverable tag', () => {
    const input = '<deliverable filename="empty.md"></deliverable>';
    const result = parseAgentOutput(input);
    expect(result.deliverable).toBeNull();
  });

  it('preserves bare text around tags', () => {
    const input = 'Before.\n<summary>The summary.</summary>\nAfter.';
    const result = parseAgentOutput(input);
    expect(result.summary).toBe('The summary.');
    expect(result.bareText).toBe('Before.\nAfter.');
  });

  it('handles tags in any order', () => {
    const input = [
      '<deliverable filename="report.md"># Report content</deliverable>',
      '<summary>Brief summary.</summary>',
    ].join('\n');
    const result = parseAgentOutput(input);
    expect(result.summary).toBe('Brief summary.');
    expect(result.deliverable?.content).toBe('# Report content');
  });
});
