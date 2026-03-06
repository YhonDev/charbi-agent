// kernel/gateway.ts
import * as http from 'http';
import { v4 as uuidv4 } from 'uuid';
import { eventBus, EventType, emitEvent } from './event_bus';
import { TaskGraphEngine } from './task_graph/task_graph_engine';
import { log } from './logger';
import { DebugTracker } from './debug/debug_tracker';

export class Gateway {
  private static instance: Gateway;
  private server: http.Server;
  private port: number = 5005;

  private constructor() {
    this.server = http.createServer(this.handleRequest.bind(this));
    try {
      const { ConfigService } = require('./config_service');
      const gwConfig = ConfigService.getInstance().getGateway();
      if (gwConfig && gwConfig.port) {
        this.port = gwConfig.port;
      }
    } catch (e) {
      console.warn('[Gateway] Could not load port from config, using default 5005');
    }
  }

  public static getInstance(): Gateway {
    if (!Gateway.instance) {
      Gateway.instance = new Gateway();
    }
    return Gateway.instance;
  }

  async start() {
    return new Promise<void>((resolve, reject) => {
      this.server.on('error', (err: any) => {
        if (err.code === 'EADDRINUSE') {
          console.error(`[Gateway] FATAL: Port ${this.port} is already in use.`);
          reject(err);
        } else {
          reject(err);
        }
      });

      this.server.listen(this.port, '0.0.0.0', () => {
        console.log(`[Gateway] API listening on http://0.0.0.0:${this.port}`);
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
    res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
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
    } else if (req.url?.startsWith('/api/v1/debug/enable') && req.method === 'POST') {
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', async () => {
        try {
          const { duration } = JSON.parse(body);
          const durationMs = (duration || 60) * 1000;
          DebugTracker.getInstance().enable(durationMs);
          res.statusCode = 200;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({
            success: true,
            message: `Debug mode enabled for ${duration || 60} seconds`,
            activeUntil: new Date(Date.now() + durationMs).toISOString()
          }));
        } catch (e: any) {
          res.statusCode = 400;
          res.end(JSON.stringify({ error: 'Invalid duration or JSON' }));
        }
      });
    } else if (req.url?.startsWith('/api/v1/debug/flow') && req.method === 'GET') {
      const url = new URL(req.url, `http://${req.headers.host}`);
      const correlationId = url.searchParams.get('correlationId');
      const flow = DebugTracker.getInstance().getFlow(correlationId || 'unknown');
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify(flow));
    } else if (req.url === '/api/v1/debug/complexity' && req.method === 'POST') {
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', async () => {
        try {
          const { prompt, correlationId } = JSON.parse(body);
          const taskGraphEngine = (await import('./task_graph/task_graph_engine')).TaskGraphEngine.getInstance();
          const complexity = await taskGraphEngine.assessComplexity(prompt, correlationId || `debug_${Date.now()}`);
          res.statusCode = 200;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(complexity));
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

      const onResponse = (event: any) => {
        if (event.payload.chatId === chatId) {
          eventBus.off(EventType.AGENT_RESPONSE, onResponse);
          resolve(event.payload.text);
        }
      };

      eventBus.on(EventType.AGENT_RESPONSE, onResponse);

      setTimeout(() => {
        eventBus.off(EventType.AGENT_RESPONSE, onResponse);
        reject(new Error('Kernel request timeout (180s)'));
      }, 180000);

      emitEvent({
        id: requestId,
        type: EventType.USER_REQUEST,
        timestamp: Date.now(),
        origin: 'cli_gateway',
        payload: { text, chatId }
      });
    });
  }
}

export const gateway = Gateway.getInstance();
