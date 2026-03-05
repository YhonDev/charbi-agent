// skills/system/tools/read.ts
import { CharbiTool } from '../../../kernel/tool_interface';
import fs from 'fs';
import path from 'path';

const MAX_OUTPUT_LENGTH = 4096;

const tool: CharbiTool = {
  schema: {
    name: 'read',
    description: 'Lee el contenido de un archivo o lista los archivos de un directorio.',
    parameters: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'Ruta absoluta del archivo o directorio a leer.'
        }
      },
      required: ['path']
    }
  },
  handler: async (params: any) => {
    const { path: filePath } = params;
    try {
      if (!fs.existsSync(filePath)) {
        throw new Error(`La ruta no existe: ${filePath}`);
      }

      if (fs.statSync(filePath).isDirectory()) {
        const entries = fs.readdirSync(filePath, { withFileTypes: true });
        const listing = entries.map(e => ({
          name: e.name,
          type: e.isDirectory() ? 'directory' : 'file',
          size: e.isFile() ? fs.statSync(path.join(filePath, e.name)).size : undefined,
        }));
        return { success: true, type: 'directory', entries: listing };
      } else {
        const content = fs.readFileSync(filePath, 'utf8');
        const truncated = content.length > MAX_OUTPUT_LENGTH
          ? content.substring(0, MAX_OUTPUT_LENGTH) + '\n[...truncated]'
          : content;
        return { success: true, type: 'file', content: truncated, size: content.length };
      }
    } catch (e: any) {
      throw new Error(`Error leyendo ruta: ${e.message}`);
    }
  }
};

export default tool;
