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
  tickets: path.join(DATA_DIR, 'tickets.json'),
  products: path.join(DATA_DIR, 'products.json'),
  sales: path.join(DATA_DIR, 'sales.json'),
  workshop: path.join(DATA_DIR, 'workshop.json'),
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
ensureSeed('tickets', SEED_TICKETS);
ensureSeed('products', SEED_PRODUCTS);
ensureSeed('workshop', SEED_WORKSHOP);
ensureSeed('sales', SEED_SALES);
ensureSeed('activity', SEED_ACTIVITY);

// ==========================================
// GENERIC CRUD HELPERS
// ==========================================
export function readCollection(name) {
  const filePath = FILES[name];
  if (!filePath) throw new Error(`Colección desconocida: ${name}`);
  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(raw);
  } catch (err) {
    console.error(`[jsonStore] Error leyendo ${name}:`, err.message);
    return [];
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
  let max = startAt;
  const regex = new RegExp(`${prefix}-(\\d+)`);
  list.forEach(item => {
    if (item.folio) {
      const m = item.folio.match(regex);
      if (m) {
        const num = parseInt(m[1], 10);
        if (num > max) max = num;
      }
    }
  });
  return `${prefix}-${max + 1}`;
}
