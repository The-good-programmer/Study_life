/**
 * Gzips JSON answers of more than 1 KB when the browser accepts it (a sync pull of decks can be
 * megabytes, and shrinks to a fraction). Streams (the AI's answers as they're written) are sent as
 * they are. Works by holding the status and headers a route sets until its body is known.
 */

import zlib from 'node:zlib';

const MIN_BYTES = 1024;

export function enableCompression(req, res) {
  if (!/\bgzip\b/.test(String(req.headers['accept-encoding'] || ''))) return;

  const writeHead = res.writeHead.bind(res);
  const write = res.write.bind(res);
  const end = res.end.bind(res);
  let held = null; // [status, headers] set by the route, not sent yet

  const flush = () => {
    if (!held) return;
    const [status, headers] = held;
    held = null;
    writeHead(status, headers);
  };

  res.writeHead = (status, ...rest) => {
    const headers = rest.find((arg) => arg && typeof arg === 'object') || {};
    held = [status, headers];
    return res;
  };

  // A stream: send the headers as they are and stop compressing.
  res.write = (...args) => {
    flush();
    return write(...args);
  };

  res.end = (body, ...rest) => {
    const status = held ? held[0] : res.statusCode;
    const headers = held ? { ...held[1] } : {};
    const type = String(headers['Content-Type'] || headers['content-type'] || res.getHeader('Content-Type') || '');
    const size = typeof body === 'string' ? Buffer.byteLength(body) : Buffer.isBuffer(body) ? body.length : 0;
    if (!body || size < MIN_BYTES || !type.includes('application/json') || res.headersSent) {
      flush();
      return end(body, ...rest);
    }
    held = null;
    zlib.gzip(body, (err, zipped) => {
      if (err) {
        writeHead(status, headers);
        end(body);
        return;
      }
      writeHead(status, { ...headers, 'Content-Encoding': 'gzip', Vary: 'Accept-Encoding, Origin', 'Content-Length': zipped.length });
      end(zipped);
    });
    return res;
  };
}
