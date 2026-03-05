// skills/cognitive/tools/memory.store.ts
import { CharbiTool } from '../../../kernel/tool_interface';
import { memoryManager } from '../../../kernel/cognition/memory_manager';

const tool: CharbiTool = {
  schema: {
    name: 'store',
    description: 'Guarda información importante en la memoria a largo plazo del agente.',
    parameters: {
      type: 'object',
      properties: {
        content: {
          type: 'string',
          description: 'La información o dato a recordar.'
        },
        category: {
          type: 'string',
          description: 'Categoría (ej: user_preference, project_status, fact).'
        }
      },
      required: ['content']
    }
  },
  handler: async (params: any) => {
    const { content, category } = params;
    const id = memoryManager.store(content, category || 'general');
    return { success: true, id, message: 'Información guardada en memoria.' };
  }
};

export default tool;
