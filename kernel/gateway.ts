// kernel/gateway.ts
import http from 'http';
import { v4 as uuidv4 } from 'uuid';
import { emitEvent, eventBus } from './event_bus';

export class Gateway {
  private server: http.Server;
  private port: number = 5005;

  constructor() {
    this.server = http.createServer(this.handleRequest.bind(this));
  }

  async start() {
    return new Promise<void>((resolve) => {
      this.server.listen(this.port, () => {
        console.log(`[Gateway] API listening on http://localhost:${this.port}`);
        resolve();
      });
    });
  }

  async stop() {
    return new Promise<void>((resolve) => {
      this.server.close(() => resolve());
    });
  }

  private async handleRequest(req: http.IncomingMessage, res: http.ServerResponse) {
    // Habilitar CORS simple
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.statusCode = 204;
      res.end();
      return;
    }

    if (req.url === '/chat' && req.method === 'POST') {
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', async () => {
        try {
          const { text, chatId } = JSON.parse(body);
          const response = await this.processChatRequest(text, chatId || 'cli_user');
          res.statusCode = 200;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ response }));
        } catch (e: any) {
          res.statusCode = 500;
          res.end(JSON.stringify({ error: e.message }));
        }
      });
    } else if (req.url === '/status') {
      const { StatusService } = await import('./services/status_service');
      const status = await StatusService.getFullStatus();
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify(status));
    } else {
      res.statusCode = 404;
      res.end();
    }
  }

  private async processChatRequest(text: string, chatId: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const requestId = uuidv4();

      // 1. Escuchar la respuesta del agente
      const onResponse = (event: any) => {
        if (event.payload.chatId === chatId) {
          eventBus.off('AGENT_RESPONSE', onResponse);
          resolve(event.payload.text);
        }
      };

      eventBus.on('AGENT_RESPONSE', onResponse);

      // Timeout de seguridad
      setTimeout(() => {
        eventBus.off('AGENT_RESPONSE', onResponse);
        reject(new Error('Kernel request timeout (60s)'));
      }, 60000);

      // 2. Emitir la solicitud al bus
      emitEvent({
        id: requestId,
        type: 'USER_REQUEST',
        timestamp: Date.now(),
        origin: 'cli_gateway',
        payload: { text, chatId }
      });
    });
  }
}

export const gateway = new Gateway();
