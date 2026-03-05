// skills/system/tools/search.ts
import { CharbiTool } from '../../../kernel/tool_interface';
import https from 'https';

const tool: CharbiTool = {
  schema: {
    name: 'search',
    description: 'Realiza una búsqueda en la web (DuckDuckGo) y devuelve snippets de información.',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'La consulta de búsqueda.'
        }
      },
      required: ['query']
    }
  },
  handler: async (params: any) => {
    const { query } = params;
    return new Promise((resolve, reject) => {
      const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
      const options = {
        headers: { 'User-Agent': 'Mozilla/5.0' }
      };

      https.get(searchUrl, options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          const results: { title: string; link: string; snippet: string }[] = [];
          const regex = /<a class="result__a" href="([^"]+)">([\s\S]*?)<\/a>[\s\S]*?<a class="result__snippet"[\s\S]*?>([\s\S]*?)<\/a>/g;

          let match;
          while ((match = regex.exec(data)) !== null && results.length < 5) {
            results.push({
              title: match[2].replace(/<[^>]*>/g, '').trim(),
              link: match[1],
              snippet: match[3].replace(/<[^>]*>/g, '').trim()
            });
          }

          if (results.length === 0 && data.includes('No results')) {
            resolve({ success: true, results: [], message: 'No se encontraron resultados.' });
          } else {
            resolve({ success: true, results });
          }
        });
      }).on('error', e => reject(new Error(`Error de búsqueda: ${e.message}`)));
    });
  }
};

export default tool;
