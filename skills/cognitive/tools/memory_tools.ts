// skills/cognitive/tools/memory_tools.ts
import { CharbiTool } from '../../../kernel/tool_interface';
import { memoryClient } from '../../../kernel/cognition/memory_client';

export const brainRecall: CharbiTool = {
  schema: {
    name: "brain_recall",
    description: "Realiza una búsqueda híbrida profunda (semántica + estructural) sobre un tema en la memoria de Charbi.",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", description: "Lo que deseas recordar o buscar" },
        k: { type: "number", description: "Cantidad de resultados semánticos", default: 5 }
      },
      required: ["query"]
    }
  },
  handler: async (params: any) => {
    try {
      // Nota: En una implementación de producción, aquí llamaríamos a un servicio de embeddings
      // para convertir params.query en un vector. Por ahora, el MemoryServer simulará
      // o usará un placeholder si no hay servicio de embeddings activo.

      // Placeholder vectorial (384 dims para MiniLM o similar)
      const mockVector = new Array(384).fill(0).map(() => Math.random());

      const results = await memoryClient.call('memory.search', {
        vector: mockVector,
        text: params.query,
        k: params.k || 5
      });

      return { success: true, results };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  }
};

export default [brainRecall];
