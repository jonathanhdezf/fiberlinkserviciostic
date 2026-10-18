import { resolve } from 'path';
import { defineConfig, loadEnv } from 'vite';
import { handleApiRequest } from './server/apiRouter.js';

function fiberlinkApiPlugin() {
  return {
    name: 'fiberlink-api-server',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (req.url && (req.url === '/api' || req.url.startsWith('/api/') || req.url.startsWith('/api?'))) {
          try {
            await handleApiRequest(req, res, next);
          } catch (err) {
            console.error('[Vite API Middleware Error]:', err);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: err.message }));
          }
        } else {
          next();
        }
      });
    }
  };
}

export default defineConfig(({ mode }) => {
  // Variables privadas del servidor (GEMINI_API_KEY) — no usan prefijo VITE_, por lo que no llegan al navegador
  const env = loadEnv(mode, process.cwd(), '');
  ['GEMINI_API_KEY', 'GEMINI_MODEL'].forEach((key) => {
    if (env[key] && !process.env[key]) process.env[key] = env[key];
  });

  return {
  base: '/',
  plugins: [fiberlinkApiPlugin()],
  server: {
    port: 5173
  },
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        admin: resolve(__dirname, 'admin.html'),
        soluciones: resolve(__dirname, 'soluciones.html'),
        catalogo: resolve(__dirname, 'catalogo.html'),
        ticket: resolve(__dirname, 'ticket.html')
      }
    }
  }
  };
});
