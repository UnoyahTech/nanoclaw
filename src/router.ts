import { Channel, NewMessage } from './types.js';
import { resolveDelivery } from './delivery.js';
import { formatLocalTime } from './timezone.js';

export function escapeXml(s: string): string {
  if (!s) return '';
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function formatMessages(
  messages: NewMessage[],
  timezone: string,
): string {
  const lines = messages.map((m) => {
    const displayTime = formatLocalTime(m.timestamp, timezone);
    const replyAttr = m.reply_to_message_id
      ? ` reply_to="${escapeXml(m.reply_to_message_id)}"`
      : '';
    const replySnippet =
      m.reply_to_message_content && m.reply_to_sender_name
        ? `\n  <quoted_message from="${escapeXml(m.reply_to_sender_name)}">${escapeXml(m.reply_to_message_content)}</quoted_message>`
        : '';
    return `<message sender="${escapeXml(m.sender_name)}" time="${escapeXml(displayTime)}"${replyAttr}>${replySnippet}${escapeXml(m.content)}</message>`;
  });

  const header = `<context timezone="${escapeXml(timezone)}" />\n`;

  return `${header}<messages>\n${lines.join('\n')}\n</messages>`;
}

export function stripInternalTags(text: string): string {
  return text.replace(/<internal>[\s\S]*?<\/internal>/g, '').trim();
}

export function formatOutbound(rawText: string): string {
  const text = stripInternalTags(rawText);
  if (!text) return '';
  return text;
}

export function routeOutbound(
  channels: Channel[],
  jid: string,
  text: string,
): Promise<void> {
  const channel = channels.find((c) => c.ownsJid(jid) && c.isConnected());
  if (!channel) throw new Error(`No channel for JID: ${jid}`);
  return channel.sendMessage(jid, text);
}

/**
 * Send a delivery action through the appropriate channel.
 * Handles inline messages, smart-split messages, and messages with file attachments.
 */
export async function routeDelivery(
  channels: Channel[],
  jid: string,
  rawText: string,
  agentName: string,
): Promise<void> {
  const channel = channels.find((c) => c.ownsJid(jid) && c.isConnected());
  if (!channel) throw new Error(`No channel for JID: ${jid}`);

  const action = resolveDelivery(rawText, agentName);

  if (action.attachment && channel.sendMessageWithAttachments) {
    // Send all inline messages first, then the last one with the attachment
    const lastIdx = action.messages.length - 1;
    for (let i = 0; i < lastIdx; i++) {
      await channel.sendMessage(jid, action.messages[i]);
    }
    await channel.sendMessageWithAttachments(
      jid,
      action.messages[lastIdx] || '',
      [
        {
          name: action.attachment.filename,
          content: action.attachment.content,
        },
      ],
    );
  } else if (action.attachment) {
    // Channel doesn't support attachments — fall back to smart-split the full content
    const { smartSplit } = await import('./smart-split.js');
    const allText =
      action.messages.join('\n\n') + '\n\n' + action.attachment.content;
    const chunks = smartSplit(allText);
    for (const chunk of chunks) {
      await channel.sendMessage(jid, chunk);
    }
  } else {
    // Inline or split — just send each message
    for (const msg of action.messages) {
      await channel.sendMessage(jid, msg);
    }
  }
}

export function findChannel(
  channels: Channel[],
  jid: string,
): Channel | undefined {
  return channels.find((c) => c.ownsJid(jid));
}
