import { describe, it, expect, vi } from 'vitest';

import { routeDelivery } from './router.js';
import { Channel } from './types.js';

function mockChannel(overrides: Partial<Channel> = {}): Channel {
  return {
    name: 'test',
    connect: vi.fn(),
    sendMessage: vi.fn().mockResolvedValue(undefined),
    sendMessageWithAttachments: vi.fn().mockResolvedValue(undefined),
    isConnected: () => true,
    ownsJid: () => true,
    disconnect: vi.fn(),
    ...overrides,
  };
}

describe('routeDelivery', () => {
  it('sends short text via sendMessage once', async () => {
    const ch = mockChannel();
    await routeDelivery([ch], 'dc:123', 'Short reply.', 'nova');

    expect(ch.sendMessage).toHaveBeenCalledTimes(1);
    expect(ch.sendMessage).toHaveBeenCalledWith('dc:123', 'Short reply.');
    expect(ch.sendMessageWithAttachments).not.toHaveBeenCalled();
  });

  it('sends tagged output with attachment via sendMessageWithAttachments', async () => {
    const ch = mockChannel();
    const tagged =
      '<summary>Found 3 issues.</summary>\n<deliverable filename="audit.md"># Audit\nDetails here.</deliverable>';
    await routeDelivery([ch], 'dc:123', tagged, 'scout');

    expect(ch.sendMessageWithAttachments).toHaveBeenCalledTimes(1);
    const [jid, text, files] = (
      ch.sendMessageWithAttachments as ReturnType<typeof vi.fn>
    ).mock.calls[0];
    expect(jid).toBe('dc:123');
    expect(text).toContain('Found 3 issues.');
    expect(files).toHaveLength(1);
    expect(files[0].name).toBe('audit.md');
    expect(files[0].content).toBe('# Audit\nDetails here.');
  });

  it('falls back to smart-split via sendMessage when channel lacks sendMessageWithAttachments', async () => {
    const ch = mockChannel({
      sendMessageWithAttachments: undefined,
    });
    const tagged =
      '<summary>Summary here.</summary>\n<deliverable filename="report.md"># Report\nLong content.</deliverable>';
    await routeDelivery([ch], 'dc:123', tagged, 'remy');

    // Should NOT have called sendMessageWithAttachments (it's undefined)
    // Should have called sendMessage with smart-split chunks
    expect(ch.sendMessage).toHaveBeenCalled();
    const calls = (ch.sendMessage as ReturnType<typeof vi.fn>).mock.calls;
    // All chunks concatenated should contain both summary and report content
    const allText = calls.map((c: unknown[]) => c[1] as string).join('\n');
    expect(allText).toContain('Summary here.');
    expect(allText).toContain('# Report');
    expect(allText).toContain('Long content.');
  });

  it('throws when no channel matches the jid', async () => {
    const ch = mockChannel({ ownsJid: () => false });
    await expect(
      routeDelivery([ch], 'dc:999', 'Hello', 'nova'),
    ).rejects.toThrow('No channel for JID');
  });
});
