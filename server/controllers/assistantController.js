// ==========================================
// ASISTENTE TÉCNICO VIRTUAL IA (GEMINI)
// Objetivo: capturar la solicitud de servicio (ticket), mostrar empatía,
// dar un pre-diagnóstico MUY breve y delegar la solución a los técnicos.
// Modo dual: Gemini API (GEMINI_API_KEY) + motor local de respaldo por reglas.
// ==========================================

export const SERVICES = [
  'Soporte técnico',
  'Redes / WiFi',
  'Videovigilancia CCTV',
  'Punto de Venta POS',
  'Presencia Web / Nube',
  'Otro servicio TIC'
];
export const MODALITIES = ['En Sitio / Domicilio', 'Remoto', 'En Taller'];
export const PRIORITIES = ['Normal', 'Alta', 'Urgente'];

const DEFAULT_MODEL = 'gemini-flash-lite-latest';
let envLoaded = false;

function ensureEnv() {
  if (envLoaded) return;
  envLoaded = true;
  try {
    if (!process.env.GEMINI_API_KEY && typeof process.loadEnvFile === 'function') {
      process.loadEnvFile('.env');
    }
  } catch (_) {
    // .env opcional
  }
}

export const OFFICIAL_CATALOG = [
  { id: 'prod-101', sku: 'POS-CAJ-01', name: 'Cajón de Dinero Metálico Automático RJ11', category: 'pos', price: 1150, description: 'Cajón metálico uso rudo con 5 divisiones de billetes, 8 monedas y apertura automática RJ11.' },
  { id: 'prod-102', sku: 'POS-IMP-58', name: 'Impresora Térmica de Tickets 58mm USB', category: 'pos', price: 890, description: 'Impresora térmica directa sin tinta compatible con Windows y software de cobro.' },
  { id: 'prod-103', sku: 'POS-IMP-80', name: 'Impresora Térmica 80mm Autocorte USB + LAN', category: 'pos', price: 1980, description: 'Impresora de tickets 80mm con cortador de guillotina automático y conexión USB + Red.' },
  { id: 'prod-104', sku: 'POS-LEC-2D', name: 'Lector de Código de Barras 1D/2D QR Inalámbrico', category: 'pos', price: 950, description: 'Escáner omnidireccional inalámbrico 2.4GHz + USB que lee pantallas y etiquetas.' },
  { id: 'prod-105', sku: 'CCTV-HIK-2MP', name: 'Cámara Bala Hikvision 1080p ColorVu', category: 'cctv', price: 850, description: 'Cámara exterior IP67 con visión nocturna a todo color 24/7.' },
  { id: 'prod-106', sku: 'CCTV-KIT-4CH', name: 'Kit DVR 4 Canales + 4 Cámaras HD + Disco 1TB', category: 'cctv', price: 4650, description: 'Kit completo de vigilancia con grabador DVR, 4 cámaras HD, disco de 1TB y app en celular.' },
  { id: 'prod-107', sku: 'NET-UTP-CAT6', name: 'Cable UTP Cat6 100% Cobre (Metro)', category: 'redes', price: 15, description: 'Cable de red categoría 6 certificado 100% cobre para enlaces Gigabit y PoE.' },
  { id: 'prod-108', sku: 'NET-AP-U6', name: 'Access Point Ubiquiti UniFi U6+ WiFi 6', category: 'redes', price: 2890, description: 'Punto de acceso empresarial de alta velocidad WiFi 6 para locales, hoteles y oficinas.' },
  { id: 'prod-109', sku: 'SW-WIN11-PRO', name: 'Licencia Original Windows 11 Pro OEM Vitalicia', category: 'software', price: 650, description: 'Clave permanente original Microsoft con soporte BitLocker y Escritorio Remoto.' },
  { id: 'prod-110', sku: 'SW-POS-PRO', name: 'Sistema Punto de Venta Local (Licencia Vitalicia)', category: 'software', price: 1200, description: 'Software para cobro, inventarios, corte de caja y tickets sin mensualidades.' },
  { id: 'prod-111', sku: 'REF-SSD-480', name: 'Unidad de Estado Sólido SSD 480GB Kingston', category: 'refacciones', price: 890, description: 'Disco SSD de alta velocidad SATA III para acelerar laptops y PCs.' },
  { id: 'prod-112', sku: 'REF-RAM-8G', name: 'Memoria RAM DDR4 8GB 3200MHz Laptop', category: 'refacciones', price: 620, description: 'Módulo de memoria RAM para mejorar la multitarea en computadoras portátiles.' },
  { id: 'prod-113', sku: 'SRV-MANT-PC', name: 'Mantenimiento Preventivo Completo (Físico + Lógico)', category: 'servicios', price: 350, description: 'Limpieza interna, pasta térmica de alto rendimiento y optimización del sistema.' },
  { id: 'prod-114', sku: 'SRV-DIAG-SITIO', name: 'Diagnóstico Técnico en Sitio / Domicilio', category: 'servicios', price: 250, description: 'Visita técnica presencial para revisión en negocio o domicilio en Teziutlán.' }
];

const CATALOG_SUMMARY = OFFICIAL_CATALOG.map(p => `- [${p.id}] ${p.name}: $${p.price} MXN (${p.category})`).join('\n');

const SYSTEM_PROMPT = `Eres "Fibi", el asistente técnico y comercial virtual con IA de Fiberlink Servicios TIC en Teziutlán, Puebla, México.
Tu trato es cálido, empático, ágil y profesional en español de México (trato de "tú").
Respuestas breves y directas (máximo 2-3 oraciones).

TIENES DOS MODOS DE ATENCIÓN:
1) MODO PEDIDOS / COTIZACIONES (mode = "order"):
- Se activa cuando el cliente pregunta precios, existencias, pide recomendaciones o desea comprar/cotizar equipamiento o servicios.
- CATÁLOGO OFICIAL Y PRECIOS REALES EN PESOS MEXICANOS ($ MXN):
${CATALOG_SUMMARY}
- REGLAS DE PEDIDOS:
  * Brinda precios exactos del catálogo en MXN.
  * Incluye en "suggestedProducts" los productos relevantes (máximo 3) con { id, name, price, category }.
  * Si el cliente indica que quiere agregar artículos (ej. "agrega un lector", "quiero 2 impresoras y 1 cajón"), actualiza "orderDraft.items" calculando cantidades, subtotales y el "total".
  * Pide al cliente su nombre, WhatsApp a 10 dígitos y modalidad de entrega (A domicilio en Teziutlán o Recoger en sucursal).
  * Cuando el pedido tenga artículos y los datos esenciales, presenta el total y solicita confirmación (action = "confirm").

2) MODO SOPORTE TÉCNICO / TICKETS (mode = "ticket"):
- Se activa cuando el cliente tiene un problema técnico, falla, lentitud o descompostura.
- NO des soluciones largas paso a paso; ofrece un pre-diagnóstico de UNA línea y captura los datos para que un técnico humano lo atienda:
  problema → servicio (${SERVICES.join(' | ')}) → modalidad (${MODALITIES.join(' | ')}) → nombre → WhatsApp 10 dígitos → dirección (si es a domicilio).
- Prioridad: "Urgente" si el negocio está detenido; "Alta" si afecta operación; "Normal" en otros casos.
- Al tener los datos completos, pide confirmación (action = "confirm"). Tras el sí, pon action = "submit".

Devuelve SIEMPRE el JSON estructurado según el esquema.`;

const RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    reply: { type: 'STRING', description: 'Respuesta breve y empática para el cliente en español de México.' },
    mode: { type: 'STRING', enum: ['ticket', 'order'], description: 'Modo de la conversación: ticket de soporte o pedido de catálogo.' },
    diagnosis: { type: 'STRING', description: 'Pre-diagnóstico de una línea o nota técnica.' },
    action: { type: 'STRING', enum: ['collect', 'confirm', 'submit'] },
    quickReplies: { type: 'ARRAY', items: { type: 'STRING' }, description: 'Hasta 3 respuestas rápidas sugeridas.' },
    suggestedProducts: {
      type: 'ARRAY',
      description: 'Productos sugeridos del catálogo para compra o cotización.',
      items: {
        type: 'OBJECT',
        properties: {
          id: { type: 'STRING' },
          name: { type: 'STRING' },
          price: { type: 'NUMBER' },
          category: { type: 'STRING' }
        },
        required: ['id', 'name', 'price']
      }
    },
    orderDraft: {
      type: 'OBJECT',
      description: 'Borrador del pedido comercial.',
      properties: {
        items: {
          type: 'ARRAY',
          items: {
            type: 'OBJECT',
            properties: {
              id: { type: 'STRING' },
              name: { type: 'STRING' },
              qty: { type: 'INTEGER' },
              price: { type: 'NUMBER' },
              subtotal: { type: 'NUMBER' }
            },
            required: ['id', 'name', 'qty', 'price', 'subtotal']
          }
        },
        total: { type: 'NUMBER' },
        clientName: { type: 'STRING' },
        clientPhone: { type: 'STRING' },
        deliveryType: { type: 'STRING' },
        deliveryAddress: { type: 'STRING' }
      }
    },
    draft: {
      type: 'OBJECT',
      properties: {
        name: { type: 'STRING' },
        phone: { type: 'STRING' },
        service: { type: 'STRING' },
        modality: { type: 'STRING' },
        priority: { type: 'STRING' },
        address: { type: 'STRING' },
        description: { type: 'STRING' }
      }
    }
  },
  required: ['reply', 'action']
};

// ------------------------------------------
// Utilidades de normalización
// ------------------------------------------
function pickAllowed(value, allowed, fallback = '') {
  if (!value) return fallback;
  const v = String(value).toLowerCase();
  return allowed.find(a => a.toLowerCase() === v)
    || allowed.find(a => v.includes(a.toLowerCase().split(' ')[0]))
    || fallback;
}

export function normalizeDraft(draft = {}, prev = {}) {
  const merged = { ...prev };
  for (const [k, v] of Object.entries(draft || {})) {
    if (typeof v === 'string' && v.trim()) merged[k] = v.trim();
  }
  if (merged.phone) {
    const digits = merged.phone.replace(/\D/g, '');
    merged.phone = digits.length >= 10 ? digits.slice(-10) : '';
  }
  merged.service = pickAllowed(merged.service, SERVICES, merged.service ? 'Otro servicio TIC' : '');
  merged.modality = pickAllowed(merged.modality, MODALITIES);
  merged.priority = pickAllowed(merged.priority, PRIORITIES, 'Normal');
  if (merged.name && merged.name.length > 60) merged.name = merged.name.slice(0, 60);
  if (merged.description && merged.description.length > 600) merged.description = merged.description.slice(0, 600);
  return merged;
}

export function getMissingFields(d = {}) {
  const missing = [];
  if (!d.description) missing.push('description');
  if (!d.service) missing.push('service');
  if (!d.modality) missing.push('modality');
  if (!d.name) missing.push('name');
  if (!d.phone || d.phone.length !== 10) missing.push('phone');
  if (d.modality === 'En Sitio / Domicilio' && !d.address) missing.push('address');
  return missing;
}

// ------------------------------------------
// Motor local de respaldo (sin API key / sin red)
// ------------------------------------------
const SERVICE_KEYWORDS = [
  ['Punto de Venta POS', /(punto de venta|pos\b|caja|cobr|ticketera|terminal|lector|esc[aá]ner de c[oó]digo|factur)/i, 'Posible bloqueo del software de cobro o de la conexión con periféricos.'],
  ['Redes / WiFi', /(internet|wi-?fi|red\b|router|m[oó]dem|se cae|sin se[nñ]al|conexi[oó]n|lent[ao] el internet)/i, 'Posible falla en router/módem, cableado o el proveedor de internet.'],
  ['Videovigilancia CCTV', /(c[aá]mara|cctv|dvr|nvr|vigilancia|grabaci[oó]n)/i, 'Posible desconexión de cámaras, disco del grabador o acceso remoto.'],
  ['Presencia Web / Nube', /(p[aá]gina web|sitio|dominio|correo|hosting|nube|google workspace|outlook)/i, 'Posible configuración de dominio, correo o servicio en la nube.'],
  ['Soporte técnico', /(computadora|pc|laptop|lent[ao]|virus|impresora|no prende|pantalla|windows|office|contrase[nñ]a|archivo)/i, 'Posible saturación del sistema, malware o falla de hardware.']
];

function localExtract(text, d) {
  const t = text.trim();
  const phone = t.replace(/[\s-]/g, '').match(/(\+?52)?(\d{10})/);
  if (phone) d.phone = phone[2];

  const name = t.match(/(?:me llamo|mi nombre es|soy)\s+([A-Za-zÁÉÍÓÚÑáéíóúñ]+(?:\s+[A-Za-zÁÉÍÓÚÑáéíóúñ]+){0,3})/i);
  if (name) {
    let n = name[1].trim();
    n = n.replace(/\b(tel|telefono|teléfono|cel|celular|whats|whatsapp|mi|de)\b.*$/i, '').trim();
    if (n) d.name = n;
  }

  for (const [svc, rx] of SERVICE_KEYWORDS) {
    if (rx.test(t)) { if (!d.service) d.service = svc; break; }
  }
  if (/remot|a distancia|en l[ií]nea/i.test(t)) d.modality = 'Remoto';
  else if (/taller|lo llevo|llevarlo/i.test(t)) d.modality = 'En Taller';
  else if (/domicilio|en sitio|vengan|visita|mi negocio|mi local|presencial/i.test(t)) d.modality = 'En Sitio / Domicilio';

  if (/(no puedo cobrar|urgente|detenid|sin internet|no funciona nada|ca[ií]do|emergencia)/i.test(t)) d.priority = 'Urgente';
  else if (/(r[aá]pido|pronto|afecta|clientes esperando)/i.test(t) && d.priority !== 'Urgente') d.priority = 'Alta';
}

function localDiagnosis(d) {
  const hit = SERVICE_KEYWORDS.find(([svc]) => svc === d.service);
  return hit ? hit[2] : '';
}

function localFindProducts(text) {
  const t = text.toLowerCase();
  const hits = [];
  if (/(caj[oó]n|dinero|caja registradora)/i.test(t)) hits.push(OFFICIAL_CATALOG.find(p => p.id === 'prod-101'));
  if (/(impresora|ticketera|58mm|termica 58)/i.test(t)) hits.push(OFFICIAL_CATALOG.find(p => p.id === 'prod-102'));
  if (/(impresora.*80|80mm|autocorte|guillotina)/i.test(t)) hits.push(OFFICIAL_CATALOG.find(p => p.id === 'prod-103'));
  if (/(lector|c[oó]digo|barra|qr|escaner|esc[aá]ner)/i.test(t)) hits.push(OFFICIAL_CATALOG.find(p => p.id === 'prod-104'));
  if (/(c[aá]mara|colorvu|bala|hikvision)/i.test(t)) hits.push(OFFICIAL_CATALOG.find(p => p.id === 'prod-105'));
  if (/(kit.*c[aá]mara|dvr|vigilancia|seguridad)/i.test(t)) hits.push(OFFICIAL_CATALOG.find(p => p.id === 'prod-106'));
  if (/(cable|utp|cat6|red)/i.test(t)) hits.push(OFFICIAL_CATALOG.find(p => p.id === 'prod-107'));
  if (/(access point|unifi|wifi 6|u6|ubiquiti)/i.test(t)) hits.push(OFFICIAL_CATALOG.find(p => p.id === 'prod-108'));
  if (/(windows|licencia|win 11|pro)/i.test(t)) hits.push(OFFICIAL_CATALOG.find(p => p.id === 'prod-109'));
  if (/(sistema.*pos|software.*pos|software.*punto|punto de venta)/i.test(t)) hits.push(OFFICIAL_CATALOG.find(p => p.id === 'prod-110'));
  if (/(ssd|disco|estado solido|kingston)/i.test(t)) hits.push(OFFICIAL_CATALOG.find(p => p.id === 'prod-111'));
  if (/(ram|memoria|ddr4)/i.test(t)) hits.push(OFFICIAL_CATALOG.find(p => p.id === 'prod-112'));
  if (/(mantenimiento|pasta termica|limpieza)/i.test(t)) hits.push(OFFICIAL_CATALOG.find(p => p.id === 'prod-113'));
  return hits.filter(Boolean).slice(0, 3);
}

function localEngine(messages, prevDraft, prevOrderDraft = {}) {
  const d = { ...prevDraft };
  const userMsgs = messages.filter(m => m.role === 'user');
  const last = userMsgs[userMsgs.length - 1]?.text || '';
  const isOrderQuery = /(precio|cuanto|cuánto|costo|cotiz|compr|pedir|pedido|venden|catalogo|catálogo|cajon|cajón|impresora|lector|cámara|camara|licencia|kit)/i.test(last);

  if (isOrderQuery) {
    const products = localFindProducts(last);
    const suggested = products.length ? products : OFFICIAL_CATALOG.slice(0, 3);
    const prodList = suggested.map(p => `• **${p.name}** en **$${p.price} MXN**`).join('\n');
    return {
      reply: `¡Con gusto! Aquí tienes opciones con precio oficial en Teziutlán:\n${prodList}\n¿Te gustaría agregar alguno a tu pedido o prefieres que te ayudemos a armar un combo completo?`,
      mode: 'order',
      diagnosis: 'Equipamiento en stock con garantía Fiberlink.',
      action: 'collect',
      quickReplies: suggested.map(p => `Agregar ${p.name.split(' ')[0]}`),
      suggestedProducts: suggested.map(p => ({ id: p.id, name: p.name, price: p.price, category: p.category })),
      orderDraft: prevOrderDraft,
      draft: d
    };
  }

  const prevMissing = getMissingFields(normalizeDraft(prevDraft));
  const asked = prevMissing[0];

  localExtract(last, d);

  // Asignar respuesta directa al campo que se estaba preguntando
  if (asked === 'description' && !prevDraft.description && last.length > 3) d.description = last;
  if (asked === 'name' && !d.name && /^[A-Za-zÁÉÍÓÚÑáéíóúñ\s.]{2,60}$/.test(last.trim())) d.name = last.trim();
  if (asked === 'address' && !d.address && last.length > 5) d.address = last.trim();
  if (asked === 'service' && !d.service) d.service = pickAllowed(last, SERVICES, 'Otro servicio TIC');
  if (asked === 'modality' && !d.modality) {
    d.modality = pickAllowed(last, MODALITIES) || (/sitio|domicilio/i.test(last) ? 'En Sitio / Domicilio' : '');
  }

  const draft = normalizeDraft(d);
  const missing = getMissingFields(draft);
  const diagnosis = localDiagnosis(draft);
  const firstName = draft.name ? draft.name.split(' ')[0] : '';

  if (!missing.length) {
    const confirmed = /^(s[ií]|si|correcto|confirm|adelante|ok|listo|de acuerdo|claro)/i.test(last.trim()) && prevMissing.length === 0;
    if (confirmed) {
      return { reply: `¡Perfecto${firstName ? ', ' + firstName : ''}! Estoy levantando tu ticket ahora mismo. 🚀`, mode: 'ticket', diagnosis, action: 'submit', quickReplies: [], draft };
    }
    return {
      reply: `Gracias${firstName ? ', ' + firstName : ''}. Ya tengo todo: revisa el resumen y confírmame para enviarlo al equipo técnico.`,
      mode: 'ticket',
      diagnosis, action: 'confirm', quickReplies: ['Sí, confirmar ticket', 'Corregir un dato'], draft
    };
  }

  const prompts = {
    description: { r: '¡Hola! Soy Fibi, tu asistente de Fiberlink en Teziutlán. 👋 ¿En qué te podemos apoyar hoy? ¿Requieres soporte técnico o cotizar un equipo?', q: ['Cotizar Punto de Venta', 'Mi computadora está lenta', 'Cámaras de seguridad'] },
    service: { r: 'Entiendo, vamos a ayudarte. ¿Con qué área se relaciona tu solicitud?', q: ['Soporte técnico', 'Redes / WiFi', 'Punto de Venta POS'] },
    modality: { r: `${diagnosis ? 'Entiendo lo molesto que es esto; un técnico lo revisará a detalle. ' : ''}¿Cómo prefieres la atención?`, q: ['Remoto', 'En Sitio / Domicilio', 'En Taller'] },
    name: { r: 'Perfecto. ¿A nombre de quién registro la solicitud?', q: [] },
    phone: { r: `Gracias${firstName ? ', ' + firstName : ''}. ¿Me compartes tu número de WhatsApp a 10 dígitos para que el técnico te contacte?`, q: [] },
    address: { r: '¿Cuál es la dirección o colonia donde realizaremos la visita?', q: [] }
  };
  const p = prompts[missing[0]];
  return { reply: p.r, mode: 'ticket', diagnosis, action: 'collect', quickReplies: p.q, draft };
}

// ------------------------------------------
// Llamada a Gemini
// ------------------------------------------
async function callGemini(messages, prevDraft, prevOrderDraft, apiKey) {
  let model = process.env.GEMINI_MODEL || DEFAULT_MODEL;
  if (!model || ['gemini-2.5-flash', 'gemini-1.5-flash', 'gemini-2.0-flash', 'gemini-2.5-flash-lite', 'gemini-flash-latest'].includes(model)) {
    model = 'gemini-flash-lite-latest';
  }
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

  const contents = messages.slice(-16).map(m => ({
    role: m.role === 'user' ? 'user' : 'model',
    parts: [{ text: String(m.text || '').slice(0, 1200) }]
  }));
  // Contexto de estado: borrador actual y campos pendientes
  contents.push({
    role: 'user',
    parts: [{ text: `[ESTADO INTERNO - no lo menciones] Borrador ticket actual: ${JSON.stringify(prevDraft)}. Borrador pedido actual: ${JSON.stringify(prevOrderDraft || {})}. Responde al último mensaje del cliente con precios exactos del catálogo si pregunta por productos, o capturando el ticket si reporta un problema.` }]
  });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 25000);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      signal: controller.signal,
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents,
        generationConfig: {
          temperature: 0.35,
          maxOutputTokens: 2048,
          responseMimeType: 'application/json',
          responseSchema: RESPONSE_SCHEMA
        }
      })
    });
    if (!res.ok) throw new Error(`Gemini HTTP ${res.status}: ${(await res.text()).slice(0, 250)}`);
    const data = await res.json();
    const raw = data?.candidates?.[0]?.content?.parts?.map(p => p.text).join('') || '';
    return JSON.parse(raw);
  } finally {
    clearTimeout(timer);
  }
}

export async function handleAssistantChat(body = {}) {
  ensureEnv();
  const messages = Array.isArray(body.messages) ? body.messages.filter(m => m && m.text) : [];
  const prevDraft = normalizeDraft(body.draft || {});
  const prevOrderDraft = body.orderDraft && typeof body.orderDraft === 'object' ? body.orderDraft : {};

  if (!messages.length) {
    const out = localEngine([], prevDraft, prevOrderDraft);
    return { status: 200, data: { ...out, missing: getMissingFields(out.draft), engine: 'local' } };
  }

  const apiKey = (process.env.GEMINI_API_KEY || '').trim();
  let lastGeminiErr = null;
  if (apiKey) {
    try {
      const ai = await callGemini(messages, prevDraft, prevOrderDraft, apiKey);
      const mode = ai.mode === 'order' ? 'order' : 'ticket';
      const draft = normalizeDraft(ai.draft, prevDraft);
      const missing = getMissingFields(draft);
      let action = ['collect', 'confirm', 'submit'].includes(ai.action) ? ai.action : 'collect';
      if (mode === 'ticket' && missing.length) action = 'collect';

      return {
        status: 200,
        data: {
          reply: String(ai.reply || '').slice(0, 750) || '¿En qué te podemos apoyar hoy?',
          mode,
          diagnosis: String(ai.diagnosis || '').slice(0, 220),
          action,
          quickReplies: Array.isArray(ai.quickReplies) ? ai.quickReplies.slice(0, 3) : [],
          suggestedProducts: Array.isArray(ai.suggestedProducts) ? ai.suggestedProducts.slice(0, 4) : [],
          orderDraft: ai.orderDraft && typeof ai.orderDraft === 'object' ? ai.orderDraft : prevOrderDraft,
          draft,
          missing,
          engine: 'gemini'
        }
      };
    } catch (err) {
      lastGeminiErr = err.message;
      console.warn('[assistantController] Gemini no disponible, usando motor local:', err.message);
    }
  }

  const out = localEngine(messages, prevDraft, prevOrderDraft);
  return { status: 200, data: { ...out, missing: getMissingFields(out.draft), engine: 'local', geminiError: lastGeminiErr } };
}
