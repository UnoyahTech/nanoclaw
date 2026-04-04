import { parseAgentOutput } from './output-parser.js';
import { smartSplit } from './smart-split.js';

export interface DeliveryAction {
  type: 'inline' | 'split' | 'attachment';
  messages: string[];
  attachment: {
    filename: string;
    content: string;
  } | null;
}

const AUTO_ATTACH_THRESHOLD = 4000;
const DISCORD_MAX_LENGTH = 2000;

/**
 * Extract the first meaningful paragraph from text, skipping headings and rules.
 * Used for auto-generated summaries when agent doesn't provide a <summary> tag.
 */
function extractFirstParagraph(text: string): string {
  const paragraphs = text.split(/\n\n+/);
  for (const p of paragraphs) {
    const trimmed = p.trim();
    // Skip headings, horizontal rules, and empty lines
    if (!trimmed) continue;
    if (/^#{1,6}\s/.test(trimmed)) continue;
    if (/^(?:---+|\*\*\*+)$/.test(trimmed)) continue;
    return trimmed;
  }
  // Fallback: first 500 chars
  return text.slice(0, 500).trim();
}

function fallbackFilename(agentName: string): string {
  const date = new Date().toISOString().slice(0, 10);
  return `${agentName}-${date}.md`;
}

export function resolveDelivery(
  rawText: string,
  agentName: string,
): DeliveryAction {
  const parsed = parseAgentOutput(rawText);

  // Case 1: Tagged output with deliverable
  if (parsed.deliverable) {
    const filename = parsed.deliverable.filename || fallbackFilename(agentName);
    const messages: string[] = [];

    if (parsed.summary && parsed.bareText) {
      messages.push(`${parsed.bareText}\n\n${parsed.summary}`);
    } else if (parsed.summary) {
      messages.push(parsed.summary);
    } else if (parsed.bareText) {
      // Deliverable without summary — auto-generate from deliverable content
      const autoSummary = extractFirstParagraph(parsed.deliverable.content);
      messages.push(`${parsed.bareText}\n\nFull report attached below.\n${autoSummary}`);
    } else {
      // Just deliverable, no summary, no bare text
      const autoSummary = extractFirstParagraph(parsed.deliverable.content);
      messages.push(`Full report attached below.\n${autoSummary}`);
    }

    return {
      type: 'attachment',
      messages,
      attachment: {
        filename,
        content: parsed.deliverable.content,
      },
    };
  }

  // Case 2: Summary tag only (no deliverable)
  if (parsed.summary) {
    const text = parsed.bareText
      ? `${parsed.bareText}\n\n${parsed.summary}`
      : parsed.summary;
    return {
      type: 'inline',
      messages: smartSplit(text, DISCORD_MAX_LENGTH),
      attachment: null,
    };
  }

  // Case 3: Bare text only — decide by length
  // Use rawText for attachment content to preserve original formatting;
  // use bareText for length checks and inline display (internal tags stripped).
  const text = parsed.bareText;

  if (text.length <= DISCORD_MAX_LENGTH) {
    return {
      type: 'inline',
      messages: [text],
      attachment: null,
    };
  }

  if (text.length > AUTO_ATTACH_THRESHOLD) {
    const autoSummary = extractFirstParagraph(rawText);
    return {
      type: 'attachment',
      messages: [`Full report attached below.\n${autoSummary}`],
      attachment: {
        filename: fallbackFilename(agentName),
        content: rawText,
      },
    };
  }

  // Medium length: smart split
  return {
    type: 'split',
    messages: smartSplit(text, DISCORD_MAX_LENGTH),
    attachment: null,
  };
}
