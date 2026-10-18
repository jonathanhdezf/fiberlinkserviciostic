// ==========================================
// SHIFTS & CASH CUTS CONTROLLER (Turnos y Cortes de Caja)
// ==========================================

import { readCollection, writeCollection, generateNextFolio, logActivity } from '../db/jsonStore.js';

export function handleListShifts() {
  const shifts = readCollection('shifts');
  shifts.sort((a, b) => new Date(b.openedAt) - new Date(a.openedAt));
  return { status: 200, data: shifts };
}

export function handleOpenShift(body, currentUser) {
  const shifts = readCollection('shifts');
  const folio = generateNextFolio('shifts', 'TRN', 1000);
  const author = currentUser?.name || body.cashier || 'Cajero en Turno';

  const shiftName = (body.shiftName || 'Turno Matutino (08:00 - 16:00)').trim();
  const registerName = (body.registerName || 'Caja Principal #1 — Mostrador Teziutlán').trim();
  const cashier = (body.cashier || author).trim();
  const openingCash = Math.max(0, parseFloat(body.openingCash) || 0);
  const notes = (body.notes || '').trim();

  // If user requested closing previous open shift on same register, close it gracefully
  if (body.closePreviousOpen !== false) {
    shifts.forEach(s => {
      if (s.status === 'abierto' && s.registerName === registerName) {
        s.status = 'cerrado';
        s.closedAt = new Date().toISOString();
      }
    });
  }

  const newShift = {
    id: `shift-${Date.now()}`,
    folio,
    shiftName,
    registerName,
    cashier,
    openedBy: author,
    openedAt: new Date().toISOString(),
    closedAt: null,
    status: 'abierto',
    openingCash,
    cashMovements: [],
    closingCashCounted: null,
    expectedCash: null,
    difference: 0,
    cutFolio: null,
    notes
  };

  shifts.unshift(newShift);
  writeCollection('shifts', shifts);

  logActivity({
    user: author,
    role: currentUser?.role || 'ventas',
    module: 'shifts',
    action: `Abrió turno ${folio} (${shiftName}) en ${registerName} con fondo inicial de $${openingCash.toFixed(2)}`
  });

  return { status: 201, data: { success: true, shift: newShift } };
}

export function handleAddCashMovement(shiftId, body, currentUser) {
  const shifts = readCollection('shifts');
  let idx = shifts.findIndex(s => s.id === shiftId || s.folio === shiftId);
  if (idx === -1) {
    // Fallback to active shift
    idx = shifts.findIndex(s => s.status === 'abierto');
  }
  if (idx === -1) {
    return { status: 404, data: { error: 'No se encontró un turno abierto para registrar el movimiento de caja.' } };
  }

  const amount = Math.max(0.01, parseFloat(body.amount) || 0);
  const type = body.type || 'salida_gasto'; // 'entrada_efectivo' | 'salida_gasto' | 'retiro_parcial'
  const concept = (body.concept || 'Movimiento de efectivo en caja').trim();
  const author = currentUser?.name || body.author || shifts[idx].cashier || 'Cajero';

  shifts[idx].cashMovements = Array.isArray(shifts[idx].cashMovements) ? shifts[idx].cashMovements : [];
  const movFolio = `MCJ-${100 + shifts[idx].cashMovements.length + 1}`;
  const movement = {
    id: `cm-${Date.now()}`,
    folio: movFolio,
    date: new Date().toISOString(),
    type,
    concept,
    amount,
    author
  };

  shifts[idx].cashMovements.unshift(movement);
  writeCollection('shifts', shifts);

  logActivity({
    user: author,
    role: currentUser?.role || 'ventas',
    module: 'shifts',
    action: `Registró movimiento de caja ${movFolio} (${type}) por $${amount.toFixed(2)} en turno ${shifts[idx].folio}`
  });

  return { status: 201, data: { success: true, shift: shifts[idx], movement } };
}

export function handleListCashCuts(searchParams) {
  let cuts = readCollection('cashCuts');
  const cutType = searchParams?.get('cutType');
  if (cutType && cutType !== 'all') {
    cuts = cuts.filter(c => c.cutType === cutType);
  }
  cuts.sort((a, b) => new Date(b.date) - new Date(a.date));
  return { status: 200, data: cuts };
}

export function handleCreateCashCut(body, currentUser) {
  const cuts = readCollection('cashCuts');
  const shifts = readCollection('shifts');
  const folio = generateNextFolio('cashCuts', 'COR', 1000);
  const author = currentUser?.name || body.cashier || 'Administrador';

  const cutType = body.cutType === 'dia' ? 'dia' : 'turno';
  const shiftId = body.shiftId || (cutType === 'dia' ? 'ALL' : null);

  let targetShift = null;
  let sIdx = -1;
  if (shiftId && shiftId !== 'ALL') {
    sIdx = shifts.findIndex(s => s.id === shiftId || s.folio === shiftId);
    if (sIdx !== -1) targetShift = shifts[sIdx];
  } else if (cutType === 'turno') {
    sIdx = shifts.findIndex(s => s.status === 'abierto');
    if (sIdx !== -1) targetShift = shifts[sIdx];
  }

  const openingCash = parseFloat(body.openingCash) || (targetShift ? parseFloat(targetShift.openingCash) || 0 : 0);
  const cashSales = parseFloat(body.cashSales) || 0;
  const cardSales = parseFloat(body.cardSales) || 0;
  const transferSales = parseFloat(body.transferSales) || 0;
  const creditSales = parseFloat(body.creditSales) || 0;
  const creditPaymentsCash = parseFloat(body.creditPaymentsCash) || 0;
  const creditPaymentsOther = parseFloat(body.creditPaymentsOther) || 0;
  const cashInTotal = parseFloat(body.cashInTotal) || 0;
  const cashOutTotal = parseFloat(body.cashOutTotal) || 0;

  const totalGrossSales = Number((cashSales + cardSales + transferSales + creditSales).toFixed(2));
  const totalCollectedRevenue = Number((cashSales + cardSales + transferSales + creditPaymentsCash + creditPaymentsOther).toFixed(2));
  const expectedCashInDrawer = Number((openingCash + cashSales + creditPaymentsCash + cashInTotal - cashOutTotal).toFixed(2));
  const countedCashInDrawer = body.countedCashInDrawer !== undefined && body.countedCashInDrawer !== null
    ? Number(parseFloat(body.countedCashInDrawer).toFixed(2))
    : expectedCashInDrawer;
  const difference = Number((countedCashInDrawer - expectedCashInDrawer).toFixed(2));

  const nowIso = new Date().toISOString();
  const newCut = {
    id: `cut-${Date.now()}`,
    folio,
    cutType,
    shiftId: targetShift ? targetShift.id : 'ALL',
    shiftFolio: targetShift ? targetShift.folio : (body.shiftFolio || 'CONSOLIDADO-DIA'),
    shiftName: targetShift ? targetShift.shiftName : (body.shiftName || 'Corte General del Día (Consolidado)'),
    registerName: targetShift ? targetShift.registerName : (body.registerName || 'Todas las Cajas — Sucursal Teziutlán'),
    cashier: body.cashier || (targetShift ? targetShift.cashier : author),
    date: nowIso,
    periodStart: body.periodStart || (targetShift ? targetShift.openedAt : nowIso),
    periodEnd: nowIso,
    salesCount: Number(body.salesCount) || 0,
    cancelledCount: Number(body.cancelledCount) || 0,
    openingCash,
    cashSales,
    cardSales,
    transferSales,
    creditSales,
    creditPaymentsCash,
    creditPaymentsOther,
    cashInTotal,
    cashOutTotal,
    totalGrossSales,
    totalCollectedRevenue,
    expectedCashInDrawer,
    countedCashInDrawer,
    difference,
    denominations: body.denominations || { b1000: 0, b500: 0, b200: 0, b100: 0, b50: 0, b20: 0, coins: 0 },
    whatsappPhone: (body.whatsappPhone || '2311024672').trim(),
    notes: (body.notes || (cutType === 'dia' ? 'Corte General del Día' : 'Corte de Turno')).trim()
  };

  cuts.unshift(newCut);
  writeCollection('cashCuts', cuts);

  // If closing the shift upon cut
  if (body.closeShift && sIdx !== -1) {
    shifts[sIdx].status = 'cerrado';
    shifts[sIdx].closedAt = nowIso;
    shifts[sIdx].closingCashCounted = countedCashInDrawer;
    shifts[sIdx].expectedCash = expectedCashInDrawer;
    shifts[sIdx].difference = difference;
    shifts[sIdx].cutFolio = folio;
    if (body.notes) {
      shifts[sIdx].notes = body.notes;
    }
    writeCollection('shifts', shifts);
  }

  logActivity({
    user: author,
    role: currentUser?.role || 'admin',
    module: 'shifts',
    action: `Generó ${cutType === 'dia' ? 'Corte del Día' : 'Corte de Turno'} ${folio} (Esperado: $${expectedCashInDrawer.toFixed(2)}, Contado: $${countedCashInDrawer.toFixed(2)}, Dif: $${difference.toFixed(2)})`
  });

  return {
    status: 201,
    data: {
      success: true,
      cut: newCut,
      shift: sIdx !== -1 ? shifts[sIdx] : null
    }
  };
}
