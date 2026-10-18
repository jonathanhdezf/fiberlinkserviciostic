// ==========================================
// SYSTEM SETTINGS & BACKUP CONTROLLER (Módulo de Configuración)
// ==========================================

import { readCollection, writeCollection, SEED_SETTINGS, logActivity } from '../db/jsonStore.js';

export function handleGetSettings() {
  const stored = readCollection('settings') || {};
  const merged = {
    ...SEED_SETTINGS,
    ...stored,
    company: { ...SEED_SETTINGS.company, ...(stored.company || {}) },
    enabledOptions: { ...SEED_SETTINGS.enabledOptions, ...(stored.enabledOptions || {}) },
    folios: { ...SEED_SETTINGS.folios, ...(stored.folios || {}) },
    registers: Array.isArray(stored.registers) ? stored.registers : SEED_SETTINGS.registers,
    ticketConfig: { ...SEED_SETTINGS.ticketConfig, ...(stored.ticketConfig || {}) },
    paymentMethods: Array.isArray(stored.paymentMethods) ? stored.paymentMethods : SEED_SETTINGS.paymentMethods,
    taxes: { ...SEED_SETTINGS.taxes, ...(stored.taxes || {}) },
    cutRules: { ...SEED_SETTINGS.cutRules, ...(stored.cutRules || {}) },
    unitsOfMeasure: Array.isArray(stored.unitsOfMeasure) ? stored.unitsOfMeasure : SEED_SETTINGS.unitsOfMeasure,
    notifications: { ...SEED_SETTINGS.notifications, ...(stored.notifications || {}) }
  };
  return { status: 200, data: merged };
}

export function handleUpdateSettings(body, currentUser) {
  const current = handleGetSettings().data;
  const author = currentUser?.name || 'Administrador';

  const updated = {
    ...current,
    company: body.company ? { ...current.company, ...body.company } : current.company,
    enabledOptions: body.enabledOptions ? { ...current.enabledOptions, ...body.enabledOptions } : current.enabledOptions,
    folios: body.folios ? { ...current.folios, ...body.folios } : current.folios,
    registers: Array.isArray(body.registers) ? body.registers : current.registers,
    ticketConfig: body.ticketConfig ? { ...current.ticketConfig, ...body.ticketConfig } : current.ticketConfig,
    paymentMethods: Array.isArray(body.paymentMethods) ? body.paymentMethods : current.paymentMethods,
    taxes: body.taxes ? { ...current.taxes, ...body.taxes } : current.taxes,
    cutRules: body.cutRules ? { ...current.cutRules, ...body.cutRules } : current.cutRules,
    unitsOfMeasure: Array.isArray(body.unitsOfMeasure) ? body.unitsOfMeasure : current.unitsOfMeasure,
    notifications: body.notifications ? { ...current.notifications, ...body.notifications } : current.notifications,
    updatedAt: new Date().toISOString()
  };

  writeCollection('settings', updated);

  logActivity({
    user: author,
    role: currentUser?.role || 'admin',
    module: 'settings',
    action: `Actualizó parámetros del Módulo de Configuración (${body.sectionLabel || 'Configuración General'})`
  });

  return { status: 200, data: { success: true, settings: updated } };
}

export function handleExportBackup() {
  const collections = [
    'settings',
    'users',
    'clients',
    'products',
    'inventoryMovements',
    'sales',
    'shifts',
    'cashCuts',
    'tickets',
    'workshop',
    'activity'
  ];

  const data = {};
  const counts = {};
  collections.forEach(col => {
    const val = readCollection(col);
    data[col] = val;
    counts[col] = Array.isArray(val) ? val.length : 1;
  });

  return {
    status: 200,
    data: {
      system: 'Fiberlink Enterprise OS',
      version: '2.4.0',
      exportedAt: new Date().toISOString(),
      counts,
      collections: data
    }
  };
}

export function handleRestoreBackup(body, currentUser) {
  const incoming = body?.collections || body;
  if (!incoming || typeof incoming !== 'object') {
    return { status: 400, data: { error: 'Archivo de respaldo inválido o sin estructura de colecciones.' } };
  }

  const allowed = [
    'settings',
    'users',
    'clients',
    'products',
    'inventoryMovements',
    'sales',
    'shifts',
    'cashCuts',
    'tickets',
    'workshop'
  ];

  let restoredCols = 0;
  allowed.forEach(col => {
    if (incoming[col] !== undefined) {
      writeCollection(col, incoming[col]);
      restoredCols++;
    }
  });

  const author = currentUser?.name || 'Administrador';
  logActivity({
    user: author,
    role: currentUser?.role || 'admin',
    module: 'settings',
    action: `Restauró respaldo completo de base de datos (${restoredCols} colecciones actualizadas)`
  });

  return {
    status: 200,
    data: {
      success: true,
      restoredCollections: restoredCols
    }
  };
}
