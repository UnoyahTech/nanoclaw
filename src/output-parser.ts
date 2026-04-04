/**
 * Parses agent output for channel-agnostic semantic tags.
 *
 * Recognized tags:
 * - <internal>...</internal>  — stripped (agent reasoning, not shown)
 * - <summary>...</summary>    — concise inline summary
 * - <deliverable filename="...">...</deliverable> — full-length work product
 *
 * Only exact tag names are matched. HTML-like content (<meta>, <div>, etc.)
 * inside agent output is not touched.
 *
 * If any tag is malformed (opened but not closed), the entire output is
 * treated as bare text. A response must never be silenced by a parser bug.
 */

export interface ParsedOutput {
  summary: string | null;
  deliverable: {
    content: string;
    filename: string | null;
  } | null;
  bareText: string;
}

// Exact patterns — not a general XML parser
const INTERNAL_RE = /<internal>[\s\S]*?<\/internal>/g;
const SUMMARY_RE = /<summary>([\s\S]*?)<\/summary>/;
const DELIVERABLE_RE =
  /<deliverable(?:\s+filename="([^"]*)")?\s*>([\s\S]*?)<\/deliverable>/;

// Detect unclosed tags — if we see an opening tag without a closing one, bail
const UNCLOSED_SUMMARY_RE = /<summary>(?![\s\S]*<\/summary>)/;
const UNCLOSED_DELIVERABLE_RE = /<deliverable[^>]*>(?![\s\S]*<\/deliverable>)/;

export function parseAgentOutput(raw: string): ParsedOutput {
  // Check for unclosed tags first — treat entire output as bare text
  if (UNCLOSED_SUMMARY_RE.test(raw) || UNCLOSED_DELIVERABLE_RE.test(raw)) {
    return { summary: null, deliverable: null, bareText: raw };
  }

  let text = raw;

  // Strip internal tags
  text = text.replace(INTERNAL_RE, '');

  // Extract summary
  let summary: string | null = null;
  const summaryMatch = text.match(SUMMARY_RE);
  if (summaryMatch) {
    const content = summaryMatch[1].trim();
    summary = content || null; // null if empty
    text = text.replace(SUMMARY_RE, '');
  }

  // Extract deliverable
  let deliverable: ParsedOutput['deliverable'] = null;
  const deliverableMatch = text.match(DELIVERABLE_RE);
  if (deliverableMatch) {
    const content = deliverableMatch[2].trim();
    if (content) {
      deliverable = {
        content,
        filename: deliverableMatch[1] || null,
      };
    }
    text = text.replace(DELIVERABLE_RE, '');
  }

  // Remaining text is bare text — collapse runs of newlines left by tag removal
  const bareText = text.replace(/\n{2,}/g, '\n').trim();

  return { summary, deliverable, bareText };
}
