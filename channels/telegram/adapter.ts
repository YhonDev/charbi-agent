// charbi/channels/telegram/adapter.ts
import { emitEvent } from '../../kernel/event_bus';
import { v4 as uuid } from 'uuid';

/**
 * onTelegramMessage
 * Adapter that converts a Telegram message into a Kernel USER_REQUEST event.
 */
export function onTelegramMessage(msg: any) {
  emitEvent({
    id: uuid(),
    type: 'USER_REQUEST',
    timestamp: Date.now(),
    origin: 'telegram',
    payload: {
      text: msg.text,
      user: msg.from?.id,
      chatId: msg.chat?.id,
      raw: msg
    }
  });
}

/**
 * sendTelegramResponse
 * Outbound adapter to send messages back to the user.
 */
export function sendTelegramResponse(chatId: string, text: string) {
  console.log(`[TelegramAdapter] Sending response to ${chatId}: ${text}`);
  // In a real implementation, you'd call the Telegram Bot API here.
}
