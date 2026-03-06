// channels/telegram/adapter.ts
// Adapter REAL de Telegram con polling, conexión al EventBus y respuestas.

import TelegramBot from 'node-telegram-bot-api';
import { v4 as uuid } from 'uuid';
import { emitEvent, eventBus, EventType } from '../../kernel/event_bus';
import { log } from '../../kernel/logger';

let bot: TelegramBot | null = null;

// ─── Credenciales: allowFrom ───
const fs = require('fs');
const path = require('path');
const CREDS_DIR = path.join(__dirname, 'credentials');

function loadAllowedUsers(): string[] {
  try {
    const filePath = path.join(CREDS_DIR, 'telegram-default-allowFrom.json');
    if (fs.existsSync(filePath)) {
      const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      return (data.allowFrom || []).map((x: any) => String(x));
    }
  } catch (e) { /* ignore */ }
  return [];
}

// ─── Clase adapter con interfaz ChannelAdapter ───

export class TelegramAdapter {
  name = 'telegram';
  private token: string;
  private allowedUsers: string[];

  constructor(config: any) {
    this.token = config.bot_token || process.env.TELEGRAM_TOKEN || '';
    this.allowedUsers = loadAllowedUsers();
  }

  async start(): Promise<void> {
    if (!this.token) {
      console.error('[Telegram] No bot token configured. Set bot_token in config or TELEGRAM_TOKEN env.');
      return;
    }

    bot = new TelegramBot(this.token, { polling: true });

    bot.on('message', (msg) => {
      // Filtro de seguridad: solo usuarios permitidos (si hay lista)
      if (this.allowedUsers.length > 0 && !this.allowedUsers.includes(String(msg.from?.id || ''))) {
        console.log('[Telegram] Blocked message from unauthorized user: ' + msg.from?.id);
        return;
      }

      if (!msg.text) return;

      console.log('[Telegram] Message from ' + (msg.from?.first_name || msg.from?.id) + ': ' + msg.text);

      // Mejorar UX: Enviar indicador de "escribiendo..." inmediatamente
      bot?.sendChatAction(msg.chat.id, 'typing').catch(() => { });

      // Emitir al EventBus del kernel
      emitEvent({
        id: uuid(),
        type: EventType.USER_REQUEST,
        timestamp: Date.now(),
        origin: 'telegram',
        payload: {
          text: msg.text,
          user: msg.from?.id,
          username: msg.from?.username,
          firstName: msg.from?.first_name,
          chatId: msg.chat.id,
          messageId: msg.message_id,
          raw: msg,
        }
      });
    });

    bot.on('polling_error', (err) => {
      console.error('[Telegram] Polling error:', err.message);
    });

    // Escuchar cambios de estado del agente para mantener el "escribiendo..."
    eventBus.on(EventType.AGENT_STATUS, (event: any) => {
      const chatId = event.payload?.chatId;
      if (bot && chatId && (event.payload?.status === 'THINKING' || event.payload?.status === 'ACTING' || event.payload?.status === 'PLANNING')) {
        bot.sendChatAction(chatId, 'typing').catch(() => { });
      }
    });

    // Escuchar respuestas del kernel para enviar a Telegram (vía AGENT_RESPONSE genérico)
    eventBus.on(EventType.AGENT_RESPONSE, (event: any) => {
      if (event.payload?.origin === 'telegram' || event.payload?.channel === 'telegram') {
        const chatId = event.payload?.chatId;
        const text = event.payload?.text || event.payload?.message;
        if (bot && chatId && text) {
          bot.sendMessage(chatId, text, { parse_mode: 'Markdown' }).catch((e: any) => {
            bot?.sendMessage(chatId, text).catch(() => { });
          });
        }
      }
    });

    console.log('[Telegram] Bot started with polling. Listening for messages...');

    log({
      level: 'INFO',
      module: 'TelegramAdapter',
      message: 'Telegram bot started',
      sessionId: 'system',
      data: { allowedUsers: this.allowedUsers.length }
    });
  }

  async stop(): Promise<void> {
    if (bot) {
      await bot.stopPolling();
      bot = null;
      console.log('[Telegram] Bot stopped');
    }
  }

  async send(message: string, chatId?: string): Promise<void> {
    if (bot && chatId) {
      await bot.sendMessage(chatId, message);
    }
  }
}

// ─── Export para compatibilidad ───
export default TelegramAdapter;

// Legacy exports (backward compatibility)
export function onTelegramMessage(msg: any) {
  emitEvent({
    id: uuid(),
    type: EventType.USER_REQUEST,
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

export function sendTelegramResponse(chatId: string, text: string) {
  if (bot) {
    bot.sendMessage(chatId, text).catch(() => { });
  }
}

// Helper: envía respuesta directa (para usar desde cualquier parte del kernel)
export function replyToTelegram(chatId: number | string, text: string) {
  emitEvent({
    id: uuid(),
    type: EventType.AGENT_RESPONSE, // Using the standard response type
    timestamp: Date.now(),
    origin: 'kernel',
    payload: { chatId, text }
  });
}
