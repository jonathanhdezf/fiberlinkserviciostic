// ==========================================
// FIBERLINK PDF RECEIPT GENERATOR (jsPDF)
// Descarga directa de:
// 1) Recibo de Recolección de Equipo en Domicilio
// 2) Recibo de Entrega de Equipo al Finalizar Servicio
// ==========================================

import { jsPDF } from 'jspdf';

const DEFAULT_LOGO_URL = '/logo.gif';
const logoAssetCache = new Map();

async function loadLogoAsset(logoSrc = DEFAULT_LOGO_URL) {
  const src = String(logoSrc || '').trim() || DEFAULT_LOGO_URL;
  if (logoAssetCache.has(src)) {
    return logoAssetCache.get(src);
  }
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return null;
  }

  const asset = await new Promise((resolve) => {
    let settled = false;
    const finish = (val) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(val);
    };

    const timer = setTimeout(() => finish(null), 1500);
    const img = new Image();
    if (/^https?:\/\//i.test(src) && !src.startsWith(window.location.origin)) {
      img.crossOrigin = 'anonymous';
    }

    img.onload = () => {
      try {
        const natW = img.naturalWidth || 128;
        const natH = img.naturalHeight || 128;
        const scale = Math.max(1, Math.ceil(256 / Math.max(natW, natH)));
        const canvas = document.createElement('canvas');
        canvas.width = natW * scale;
        canvas.height = natH * scale;
        const ctx = canvas.getContext('2d');
        if (!ctx) return finish(null);
        ctx.imageSmoothingEnabled = !src.toLowerCase().endsWith('.gif');
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/png');
        finish({ dataUrl, width: natW, height: natH });
      } catch (_) {
        finish(null);
      }
    };

    img.onerror = () => finish(null);
    img.src = src;
  });

  if (asset) {
    logoAssetCache.set(src, asset);
  } else if (src !== DEFAULT_LOGO_URL) {
    return loadLogoAsset(DEFAULT_LOGO_URL);
  }
  return asset;
}

function safeText(val, fallback = 'No especificado') {
  const s = String(val ?? '').trim();
  return s || fallback;
}

function formatDateTime(iso) {
  if (!iso) return new Date().toLocaleString('es-MX');
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  return d.toLocaleString('es-MX', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function formatMoney(val) {
  const n = Number(val) || 0;
  return '$' + n.toLocaleString('es-MX', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function sanitizeSignaturePng(val) {
  if (typeof val !== 'string') return '';
  const trimmed = val.trim();
  return /^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(trimmed) ? trimmed : '';
}

function normalizeEquipment(ticket) {
  const eq = ticket?.equipment && typeof ticket.equipment === 'object' ? ticket.equipment : {};
  return {
    deviceType: safeText(eq.deviceType, 'Equipo / Dispositivo TIC'),
    brandModel: safeText(eq.brandModel, 'Por confirmar en sitio'),
    serialNumber: safeText(eq.serialNumber, 'S/N no registrado'),
    accessories: safeText(eq.accessories, 'Sin accesorios adicionales'),
    physicalCondition: safeText(eq.physicalCondition, 'Revisión visual estándar al momento de la atención'),
    pickupAt: eq.pickupAt || ticket?.createdAt || new Date().toISOString(),
    deliveredAt: eq.deliveredAt || new Date().toISOString(),
    deliveredTo: safeText(eq.deliveredTo, ticket?.name || 'Cliente titular'),
    deliveryNotes: safeText(eq.deliveryNotes, ''),
    pickupSignature: sanitizeSignaturePng(eq.pickupSignature),
    techPickupSignature: sanitizeSignaturePng(eq.techPickupSignature),
    deliverySignature: sanitizeSignaturePng(eq.deliverySignature),
    techDeliverySignature: sanitizeSignaturePng(eq.techDeliverySignature)
  };
}

function drawHeader(doc, badgeTitle, folio, rightLabel, rightValue, logoAsset = null) {
  const pageW = doc.internal.pageSize.getWidth();

  // Dark slate header banner
  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, pageW, 34, 'F');

  // Accent bar
  doc.setFillColor(156, 195, 46);
  doc.rect(0, 34, pageW, 2.2, 'F');

  let textX = 14;
  if (logoAsset?.dataUrl) {
    const frameX = 14;
    const frameY = 6;
    const frameSize = 14;
    doc.setFillColor(30, 41, 59);
    doc.setDrawColor(156, 195, 46);
    doc.setLineWidth(0.35);
    doc.roundedRect(frameX, frameY, frameSize, frameSize, 1.8, 1.8, 'FD');

    const pad = 1.1;
    const maxBox = frameSize - pad * 2;
    const ratio = (logoAsset.width || 1) / (logoAsset.height || 1);
    const drawW = ratio >= 1 ? maxBox : maxBox * ratio;
    const drawH = ratio >= 1 ? maxBox / ratio : maxBox;
    const drawX = frameX + (frameSize - drawW) / 2;
    const drawY = frameY + (frameSize - drawH) / 2;
    doc.addImage(logoAsset.dataUrl, 'PNG', drawX, drawY, drawW, drawH);

    textX = frameX + frameSize + 3.5;
  }

  // Brand title
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14.5);
  doc.text('FIBERLINK SERVICIOS TIC', textX, 12.2);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(203, 213, 225);
  const subtitleMaxW = Math.max(80, pageW - 68 - textX - 4);
  doc.text(
    'Teziutlán, Puebla  |  Tel / WhatsApp: 231 102 4672  |  Soporte, Redes, CCTV y POS',
    textX,
    17.8,
    { maxWidth: subtitleMaxW }
  );

  // Document type badge
  doc.setFillColor(30, 41, 59);
  doc.roundedRect(14, 22.8, 124, 7.5, 1.5, 1.5, 'F');
  doc.setTextColor(156, 195, 46);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.text(badgeTitle, 17, 27.9);

  // Folio & timestamp box on right
  doc.setFillColor(30, 41, 59);
  doc.roundedRect(pageW - 68, 6, 54, 23, 2, 2, 'F');
  doc.setTextColor(148, 163, 184);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.text('FOLIO DE TICKET', pageW - 64, 11.5);

  doc.setTextColor(156, 195, 46);
  doc.setFontSize(13);
  doc.text(safeText(folio, 'FL-0000'), pageW - 64, 18);

  doc.setTextColor(226, 232, 240);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.3);
  doc.text(`${rightLabel}: ${rightValue}`, pageW - 64, 24.5, { maxWidth: 48 });
}

function drawSectionTitle(doc, y, title) {
  const pageW = doc.internal.pageSize.getWidth();
  doc.setFillColor(241, 245, 249);
  doc.rect(14, y, pageW - 28, 7, 'F');
  doc.setFillColor(156, 195, 46);
  doc.rect(14, y, 2.5, 7, 'F');

  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.text(title, 19, y + 4.9);
  return y + 10.5;
}

function drawKeyValueRow(doc, x, y, label, value, maxWidth = 86) {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.2);
  doc.setTextColor(71, 85, 105);
  doc.text(label, x, y);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.2);
  doc.setTextColor(15, 23, 42);
  const lines = doc.splitTextToSize(safeText(value, '-'), maxWidth);
  doc.text(lines, x, y + 4.2);
  return y + 4.2 + lines.length * 4.2 + 1.5;
}

function drawSignatures(doc, y, leftTitle, leftSub, rightTitle, rightSub, signatures = {}) {
  const pageW = doc.internal.pageSize.getWidth();
  const boxY = Math.max(y, 240);

  const leftSig = sanitizeSignaturePng(signatures?.leftSignature);
  if (leftSig) {
    try {
      doc.addImage(leftSig, 'PNG', 38, boxY + 0.8, 38, 13);
    } catch (_) {
      // Ignore malformed signature raster
    }
  }

  const rightSig = sanitizeSignaturePng(signatures?.rightSignature);
  if (rightSig) {
    try {
      doc.addImage(rightSig, 'PNG', pageW - 76, boxY + 0.8, 38, 13);
    } catch (_) {
      // Ignore malformed signature raster
    }
  }

  doc.setDrawColor(148, 163, 184);
  doc.setLineWidth(0.35);
  doc.line(22, boxY + 14, 92, boxY + 14);
  doc.line(pageW - 92, boxY + 14, pageW - 22, boxY + 14);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(15, 23, 42);
  doc.text(leftTitle, 57, boxY + 19, { align: 'center' });
  doc.text(rightTitle, pageW - 57, boxY + 19, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.6);
  doc.setTextColor(100, 116, 139);
  doc.text(leftSub, 57, boxY + 23.2, { align: 'center', maxWidth: 68 });
  doc.text(rightSub, pageW - 57, boxY + 23.2, { align: 'center', maxWidth: 68 });
}

function drawFooter(doc, note) {
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  doc.setDrawColor(226, 232, 240);
  doc.line(14, pageH - 13, pageW - 14, pageH - 13);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.3);
  doc.setTextColor(100, 116, 139);
  doc.text(note, pageW / 2, pageH - 8, { align: 'center' });
}

export async function downloadEquipmentPickupReceiptPdf(ticket, options = {}) {
  if (!ticket) return false;
  const logoAsset = await loadLogoAsset(options?.logoUrl || DEFAULT_LOGO_URL);
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' });
  const eq = normalizeEquipment(ticket);
  const folio = safeText(ticket.folio, 'FL-0000');
  const pageW = doc.internal.pageSize.getWidth();

  drawHeader(
    doc,
    'RECIBO DE RECOLECCION DE EQUIPO EN DOMICILIO',
    folio,
    'Recoleccion',
    formatDateTime(eq.pickupAt),
    logoAsset
  );

  let y = 43;

  // Section 1: Client & Pickup Location
  y = drawSectionTitle(doc, y, '1. DATOS DEL CLIENTE Y DOMICILIO DE RECOLECCION');
  const clientName = ticket.company ? `${safeText(ticket.name)} (${ticket.company})` : safeText(ticket.name);
  const leftY1 = drawKeyValueRow(doc, 16, y, 'Cliente / Empresa:', clientName, 88);
  const leftY2 = drawKeyValueRow(doc, 16, leftY1, 'Domicilio de recoleccion:', safeText(ticket.address, 'Domicilio por confirmar'), 88);
  const leftY3 = drawKeyValueRow(doc, 16, leftY2, 'Recibe el equipo (Entrega):', eq.deliveredTo, 88);

  const rightY1 = drawKeyValueRow(doc, 112, y, 'Telefono / WhatsApp:', safeText(ticket.phone, 'Sin telefono'), 84);
  const rightY2 = drawKeyValueRow(doc, 112, rightY1, 'Servicio / Modalidad:', `${safeText(ticket.service)} · ${safeText(ticket.modality)}`, 84);
  const rightY3 = drawKeyValueRow(doc, 112, rightY2, 'Tecnico que recoge:', safeText(ticket.assignedTo, 'Tecnico Fiberlink'), 84);

  y = Math.max(leftY3, rightY3) + 3;

  // Section 2: Equipment Details
  y = drawSectionTitle(doc, y, '2. INVENTARIO Y ESTADO DEL EQUIPO RECOLECTADO');
  const eqL1 = drawKeyValueRow(doc, 16, y, 'Tipo de equipo:', eq.deviceType, 88);
  const eqL2 = drawKeyValueRow(doc, 16, eqL1, 'Marca / Modelo:', eq.brandModel, 88);
  const eqL3 = drawKeyValueRow(doc, 16, eqL2, 'Numero de Serie / IMEI:', eq.serialNumber, 88);

  const eqR1 = drawKeyValueRow(doc, 112, y, 'Accesorios y cables recibidos:', eq.accessories, 84);
  const eqR2 = drawKeyValueRow(doc, 112, eqR1, 'Estado fisico al recoger:', eq.physicalCondition, 84);

  y = Math.max(eqL3, eqR2) + 3;

  // Section 3: Reported Fault
  y = drawSectionTitle(doc, y, '3. FALLA REPORTADA / MOTIVO DEL RETIRO');
  doc.setDrawColor(203, 213, 225);
  doc.setFillColor(248, 250, 252);
  const faultLines = doc.splitTextToSize(safeText(ticket.description, 'Revision y diagnostico tecnico en taller.'), pageW - 36);
  const faultHeight = Math.max(18, faultLines.length * 4.5 + 8);
  doc.roundedRect(14, y - 1, pageW - 28, faultHeight, 1.5, 1.5, 'FD');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.2);
  doc.setTextColor(15, 23, 42);
  doc.text(faultLines, 18, y + 5);
  y += faultHeight + 6;

  // Section 4: Custody & Terms
  y = drawSectionTitle(doc, y, '4. CONDICIONES DE RESGUARDO Y DIAGNOSTICO');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.2);
  doc.setTextColor(51, 65, 85);
  const clauses = [
    '1. El equipo descrito queda bajo resguardo tecnico de Fiberlink Servicios TIC para su revision, diagnostico o reparacion.',
    '2. El cliente declara que la informacion contenida cuenta con respaldo previo o autoriza el manejo tecnico necesario.',
    '3. Cualquier costo adicional de refacciones o mano de obra sera informado y autorizado antes de proceder.',
    '4. Este comprobante ampara el retiro del equipo en domicilio; para su entrega final se emitira el Recibo de Entrega.'
  ];
  clauses.forEach((line) => {
    const wrapped = doc.splitTextToSize(line, pageW - 32);
    doc.text(wrapped, 16, y);
    y += wrapped.length * 4 + 1.4;
  });

  drawSignatures(
    doc,
    y + 6,
    'Entrega Cliente en Domicilio',
    safeText(ticket.name, 'Nombre y firma de conformidad'),
    'Recoge Tecnico Fiberlink',
    safeText(ticket.assignedTo, 'Personal autorizado Fiberlink'),
    {
      leftSignature: eq.pickupSignature,
      rightSignature: eq.techPickupSignature
    }
  );

  drawFooter(
    doc,
    `Documento de Recoleccion · Folio ${folio} · Consulta avances con tu folio en fiberlink · Teziutlan, Pue.`
  );

  doc.save(`Recibo-Recoleccion-${folio}.pdf`);
  return true;
}

export async function downloadEquipmentDeliveryReceiptPdf(ticket, options = {}) {
  if (!ticket) return false;
  const logoAsset = await loadLogoAsset(options?.logoUrl || DEFAULT_LOGO_URL);
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' });
  const eq = normalizeEquipment(ticket);
  const folio = safeText(ticket.folio, 'FL-0000');
  const pageW = doc.internal.pageSize.getWidth();

  drawHeader(
    doc,
    'COMPROBANTE DE ENTREGA DE EQUIPO Y FIN DE SERVICIO',
    folio,
    'Entrega',
    formatDateTime(eq.deliveredAt),
    logoAsset
  );

  let y = 43;

  // Section 1: Client & Delivery Data
  y = drawSectionTitle(doc, y, '1. DATOS DE ENTREGA Y SERVICIO FINALIZADO');
  const clientName = ticket.company ? `${safeText(ticket.name)} (${ticket.company})` : safeText(ticket.name);
  const l1 = drawKeyValueRow(doc, 16, y, 'Cliente / Titular:', clientName, 88);
  const l2 = drawKeyValueRow(doc, 16, l1, 'Recibe el Equipo (Entrega):', eq.deliveredTo, 88);
  const l3 = drawKeyValueRow(doc, 16, l2, 'Domicilio de entrega:', safeText(ticket.address, 'Mostrador / Domicilio'), 88);

  const r1 = drawKeyValueRow(doc, 112, y, 'Telefono / WhatsApp:', safeText(ticket.phone, 'Sin telefono'), 84);
  const r2 = drawKeyValueRow(doc, 112, r1, 'Fecha recoleccion / ingreso:', formatDateTime(eq.pickupAt), 84);
  const r3 = drawKeyValueRow(doc, 112, r2, 'Tecnico que entrega:', safeText(ticket.assignedTo, 'Tecnico Fiberlink'), 84);

  y = Math.max(l3, r3) + 2;

  // Section 2: Returned Equipment
  y = drawSectionTitle(doc, y, '2. EQUIPO Y ACCESORIOS DEVUELTOS');
  const eqL1 = drawKeyValueRow(doc, 16, y, 'Equipo:', `${eq.deviceType} — ${eq.brandModel}`, 88);
  const eqL2 = drawKeyValueRow(doc, 16, eqL1, 'Numero de Serie / IMEI:', eq.serialNumber, 88);

  const eqR1 = drawKeyValueRow(doc, 112, y, 'Accesorios devueltos:', eq.accessories, 84);
  const eqR2 = drawKeyValueRow(doc, 112, eqR1, 'Estado fisico al entregar:', eq.physicalCondition, 84);

  y = Math.max(eqL2, eqR2) + 2;

  // Section 3: Work Performed / Delivery Notes
  y = drawSectionTitle(doc, y, '3. TRABAJO REALIZADO Y PRUEBAS DE ENTREGA');
  const lastLog = Array.isArray(ticket.bitacora) && ticket.bitacora.length > 0
    ? ticket.bitacora[ticket.bitacora.length - 1]?.note || ''
    : '';
  const diag = ticket.diagnosis && typeof ticket.diagnosis === 'object' ? ticket.diagnosis : {};
  const diagParts = [
    diag.verifiedFault ? `Falla: ${diag.verifiedFault}` : '',
    diag.technicalFindings ? `Diagnostico: ${diag.technicalFindings}` : '',
    diag.recommendedSolution ? `Solucion: ${diag.recommendedSolution}` : ''
  ].filter(Boolean).join(' · ');
  const summaryText = eq.deliveryNotes || diagParts || lastLog || ticket.description || 'Servicio tecnico completado y equipo probado frente al cliente.';
  const sumLines = doc.splitTextToSize(summaryText, pageW - 36);
  const sumH = Math.max(15, sumLines.length * 4.3 + 7);
  doc.setDrawColor(203, 213, 225);
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(14, y - 1, pageW - 28, sumH, 1.5, 1.5, 'FD');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.8);
  doc.setTextColor(15, 23, 42);
  doc.text(sumLines, 18, y + 4.5);
  y += sumH + 4;

  // Section 4: Charges / Settlement
  y = drawSectionTitle(doc, y, '4. RESUMEN DE CARGOS Y GARANTIA');
  const items = Array.isArray(ticket.pos?.items) ? ticket.pos.items : [];
  const total = Number(ticket.pos?.total) || 0;
  const isPaid = Boolean(ticket.pos?.paid);

  if (items.length > 0) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(71, 85, 105);
    doc.text('CONCEPTO', 16, y);
    doc.text('IMPORTE', pageW - 16, y, { align: 'right' });
    y += 2;
    doc.setDrawColor(203, 213, 225);
    doc.line(16, y, pageW - 16, y);
    y += 4;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.4);
    doc.setTextColor(15, 23, 42);
    items.slice(0, 6).forEach((item) => {
      const qtyPrefix = Number(item.qty) > 1 ? `${item.qty}x ` : '';
      doc.text(`${qtyPrefix}${safeText(item.concept, 'Servicio')}`, 16, y, { maxWidth: 135 });
      doc.text(formatMoney((Number(item.price) || 0) * (Number(item.qty) || 1)), pageW - 16, y, { align: 'right' });
      y += 4.5;
    });
    doc.line(16, y - 1, pageW - 16, y - 1);
    y += 3.5;
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(15, 23, 42);
  doc.text(
    `TOTAL DEL SERVICIO: ${formatMoney(total)}   |   ESTADO: ${total === 0 ? 'SIN CARGO / CUBIERTO' : (isPaid ? 'PAGADO [OK]' : 'PENDIENTE DE LIQUIDACION')}`,
    16,
    y
  );
  y += 5.5;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.8);
  doc.setTextColor(51, 65, 85);
  const warrantyLines = doc.splitTextToSize(
    'Conformidad y Garantia: Al firmar, el cliente confirma recibir su equipo completo, funcionando y en el estado fisico acordado. Garantia de 30 dias en mano de obra presentando este comprobante (no aplica en golpes, humedad o variaciones electricas).',
    pageW - 32
  );
  doc.text(warrantyLines, 16, y);
  y += warrantyLines.length * 3.8 + 4;

  drawSignatures(
    doc,
    y,
    'Recibe Equipo de Conformidad',
    safeText(eq.deliveredTo, 'Nombre y firma del cliente'),
    'Entrega Tecnico Fiberlink',
    safeText(ticket.assignedTo, 'Personal autorizado Fiberlink'),
    {
      leftSignature: eq.deliverySignature,
      rightSignature: eq.techDeliverySignature
    }
  );

  drawFooter(
    doc,
    `Comprobante de Entrega Final · Folio ${folio} · Gracias por su preferencia · Fiberlink Servicios TIC`
  );

  doc.save(`Recibo-Entrega-${folio}.pdf`);
  return true;
}
