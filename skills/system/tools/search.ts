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
    const { AuthManager } = await import('../../../kernel/auth/auth_manager');
    const tavilyKey = AuthManager.getToken('tavily');

    if (tavilyKey) {
      console.log('[Search] Using Tavily API...');
      try {
        const response = await fetch('https://api.tavily.com/search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            api_key: tavilyKey,
            query,
            search_depth: 'advanced',
            max_results: 5
          })
        });
        const data = await response.json();
        if (data.results) {
          return {
            success: true,
            results: data.results.map((r: any) => ({
              title: r.title,
              link: r.url,
              snippet: r.content
            }))
          };
        }
      } catch (e: any) {
        console.warn('[Search] Tavily failed, falling back to Scraper:', e.message);
      }
    }

    // FALLBACK: DuckDuckGo Scraper
    console.log('[Search] Using DuckDuckGo Scraper...');
    return new Promise((resolve, reject) => {
      const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
      const options = {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36' },
        timeout: 15000
      };

      const req = https.get(searchUrl, options, (res) => {
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

          if (results.length === 0) {
            resolve({ success: true, results: [], message: 'No se encontraron resultados en Scraper.' });
          } else {
            resolve({ success: true, results });
          }
        });
      });

      req.on('error', e => resolve({ success: false, error: `Error de red: ${e.message}` }));
      req.on('timeout', () => { req.destroy(); resolve({ success: false, error: 'Timeout de búsqueda agotado.' }); });
    });
  }
};

export default tool;
