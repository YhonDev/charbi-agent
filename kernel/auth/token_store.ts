// kernel/auth/token_store.ts
// Gestión de almacenamiento de tokens para Charbi.
// Guarda las credenciales en ~/.charbi-agent/auth/<provider>.json

import fs from 'fs';
import path from 'path';
import os from 'os';

const CHARBI_HOME = process.env.CHARBI_HOME || path.join(os.homedir(), '.charbi-agent');
const AUTH_DIR = path.join(CHARBI_HOME, 'auth');

export class TokenStore {
  /** Asegura que el directorio de autenticación exista */
  private static ensureDir() {
    if (!fs.existsSync(AUTH_DIR)) {
      fs.mkdirSync(AUTH_DIR, { recursive: true });
    }
  }

  /** Guarda los datos de autenticación de un proveedor */
  static save(provider: string, data: any) {
    this.ensureDir();
    const filePath = path.join(AUTH_DIR, `${provider.toLowerCase()}.json`);
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
    console.log(`[TokenStore] Saved credentials for: ${provider}`);
  }

  /** Carga los datos de autenticación de un proveedor */
  static load(provider: string): any | null {
    const filePath = path.join(AUTH_DIR, `${provider.toLowerCase()}.json`);
    if (!fs.existsSync(filePath)) return null;

    try {
      return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch (e) {
      console.error(`[TokenStore] Failed to load credentials for ${provider}:`, e);
      return null;
    }
  }

  /** Elimina las credenciales de un proveedor */
  static delete(provider: string) {
    const filePath = path.join(AUTH_DIR, `${provider.toLowerCase()}.json`);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      console.log(`[TokenStore] Deleted credentials for: ${provider}`);
    }
  }

  /** Lista los proveedores autenticados */
  static listProviders(): string[] {
    if (!fs.existsSync(AUTH_DIR)) return [];
    return fs.readdirSync(AUTH_DIR)
      .filter(f => f.endsWith('.json'))
      .map(f => f.replace('.json', ''));
  }
}

export default TokenStore;
