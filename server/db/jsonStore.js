// ==========================================
// FIBERLINK JSON DATABASE ENGINE
// Storage directory: server/data/
// Collections: users, tickets, products, sales, workshop, activity
// ==========================================

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { ROLES } from '../config/constants.js';

import os from 'os';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// In Vercel serverless environment, local filesystem outside /tmp is read-only
const isVercel = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
export const BUNDLED_DATA_DIR = path.join(__dirname, '..', 'data');
export const DATA_DIR = isVercel ? path.join(os.tmpdir(), 'fiberlink-data') : BUNDLED_DATA_DIR;

export const FILES = {
  users: path.join(DATA_DIR, 'users.json'),
  clients: path.join(DATA_DIR, 'clients.json'),
  tickets: path.join(DATA_DIR, 'tickets.json'),
  products: path.join(DATA_DIR, 'products.json'),
  inventoryMovements: path.join(DATA_DIR, 'inventory_movements.json'),
  sales: path.join(DATA_DIR, 'sales.json'),
  shifts: path.join(DATA_DIR, 'shifts.json'),
  cashCuts: path.join(DATA_DIR, 'cash_cuts.json'),
  workshop: path.join(DATA_DIR, 'workshop.json'),
  settings: path.join(DATA_DIR, 'settings.json'),
  activity: path.join(DATA_DIR, 'activity.json')
};

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  } catch (e) {
    console.warn('[jsonStore] Could not create DATA_DIR:', e.message);
  }
}

// ==========================================
// INITIAL SEED DATA
// ==========================================
const SEED_USERS = [
  {
    id: 'u-admin',
    username: 'admin',
    password: 'admin123',
    name: 'Ing. Roberto Méndez',
    role: ROLES.ADMIN,
    email: 'admin@fiberlink.mx',
    phone: '2311024672',
    specialty: 'Dirección General & Redes',
    active: true,
    createdAt: '2026-01-01T09:00:00.000Z'
  },
  {
    id: 'u-tec1',
    username: 'tecnico',
    password: 'tec123',
    name: 'Ing. Alejandro Luna',
    role: ROLES.TECNICO,
    email: 'soporte@fiberlink.mx',
    phone: '2311158890',
    specialty: 'Taller Electrónico & CCTV',
    active: true,
    createdAt: '2026-01-10T09:00:00.000Z'
  },
  {
    id: 'u-tec2',
    username: 'redes',
    password: 'redes123',
    name: 'Téc. Daniel Ortega',
    role: ROLES.TECNICO,
    email: 'redes@fiberlink.mx',
    phone: '2311203344',
    specialty: 'Fibra Óptica & MikroTik/Ubiquiti',
    active: true,
    createdAt: '2026-02-01T09:00:00.000Z'
  },
  {
    id: 'u-ventas',
    username: 'caja',
    password: 'caja123',
    name: 'Lic. Sofía Navarro',
    role: ROLES.VENTAS,
    email: 'ventas@fiberlink.mx',
    phone: '2311097711',
    specialty: 'Mostrador, POS & Facturación',
    active: true,
    createdAt: '2026-02-15T09:00:00.000Z'
  },
  {
    id: 'u-recep',
    username: 'recepcion',
    password: 'recep123',
    name: 'Mariana Salazar',
    role: ROLES.RECEPCION,
    email: 'atencion@fiberlink.mx',
    phone: '2311045566',
    specialty: 'Mesa de Ayuda & Ingreso a Taller',
    active: true,
    createdAt: '2026-03-01T09:00:00.000Z'
  }
];

const SEED_PRODUCTS = [
  {
    id: 'prod-101',
    sku: 'POS-CAJ-01',
    name: 'Cajón de Dinero Automático Metálico RJ11',
    category: 'pos',
    cost: 680.00,
    price: 1150.00,
    stock: 14,
    minStock: 4,
    unit: 'pza',
    isService: false,
    publicVisible: true,
    description: 'Cajón metálico de uso rudo con 5 divisiones de billetes, 8 de monedas y apertura automática RJ11.',
    specs: ['5 billetes / 8 monedas', 'Interfaz RJ11 a impresora', 'Cerradura de 3 posiciones']
  },
  {
    id: 'prod-102',
    sku: 'POS-IMP-58',
    name: 'Impresora Térmica de Tickets 58mm USB',
    category: 'pos',
    cost: 490.00,
    price: 890.00,
    stock: 9,
    minStock: 3,
    unit: 'pza',
    isService: false,
    publicVisible: true,
    description: 'Impresora térmica directa sin tinta de 58mm, alta velocidad 90mm/s compatible con Windows y POS.',
    specs: ['Térmica directa 58mm', 'Puerto USB + RJ11 para cajón', 'Compatible con Eleventa y Loyverse']
  },
  {
    id: 'prod-103',
    sku: 'POS-IMP-80',
    name: 'Impresora Térmica 80mm Autocorte USB + LAN',
    category: 'pos',
    cost: 1250.00,
    price: 1980.00,
    stock: 6,
    minStock: 2,
    unit: 'pza',
    isService: false,
    publicVisible: true,
    description: 'Impresora de tickets 80mm con cortador automático de guillotina y doble interfaz USB + Red Ethernet.',
    specs: ['Ancho 80mm con autocorte', 'USB + Ethernet LAN', 'Velocidad 260mm/s']
  },
  {
    id: 'prod-104',
    sku: 'POS-LEC-2D',
    name: 'Lector de Código de Barras 1D/2D QR Inalámbrico',
    category: 'pos',
    cost: 520.00,
    price: 950.00,
    stock: 11,
    minStock: 3,
    unit: 'pza',
    isService: false,
    publicVisible: true,
    description: 'Escáner omnidireccional e inalámbrico 2.4GHz + USB capaz de leer códigos en papel y pantallas de celular.',
    specs: ['Lectura 1D, 2D y QR', 'Inalámbrico 2.4GHz + cable USB', 'Batería de larga duración']
  },
  {
    id: 'prod-105',
    sku: 'CCTV-HIK-2MP',
    name: 'Cámara Bala Hikvision Full HD 1080p ColorVu',
    category: 'cctv',
    cost: 480.00,
    price: 850.00,
    stock: 18,
    minStock: 6,
    unit: 'pza',
    isService: false,
    publicVisible: true,
    description: 'Cámara de videovigilancia exterior IP67 con visión nocturna a todo color ColorVu 24/7.',
    specs: ['Resolución 2MP 1080p', 'Visión nocturna a color 20m', 'Protección intemperie IP67']
  },
  {
    id: 'prod-106',
    sku: 'CCTV-KIT-4CH',
    name: 'Kit DVR 4 Canales + 4 Cámaras HD + Disco 1TB',
    category: 'cctv',
    cost: 2950.00,
    price: 4650.00,
    stock: 3,
    minStock: 2,
    unit: 'kit',
    isService: false,
    publicVisible: true,
    description: 'Paquete completo de seguridad con grabación continua y visualización en celular iOS/Android.',
    specs: ['DVR 4CH pentahíbrido H.265+', '4 cámaras 1080p exterior/interior', 'Disco Duro 1TB vigilancia incluido']
  },
  {
    id: 'prod-107',
    sku: 'NET-UTP-CAT6',
    name: 'Bobina Cable UTP Cat6 100% Cobre (Metro)',
    category: 'redes',
    cost: 7.50,
    price: 15.00,
    stock: 280,
    minStock: 50,
    unit: 'metro',
    isService: false,
    publicVisible: true,
    description: 'Cable de red categoría 6 certificado 100% cobre para enlaces gigabit y PoE estable.',
    specs: ['100% Cobre calibre 23 AWG', 'Soporta Gigabit y PoE', 'Venta por metro o bobina']
  },
  {
    id: 'prod-108',
    sku: 'NET-AP-U6',
    name: 'Access Point Ubiquiti UniFi U6+ Dual Band WiFi 6',
    category: 'redes',
    cost: 1980.00,
    price: 2890.00,
    stock: 2,
    minStock: 3,
    unit: 'pza',
    isService: false,
    publicVisible: true,
    description: 'Punto de acceso empresarial WiFi 6 de alta densidad para hoteles, clínicas y oficinas.',
    specs: ['WiFi 6 MIMO 2x2', 'Soporta +300 clientes concurrentes', 'Alimentación PoE']
  },
  {
    id: 'prod-109',
    sku: 'SW-WIN11-PRO',
    name: 'Licencia Original Windows 11 Pro OEM Vitalicia',
    category: 'software',
    cost: 280.00,
    price: 650.00,
    stock: 25,
    minStock: 5,
    unit: 'licencia',
    isService: false,
    publicVisible: true,
    description: 'Activación genuina permanente para equipos de trabajo con soporte de dominio y BitLocker.',
    specs: ['100% Original activación directa', 'Actualizaciones oficiales Microsoft', '1 PC Permanente']
  },
  {
    id: 'prod-110',
    sku: 'SW-POS-PRO',
    name: 'Sistema Punto de Venta Local (Licencia Vitalicia)',
    category: 'software',
    cost: 350.00,
    price: 1200.00,
    stock: 50,
    minStock: 5,
    unit: 'licencia',
    isService: false,
    publicVisible: true,
    description: 'Software de control de ventas, inventarios, corte de caja, clientes y tickets sin rentas mensuales.',
    specs: ['Control de inventario y alertas', 'Multicaja y corte por turno', 'Sin anualidades forzosas']
  },
  {
    id: 'prod-111',
    sku: 'REF-SSD-480',
    name: 'Unidad de Estado Sólido SSD 480GB Kingston SATA III',
    category: 'refacciones',
    cost: 520.00,
    price: 890.00,
    stock: 2,
    minStock: 4,
    unit: 'pza',
    isService: false,
    publicVisible: true,
    description: 'Reemplazo de alta velocidad para acelerar laptops y PCs de escritorio hasta 10x.',
    specs: ['480GB SATA 3 6Gb/s', 'Lectura 500MB/s', '3 años de garantía']
  },
  {
    id: 'prod-112',
    sku: 'REF-RAM-8G',
    name: 'Memoria RAM DDR4 8GB 3200MHz SODIMM Laptop',
    category: 'refacciones',
    cost: 340.00,
    price: 620.00,
    stock: 7,
    minStock: 3,
    unit: 'pza',
    isService: false,
    publicVisible: true,
    description: 'Módulo de memoria RAM DDR4 para actualización de portátiles y Mini PCs.',
    specs: ['8GB DDR4 3200MHz', 'Bajo voltaje 1.2V', 'Compatible Intel y AMD']
  },
  {
    id: 'prod-113',
    sku: 'SRV-MANT-PC',
    name: 'Mantenimiento Preventivo Completo (Físico + Lógico)',
    category: 'servicios',
    cost: 50.00,
    price: 350.00,
    stock: 999,
    minStock: 0,
    unit: 'servicio',
    isService: true,
    publicVisible: true,
    description: 'Limpieza interna ultrasónica, cambio de pasta térmica de alta conductividad y optimización de sistema.',
    specs: ['Pasta térmica Arctic MX-4', 'Limpieza de ventilación', 'Optimización de arranque']
  },
  {
    id: 'prod-114',
    sku: 'SRV-DIAG-SITIO',
    name: 'Diagnóstico Técnico en Sitio / Domicilio (Teziutlán)',
    category: 'servicios',
    cost: 50.00,
    price: 250.00,
    stock: 999,
    minStock: 0,
    unit: 'servicio',
    isService: true,
    publicVisible: true,
    description: 'Visita técnica para revisión de red, punto de venta o equipo de cómputo en negocio o domicilio.',
    specs: ['Cobertura en Teziutlán', 'Bonificable en reparación mayor', 'Reporte técnico incluido']
  }
];

const SEED_WORKSHOP = [
  {
    id: 'ws-1001',
    folio: 'OS-1001',
    estado: 'en_reparacion',
    clientName: 'Contadora Laura Domínguez',
    clientPhone: '2311048821',
    clientEmail: 'laura.despacho@gmail.com',
    deviceType: 'Laptop',
    brand: 'HP',
    model: 'Pavilion 15-eh100',
    serialNumber: '5CD14299XK',
    accessories: 'Cargador original 45W, funda negra',
    reportedFault: 'Se apaga a los 10 minutos de encender, calienta mucho en la parte inferior y va muy lenta al abrir Contpaq.',
    technicalDiagnosis: 'Ventilador obstruido con pelusa compactada, pasta térmica seca y disco mecánico HDD con sectores lentos. Se recomienda cambio a SSD 480GB + mantenimiento térmico.',
    assignedTech: 'Ing. Alejandro Luna',
    priority: 'Alta',
    parts: [
      { id: 'wp-1', productId: 'prod-111', concept: 'Unidad de Estado Sólido SSD 480GB Kingston SATA III', qty: 1, price: 890.00 },
      { id: 'wp-2', productId: 'prod-113', concept: 'Mantenimiento Preventivo Completo + Clonación de Sistema', qty: 1, price: 350.00 }
    ],
    laborCost: 0,
    advancePayment: 500.00,
    total: 1240.00,
    paid: false,
    promisedDate: new Date(Date.now() + 3600000 * 24).toISOString(),
    createdAt: new Date(Date.now() - 3600000 * 30).toISOString(),
    updatedAt: new Date(Date.now() - 3600000 * 4).toISOString(),
    bitacora: [
      {
        id: 'wb-1',
        date: new Date(Date.now() - 3600000 * 30).toISOString(),
        author: 'Mariana Salazar',
        note: 'Equipo recibido en mostrador. Presenta rayón leve en tapa superior. Enciende pero ventilador hace ruido.'
      },
      {
        id: 'wb-2',
        date: new Date(Date.now() - 3600000 * 18).toISOString(),
        author: 'Ing. Alejandro Luna',
        note: 'Diagnóstico completado. Cliente autoriza instalación de SSD 480GB y deja anticipo de $500.'
      }
    ]
  },
  {
    id: 'ws-1002',
    folio: 'OS-1002',
    estado: 'listo_entrega',
    clientName: 'Abarrotes El Progreso (Sr. Jorge)',
    clientPhone: '2311194410',
    clientEmail: '',
    deviceType: 'Impresora POS',
    brand: 'Xprinter',
    model: 'XP-80C Autocorte',
    serialNumber: 'XP80-992811',
    accessories: 'Eliminador 24V y cable USB',
    reportedFault: 'Cuchilla de autocorte trabada, no abre la tapa del rollo de papel.',
    technicalDiagnosis: 'Engrane de guillotina atascado por residuo de papel térmico adhesivo. Se realizó desarme, limpieza, lubricación de mecanismo y ajuste de sensor óptico.',
    assignedTech: 'Ing. Alejandro Luna',
    priority: 'Urgente',
    parts: [
      { id: 'wp-3', productId: null, concept: 'Reparación y ajuste de mecanismo de guillotina térmica', qty: 1, price: 420.00 }
    ],
    laborCost: 0,
    advancePayment: 0,
    total: 420.00,
    paid: false,
    promisedDate: new Date(Date.now() + 3600000 * 4).toISOString(),
    createdAt: new Date(Date.now() - 3600000 * 20).toISOString(),
    updatedAt: new Date(Date.now() - 3600000 * 2).toISOString(),
    bitacora: [
      {
        id: 'wb-3',
        date: new Date(Date.now() - 3600000 * 2).toISOString(),
        author: 'Ing. Alejandro Luna',
        note: 'Pruebas de 50 cortes continuos exitosas. Equipo listo para entrega en mostrador.'
      }
    ]
  },
  {
    id: 'ws-1003',
    folio: 'OS-1003',
    estado: 'diagnostico',
    clientName: 'Arq. Fernando Cuevas',
    clientPhone: '2311309912',
    clientEmail: 'fcuevas.arq@outlook.com',
    deviceType: 'PC / Workstation',
    brand: 'Custom Ensamble',
    model: 'Ryzen 7 / RTX 3060',
    serialNumber: 'S/N-ENSAMBLE',
    accessories: 'Solo gabinete (sin cables)',
    reportedFault: 'Da pantallazo azul al renderizar en Lumion y se reinicia sola.',
    technicalDiagnosis: 'En pruebas de estrés de fuente de poder y memoria RAM.',
    assignedTech: 'Ing. Alejandro Luna',
    priority: 'Normal',
    parts: [],
    laborCost: 0,
    advancePayment: 200.00,
    total: 200.00,
    paid: false,
    promisedDate: new Date(Date.now() + 3600000 * 48).toISOString(),
    createdAt: new Date(Date.now() - 3600000 * 6).toISOString(),
    updatedAt: new Date(Date.now() - 3600000 * 5).toISOString(),
    bitacora: [
      {
        id: 'wb-4',
        date: new Date(Date.now() - 3600000 * 6).toISOString(),
        author: 'Mariana Salazar',
        note: 'Ingreso a laboratorio. Se cobra revisión inicial de $200 a cuenta de reparación.'
      }
    ]
  }
];

const SEED_SALES = [
  {
    id: 'sale-1001',
    folio: 'VTA-1001',
    date: new Date(Date.now() - 3600000 * 26).toISOString(),
    cashier: 'Lic. Sofía Navarro',
    clientName: 'Farmacia San José',
    paymentMethod: 'Transferencia',
    linkedRef: '',
    status: 'completada',
    items: [
      { productId: 'prod-101', sku: 'POS-CAJ-01', name: 'Cajón de Dinero Automático Metálico RJ11', qty: 1, price: 1150.00, cost: 680.00, subtotal: 1150.00 },
      { productId: 'prod-102', sku: 'POS-IMP-58', name: 'Impresora Térmica de Tickets 58mm USB', qty: 1, price: 890.00, cost: 490.00, subtotal: 890.00 }
    ],
    subtotal: 2040.00,
    discount: 40.00,
    total: 2000.00,
    amountReceived: 2000.00,
    change: 0
  },
  {
    id: 'sale-1002',
    folio: 'VTA-1002',
    date: new Date(Date.now() - 3600000 * 19).toISOString(),
    cashier: 'Ing. Roberto Méndez',
    clientName: 'Lic. Patricia Vega (Notaría No. 2)',
    paymentMethod: 'Efectivo',
    linkedRef: 'FL-1004',
    status: 'completada',
    items: [
      { productId: 'prod-113', sku: 'SRV-MANT-PC', name: 'Mantenimiento preventivo lógico x3 PCs', qty: 1, price: 600.00, cost: 80.00, subtotal: 600.00 }
    ],
    subtotal: 600.00,
    discount: 0,
    total: 600.00,
    amountReceived: 1000.00,
    change: 400.00
  },
  {
    id: 'sale-1003',
    folio: 'VTA-1003',
    date: new Date(Date.now() - 3600000 * 5).toISOString(),
    cashier: 'Lic. Sofía Navarro',
    clientName: 'Mostrador / Público en General',
    paymentMethod: 'Tarjeta',
    linkedRef: '',
    status: 'completada',
    items: [
      { productId: 'prod-104', sku: 'POS-LEC-2D', name: 'Lector de Código de Barras 1D/2D QR Inalámbrico', qty: 1, price: 950.00, cost: 520.00, subtotal: 950.00 },
      { productId: 'prod-109', sku: 'SW-WIN11-PRO', name: 'Licencia Original Windows 11 Pro OEM Vitalicia', qty: 1, price: 650.00, cost: 280.00, subtotal: 650.00 }
    ],
    subtotal: 1600.00,
    discount: 0,
    total: 1600.00,
    amountReceived: 1600.00,
    change: 0
  }
];

const SEED_TICKETS = [
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
    assignedTo: 'Ing. Alejandro Luna',
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
        { id: 'p1', concept: 'Diagnóstico en sitio de hardware POS', price: 250.00 }
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
    assignedTo: 'Téc. Daniel Ortega',
    description: 'Caída de red WiFi en consultorios 2 y 3. El switch principal muestra luces rojas parpadeando.',
    createdAt: new Date(Date.now() - 3600000 * 18).toISOString(),
    updatedAt: new Date(Date.now() - 3600000 * 10).toISOString(),
    bitacora: [
      {
        id: 'b2',
        date: new Date(Date.now() - 3600000 * 12).toISOString(),
        author: 'Téc. Daniel Ortega',
        note: 'Se detecta bucle de red por cable duplicado en recepción. Se procede a aislar el puerto.'
      }
    ],
    pos: {
      items: [
        { id: 'p2', concept: 'Reconfiguración de red LAN y AP Ubiquiti', price: 450.00 }
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
    assignedTo: 'Ing. Alejandro Luna',
    description: 'Instalación de 4 cámaras IP Hikvision y configuración de app móvil en celulares de gerencia.',
    createdAt: new Date(Date.now() - 3600000 * 48).toISOString(),
    updatedAt: new Date(Date.now() - 3600000 * 4).toISOString(),
    bitacora: [
      {
        id: 'b3',
        date: new Date(Date.now() - 3600000 * 30).toISOString(),
        author: 'Ing. Alejandro Luna',
        note: 'Cableado UTP categoría 6 terminado al 100%. Falta enfocar lente en cámara de estacionamiento.'
      }
    ],
    pos: {
      items: [
        { id: 'p3', concept: 'Mano de obra instalación 4 cámaras IP', price: 1200.00 },
        { id: 'p4', concept: 'Bobina UTP Cat6 100m + conectores', price: 850.00 }
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
    assignedTo: 'Ing. Roberto Méndez',
    description: 'Mantenimiento preventivo, limpieza de temporales y renovación de antivirus en 3 equipos de oficina.',
    createdAt: new Date(Date.now() - 3600000 * 72).toISOString(),
    updatedAt: new Date(Date.now() - 3600000 * 20).toISOString(),
    bitacora: [
      {
        id: 'b4',
        date: new Date(Date.now() - 3600000 * 20).toISOString(),
        author: 'Ing. Roberto Méndez',
        note: 'Mantenimiento remoto completado exitosamente. Cliente confirma óptimo rendimiento.'
      }
    ],
    pos: {
      items: [
        { id: 'p5', concept: 'Mantenimiento preventivo lógico x3 PCs', price: 600.00 }
      ],
      total: 600.00,
      paid: true
    }
  }
];

const SEED_ACTIVITY = [
  {
    id: 'act-1',
    date: new Date(Date.now() - 3600000 * 5).toISOString(),
    user: 'Lic. Sofía Navarro',
    role: 'ventas',
    module: 'pos',
    action: 'Registró venta VTA-1003 por $1,600.00 (Tarjeta)'
  },
  {
    id: 'act-2',
    date: new Date(Date.now() - 3600000 * 2).toISOString(),
    user: 'Ing. Alejandro Luna',
    role: 'tecnico',
    module: 'workshop',
    action: 'Marcó orden de taller OS-1002 como Listo para Entrega'
  }
];

const SEED_CLIENTS = [
  {
    id: 'cli-101',
    code: 'CLI-1001',
    name: 'Abarrotes y Mayorista La Sierra S.A. de C.V.',
    commercialName: 'Súper La Sierra Teziutlán',
    phone: '2311048899',
    email: 'compras@superlasierra.mx',
    address: 'Av. Hidalgo 412, Centro, Teziutlán, Pue.',
    active: true,
    hasCredit: true,
    creditLimit: 25000.00,
    creditDays: 30,
    currentBalance: 4380.00,
    hasBilling: true,
    rfc: 'AMS1904128B4',
    legalName: 'ABARROTES Y MAYORISTA LA SIERRA',
    taxRegime: '601 - General de Ley Personas Morales',
    cfdiUse: 'I04 - Equipo de cómputo y accesorios',
    postalCode: '73800',
    billingEmail: 'facturacion@superlasierra.mx',
    notes: 'Cliente corporativo VIP con 3 sucursales. Autorizado crédito en equipamiento POS y póliza.',
    createdAt: '2026-01-12T10:00:00.000Z',
    updatedAt: new Date(Date.now() - 3600000 * 6).toISOString(),
    ledger: [
      {
        id: 'mov-101',
        folio: 'CRD-1001',
        creditCycleId: 'CYC-901',
        date: new Date(Date.now() - 86400000 * 24).toISOString(),
        type: 'cargo',
        concept: 'Kit Punto de Venta Completo (Impresora 80mm + Cajón + Lector 2D)',
        paymentMethod: 'Crédito',
        amount: 3980.00,
        previousBalance: 0.00,
        newBalance: 3980.00,
        status: 'liquidado',
        cashier: 'Lic. Sofía Navarro'
      },
      {
        id: 'mov-102',
        folio: 'ABN-1001',
        creditCycleId: 'CYC-901',
        date: new Date(Date.now() - 86400000 * 15).toISOString(),
        type: 'abono',
        concept: 'Abono parcial a cuenta vía Transferencia SPEI',
        paymentMethod: 'Transferencia',
        amount: 2000.00,
        previousBalance: 3980.00,
        newBalance: 1980.00,
        status: 'liquidado',
        cashier: 'Lic. Sofía Navarro'
      },
      {
        id: 'mov-103',
        folio: 'LIQ-1001',
        creditCycleId: 'CYC-901',
        date: new Date(Date.now() - 86400000 * 10).toISOString(),
        type: 'liquidacion',
        concept: 'Liquidación total de crédito anterior CYC-901',
        paymentMethod: 'Transferencia',
        amount: 1980.00,
        previousBalance: 1980.00,
        newBalance: 0.00,
        status: 'liquidado',
        cashier: 'Ing. Roberto Méndez'
      },
      {
        id: 'mov-104',
        folio: 'CRD-1004',
        creditCycleId: 'CYC-905',
        date: new Date(Date.now() - 86400000 * 4).toISOString(),
        type: 'cargo',
        concept: '4x Cámaras Hikvision ColorVu + DVR 8 Canales + Instalación',
        paymentMethod: 'Crédito',
        amount: 6380.00,
        previousBalance: 0.00,
        newBalance: 6380.00,
        status: 'vigente',
        cashier: 'Lic. Sofía Navarro'
      },
      {
        id: 'mov-105',
        folio: 'ABN-1005',
        creditCycleId: 'CYC-905',
        date: new Date(Date.now() - 86400000 * 1).toISOString(),
        type: 'abono',
        concept: 'Primer abono en efectivo en mostrador',
        paymentMethod: 'Efectivo',
        amount: 2000.00,
        previousBalance: 6380.00,
        newBalance: 4380.00,
        status: 'vigente',
        cashier: 'Lic. Sofía Navarro'
      }
    ]
  },
  {
    id: 'cli-102',
    code: 'CLI-1002',
    name: 'Clínica Médica San José de Teziutlán S.C.',
    commercialName: 'Clínica San José',
    phone: '2311229900',
    email: 'administracion@clinicasanjose.mx',
    address: 'Calle Juárez 118, Barrio de Chignaulingo, Teziutlán',
    active: true,
    hasCredit: true,
    creditLimit: 18000.00,
    creditDays: 15,
    currentBalance: 2650.00,
    hasBilling: true,
    rfc: 'CMS1608239K1',
    legalName: 'CLINICA MEDICA SAN JOSE DE TEZIUTLAN',
    taxRegime: '601 - General de Ley Personas Morales',
    cfdiUse: 'G03 - Gastos en general',
    postalCode: '73800',
    billingEmail: 'contabilidad@clinicasanjose.mx',
    notes: 'Póliza mensual de mantenimiento de red hospitalaria y servidores.',
    createdAt: '2026-02-01T11:30:00.000Z',
    updatedAt: new Date(Date.now() - 3600000 * 14).toISOString(),
    ledger: [
      {
        id: 'mov-201',
        folio: 'CRD-1002',
        creditCycleId: 'CYC-902',
        date: new Date(Date.now() - 86400000 * 18).toISOString(),
        type: 'cargo',
        concept: 'Router MikroTik hEX S + Configuración Balanceo Dual WAN',
        paymentMethod: 'Crédito',
        amount: 2800.00,
        previousBalance: 0.00,
        newBalance: 2800.00,
        status: 'liquidado',
        cashier: 'Ing. Roberto Méndez'
      },
      {
        id: 'mov-202',
        folio: 'LIQ-1002',
        creditCycleId: 'CYC-902',
        date: new Date(Date.now() - 86400000 * 9).toISOString(),
        type: 'liquidacion',
        concept: 'Liquidación total factura F-409 vía SPEI',
        paymentMethod: 'Transferencia',
        amount: 2800.00,
        previousBalance: 2800.00,
        newBalance: 0.00,
        status: 'liquidado',
        cashier: 'Lic. Sofía Navarro'
      },
      {
        id: 'mov-203',
        folio: 'CRD-1006',
        creditCycleId: 'CYC-906',
        date: new Date(Date.now() - 86400000 * 2).toISOString(),
        type: 'cargo',
        concept: '2x SSD Kingston NV2 1TB + Mantenimiento 3 Laptops Consultorios',
        paymentMethod: 'Crédito',
        amount: 2650.00,
        previousBalance: 0.00,
        newBalance: 2650.00,
        status: 'vigente',
        cashier: 'Lic. Sofía Navarro'
      }
    ]
  },
  {
    id: 'cli-103',
    code: 'CLI-1003',
    name: 'Farmacia Guadalupana del Centro',
    commercialName: 'Farmacia Guadalupana',
    phone: '2311184455',
    email: 'gerencia@farmaciaguadalupana.com',
    address: 'Av. Cuauhtémoc 55, Centro, Teziutlán, Pue.',
    active: true,
    hasCredit: true,
    creditLimit: 10000.00,
    creditDays: 15,
    currentBalance: 0.00,
    hasBilling: true,
    rfc: 'ROGA8405197H2',
    legalName: 'ARTURO RODRIGUEZ GARCIA',
    taxRegime: '626 - Régimen Simplificado de Confianza (RESICO)',
    cfdiUse: 'G01 - Adquisición de mercancías',
    postalCode: '73800',
    billingEmail: 'facturas@farmaciaguadalupana.com',
    notes: 'Excelente historial crediticio, liquida puntualmente en quincena.',
    createdAt: '2026-02-18T09:00:00.000Z',
    updatedAt: new Date(Date.now() - 86400000 * 5).toISOString(),
    ledger: [
      {
        id: 'mov-301',
        folio: 'CRD-1003',
        creditCycleId: 'CYC-903',
        date: new Date(Date.now() - 86400000 * 12).toISOString(),
        type: 'cargo',
        concept: 'Licencia Sistema Punto de Venta Vitalicia + Lector 2D QR',
        paymentMethod: 'Crédito',
        amount: 2550.00,
        previousBalance: 0.00,
        newBalance: 2550.00,
        status: 'liquidado',
        cashier: 'Lic. Sofía Navarro'
      },
      {
        id: 'mov-302',
        folio: 'LIQ-1003',
        creditCycleId: 'CYC-903',
        date: new Date(Date.now() - 86400000 * 5).toISOString(),
        type: 'liquidacion',
        concept: 'Liquidación total en ventanilla (Efectivo)',
        paymentMethod: 'Efectivo',
        amount: 2550.00,
        previousBalance: 2550.00,
        newBalance: 0.00,
        status: 'liquidado',
        cashier: 'Lic. Sofía Navarro'
      }
    ]
  },
  {
    id: 'cli-104',
    code: 'CLI-1004',
    name: 'Arq. Fernando Morales Vázquez',
    commercialName: 'Despacho Morales Arquitectos',
    phone: '2311092233',
    email: 'fernando@moralesarq.mx',
    address: 'Fracc. Jardines de Teziutlán Calle 3 #14',
    active: true,
    hasCredit: false,
    creditLimit: 0.00,
    creditDays: 0,
    currentBalance: 0.00,
    hasBilling: true,
    rfc: 'MOVF881104LA9',
    legalName: 'FERNANDO MORALES VAZQUEZ',
    taxRegime: '612 - Personas Físicas con Actividades Empresariales y Profesionales',
    cfdiUse: 'I04 - Equipo de cómputo y accesorios',
    postalCode: '73820',
    billingEmail: 'facturacion@moralesarq.mx',
    notes: 'Pago de contado, requiere factura electrónica CFDI 4.0 en cada compra.',
    createdAt: '2026-03-04T12:00:00.000Z',
    updatedAt: '2026-03-04T12:00:00.000Z',
    ledger: []
  }
];

const SEED_INVENTORY_MOVEMENTS = [
  {
    id: 'kdx-1001',
    folio: 'KDX-1001',
    date: '2026-03-01T09:00:00.000Z',
    productId: 'prod-101',
    sku: 'POS-CAJ-01',
    productName: 'Cajón de Dinero Automático Metálico RJ11',
    category: 'pos',
    type: 'entrada',
    reason: 'Compra a proveedor / Abastecimiento inicial',
    reference: 'FAC-PROV-881',
    stockBefore: 0,
    quantity: 15,
    delta: 15,
    stockAfter: 15,
    unitCost: 680.00,
    totalCost: 10200.00,
    user: 'Ing. Roberto Méndez'
  },
  {
    id: 'kdx-1002',
    folio: 'KDX-1002',
    date: '2026-03-01T09:15:00.000Z',
    productId: 'prod-105',
    sku: 'CCTV-HIK-2MP',
    productName: 'Cámara Bala Hikvision Full HD 1080p ColorVu',
    category: 'cctv',
    type: 'entrada',
    reason: 'Recepción de lote mayorista Hikvision',
    reference: 'FAC-SYSCOM-4410',
    stockBefore: 0,
    quantity: 20,
    delta: 20,
    stockAfter: 20,
    unitCost: 480.00,
    totalCost: 9600.00,
    user: 'Ing. Roberto Méndez'
  },
  {
    id: 'kdx-1003',
    folio: 'KDX-1003',
    date: '2026-03-02T11:30:00.000Z',
    productId: 'prod-108',
    sku: 'NET-AP-U6',
    productName: 'Access Point Ubiquiti UniFi U6+ Dual Band WiFi 6',
    category: 'redes',
    type: 'entrada',
    reason: 'Compra de equipo de red empresarial',
    reference: 'FAC-UBNT-209',
    stockBefore: 0,
    quantity: 5,
    delta: 5,
    stockAfter: 5,
    unitCost: 1980.00,
    totalCost: 9900.00,
    user: 'Ing. Roberto Méndez'
  },
  {
    id: 'kdx-1004',
    folio: 'KDX-1004',
    date: '2026-03-03T14:20:00.000Z',
    productId: 'prod-108',
    sku: 'NET-AP-U6',
    productName: 'Access Point Ubiquiti UniFi U6+ Dual Band WiFi 6',
    category: 'redes',
    type: 'salida_venta',
    reason: 'Salida por proyecto / Venta POS',
    reference: 'VTA-1001',
    stockBefore: 5,
    quantity: 3,
    delta: -3,
    stockAfter: 2,
    unitCost: 1980.00,
    totalCost: 5940.00,
    user: 'Lic. Sofía Navarro'
  },
  {
    id: 'kdx-1005',
    folio: 'KDX-1005',
    date: '2026-03-04T10:05:00.000Z',
    productId: 'prod-111',
    sku: 'REF-SSD-480',
    productName: 'Unidad de Estado Sólido SSD 480GB Kingston SATA III',
    category: 'refacciones',
    type: 'entrada',
    reason: 'Entrada de almacén refacciones laboratorio',
    reference: 'FAC-KING-902',
    stockBefore: 0,
    quantity: 6,
    delta: 6,
    stockAfter: 6,
    unitCost: 520.00,
    totalCost: 3120.00,
    user: 'Ing. Roberto Méndez'
  },
  {
    id: 'kdx-1006',
    folio: 'KDX-1006',
    date: '2026-03-05T16:40:00.000Z',
    productId: 'prod-111',
    sku: 'REF-SSD-480',
    productName: 'Unidad de Estado Sólido SSD 480GB Kingston SATA III',
    category: 'refacciones',
    type: 'ajuste_salida',
    reason: 'Instalación en órdenes de Taller OS-1001 y ventas mostrador',
    reference: 'OS-1001 / VTA-1002',
    stockBefore: 6,
    quantity: 4,
    delta: -4,
    stockAfter: 2,
    unitCost: 520.00,
    totalCost: 2080.00,
    user: 'Ing. Alejandro Luna'
  },
  {
    id: 'kdx-1007',
    folio: 'KDX-1007',
    date: '2026-03-06T12:15:00.000Z',
    productId: 'prod-101',
    sku: 'POS-CAJ-01',
    productName: 'Cajón de Dinero Automático Metálico RJ11',
    category: 'pos',
    type: 'salida_venta',
    reason: 'Venta en Terminal POS',
    reference: 'VTA-1001',
    stockBefore: 15,
    quantity: 1,
    delta: -1,
    stockAfter: 14,
    unitCost: 680.00,
    totalCost: 680.00,
    user: 'Lic. Sofía Navarro'
  },
  {
    id: 'kdx-1008',
    folio: 'KDX-1008',
    date: '2026-03-06T17:10:00.000Z',
    productId: 'prod-105',
    sku: 'CCTV-HIK-2MP',
    productName: 'Cámara Bala Hikvision Full HD 1080p ColorVu',
    category: 'cctv',
    type: 'ajuste_conteo',
    reason: 'Ajuste por conteo físico de auditoría (2 cámaras en demostración)',
    reference: 'AUD-2026-03',
    stockBefore: 20,
    quantity: 2,
    delta: -2,
    stockAfter: 18,
    unitCost: 480.00,
    totalCost: 960.00,
    user: 'Ing. Roberto Méndez'
  }
];

const SEED_SHIFTS = [
  {
    id: 'shift-1003',
    folio: 'TRN-1003',
    shiftName: 'Turno Matutino (08:00 - 16:00)',
    registerName: 'Caja Principal #1 — Mostrador Teziutlán',
    cashier: 'Lic. Sofía Navarro',
    openedBy: 'Lic. Sofía Navarro',
    openedAt: new Date(Date.now() - 3600000 * 5).toISOString(),
    closedAt: null,
    status: 'abierto',
    openingCash: 1500.00,
    cashMovements: [
      {
        id: 'cm-101',
        folio: 'MCJ-101',
        date: new Date(Date.now() - 3600000 * 3).toISOString(),
        type: 'entrada_efectivo',
        concept: 'Dotación de morralla y cambio para mostrador',
        amount: 500.00,
        author: 'Ing. Roberto Méndez'
      },
      {
        id: 'cm-102',
        folio: 'MCJ-102',
        date: new Date(Date.now() - 3600000 * 1.5).toISOString(),
        type: 'salida_gasto',
        concept: 'Pago de guía de paquetería urgente (refacciones taller)',
        amount: 220.00,
        author: 'Lic. Sofía Navarro'
      }
    ],
    closingCashCounted: null,
    expectedCash: null,
    difference: 0,
    cutFolio: null,
    notes: 'Turno operativo actual en mostrador principal.'
  },
  {
    id: 'shift-1002',
    folio: 'TRN-1002',
    shiftName: 'Turno Vespertino (14:00 - 21:00)',
    registerName: 'Caja Principal #1 — Mostrador Teziutlán',
    cashier: 'Lic. Sofía Navarro',
    openedBy: 'Lic. Sofía Navarro',
    openedAt: new Date(Date.now() - 86400000 - 3600000 * 7).toISOString(),
    closedAt: new Date(Date.now() - 86400000).toISOString(),
    status: 'cerrado',
    openingCash: 1500.00,
    cashMovements: [
      {
        id: 'cm-100',
        folio: 'MCJ-100',
        date: new Date(Date.now() - 86400000 - 3600000 * 3).toISOString(),
        type: 'salida_gasto',
        concept: 'Compra de cintillos y alcohol isopropílico para laboratorio',
        amount: 150.00,
        author: 'Lic. Sofía Navarro'
      }
    ],
    closingCashCounted: 5530.00,
    expectedCash: 5530.00,
    difference: 0.00,
    cutFolio: 'COR-1002',
    notes: 'Cierre de turno vespertino sin diferencias en arqueo.'
  },
  {
    id: 'shift-1001',
    folio: 'TRN-1001',
    shiftName: 'Turno Matutino (08:00 - 16:00)',
    registerName: 'Caja Principal #1 — Mostrador Teziutlán',
    cashier: 'Mariana Salazar',
    openedBy: 'Ing. Roberto Méndez',
    openedAt: new Date(Date.now() - 86400000 * 2 - 3600000 * 8).toISOString(),
    closedAt: new Date(Date.now() - 86400000 * 2).toISOString(),
    status: 'cerrado',
    openingCash: 1000.00,
    cashMovements: [],
    closingCashCounted: 4930.00,
    expectedCash: 4950.00,
    difference: -20.00,
    cutFolio: 'COR-1001',
    notes: 'Diferencia menor de -$20.00 en cambio de monedas.'
  }
];

const SEED_CASH_CUTS = [
  {
    id: 'cut-1003',
    folio: 'COR-1003',
    cutType: 'dia',
    shiftId: 'ALL',
    shiftFolio: 'CONSOLIDADO-DIA',
    shiftName: 'Corte General del Día (Consolidado)',
    registerName: 'Todas las Cajas — Sucursal Teziutlán',
    cashier: 'Ing. Roberto Méndez',
    date: new Date(Date.now() - 86400000 + 1800000).toISOString(),
    periodStart: new Date(Date.now() - 86400000 - 3600000 * 12).toISOString(),
    periodEnd: new Date(Date.now() - 86400000 + 1800000).toISOString(),
    salesCount: 6,
    cancelledCount: 0,
    openingCash: 2500.00,
    cashSales: 8130.00,
    cardSales: 3450.00,
    transferSales: 6470.00,
    creditSales: 6380.00,
    creditPaymentsCash: 2000.00,
    creditPaymentsOther: 1980.00,
    cashInTotal: 0.00,
    cashOutTotal: 150.00,
    totalGrossSales: 24430.00,
    totalCollectedRevenue: 22030.00,
    expectedCashInDrawer: 12480.00,
    countedCashInDrawer: 12480.00,
    difference: 0.00,
    denominations: { b1000: 6, b500: 8, b200: 9, b100: 5, b50: 3, b20: 1, coins: 10 },
    whatsappPhone: '2311024672',
    notes: 'Corte Z del día auditado por Dirección General. Depósito bancario programado.'
  },
  {
    id: 'cut-1002',
    folio: 'COR-1002',
    cutType: 'turno',
    shiftId: 'shift-1002',
    shiftFolio: 'TRN-1002',
    shiftName: 'Turno Vespertino (14:00 - 21:00)',
    registerName: 'Caja Principal #1 — Mostrador Teziutlán',
    cashier: 'Lic. Sofía Navarro',
    date: new Date(Date.now() - 86400000).toISOString(),
    periodStart: new Date(Date.now() - 86400000 - 3600000 * 7).toISOString(),
    periodEnd: new Date(Date.now() - 86400000).toISOString(),
    salesCount: 4,
    cancelledCount: 0,
    openingCash: 1500.00,
    cashSales: 4180.00,
    cardSales: 1850.00,
    transferSales: 2490.00,
    creditSales: 0.00,
    creditPaymentsCash: 0.00,
    creditPaymentsOther: 1980.00,
    cashInTotal: 0.00,
    cashOutTotal: 150.00,
    totalGrossSales: 8520.00,
    totalCollectedRevenue: 10500.00,
    expectedCashInDrawer: 5530.00,
    countedCashInDrawer: 5530.00,
    difference: 0.00,
    denominations: { b1000: 2, b500: 5, b200: 4, b100: 2, b50: 0, b20: 1, coins: 10 },
    whatsappPhone: '2311024672',
    notes: 'Cuadre exacto al cierre del turno vespertino.'
  },
  {
    id: 'cut-1001',
    folio: 'COR-1001',
    cutType: 'turno',
    shiftId: 'shift-1001',
    shiftFolio: 'TRN-1001',
    shiftName: 'Turno Matutino (08:00 - 16:00)',
    registerName: 'Caja Principal #1 — Mostrador Teziutlán',
    cashier: 'Mariana Salazar',
    date: new Date(Date.now() - 86400000 * 2).toISOString(),
    periodStart: new Date(Date.now() - 86400000 * 2 - 3600000 * 8).toISOString(),
    periodEnd: new Date(Date.now() - 86400000 * 2).toISOString(),
    salesCount: 3,
    cancelledCount: 0,
    openingCash: 1000.00,
    cashSales: 3950.00,
    cardSales: 1600.00,
    transferSales: 3980.00,
    creditSales: 0.00,
    creditPaymentsCash: 0.00,
    creditPaymentsOther: 0.00,
    cashInTotal: 0.00,
    cashOutTotal: 0.00,
    totalGrossSales: 9530.00,
    totalCollectedRevenue: 9530.00,
    expectedCashInDrawer: 4950.00,
    countedCashInDrawer: 4930.00,
    difference: -20.00,
    denominations: { b1000: 2, b500: 4, b200: 4, b100: 1, b50: 0, b20: 1, coins: 10 },
    whatsappPhone: '2311024672',
    notes: 'Faltante menor de $20.00 en morralla.'
  }
];

export const SEED_SETTINGS = {
  company: {
    programName: 'Fiberlink Enterprise OS',
    commercialName: 'FIBERLINK SERVICIOS TIC',
    legalName: 'FIBERLINK SERVICIOS DE TELECOMUNICACIONES E INFORMÁTICA S.A. DE C.V.',
    rfc: 'FST2109148H2',
    taxRegime: '601 - General de Ley Personas Morales',
    address: 'Calle Hidalgo Centro, Teziutlán, Puebla, C.P. 73800',
    phone: '231 102 4672',
    whatsapp: '2311024672',
    email: 'contacto@fiberlink.mx',
    website: 'https://fiberlinkserviciostic.vercel.app',
    logoUrl: '/logo.gif'
  },
  enabledOptions: {
    allowSellWithoutStock: false,
    requireClientForCredit: true,
    openCashDrawerOnCashSale: true,
    autoPrintTicketOnSale: true,
    roundCashCents: false,
    showBarcodeInPos: true,
    requireAdminForCancel: true,
    enableWorkshopModule: true,
    enableTicketsModule: true,
    enableWhatsappReceipts: true
  },
  folios: {
    sales: { prefix: 'VTA', nextNumber: 1005, description: 'Tickets de Venta en Mostrador (POS)' },
    tickets: { prefix: 'FL', nextNumber: 1008, description: 'Tickets de Soporte Técnico y Redes' },
    workshop: { prefix: 'OS', nextNumber: 1004, description: 'Órdenes de Servicio en Laboratorio / Taller' },
    clients: { prefix: 'CLI', nextNumber: 1005, description: 'Padrón de Clientes y Cuentas de Crédito' },
    inventoryMovements: { prefix: 'KDX', nextNumber: 1009, description: 'Movimientos de Almacén y Kardex' },
    shifts: { prefix: 'TRN', nextNumber: 1004, description: 'Turnos de Trabajo en Caja' },
    cashCuts: { prefix: 'COR', nextNumber: 1004, description: 'Cortes de Turno (X/Z) y Cortes del Día' }
  },
  registers: [
    {
      id: 'reg-1',
      code: 'CAJA-01',
      name: 'Caja Principal #1 — Mostrador Teziutlán',
      branch: 'Matriz Centro Teziutlán',
      printerName: 'Impresora Térmica 80mm USB/LAN',
      defaultOpeningCash: 1500.00,
      folioSeries: 'VTA',
      active: true
    },
    {
      id: 'reg-2',
      code: 'CAJA-02',
      name: 'Caja #2 — Laboratorio y Taller Técnico',
      branch: 'Matriz Centro Teziutlán',
      printerName: 'Impresora Térmica 58mm Recepción',
      defaultOpeningCash: 1000.00,
      folioSeries: 'VTA',
      active: true
    },
    {
      id: 'reg-3',
      code: 'CAJA-03',
      name: 'Caja Móvil — Cobranza en Campo',
      branch: 'Unidades Móviles / Instalaciones',
      printerName: 'Ticket Digital / WhatsApp PDF',
      defaultOpeningCash: 500.00,
      folioSeries: 'VTA',
      active: true
    }
  ],
  ticketConfig: {
    paperWidth: '80mm',
    fontSize: '12px',
    showLogo: true,
    showTaxBreakdown: true,
    showCashierAndShift: true,
    showSkuOnItems: true,
    headerLine1: 'Soporte Técnico, Redes, Fibra Óptica, CCTV y Punto de Venta',
    headerLine2: 'Teziutlán, Puebla · Tel / WhatsApp: 231 102 4672',
    footerMessage: '¡Gracias por su preferencia! Garantía y soporte local en Teziutlán.',
    warrantyPolicy: 'Equipos nuevos con 1 año de garantía contra defecto de fábrica. Servicios y reparaciones 30 días presentando este comprobante.',
    enableDigitalTicket: true,
    digitalTicketShowQr: true,
    digitalTicketShowSupportBtn: true,
    digitalTicketWhatsappTemplate: 'Hola *{cliente}*, gracias por tu compra en *{empresa}*. Aquí puedes consultar y descargar tu Ticket Digital *{folio}* por *{total}*:\n{enlace}'
  },
  paymentMethods: [
    { id: 'pm-cash', key: 'Efectivo', label: '💵 Efectivo (Moneda Nacional)', enabled: true, feePercent: 0, requiresReference: false, opensDrawer: true, bankInfo: 'Cajón de dinero en mostrador' },
    { id: 'pm-card', key: 'Tarjeta', label: '💳 Tarjeta Débito / Crédito (Terminal)', enabled: true, feePercent: 0, requiresReference: true, opensDrawer: false, bankInfo: 'Terminal Bancaria Clip / MercadoPago / BBVA' },
    { id: 'pm-spei', key: 'Transferencia', label: '🏦 Transferencia Electrónica SPEI', enabled: true, feePercent: 0, requiresReference: true, opensDrawer: false, bankInfo: 'BBVA: 012180001928374651 · Fiberlink TIC' },
    { id: 'pm-credit', key: 'Crédito', label: '📋 Crédito Autorizado de Cliente', enabled: true, feePercent: 0, requiresReference: false, opensDrawer: false, bankInfo: 'Sujeto a línea de crédito autorizada' },
    { id: 'pm-check', key: 'Cheque', label: '🧾 Cheque Nominativo / Orden de Pago', enabled: false, feePercent: 0, requiresReference: true, opensDrawer: false, bankInfo: 'Salvo buen cobro' }
  ],
  taxes: {
    taxName: 'IVA',
    vatRate: 16,
    pricesIncludeTax: true,
    applyRetentionIsr: false,
    retentionIsrRate: 1.25,
    currencyCode: 'MXN',
    currencySymbol: '$',
    exchangeRateUsd: 19.85
  },
  cutRules: {
    blindCutMode: false,
    defaultOpeningFund: 1500.00,
    maxCashInDrawerAlert: 15000.00,
    allowedDiscrepancyTolerance: 20.00,
    requireCountDenominations: false,
    autoSendWhatsappOnCloseShift: false,
    defaultCutWhatsappPhone: '2311024672'
  },
  unitsOfMeasure: [
    { id: 'u-pza', key: 'pza', name: 'Pieza / Unidad Individual', allowDecimals: false, satKey: 'H87' },
    { id: 'u-srv', key: 'srv', name: 'Servicio Técnico / Mano de Obra', allowDecimals: false, satKey: 'E48' },
    { id: 'u-kit', key: 'kit', name: 'Kit / Paquete Completo', allowDecimals: false, satKey: 'KT' },
    { id: 'u-m', key: 'm', name: 'Metro Lineal (Cable / Fibra)', allowDecimals: true, satKey: 'MTR' },
    { id: 'u-caja', key: 'caja', name: 'Caja / Bobina (305m)', allowDecimals: false, satKey: 'XBX' },
    { id: 'u-lic', key: 'lic', name: 'Licencia de Software / Póliza', allowDecimals: false, satKey: 'CE' },
    { id: 'u-hr', key: 'hr', name: 'Hora de Ingeniería / Soporte', allowDecimals: true, satKey: 'HUR' }
  ],
  notifications: {
    lowStockAlerts: true,
    overdueCreditAlerts: true,
    urgentTicketAlerts: true,
    cashLimitAlerts: true,
    soundEffects: true,
    adminWhatsappNumber: '2311024672',
    adminEmailAlert: 'admin@fiberlink.mx'
  },
  updatedAt: new Date().toISOString()
};

function ensureSeed(collectionName, seedData) {
  const filePath = FILES[collectionName];
  if (!fs.existsSync(filePath)) {
    const bundledPath = path.join(BUNDLED_DATA_DIR, `${collectionName}.json`);
    if (fs.existsSync(bundledPath)) {
      try {
        fs.copyFileSync(bundledPath, filePath);
        return;
      } catch (e) {
        // Fallback to seedData
      }
    }
    try {
      fs.writeFileSync(filePath, JSON.stringify(seedData, null, 2), 'utf-8');
    } catch (e) {
      console.warn(`[jsonStore] Could not write ${filePath}:`, e.message);
    }
  }
}

// Initialize all collections on startup
ensureSeed('users', SEED_USERS);
ensureSeed('clients', SEED_CLIENTS);
ensureSeed('tickets', SEED_TICKETS);
ensureSeed('products', SEED_PRODUCTS);
ensureSeed('inventoryMovements', SEED_INVENTORY_MOVEMENTS);
ensureSeed('workshop', SEED_WORKSHOP);
ensureSeed('sales', SEED_SALES);
ensureSeed('shifts', SEED_SHIFTS);
ensureSeed('cashCuts', SEED_CASH_CUTS);
ensureSeed('settings', SEED_SETTINGS);
ensureSeed('activity', SEED_ACTIVITY);

// ==========================================
// GENERIC CRUD HELPERS
// ==========================================
export function readCollection(name) {
  const filePath = FILES[name];
  if (!filePath) throw new Error(`Colección desconocida: ${name}`);
  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    const parsed = JSON.parse(raw);
    if (name === 'products' && Array.isArray(parsed)) {
      return parsed.map((p, idx) => ({
        ...p,
        barcode: p.barcode || `7501045${String(100101 + idx).slice(-6)}`
      }));
    }
    return parsed;
  } catch (err) {
    console.error(`[jsonStore] Error leyendo ${name}:`, err.message);
    return name === 'settings' ? SEED_SETTINGS : [];
  }
}

export function writeCollection(name, data) {
  const filePath = FILES[name];
  if (!filePath) throw new Error(`Colección desconocida: ${name}`);
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
    return true;
  } catch (err) {
    console.error(`[jsonStore] Error escribiendo ${name}:`, err.message);
    return false;
  }
}

export function logActivity({ user = 'Sistema', role = 'system', module = 'general', action = '' }) {
  try {
    const list = readCollection('activity');
    const entry = {
      id: `act-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      date: new Date().toISOString(),
      user,
      role,
      module,
      action
    };
    list.unshift(entry);
    // Keep latest 250 logs
    if (list.length > 250) list.length = 250;
    writeCollection('activity', list);
    return entry;
  } catch (e) {
    return null;
  }
}

export function generateNextFolio(collectionName, prefix, startAt = 1000) {
  const list = readCollection(collectionName);
  let resolvedPrefix = prefix;
  let max = startAt;

  try {
    const settings = readCollection('settings');
    const folioCfg = settings?.folios?.[collectionName];
    if (folioCfg) {
      if (folioCfg.prefix) resolvedPrefix = folioCfg.prefix.trim().toUpperCase();
      if (Number(folioCfg.nextNumber) > 0) {
        max = Math.max(max, Number(folioCfg.nextNumber) - 1);
      }
    }
  } catch (e) {
    // Ignore settings read error
  }

  const regex = new RegExp(`${resolvedPrefix}-(\\d+)`);
  if (Array.isArray(list)) {
    list.forEach(item => {
      const f = item.folio || item.code;
      if (f) {
        const m = f.match(regex);
        if (m) {
          const num = parseInt(m[1], 10);
          if (num > max) max = num;
        }
      }
    });
  }

  const nextNum = max + 1;

  // Update nextNumber in settings.folios if available
  try {
    const settings = readCollection('settings');
    if (settings?.folios?.[collectionName]) {
      settings.folios[collectionName].nextNumber = nextNum + 1;
      writeCollection('settings', settings);
    }
  } catch (e) {
    // Ignore
  }

  return `${resolvedPrefix}-${nextNum}`;
}

export function recordInventoryMovement({
  productId,
  sku,
  productName,
  category = 'pos',
  type = 'entrada',
  reason = 'Movimiento de almacén',
  reference = '',
  stockBefore = 0,
  delta = 0,
  stockAfter = 0,
  unitCost = 0,
  user = 'Administrador'
}) {
  try {
    const movements = readCollection('inventoryMovements');
    const folio = generateNextFolio('inventoryMovements', 'KDX', 1000);
    const qty = Math.abs(Number(delta) || 0);
    const cost = parseFloat(unitCost) || 0;
    const entry = {
      id: `kdx-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
      folio,
      date: new Date().toISOString(),
      productId,
      sku,
      productName,
      category,
      type,
      reason,
      reference: reference || '-',
      stockBefore: Number(stockBefore) || 0,
      quantity: qty,
      delta: Number(delta) || 0,
      stockAfter: Number(stockAfter) || 0,
      unitCost: cost,
      totalCost: Number((qty * cost).toFixed(2)),
      user
    };
    movements.unshift(entry);
    writeCollection('inventoryMovements', movements);
    return entry;
  } catch (e) {
    console.error('[jsonStore] Error registrando movimiento Kardex:', e.message);
    return null;
  }
}
