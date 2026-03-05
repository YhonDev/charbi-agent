// kernel/cognition/memory_manager.ts
// Gestor de memoria persistente para Charbi.
// Permite guardar y recuperar fragmentos de información (Short-term / Long-term).

import fs from 'fs';
import path from 'path';

export interface MemoryEntry {
  id: string;
  timestamp: number;
  category: string;
  content: string;
  metadata?: any;
}

class MemoryManager {
  private memoryFilePath: string;
  private memories: MemoryEntry[] = [];

  constructor() {
    const charbiHome = process.env.CHARBI_HOME || path.join(require('os').homedir(), '.charbi-agent');
    this.memoryFilePath = path.join(charbiHome, 'memory', 'agent_memory.json');
    this.ensureDirectory();
    this.load();
  }

  private ensureDirectory() {
    const dir = path.dirname(this.memoryFilePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  }

  load() {
    if (fs.existsSync(this.memoryFilePath)) {
      try {
        this.memories = JSON.parse(fs.readFileSync(this.memoryFilePath, 'utf8'));
      } catch (e) {
        console.error('[MemoryManager] Error loading memory:', e);
        this.memories = [];
      }
    }
  }

  save() {
    try {
      fs.writeFileSync(this.memoryFilePath, JSON.stringify(this.memories, null, 2));
    } catch (e) {
      console.error('[MemoryManager] Error saving memory:', e);
    }
  }

  store(content: string, category: string = 'general', metadata: any = {}): string {
    const id = Math.random().toString(36).substring(2, 9);
    const entry: MemoryEntry = {
      id,
      timestamp: Date.now(),
      category,
      content,
      metadata
    };
    this.memories.push(entry);
    this.save();
    console.log(`[MemoryManager] Memorizado en ${category}: ${content.substring(0, 50)}...`);
    return id;
  }

  /** Búsqueda simple basada en palabras clave */
  search(query: string, limit: number = 5): MemoryEntry[] {
    const words = query.toLowerCase().split(/\s+/);
    return this.memories
      .filter(m => {
        const content = m.content.toLowerCase();
        return words.some(word => content.includes(word));
      })
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit);
  }

  delete(id: string): boolean {
    const initialLen = this.memories.length;
    this.memories = this.memories.filter(m => m.id !== id);
    if (this.memories.length !== initialLen) {
      this.save();
      return true;
    }
    return false;
  }

  list(category?: string): MemoryEntry[] {
    if (category) return this.memories.filter(m => m.category === category);
    return this.memories;
  }
}

export const memoryManager = new MemoryManager();
export default memoryManager;
