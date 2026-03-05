// skills/cognitive/tools/memory.search.ts
import { CharbiTool } from '../../../kernel/tool_interface';
import { memoryManager } from '../../../kernel/cognition/memory_manager';

const tool: CharbiTool = {
  schema: {
    name: 'search',
    description: 'Busca activamente en la memoria del agente por palabras clave.',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Palabras clave para buscar en los recuerdos.'
        }
      },
      required: ['query']
    }
  },
  handler: async (params: any) => {
    const { query } = params;
    const results = memoryManager.search(query);
    return { success: true, results };
  }
};

export default tool;
