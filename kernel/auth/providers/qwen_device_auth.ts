// kernel/auth/providers/qwen_device_auth.ts
// Implementación de Device OAuth para Qwen (Alibaba Cloud).
// Flujo: Obtener código -> Usuario autoriza en navegador -> Polling para obtener token.

import { TokenStore } from '../token_store';

export class QwenDeviceAuth {
  private static CLIENT_ID = 'qwen-code'; // Client ID público para Charbi/OpenClaw

  /** Inicia el proceso de login interactivo */
  static async login(): Promise<any> {
    console.log('\n[QwenAuth] Iniciando flujo de dispositivo...');

    try {
      // 1. Solicitar Device Code
      const res = await fetch('https://chat.qwen.ai/oauth/device/code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ client_id: this.CLIENT_ID })
      });

      if (!res.ok) throw new Error(`HTTP error ${res.status}: ${await res.text()}`);

      const data: any = await res.json();

      console.log('\n========================================');
      console.log('       AUTORIZAR CHARBI (QWEN)');
      console.log('========================================');
      console.log('\n1. Abre esta URL en tu navegador:');
      console.log(`   ${data.verification_uri}`);
      console.log('\n2. Ingresa este código:');
      console.log(`   ${data.user_code}`);
      console.log('\n========================================\n');
      console.log('Esperando autorización del usuario...');

      // 2. Polling para obtener el token
      let attempts = 0;
      const interval = (data.interval || 5) * 1000;

      while (attempts < 60) { // Timeout de ~5 min
        await new Promise(r => setTimeout(r, interval));
        attempts++;

        const tokenRes = await fetch('https://chat.qwen.ai/oauth/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            device_code: data.device_code,
            grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
            client_id: this.CLIENT_ID // Algunos servidores lo requieren aquí también
          })
        });

        const tokenData: any = await tokenRes.json();

        if (tokenData.access_token) {
          TokenStore.save('qwen', tokenData);
          console.log('\n[QwenAuth] ¡Login exitoso! Token guardado.');
          return tokenData;
        }

        if (tokenData.error === 'access_denied') {
          console.error('\n[QwenAuth] El usuario denegó el acceso.');
          return null;
        }

        if (tokenData.error !== 'authorization_pending') {
          console.warn(`\n[QwenAuth] Estado inesperado: ${tokenData.error}`);
        }
      }

      console.error('\n[QwenAuth] Timeout esperando la autorización.');
      return null;

    } catch (e: any) {
      console.error('\n[QwenAuth] Error fatal durante el login:', e.message);
      return null;
    }
  }
}

export default QwenDeviceAuth;
