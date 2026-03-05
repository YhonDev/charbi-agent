// skills/system/tools/filesystem.write.ts
import { CharbiTool } from '../../../kernel/tool_interface';
import fs from 'fs';
import path from 'path';

const tool: CharbiTool = {
  schema: {
    name: 'write',
    description: 'Escribe contenido en un archivo del sistema.',
    parameters: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'Ruta absoluta del archivo a escribir.'
        },
        content: {
          type: 'string',
          description: 'Contenido a escribir en el archivo.'
        }
      },
      required: ['path', 'content']
    }
  },
  handler: async (params: any) => {
    const { path: filePath, content } = params;
    try {
      const dir = path.dirname(filePath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(filePath, content, 'utf8');
      return { success: true, path: filePath, bytesWritten: Buffer.byteLength(content) };
    } catch (e: any) {
      throw new Error(`Error escribiendo archivo: ${e.message}`);
    }
  }
};

export default tool;
