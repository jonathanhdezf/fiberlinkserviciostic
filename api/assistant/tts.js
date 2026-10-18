import { handleAssistantTts } from '../../server/controllers/assistantController.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    return res.end();
  }

  try {
    const text = req.query?.text || '';
    if (!text) {
      res.statusCode = 400;
      return res.end('Missing text parameter');
    }

    const tts = await handleAssistantTts(text);
    res.statusCode = tts.status || 200;
    res.setHeader('Content-Type', tts.contentType || 'audio/mpeg');
    res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=86400');
    return res.end(tts.buffer);
  } catch (error) {
    console.error('[TTS Endpoint Error]:', error);
    res.statusCode = 500;
    return res.end('TTS synthesis error: ' + error.message);
  }
}
