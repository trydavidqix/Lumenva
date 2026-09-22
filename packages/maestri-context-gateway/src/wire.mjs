import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { createHash, randomBytes, X509Certificate } from 'node:crypto';
import { request } from 'node:https';
import { connect as tlsConnect } from 'node:tls';
import { ROOT } from './core.mjs';

const MAX_RESPONSE = 8 * 1024 * 1024;

function isLoopback(host) {
  return host === '127.0.0.1' || host === 'localhost' || host === '::1';
}

export function buildWireUrl(config, path, query = {}) {
  const url = new URL(`https://${config.host}:${config.port}${path}`);
  for (const [key, value] of Object.entries(query)) if (value != null) url.searchParams.set(key, value);
  return url;
}

export async function loadWireConfig(root = ROOT) {
  const path = `${root}/config/wire.json`;
  if (!existsSync(path)) throw new Error('Wire config missing');
  const config = JSON.parse(await readFile(path, 'utf8'));
  if (config.protocolVersion !== 1 || typeof config.host !== 'string' || !Number.isInteger(config.port) || typeof config.token !== 'string' || !config.token) throw new Error('invalid Wire config');
  if (!isLoopback(config.host) && !config.securityKeyHex) throw new Error('Wire certificate pin required for non-loopback host');
  return config;
}

export function acceptWireMutation(event, state, options = {}) {
  const current = state || { epoch: null, sequence: null };
  if (event.epoch !== current.epoch) {
    if (current.epoch !== null && options.snapshot !== true) return { accepted: false, resync_required: true, state: current };
    return { accepted: true, resync_required: false, state: { epoch: event.epoch, sequence: event.sequence ?? null } };
  }
  if (current.sequence != null && event.sequence <= current.sequence) return { accepted: false, resync_required: false, state: current };
  return { accepted: true, resync_required: false, state: { epoch: current.epoch, sequence: event.sequence ?? current.sequence } };
}

export function summarizeWireSnapshot(snapshot) {
  const terminals = (snapshot.items || []).filter(item => item?.kind === 'terminal' && item.terminal).map(item => ({
    id: item.terminal.id || item.terminal.terminalId || null,
    name: item.terminal.name || null,
    needs_attention: item.terminal.needsAttention === true,
  }));
  return {
    workspace_id: snapshot.workspaceId || snapshot.workspace?.id || null,
    terminal_count: terminals.length,
    attention_terminals: terminals.filter(terminal => terminal.needs_attention),
    received_at: new Date().toISOString(),
  };
}

function checkPin(socket, config) {
  if (!config.securityKeyHex) return;
  const peer = socket.getPeerCertificate();
  const actual = createHash('sha256').update(new X509Certificate(peer.raw).publicKey.export({ type: 'spki', format: 'der' })).digest('hex').toUpperCase();
  const expected = config.securityKeyHex.replaceAll(':', '').toUpperCase();
  if (actual !== expected) { socket.destroy(); throw new Error('Wire certificate pin mismatch'); }
}

export function wireRequest(config, path, { method = 'GET', body, query = {} } = {}) {
  return new Promise((resolve, reject) => {
    const url = buildWireUrl(config, path, query);
    const payload = body == null ? null : Buffer.from(JSON.stringify(body));
    const req = request(url, {
      method,
      agent: false,
      rejectUnauthorized: false,
      headers: {
        Connection: 'close',
        Authorization: `Bearer ${config.token}`,
        ...(payload ? {
          'content-type': 'application/json',
          'content-length': payload.length
        } : {})
      },
      timeout: 5000,
      checkServerIdentity: () => undefined
    }, response => {
      const chunks = []; let size = 0;
      response.on('data', chunk => { size += chunk.length; if (size <= MAX_RESPONSE) chunks.push(chunk); else req.destroy(new Error('Wire response exceeds 8 MiB')); });
      response.on('end', () => { try { const data = JSON.parse(Buffer.concat(chunks).toString('utf8')); if (response.statusCode < 200 || response.statusCode >= 300) reject(new Error(`Wire HTTP ${response.statusCode}: ${data?.error?.code || 'request failed'}`)); else resolve(data); } catch (error) { reject(error); } });
    });
    req.on('socket', socket => socket.once('secureConnect', () => { try { if (!config.securityKeyHex && !isLoopback(config.host)) throw new Error('Wire certificate pin required'); if (config.securityKeyHex) checkPin(socket, config); } catch (error) { req.destroy(error); } }));
    req.on('timeout', () => req.destroy(new Error('Wire request timeout')));
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

export async function wireSnapshot(config, workspaceId) {
  const [info, workspaces, feed] = await Promise.all([wireRequest(config, '/api/info'), wireRequest(config, '/api/workspaces'), wireRequest(config, `/api/workspaces/${workspaceId}/feed`)]);
  return { info: { protocolVersion: info.protocolVersion, capabilities: info.capabilities, role: info.role }, workspaces, feed, summary: summarizeWireSnapshot(feed) };
}

function frame(data, opcode = 1) {
  const payload = Buffer.from(data);
  const mask = randomBytes(4); const header = [];
  header.push(0x80 | opcode);
  if (payload.length < 126) header.push(0x80 | payload.length);
  else if (payload.length < 65536) header.push(0x80 | 126, payload.length >> 8, payload.length & 255);
  else throw new Error('Wire WebSocket frame too large');
  const masked = Buffer.alloc(payload.length); for (let i = 0; i < payload.length; i++) masked[i] = payload[i] ^ mask[i % 4];
  return Buffer.concat([Buffer.from(header), mask, masked]);
}

export function openWireFeed(config, workspaceId, onMessage) {
  return new Promise((resolve, reject) => {
    const key = randomBytes(16).toString('base64');
    const url = buildWireUrl(config, '/api/feed/stream', { ws: workspaceId, token: config.token });
    let closeResolve;
    const closed = new Promise(resolve => { closeResolve = resolve; });
    const socket = tlsConnect({ host: config.host, port: config.port, rejectUnauthorized: false, ...(isLoopback(config.host) ? {} : { servername: config.host }) }, () => {
      try { if (config.securityKeyHex) checkPin(socket, config); } catch (error) { reject(error); return; }
      socket.write(`GET ${url.pathname}${url.search} HTTP/1.1\r\nHost: ${config.host}:${config.port}\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Key: ${key}\r\nSec-WebSocket-Version: 13\r\n\r\n`);
    });
    let buffer = Buffer.alloc(0); let handshake = false; let settled = false;
    const fail = error => { if (!settled) { settled = true; reject(error); } };
    socket.on('error', fail);
    socket.on('data', chunk => {
      buffer = Buffer.concat([buffer, chunk]);
      if (!handshake) {
        const end = buffer.indexOf('\r\n\r\n');
        if (end < 0) return;
        const headers = buffer.subarray(0, end).toString('ascii');
        if (!/^HTTP\/1\.1 101 /.test(headers)) return fail(new Error('Wire WebSocket upgrade failed'));
        const accept = headers.match(/^Sec-WebSocket-Accept:\s*(.+)$/im)?.[1]?.trim();
        const expected = createHash('sha1').update(`${key}258EAFA5-E914-47DA-95CA-C5AB0DC85B11`).digest('base64');
        if (accept !== expected) return fail(new Error('Wire WebSocket accept mismatch'));
        handshake = true;
        buffer = buffer.subarray(end + 4);
        if (!settled) { settled = true; resolve({ close: () => socket.end(), send: message => socket.write(frame(JSON.stringify(message), 1)), closed }); }
      }
      while (buffer.length >= 2) {
        const first = buffer[0]; const second = buffer[1]; const opcode = first & 15; let length = second & 127; let offset = 2;
        if (length === 126) { if (buffer.length < 4) return; length = buffer.readUInt16BE(2); offset = 4; }
        if (length === 127 || buffer.length < offset + length) return;
        const payload = buffer.subarray(offset, offset + length); buffer = buffer.subarray(offset + length);
        if (opcode === 1) { try { onMessage(JSON.parse(payload.toString('utf8'))); } catch { onMessage({ type: 'invalid' }); } }
        else if (opcode === 9) socket.write(frame(payload, 10));
        else if (opcode === 8) socket.end();
      }
    });
    socket.on('close', () => closeResolve());
  });
}
