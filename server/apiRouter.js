// ==========================================
// FIBERLINK BACKEND API ROUTER
// Shared REST API Handler for Standalone Node & Vite Dev Server
// Storage: server/data/tickets.json
// ==========================================

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const DATA_DIR = path.join(__dirname, 'data');
export const DATA_FILE = path.join(DATA_DIR, 'tickets.json');

// Ensure data directory and file exist
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

if (!fs.existsSync(DATA_FILE)) {
  const initialTickets = [
    {
      id: '1712000000001',
      folio: 'FL-1001',
      estado: 'creación',
      name: 'Carlos Mendoza',
      phone: '2311029988',
      email: 'carlos.mendoza@email.com',
      company: 'Café La Sierra',
      address: 'Av. Juárez 45, Centro, Teziutlán',
      service: 'Punto de Venta POS',
      modality: 'En Sitio / Domicilio',
      priority: 'Alta',
      description: 'La impresora de tickets no responde tras apagón y el sistema marca error de comunicación COM3.',
      createdAt: new Date(Date.now() - 3600000 * 24).toISOString(),
      updatedAt: new Date(Date.now() - 3600000 * 24).toISOString(),
      bitacora: [
        {
          id: 'b1',
          date: new Date(Date.now() - 3600000 * 22).toISOString(),
          author: 'Mesa Técnica',
          note: 'Solicitud ingresada desde portal web. Se agenda visita técnica para revisión en sitio.'
        }
      ],
      pos: {
        items: [
          { concept: 'Diagnóstico en sitio de hardware POS', price: 250.00 }
        ],
        total: 250.00
      }
    },
    {
      id: '1712000000002',
      folio: 'FL-1002',
      estado: 'diagnostico',
      name: 'Dra. Elena Ramos',
      phone: '2311054433',
      email: 'clinica.ramos@gmail.com',
      company: 'Clínica Dental Ramos',
      address: 'Calle Hidalgo 12, Teziutlán',
      service: 'Redes / WiFi',
      modality: 'En Sitio / Domicilio',
      priority: 'Urgente',
      description: 'Caída de red WiFi en consultorios 2 y 3. El switch principal muestra luces rojas parpadeando.',
      createdAt: new Date(Date.now() - 3600000 * 18).toISOString(),
      updatedAt: new Date(Date.now() - 3600000 * 10).toISOString(),
      bitacora: [
        {
          id: 'b2',
          date: new Date(Date.now() - 3600000 * 12).toISOString(),
          author: 'Ing. Redes',
          note: 'Se detecta bucle de red por cable duplicado en recepción. Se procede a aislar el puerto.'
        }
      ],
      pos: {
        items: [
          { concept: 'Reconfiguración de red LAN y AP Ubiquiti', price: 450.00 }
        ],
        total: 450.00
      }
    },
    {
      id: '1712000000003',
      folio: 'FL-1003',
      estado: 'proceso',
      name: 'Miguel Ángel Torres',
      phone: '2311082211',
      email: 'm.torres@constructora.mx',
      company: 'Torres & Asociados',
      address: 'Plaza Crystal Local 8, Teziutlán',
      service: 'Videovigilancia CCTV',
      modality: 'En Sitio / Domicilio',
      priority: 'Normal',
      description: 'Instalación de 4 cámaras IP Hikvision y configuración de app móvil en celulares de gerencia.',
      createdAt: new Date(Date.now() - 3600000 * 48).toISOString(),
      updatedAt: new Date(Date.now() - 3600000 * 4).toISOString(),
      bitacora: [
        {
          id: 'b3',
          date: new Date(Date.now() - 3600000 * 30).toISOString(),
          author: 'Técnico CCTV',
          note: 'Cableado UTP categoría 6 terminado al 100%. Falta enfocar lente en cámara de estacionamiento.'
        }
      ],
      pos: {
        items: [
          { concept: 'Mano de obra instalación 4 cámaras IP', price: 1200.00 },
          { concept: 'Bobina UTP Cat6 100m + conectores', price: 850.00 }
        ],
        total: 2050.00
      }
    },
    {
      id: '1712000000004',
      folio: 'FL-1004',
      estado: 'resuelto',
      name: 'Lic. Patricia Vega',
      phone: '2311123344',
      email: 'patricia@notariavega.com',
      company: 'Notaría Pública No. 2',
      address: 'Allende 302, Teziutlán',
      service: 'Soporte técnico',
      modality: 'Remoto',
      priority: 'Normal',
      description: 'Mantenimiento preventivo, limpieza de temporales y renovación de antivirus en 3 equipos de oficina.',
      createdAt: new Date(Date.now() - 3600000 * 72).toISOString(),
      updatedAt: new Date(Date.now() - 3600000 * 20).toISOString(),
      bitacora: [
        {
          id: 'b4',
          date: new Date(Date.now() - 3600000 * 20).toISOString(),
          author: 'Mesa Técnica',
          note: 'Mantenimiento remoto completado exitosamente. Cliente confirma óptimo rendimiento.'
        }
      ],
      pos: {
        items: [
          { concept: 'Mantenimiento preventivo lógico x3 PCs', price: 600.00 }
        ],
        total: 600.00
      }
    }
  ];
  fs.writeFileSync(DATA_FILE, JSON.stringify(initialTickets, null, 2), 'utf-8');
}

export function readTickets() {
  try {
    const raw = fs.readFileSync(DATA_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch (e) {
    return [];
  }
}

export function writeTickets(tickets) {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(tickets, null, 2), 'utf-8');
  } catch (e) {
    console.error('[API Router] Error escribiendo tickets.json:', e);
  }
}

function sendJSON(res, statusCode, data) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With'
  });
  res.end(JSON.stringify(data));
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
      if (body.length > 1e6) { // 1MB limit
        req.destroy();
        reject(new Error('Payload Too Large'));
      }
    });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

/**
 * Handle API Request for both Standalone Node and Vite Dev Server
 */
export async function handleApiRequest(req, res, next) {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = url.pathname;
  const method = req.method;

  // Handle CORS preflight
  if (method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PATCH, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With'
    });
    return res.end();
  }

  // Only handle /api paths
  if (!pathname.startsWith('/api')) {
    if (typeof next === 'function') return next();
    return sendJSON(res, 404, { error: 'Not an API route' });
  }

  try {
    // 1. Healthcheck
    if (pathname === '/api/health' && method === 'GET') {
      return sendJSON(res, 200, {
        status: 'online',
        service: 'Fiberlink Ticket Backend',
        timestamp: new Date().toISOString(),
        version: '1.0.0',
        storage: DATA_FILE
      });
    }

    // 2. Ticket Statistics
    if (pathname === '/api/tickets/stats' && method === 'GET') {
      const tickets = readTickets();
      const stats = {
        total: tickets.length,
        creacion: tickets.filter(t => t.estado === 'creación').length,
        diagnostico: tickets.filter(t => t.estado === 'diagnostico').length,
        proceso: tickets.filter(t => t.estado === 'proceso').length,
        resuelto: tickets.filter(t => t.estado === 'resuelto').length,
        urgente: tickets.filter(t => t.priority === 'Urgente' && t.estado !== 'resuelto').length
      };
      return sendJSON(res, 200, stats);
    }

    // 3. List All Tickets (GET /api/tickets)
    if (pathname === '/api/tickets' && method === 'GET') {
      let tickets = readTickets();

      const estado = url.searchParams.get('estado');
      const priority = url.searchParams.get('priority');
      const q = url.searchParams.get('q');

      if (estado) {
        tickets = tickets.filter(t => t.estado === estado);
      }
      if (priority) {
        tickets = tickets.filter(t => t.priority === priority);
      }
      if (q) {
        const query = q.toLowerCase();
        tickets = tickets.filter(t =>
          (t.folio && t.folio.toLowerCase().includes(query)) ||
          (t.name && t.name.toLowerCase().includes(query)) ||
          (t.company && t.company.toLowerCase().includes(query)) ||
          (t.service && t.service.toLowerCase().includes(query)) ||
          (t.phone && t.phone.includes(query))
        );
      }

      // Sort newest first
      tickets.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      return sendJSON(res, 200, tickets);
    }

    // 4. Create New Ticket (POST /api/tickets)
    if (pathname === '/api/tickets' && method === 'POST') {
      const body = await parseBody(req);
      const tickets = readTickets();

      // Generate next folio FL-XXXX
      let maxNum = 1000;
      tickets.forEach(t => {
        if (t.folio) {
          const match = t.folio.match(/FL-(\d+)/);
          if (match) {
            const num = parseInt(match[1]);
            if (num > maxNum) maxNum = num;
          }
        }
      });
      const newFolio = `FL-${maxNum + 1}`;

      const newTicket = {
        id: Date.now().toString(),
        folio: newFolio,
        estado: 'creación',
        name: body.name || 'Cliente sin nombre',
        phone: body.phone || '',
        email: body.email || '',
        company: body.company || '',
        address: body.address || 'Soporte Remoto',
        service: body.service || 'Soporte técnico',
        modality: body.modality || 'En Sitio / Domicilio',
        priority: body.priority || 'Normal',
        description: body.description || '',
        source: body.source || 'Portal Web',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        bitacora: [
          {
            id: `b-${Date.now()}`,
            date: new Date().toISOString(),
            author: 'Sistema',
            note: 'Ticket registrado a través del portal de atención Fiberlink.'
          }
        ],
        pos: {
          items: [],
          total: 0
        }
      };

      tickets.unshift(newTicket);
      writeTickets(tickets);

      console.log(`[API Router] Nuevo ticket creado en backend: ${newFolio} (${newTicket.name})`);

      return sendJSON(res, 201, {
        success: true,
        message: 'Ticket creado exitosamente',
        ticket: newTicket
      });
    }

    // 5. Single Ticket Detail (GET /api/tickets/:id)
    const ticketIdMatch = pathname.match(/^\/api\/tickets\/([a-zA-Z0-9_-]+)$/);
    if (ticketIdMatch && method === 'GET') {
      const id = ticketIdMatch[1];
      const tickets = readTickets();
      const ticket = tickets.find(t => t.id === id || t.folio === id);
      if (!ticket) {
        return sendJSON(res, 404, { error: 'Ticket no encontrado' });
      }
      return sendJSON(res, 200, ticket);
    }

    // 6. Update Ticket Status / Properties (PATCH /api/tickets/:id)
    if (ticketIdMatch && method === 'PATCH') {
      const id = ticketIdMatch[1];
      const body = await parseBody(req);
      const tickets = readTickets();
      const index = tickets.findIndex(t => t.id === id || t.folio === id);

      if (index === -1) {
        return sendJSON(res, 404, { error: 'Ticket no encontrado' });
      }

      // Update fields
      const validStatuses = ['creación', 'diagnostico', 'proceso', 'resuelto'];
      if (body.estado && validStatuses.includes(body.estado)) {
        const prevStatus = tickets[index].estado;
        tickets[index].estado = body.estado;
        
        // Add log entry to bitacora
        tickets[index].bitacora = tickets[index].bitacora || [];
        tickets[index].bitacora.push({
          id: `b-${Date.now()}`,
          date: new Date().toISOString(),
          author: body.author || 'Técnico (Admin)',
          note: `Estado cambiado de "${prevStatus}" a "${body.estado}".`
        });
      }

      if (body.priority) tickets[index].priority = body.priority;
      if (body.description) tickets[index].description = body.description;
      if (body.address) tickets[index].address = body.address;
      if (body.phone) tickets[index].phone = body.phone;

      tickets[index].updatedAt = new Date().toISOString();
      writeTickets(tickets);

      return sendJSON(res, 200, {
        success: true,
        message: 'Ticket actualizado',
        ticket: tickets[index]
      });
    }

    // 7. Add Bitacora Note (POST /api/tickets/:id/bitacora)
    const bitacoraMatch = pathname.match(/^\/api\/tickets\/([a-zA-Z0-9_-]+)\/bitacora$/);
    if (bitacoraMatch && method === 'POST') {
      const id = bitacoraMatch[1];
      const body = await parseBody(req);
      const tickets = readTickets();
      const index = tickets.findIndex(t => t.id === id || t.folio === id);

      if (index === -1) {
        return sendJSON(res, 404, { error: 'Ticket no encontrado' });
      }

      if (!body.note || !body.note.trim()) {
        return sendJSON(res, 400, { error: 'La nota no puede estar vacía' });
      }

      const newNote = {
        id: `b-${Date.now()}`,
        date: new Date().toISOString(),
        author: body.author || 'Técnico (Admin)',
        note: body.note.trim()
      };

      tickets[index].bitacora = tickets[index].bitacora || [];
      tickets[index].bitacora.push(newNote);
      tickets[index].updatedAt = new Date().toISOString();
      writeTickets(tickets);

      return sendJSON(res, 201, {
        success: true,
        bitacora: tickets[index].bitacora,
        note: newNote,
        ticket: tickets[index]
      });
    }

    // 8. Update POS / Billing (POST /api/tickets/:id/pos)
    const posMatch = pathname.match(/^\/api\/tickets\/([a-zA-Z0-9_-]+)\/pos$/);
    if (posMatch && method === 'POST') {
      const id = posMatch[1];
      const body = await parseBody(req);
      const tickets = readTickets();
      const index = tickets.findIndex(t => t.id === id || t.folio === id);

      if (index === -1) {
        return sendJSON(res, 404, { error: 'Ticket no encontrado' });
      }

      tickets[index].pos = {
        items: Array.isArray(body.items) ? body.items : [],
        total: parseFloat(body.total) || 0
      };
      tickets[index].updatedAt = new Date().toISOString();
      writeTickets(tickets);

      return sendJSON(res, 200, {
        success: true,
        pos: tickets[index].pos,
        ticket: tickets[index]
      });
    }

    // 9. Delete Ticket (DELETE /api/tickets/:id)
    if (ticketIdMatch && method === 'DELETE') {
      const id = ticketIdMatch[1];
      let tickets = readTickets();
      const initialLen = tickets.length;
      tickets = tickets.filter(t => t.id !== id && t.folio !== id);

      if (tickets.length === initialLen) {
        return sendJSON(res, 404, { error: 'Ticket no encontrado' });
      }

      writeTickets(tickets);
      return sendJSON(res, 200, { success: true, message: 'Ticket eliminado' });
    }

    // 404 Not Found
    return sendJSON(res, 404, { error: 'Ruta no encontrada', path: pathname });

  } catch (error) {
    console.error('[API Router Error]:', error);
    return sendJSON(res, 500, { error: 'Error interno del servidor', details: error.message });
  }
}
