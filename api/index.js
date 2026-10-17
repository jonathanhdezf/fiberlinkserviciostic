import { handleApiRequest } from '../server/apiRouter.js';

export default async function handler(req, res) {
  try {
    await handleApiRequest(req, res);
  } catch (error) {
    console.error('[Vercel API Handler Error]:', error);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'Internal Server Error', message: error.message }));
  }
}
