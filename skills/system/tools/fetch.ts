// skills/system/tools/fetch.ts
import { CharbiTool } from '../../../kernel/tool_interface';
import https from 'https';
import http from 'http';

const MAX_OUTPUT_LENGTH = 4096;

const tool: CharbiTool = {
  schema: {
    name: 'fetch',
    description: 'Accede a una URL y devuelve el contenido (HTML/JSON/Texto). Útil para scraping.',
    parameters: {
      type: 'object',
      properties: {
        url: {
          type: 'string',
          description: 'La URL absoluta a la que acceder.'
        }
      },
      required: ['url']
    }
  },
  handler: async (params: any) => {
    const { url } = params;
    return new Promise((resolve, reject) => {
      try {
        const parsedUrl = new URL(url);
        const transport = parsedUrl.protocol === 'https:' ? https : http;

        const options = {
          headers: { 'User-Agent': 'Charbi-Agent/1.0' },
          timeout: 10000
        };

        transport.get(url, options, (res) => {
          let data = '';
          res.on('data', chunk => data += chunk);
          res.on('end', () => {
            const truncated = data.length > MAX_OUTPUT_LENGTH
              ? data.substring(0, MAX_OUTPUT_LENGTH) + '\n[...truncated]'
              : data;
            resolve({ success: true, status: res.statusCode, content: truncated });
          });
        }).on('error', e => reject(new Error(`Error de red: ${e.message}`)));
      } catch (e: any) {
        reject(new Error(`URL inválida: ${e.message}`));
      }
    });
  }
};

export default tool;
