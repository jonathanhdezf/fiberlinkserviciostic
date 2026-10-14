import { resolve } from 'path';
import { defineConfig } from 'vite';
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

export default defineConfig({
  base: '/',
  plugins: [fiberlinkApiPlugin()],
  server: {
    port: 5173
  },
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        admin: resolve(__dirname, 'admin.html')
      }
    }
  }
});
