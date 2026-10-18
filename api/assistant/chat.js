import { handleAssistantChat } from '../../server/controllers/assistantController.js';

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    return res.end();
  }

  if (req.method !== 'POST') {
    res.statusCode = 405;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({ error: 'Method Not Allowed' }));
  }

  try {
    let body = req.body;
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch (_) {
        body = {};
      }
    }
    if (!body || typeof body !== 'object') {
      body = {};
    }

    const result = await handleAssistantChat(body);
    const statusCode = result.status || 200;

    if (typeof res.status === 'function' && typeof res.json === 'function') {
      return res.status(statusCode).json(result.data);
    }

    res.statusCode = statusCode;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.end(JSON.stringify(result.data));
  } catch (error) {
    console.error('[Vercel Assistant API Error]:', error);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({ error: 'Error interno del asistente', details: error.message }));
  }
}
