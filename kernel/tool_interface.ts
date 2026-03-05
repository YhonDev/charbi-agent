// kernel/tool_interface.ts
// Interfaz para herramientas (tools) de Charbi.
// Permite definir schemas estructurados para el LLM.

export interface ToolParameter {
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  description: string;
  required?: boolean;
  [key: string]: any;
}

export interface ToolSchema {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, ToolParameter>;
    required: string[];
  };
}

export interface CharbiTool {
  schema: ToolSchema;
  /** El handler recibe los parámetros validados y el contexto de la skill */
  handler: (params: any, context?: any) => Promise<any>;
}

export default CharbiTool;
