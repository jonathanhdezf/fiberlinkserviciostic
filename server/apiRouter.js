// ==========================================
// FIBERLINK UNIFIED REST API ROUTER (v2.0 ERP)
// Shared Handler for Standalone Node & Vite Dev Server
// Modules: Auth/Roles, Tickets, Store/Inventory, POS, Workshop, Reports
// ==========================================

import { DATA_DIR, FILES, readCollection, writeCollection } from './db/jsonStore.js';
import {
  extractCurrentUser,
  handleLogin,
  handleListUsers,
  handleCreateUser,
  handleUpdateUser,
  handleDeleteUser
} from './controllers/authController.js';
import {
  handleTicketStats,
  handleListTickets,
  handleGetTicket,
  handleCreateTicket,
  handleUpdateTicket,
  handleAddTicketBitacora,
  handleUpdateTicketPos,
  handleDeleteTicket
} from './controllers/ticketsController.js';
import {
  handleListProducts,
  handleCreateProduct,
  handleUpdateProduct,
  handleAdjustStock,
  handleListInventoryMovements,
  handleGetProductKardex,
  handleDeleteProduct
} from './controllers/storeController.js';
import {
  handleListSales,
  handleGetSale,
  handleCreateSale,
  handleCancelSale
} from './controllers/posController.js';
import {
  handleListWorkshop,
  handleGetWorkshopOrder,
  handleCreateWorkshopOrder,
  handleUpdateWorkshopOrder,
  handleAddWorkshopBitacora,
  handleUpdateWorkshopParts,
  handleDeleteWorkshopOrder
} from './controllers/workshopController.js';
import {
  handleListClients,
  handleGetClient,
  handleCreateClient,
  handleUpdateClient,
  handleDeleteClient,
  handleRegisterCreditMovement
} from './controllers/clientsController.js';
import {
  handleListShifts,
  handleOpenShift,
  handleAddCashMovement,
  handleListCashCuts,
  handleCreateCashCut
} from './controllers/shiftsController.js';
import {
  handleGetSettings,
  handleUpdateSettings,
  handleExportBackup,
  handleRestoreBackup
} from './controllers/settingsController.js';
import { handleGetReportsSummary } from './controllers/reportsController.js';
import {
  handleListChatLeads,
  handleCreateChatLead,
  handleUpdateChatLead,
  handleDeleteChatLead
} from './controllers/chatController.js';
import { handleAssistantChat } from './controllers/assistantController.js';

export { DATA_DIR };
export const DATA_FILE = FILES.tickets;

export function readTickets() {
  return readCollection('tickets');
}

export function writeTickets(tickets) {
  return writeCollection('tickets', tickets);
}

function sendJSON(res, statusCode, data) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
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
      if (body.length > 8e6) {
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

export async function handleApiRequest(req, res, next) {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = url.pathname;
  const method = req.method;

  // CORS Preflight
  if (method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PATCH, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With'
    });
    return res.end();
  }

  if (!pathname.startsWith('/api')) {
    if (typeof next === 'function') return next();
    return sendJSON(res, 404, { error: 'Not an API route' });
  }

  const currentUser = extractCurrentUser(req);

  try {
    // ==========================================
    // 1. HEALTHCHECK
    // ==========================================
    if (pathname === '/api/health' && method === 'GET') {
      return sendJSON(res, 200, {
        status: 'online',
        service: 'Fiberlink ERP & Control Backend',
        version: '2.0.0',
        timestamp: new Date().toISOString(),
        collections: Object.keys(FILES)
      });
    }

    // ==========================================
    // 2. AUTH & USERS (Roles)
    // ==========================================
    if (pathname === '/api/auth/login' && method === 'POST') {
      const body = await parseBody(req);
      const result = handleLogin(body);
      return sendJSON(res, result.status, result.data);
    }

    if (pathname === '/api/auth/me' && method === 'GET') {
      if (!currentUser) return sendJSON(res, 401, { error: 'Sesión no válida' });
      return sendJSON(res, 200, { user: currentUser });
    }

    if (pathname === '/api/users' && method === 'GET') {
      const result = handleListUsers();
      return sendJSON(res, result.status, result.data);
    }

    if (pathname === '/api/users' && method === 'POST') {
      const body = await parseBody(req);
      const result = handleCreateUser(body, currentUser);
      return sendJSON(res, result.status, result.data);
    }

    const userIdMatch = pathname.match(/^\/api\/users\/([a-zA-Z0-9_-]+)$/);
    if (userIdMatch && method === 'PATCH') {
      const body = await parseBody(req);
      const result = handleUpdateUser(userIdMatch[1], body, currentUser);
      return sendJSON(res, result.status, result.data);
    }
    if (userIdMatch && method === 'DELETE') {
      const result = handleDeleteUser(userIdMatch[1], currentUser);
      return sendJSON(res, result.status, result.data);
    }

    // ==========================================
    // 3. TICKETS MODULE
    // ==========================================
    if (pathname === '/api/tickets/stats' && method === 'GET') {
      const result = handleTicketStats();
      return sendJSON(res, result.status, result.data);
    }

    if (pathname === '/api/tickets' && method === 'GET') {
      const result = handleListTickets(url.searchParams);
      return sendJSON(res, result.status, result.data);
    }

    if (pathname === '/api/tickets' && method === 'POST') {
      const body = await parseBody(req);
      const result = handleCreateTicket(body, currentUser);
      return sendJSON(res, result.status, result.data);
    }

    const ticketBitacoraMatch = pathname.match(/^\/api\/tickets\/([a-zA-Z0-9_-]+)\/bitacora$/);
    if (ticketBitacoraMatch && method === 'POST') {
      const body = await parseBody(req);
      const result = handleAddTicketBitacora(ticketBitacoraMatch[1], body, currentUser);
      return sendJSON(res, result.status, result.data);
    }

    const ticketPosMatch = pathname.match(/^\/api\/tickets\/([a-zA-Z0-9_-]+)\/pos$/);
    if (ticketPosMatch && method === 'POST') {
      const body = await parseBody(req);
      const result = handleUpdateTicketPos(ticketPosMatch[1], body, currentUser);
      return sendJSON(res, result.status, result.data);
    }

    const ticketIdMatch = pathname.match(/^\/api\/tickets\/([a-zA-Z0-9_-]+)$/);
    if (ticketIdMatch && method === 'GET') {
      const result = handleGetTicket(ticketIdMatch[1]);
      return sendJSON(res, result.status, result.data);
    }
    if (ticketIdMatch && method === 'PATCH') {
      const body = await parseBody(req);
      const result = handleUpdateTicket(ticketIdMatch[1], body, currentUser);
      return sendJSON(res, result.status, result.data);
    }
    if (ticketIdMatch && method === 'DELETE') {
      const result = handleDeleteTicket(ticketIdMatch[1], currentUser);
      return sendJSON(res, result.status, result.data);
    }

    // ==========================================
    // 4. STORE & INVENTORY MODULE (Tienda, Almacén, Movimientos y Kardex)
    // ==========================================
    if (pathname === '/api/inventory/movements' && method === 'GET') {
      const result = handleListInventoryMovements(url.searchParams);
      return sendJSON(res, result.status, result.data);
    }

    const kardexMatch = pathname.match(/^\/api\/inventory\/kardex\/([a-zA-Z0-9_-]+)$/);
    if (kardexMatch && method === 'GET') {
      const result = handleGetProductKardex(kardexMatch[1]);
      return sendJSON(res, result.status, result.data);
    }

    if (pathname === '/api/products' && method === 'GET') {
      const result = handleListProducts(url.searchParams);
      return sendJSON(res, result.status, result.data);
    }

    if (pathname === '/api/products' && method === 'POST') {
      const body = await parseBody(req);
      const result = handleCreateProduct(body, currentUser);
      return sendJSON(res, result.status, result.data);
    }

    const prodStockMatch = pathname.match(/^\/api\/products\/([a-zA-Z0-9_-]+)\/stock$/);
    if (prodStockMatch && method === 'POST') {
      const body = await parseBody(req);
      const result = handleAdjustStock(prodStockMatch[1], body, currentUser);
      return sendJSON(res, result.status, result.data);
    }

    const prodIdMatch = pathname.match(/^\/api\/products\/([a-zA-Z0-9_-]+)$/);
    if (prodIdMatch && method === 'PATCH') {
      const body = await parseBody(req);
      const result = handleUpdateProduct(prodIdMatch[1], body, currentUser);
      return sendJSON(res, result.status, result.data);
    }
    if (prodIdMatch && method === 'DELETE') {
      const result = handleDeleteProduct(prodIdMatch[1], currentUser);
      return sendJSON(res, result.status, result.data);
    }

    // ==========================================
    // 5. POINT OF SALE MODULE (Punto de Venta)
    // ==========================================
    if (pathname === '/api/sales' && method === 'GET') {
      const result = handleListSales(url.searchParams);
      return sendJSON(res, result.status, result.data);
    }

    if (pathname === '/api/sales' && method === 'POST') {
      const body = await parseBody(req);
      const result = handleCreateSale(body, currentUser);
      return sendJSON(res, result.status, result.data);
    }

    const saleCancelMatch = pathname.match(/^\/api\/sales\/([a-zA-Z0-9_-]+)\/cancel$/);
    if (saleCancelMatch && method === 'POST') {
      const result = handleCancelSale(saleCancelMatch[1], currentUser);
      return sendJSON(res, result.status, result.data);
    }

    const saleIdMatch = pathname.match(/^\/api\/sales\/([a-zA-Z0-9_-]+)$/);
    if (saleIdMatch && method === 'GET') {
      const result = handleGetSale(saleIdMatch[1]);
      return sendJSON(res, result.status, result.data);
    }

    // ==========================================
    // 6. WORKSHOP MODULE (Taller Técnico)
    // ==========================================
    if (pathname === '/api/workshop' && method === 'GET') {
      const result = handleListWorkshop(url.searchParams);
      return sendJSON(res, result.status, result.data);
    }

    if (pathname === '/api/workshop' && method === 'POST') {
      const body = await parseBody(req);
      const result = handleCreateWorkshopOrder(body, currentUser);
      return sendJSON(res, result.status, result.data);
    }

    const wsBitacoraMatch = pathname.match(/^\/api\/workshop\/([a-zA-Z0-9_-]+)\/bitacora$/);
    if (wsBitacoraMatch && method === 'POST') {
      const body = await parseBody(req);
      const result = handleAddWorkshopBitacora(wsBitacoraMatch[1], body, currentUser);
      return sendJSON(res, result.status, result.data);
    }

    const wsPartsMatch = pathname.match(/^\/api\/workshop\/([a-zA-Z0-9_-]+)\/parts$/);
    if (wsPartsMatch && method === 'POST') {
      const body = await parseBody(req);
      const result = handleUpdateWorkshopParts(wsPartsMatch[1], body, currentUser);
      return sendJSON(res, result.status, result.data);
    }

    const wsIdMatch = pathname.match(/^\/api\/workshop\/([a-zA-Z0-9_-]+)$/);
    if (wsIdMatch && method === 'GET') {
      const result = handleGetWorkshopOrder(wsIdMatch[1]);
      return sendJSON(res, result.status, result.data);
    }
    if (wsIdMatch && method === 'PATCH') {
      const body = await parseBody(req);
      const result = handleUpdateWorkshopOrder(wsIdMatch[1], body, currentUser);
      return sendJSON(res, result.status, result.data);
    }
    if (wsIdMatch && method === 'DELETE') {
      const result = handleDeleteWorkshopOrder(wsIdMatch[1], currentUser);
      return sendJSON(res, result.status, result.data);
    }

    // ==========================================
    // 7. CLIENTS & CREDIT MODULE (Clientes y Créditos)
    // ==========================================
    if (pathname === '/api/clients' && method === 'GET') {
      const result = handleListClients(url.searchParams);
      return sendJSON(res, result.status, result.data);
    }

    if (pathname === '/api/clients' && method === 'POST') {
      const body = await parseBody(req);
      const result = handleCreateClient(body, currentUser);
      return sendJSON(res, result.status, result.data);
    }

    const clientCreditMatch = pathname.match(/^\/api\/clients\/([a-zA-Z0-9_-]+)\/credit$/);
    if (clientCreditMatch && method === 'POST') {
      const body = await parseBody(req);
      const result = handleRegisterCreditMovement(clientCreditMatch[1], body, currentUser);
      return sendJSON(res, result.status, result.data);
    }

    const clientIdMatch = pathname.match(/^\/api\/clients\/([a-zA-Z0-9_-]+)$/);
    if (clientIdMatch && method === 'GET') {
      const result = handleGetClient(clientIdMatch[1]);
      return sendJSON(res, result.status, result.data);
    }
    if (clientIdMatch && method === 'PATCH') {
      const body = await parseBody(req);
      const result = handleUpdateClient(clientIdMatch[1], body, currentUser);
      return sendJSON(res, result.status, result.data);
    }
    if (clientIdMatch && method === 'DELETE') {
      const result = handleDeleteClient(clientIdMatch[1], currentUser);
      return sendJSON(res, result.status, result.data);
    }

    // ==========================================
    // 8. SHIFTS & CASH CUTS MODULE (Cortes y Turnos)
    // ==========================================
    if (pathname === '/api/shifts' && method === 'GET') {
      const result = handleListShifts();
      return sendJSON(res, result.status, result.data);
    }

    if (pathname === '/api/shifts' && method === 'POST') {
      const body = await parseBody(req);
      const result = handleOpenShift(body, currentUser);
      return sendJSON(res, result.status, result.data);
    }

    const shiftMovMatch = pathname.match(/^\/api\/shifts\/([a-zA-Z0-9_-]+)\/movements$/);
    if (shiftMovMatch && method === 'POST') {
      const body = await parseBody(req);
      const result = handleAddCashMovement(shiftMovMatch[1], body, currentUser);
      return sendJSON(res, result.status, result.data);
    }

    if (pathname === '/api/cash-cuts' && method === 'GET') {
      const result = handleListCashCuts(url.searchParams);
      return sendJSON(res, result.status, result.data);
    }

    if (pathname === '/api/cash-cuts' && method === 'POST') {
      const body = await parseBody(req);
      const result = handleCreateCashCut(body, currentUser);
      return sendJSON(res, result.status, result.data);
    }

    // ==========================================
    // 9. SYSTEM SETTINGS & BACKUP (Módulo de Configuración)
    // ==========================================
    if (pathname === '/api/settings' && method === 'GET') {
      const result = handleGetSettings();
      return sendJSON(res, result.status, result.data);
    }

    if (pathname === '/api/settings' && (method === 'PATCH' || method === 'POST')) {
      const body = await parseBody(req);
      const result = handleUpdateSettings(body, currentUser);
      return sendJSON(res, result.status, result.data);
    }

    if (pathname === '/api/settings/backup' && method === 'GET') {
      const result = handleExportBackup();
      return sendJSON(res, result.status, result.data);
    }

    if (pathname === '/api/settings/restore' && method === 'POST') {
      const body = await parseBody(req);
      const result = handleRestoreBackup(body, currentUser);
      return sendJSON(res, result.status, result.data);
    }

    // ==========================================
    // 10. REPORTS & ACTIVITY LOGS
    // ==========================================
    if (pathname === '/api/reports/summary' && method === 'GET') {
      const result = handleGetReportsSummary(url.searchParams);
      return sendJSON(res, result.status, result.data);
    }

    if (pathname === '/api/activity' && method === 'GET') {
      const logs = readCollection('activity');
      return sendJSON(res, 200, logs.slice(0, 50));
    }

    // ==========================================
    // 11. CHAT WEB & WHATSAPP LEADS
    // ==========================================
    if (pathname === '/api/chat-leads' && method === 'GET') {
      const result = handleListChatLeads(url.searchParams);
      return sendJSON(res, result.status, result.data);
    }

    if (pathname === '/api/chat-leads' && method === 'POST') {
      const body = await parseBody(req);
      const result = handleCreateChatLead(body);
      return sendJSON(res, result.status, result.data);
    }

    const chatLeadIdMatch = pathname.match(/^\/api\/chat-leads\/([a-zA-Z0-9_-]+)$/);
    if (chatLeadIdMatch && method === 'PATCH') {
      const body = await parseBody(req);
      const result = handleUpdateChatLead(chatLeadIdMatch[1], body, currentUser);
      return sendJSON(res, result.status, result.data);
    }

    if (chatLeadIdMatch && method === 'DELETE') {
      const result = handleDeleteChatLead(chatLeadIdMatch[1], currentUser);
      return sendJSON(res, result.status, result.data);
    }

    // ==========================================
    // 12. ASISTENTE TÉCNICO VIRTUAL IA (GEMINI)
    // ==========================================
    if (pathname === '/api/assistant/chat' && method === 'POST') {
      const body = await parseBody(req);
      const result = await handleAssistantChat(body);
      return sendJSON(res, result.status, result.data);
    }

    return sendJSON(res, 404, { error: 'Ruta de API no encontrada', path: pathname });
  } catch (error) {
    console.error('[API Router Error]:', error);
    return sendJSON(res, 500, { error: 'Error interno del servidor', details: error.message });
  }
}
