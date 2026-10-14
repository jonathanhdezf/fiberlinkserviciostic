// ==========================================
// FIBERLINK STANDALONE BACKEND SERVER
// Port: 3001 | Storage: server/data/tickets.json
// Run with: npm run server
// ==========================================

import http from 'http';
import { handleApiRequest, DATA_FILE } from './apiRouter.js';

const PORT = process.env.PORT || 3001;
const HOST = process.env.HOST || '0.0.0.0';

const server = http.createServer(async (req, res) => {
  await handleApiRequest(req, res);
});

server.listen(PORT, HOST, () => {
  console.log(`[FIBERLINK BACKEND] Servidor ejecutándose en http://localhost:${PORT}`);
  console.log(`[STORAGE] Archivo de persistencia: ${DATA_FILE}`);
});
