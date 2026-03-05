// skills/cognitive/tools/graph_tools.ts
import { CharbiTool } from '../../../kernel/tool_interface';
import { memoryClient } from '../../../kernel/cognition/memory_client';

export const addRelation: CharbiTool = {
  schema: {
    name: "add_relation",
    description: "Añade una relación estructurada al grafo de conocimiento (Sujeto -> Relación -> Objeto).",
    parameters: {
      type: "object",
      properties: {
        subject: { type: "string", description: "El sujeto de la relación (ej: 'Yhon')" },
        relation: { type: "string", description: "El verbo o relación (ej: 'desarrolla')" },
        object: { type: "string", description: "El objeto de la relación (ej: 'Charbi')" },
        metadata: { type: "object", description: "Contexto adicional opcional" }
      },
      required: ["subject", "relation", "object"]
    }
  },
  handler: async (params: any) => {
    try {
      await memoryClient.call('graph.add_relation', params);
      return { success: true, message: `Relación guardada: ${params.subject} --${params.relation}--> ${params.object}` };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  }
};

export const queryGraph: CharbiTool = {
  schema: {
    name: "query_graph",
    description: "Consulta el grafo de conocimiento para buscar relaciones por entidad o tipo de relación.",
    parameters: {
      type: "object",
      properties: {
        entity: { type: "string", description: "Nombre de la entidad a buscar" },
        relation: { type: "string", description: "Tipo de relación a filtrar" }
      }
    }
  },
  handler: async (params: any) => {
    try {
      const results = await memoryClient.call('graph.query', params);
      return { success: true, count: results.length, relationships: results };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  }
};

export default [addRelation, queryGraph];
