// charbi/kernel/workers/heavy_task.js
// Worker script — runs in a separate thread.
// Receives a task type + payload via parentPort, returns the result.

const { parentPort } = require('worker_threads');
const crypto = require('crypto');

parentPort.on('message', (msg) => {
  const { taskId, type, payload } = msg;

  try {
    let result;

    switch (type) {
      case 'hash': {
        // SHA-256 hash of payload string
        result = crypto.createHash('sha256').update(payload.data).digest('hex');
        break;
      }

      case 'hash-chain': {
        // Hash chain: hash N entries sequentially
        let hash = payload.seed || 'root';
        for (let i = 0; i < payload.count; i++) {
          hash = crypto.createHash('sha256').update(hash + payload.entries[i]).digest('hex');
        }
        result = hash;
        break;
      }

      case 'analysis': {
        // Static analysis: count lines, imports, exports in code
        const code = payload.code;
        const lines = code.split('\n').length;
        const imports = (code.match(/import\s/g) || []).length;
        const exports = (code.match(/export\s/g) || []).length;
        const functions = (code.match(/function\s/g) || []).length;
        result = { lines, imports, exports, functions };
        break;
      }

      case 'parse-json': {
        // Safe JSON parsing of large payloads
        result = JSON.parse(payload.raw);
        break;
      }

      default:
        throw new Error(`Unknown task type: ${type}`);
    }

    parentPort.postMessage({ taskId, success: true, result });
  } catch (e) {
    parentPort.postMessage({ taskId, success: false, error: e.message });
  }
});
