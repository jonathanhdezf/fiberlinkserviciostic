// ==========================================
// FIBERLINK BACKEND CONSTANTS & ROLES CONFIG
// ==========================================

export const ROLES = {
  ADMIN: 'admin',
  TECNICO: 'tecnico',
  VENTAS: 'ventas',
  RECEPCION: 'recepcion'
};

export const ROLE_PERMISSIONS = {
  [ROLES.ADMIN]: {
    label: 'Administrador General',
    modules: ['overview', 'tickets', 'workshop', 'pos', 'store', 'reports', 'users'],
    canDelete: true,
    canManageUsers: true,
    canEditInventory: true,
    canProcessSales: true
  },
  [ROLES.TECNICO]: {
    label: 'Técnico de Taller y Campo',
    modules: ['overview', 'tickets', 'workshop', 'pos', 'store', 'reports', 'users'],
    canDelete: false,
    canManageUsers: false,
    canEditInventory: false,
    canProcessSales: true
  },
  [ROLES.VENTAS]: {
    label: 'Cajero / Punto de Venta',
    modules: ['overview', 'pos', 'store', 'tickets', 'workshop', 'reports', 'users'],
    canDelete: false,
    canManageUsers: false,
    canEditInventory: true,
    canProcessSales: true
  },
  [ROLES.RECEPCION]: {
    label: 'Recepción y Mesa de Ayuda',
    modules: ['overview', 'tickets', 'workshop', 'pos', 'store', 'reports', 'users'],
    canDelete: false,
    canManageUsers: false,
    canEditInventory: false,
    canProcessSales: true
  }
};

export const TICKET_STATES = ['creación', 'diagnostico', 'proceso', 'resuelto'];

export const WORKSHOP_STATES = [
  'recepcion',
  'diagnostico',
  'esperando_refaccion',
  'en_reparacion',
  'listo_entrega',
  'entregado',
  'garantia'
];

export const PRODUCT_CATEGORIES = [
  { id: 'pos', label: 'Punto de Venta (POS)' },
  { id: 'cctv', label: 'Cámaras & Seguridad (CCTV)' },
  { id: 'redes', label: 'Redes & Fibra Óptica' },
  { id: 'software', label: 'Licencias & Software' },
  { id: 'refacciones', label: 'Refacciones & Cómputo' },
  { id: 'servicios', label: 'Servicios Técnicos' }
];

export const PAYMENT_METHODS = ['Efectivo', 'Tarjeta', 'Transferencia'];
