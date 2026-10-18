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

const DEFAULT_MODEL = 'gemini-flash-latest';
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

const SYSTEM_PROMPT = `Eres "Fibi", el asistente técnico virtual de Fiberlink Servicios TIC (Teziutlán, Puebla, México).
Tu ÚNICO objetivo es levantar una solicitud de servicio (ticket) para que un técnico humano la atienda.

PERSONALIDAD:
- Actitud de servicio, cálida, empática y profesional. Español de México, trato de "tú".
- Respuestas MUY breves (máximo 2-3 oraciones). Usa como máximo 1 emoji ocasional.
- Valida la frustración del cliente ("Entiendo lo molesto que es...") antes de pedir datos.

REGLAS ESTRICTAS:
- NO resuelvas el problema ni des instrucciones técnicas paso a paso. Solo ofrece un pre-diagnóstico de UNA línea (posible causa) y aclara que un técnico lo revisará.
- Pide UN dato a la vez, en este orden: descripción del problema → servicio → modalidad (Remoto, En Sitio / Domicilio, En Taller) → nombre → WhatsApp a 10 dígitos → dirección (solo si es En Sitio / Domicilio).
- Infiere todo lo que puedas del mensaje (servicio, prioridad, modalidad) sin volver a preguntarlo.
- Prioridad: "Urgente" si el negocio está detenido (no puede cobrar, sin internet, caída total); "Alta" si afecta la operación; si no, "Normal".
- Cuando tengas todos los datos, presenta un resumen corto y pide confirmación. Si el usuario confirma (sí, correcto, adelante, confirmo), pon action="submit".
- Si el usuario pregunta precios o temas ajenos, responde en una línea que un asesor le dará detalles y regresa a la captura.
- Nunca inventes folios, precios ni tiempos exactos.

VALORES PERMITIDOS:
- service: ${SERVICES.join(' | ')}
- modality: ${MODALITIES.join(' | ')}
- priority: ${PRIORITIES.join(' | ')}

Devuelve SIEMPRE el borrador completo actualizado (conserva los datos previos).`;

const RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    reply: { type: 'STRING', description: 'Respuesta breve y empática para el cliente.' },
    diagnosis: { type: 'STRING', description: 'Pre-diagnóstico de una línea (posible causa). Vacío si aún no hay datos.' },
    action: { type: 'STRING', enum: ['collect', 'confirm', 'submit'] },
    quickReplies: { type: 'ARRAY', items: { type: 'STRING' }, description: 'Hasta 3 respuestas rápidas sugeridas.' },
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
  required: ['reply', 'action', 'draft']
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

function localEngine(messages, prevDraft) {
  const d = { ...prevDraft };
  const userMsgs = messages.filter(m => m.role === 'user');
  const last = userMsgs[userMsgs.length - 1]?.text || '';
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
      return { reply: `¡Perfecto${firstName ? ', ' + firstName : ''}! Estoy levantando tu ticket ahora mismo. 🚀`, diagnosis, action: 'submit', quickReplies: [], draft };
    }
    return {
      reply: `Gracias${firstName ? ', ' + firstName : ''}. Ya tengo todo: revisa el resumen y confírmame para enviarlo al equipo técnico.`,
      diagnosis, action: 'confirm', quickReplies: ['Sí, confirmar ticket', 'Corregir un dato'], draft
    };
  }

  const prompts = {
    description: { r: '¡Hola! Soy Fibi, tu asistente técnico de Fiberlink. 👋 Cuéntame brevemente, ¿qué está pasando con tu equipo o servicio?', q: ['Mi computadora está lenta', 'No puedo cobrar en caja', 'Se cae el internet'] },
    service: { r: 'Entiendo, vamos a ayudarte. ¿Con qué área se relaciona tu solicitud?', q: ['Soporte técnico', 'Redes / WiFi', 'Punto de Venta POS'] },
    modality: { r: `${diagnosis ? 'Entiendo lo molesto que es esto; un técnico lo revisará a detalle. ' : ''}¿Cómo prefieres la atención?`, q: ['Remoto', 'En Sitio / Domicilio', 'En Taller'] },
    name: { r: 'Perfecto. ¿A nombre de quién registro la solicitud?', q: [] },
    phone: { r: `Gracias${firstName ? ', ' + firstName : ''}. ¿Me compartes tu número de WhatsApp a 10 dígitos para que el técnico te contacte?`, q: [] },
    address: { r: '¿Cuál es la dirección o colonia donde realizaremos la visita?', q: [] }
  };
  const p = prompts[missing[0]];
  return { reply: p.r, diagnosis, action: 'collect', quickReplies: p.q, draft };
}

// ------------------------------------------
// Llamada a Gemini
// ------------------------------------------
async function callGemini(messages, prevDraft, apiKey) {
  let model = process.env.GEMINI_MODEL || DEFAULT_MODEL;
  if (!model || ['gemini-2.5-flash', 'gemini-1.5-flash', 'gemini-2.0-flash', 'gemini-2.5-flash-lite'].includes(model)) {
    model = 'gemini-flash-latest';
  }
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

  const contents = messages.slice(-16).map(m => ({
    role: m.role === 'user' ? 'user' : 'model',
    parts: [{ text: String(m.text || '').slice(0, 1200) }]
  }));
  // Contexto de estado: borrador actual y campos pendientes
  contents.push({
    role: 'user',
    parts: [{ text: `[ESTADO INTERNO - no lo menciones] Borrador actual: ${JSON.stringify(prevDraft)}. Campos faltantes: ${getMissingFields(normalizeDraft(prevDraft)).join(', ') || 'ninguno'}. Responde al último mensaje del cliente.` }]
  });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      signal: controller.signal,
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents,
        generationConfig: {
          temperature: 0.4,
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

  if (!messages.length) {
    const out = localEngine([], prevDraft);
    return { status: 200, data: { ...out, missing: getMissingFields(out.draft), engine: 'local' } };
  }

  const apiKey = (process.env.GEMINI_API_KEY || '').trim();
  let lastGeminiErr = null;
  if (apiKey) {
    try {
      const ai = await callGemini(messages, prevDraft, apiKey);
      const draft = normalizeDraft(ai.draft, prevDraft);
      const missing = getMissingFields(draft);
      let action = ['collect', 'confirm', 'submit'].includes(ai.action) ? ai.action : 'collect';
      if (missing.length) action = 'collect'; // nunca enviar incompleto
      return {
        status: 200,
        data: {
          reply: String(ai.reply || '').slice(0, 600) || 'Cuéntame un poco más, por favor.',
          diagnosis: String(ai.diagnosis || '').slice(0, 220),
          action,
          quickReplies: Array.isArray(ai.quickReplies) ? ai.quickReplies.slice(0, 3) : [],
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

  const out = localEngine(messages, prevDraft);
  return { status: 200, data: { ...out, missing: getMissingFields(out.draft), engine: 'local', geminiError: lastGeminiErr } };
}
