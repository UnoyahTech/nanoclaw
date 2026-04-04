/**
 * Markdown-aware text splitter for Discord's 2000-char message limit.
 *
 * Split priority (highest to lowest):
 * 1. Heading boundary (## , ### , etc.)
 * 2. Horizontal rule (--- or ***)
 * 3. Double newline (paragraph break)
 * 4. Single newline (line break)
 * 5. Hard cut at maxLength
 */

const SPLIT_PATTERNS: { pattern: RegExp }[] = [
  // Heading: split before the heading line. Look for \n before ##
  { pattern: /\n(?=#{1,6} )/g },
  // Horizontal rule: split on the rule itself
  { pattern: /\n(?:---+|\*\*\*+)\n/g },
  // Double newline (paragraph break)
  { pattern: /\n\n+/g },
  // Single newline
  { pattern: /\n/g },
];

export function smartSplit(text: string, maxLength = 2000): string[] {
  if (!text) return [];
  if (text.length <= maxLength) return [text];

  const chunks: string[] = [];
  let remaining = text;

  while (remaining.length > 0) {
    if (remaining.length <= maxLength) {
      chunks.push(remaining.trim());
      break;
    }

    let splitIndex = -1;
    let matchLength = 0;

    // Try each split pattern in priority order
    for (const { pattern } of SPLIT_PATTERNS) {
      // Find the last occurrence of this pattern within maxLength
      const searchRegion = remaining.slice(0, maxLength);
      let lastMatch: RegExpExecArray | null = null;
      const regex = new RegExp(pattern.source, pattern.flags);
      let match: RegExpExecArray | null;

      while ((match = regex.exec(searchRegion)) !== null) {
        // Only consider splits that leave a non-trivial chunk (at least 100 chars)
        if (match.index >= 100) {
          lastMatch = match;
        }
      }

      if (lastMatch) {
        splitIndex = lastMatch.index;
        matchLength = lastMatch[0].length;
        break;
      }
    }

    if (splitIndex > 0) {
      chunks.push(remaining.slice(0, splitIndex).trim());
      // Advance past both the split point and the matched separator
      remaining = remaining.slice(splitIndex + matchLength).trim();
    } else {
      // Hard cut — no suitable break point found
      chunks.push(remaining.slice(0, maxLength).trim());
      remaining = remaining.slice(maxLength).trim();
    }
  }

  return chunks.filter((c) => c.length > 0);
}
