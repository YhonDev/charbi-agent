// kernel/debug/debug_tracker.ts

export interface DebugEvent {
  timestamp: number;
  type: string;
  correlationId: string;
  payload: any;
  raw?: string;  // Para respuestas RAW del LLM
}

export class DebugTracker {
  private static instance: DebugTracker;
  private events: Map<string, DebugEvent[]> = new Map();
  private maxEventsPerCorrelation = 200;
  private isEnabled = false;
  private activeUntil = 0;

  private constructor() { }

  static getInstance(): DebugTracker {
    if (!DebugTracker.instance) {
      DebugTracker.instance = new DebugTracker();
    }
    return DebugTracker.instance;
  }

  enable(durationMs: number): void {
    this.isEnabled = true;
    this.activeUntil = Date.now() + durationMs;
    console.log(`[DebugTracker] Debug mode ENABLED for ${durationMs / 1000}s (until ${new Date(this.activeUntil).toLocaleTimeString()})`);
  }

  disable(): void {
    this.isEnabled = false;
    this.activeUntil = 0;
    console.log('[DebugTracker] Debug mode DISABLED');
  }

  track(event: DebugEvent): void {
    const { correlationId } = event;

    if (!this.events.has(correlationId)) {
      this.events.set(correlationId, []);
    }

    const flow = this.events.get(correlationId)!;
    flow.push(event);

    // Limitar memoria
    if (flow.length > this.maxEventsPerCorrelation) {
      flow.shift();
    }

    // Console log inmediato solo si está activo
    if (this.isEnabled && Date.now() < this.activeUntil) {
      console.log(`[DEBUG:${correlationId}] ${event.type}:`,
        event.raw ? event.raw.substring(0, 200) : JSON.stringify(event.payload).substring(0, 200));
    }
  }

  getFlow(correlationId: string): DebugEvent[] {
    return this.events.get(correlationId) || [];
  }

  getRawLLMResponse(correlationId: string): string | undefined {
    const flow = this.getFlow(correlationId);
    const llmEvent = flow.find(e => e.type === 'LLM_RAW_RESPONSE');
    return llmEvent?.raw;
  }

  clear(correlationId: string): void {
    this.events.delete(correlationId);
  }

  // Auto-clear after 15 minutes of inactivity
  cleanup(): void {
    const cutoff = Date.now() - 15 * 60 * 1000;

    for (const [corrId, events] of this.events.entries()) {
      const lastEvent = events[events.length - 1];
      if (lastEvent && lastEvent.timestamp < cutoff) {
        this.events.delete(corrId);
      }
    }
  }
}

// Auto-cleanup every 5 minutes
setInterval(() => DebugTracker.getInstance().cleanup(), 5 * 60 * 1000);
