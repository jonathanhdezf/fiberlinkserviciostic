// ==========================================
// CLIENTS & CREDIT MANAGEMENT CONTROLLER
// (Control de Clientes, Facturación CFDI 4.0 y Administración de Créditos)
// ==========================================

import { readCollection, writeCollection, generateNextFolio, logActivity } from '../db/jsonStore.js';

export function handleListClients(searchParams) {
  let clients = readCollection('clients');
  const q = searchParams?.get('q');
  const hasCredit = searchParams?.get('hasCredit');
  const hasBilling = searchParams?.get('hasBilling');
  const withBalance = searchParams?.get('withBalance');

  if (hasCredit === 'true') {
    clients = clients.filter(c => Boolean(c.hasCredit));
  } else if (hasCredit === 'false') {
    clients = clients.filter(c => !c.hasCredit);
  }

  if (hasBilling === 'true') {
    clients = clients.filter(c => Boolean(c.hasBilling));
  } else if (hasBilling === 'false') {
    clients = clients.filter(c => !c.hasBilling);
  }

  if (withBalance === 'true') {
    clients = clients.filter(c => (Number(c.currentBalance) || 0) > 0);
  }

  if (q) {
    const query = q.toLowerCase();
    clients = clients.filter(c =>
      (c.code && c.code.toLowerCase().includes(query)) ||
      (c.name && c.name.toLowerCase().includes(query)) ||
      (c.contactName && c.contactName.toLowerCase().includes(query)) ||
      (c.phone && c.phone.toLowerCase().includes(query)) ||
      (c.email && c.email.toLowerCase().includes(query)) ||
      (c.rfc && c.rfc.toLowerCase().includes(query))
    );
  }

  clients.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
  return { status: 200, data: clients };
}

export function handleGetClient(id) {
  const clients = readCollection('clients');
  const client = clients.find(c => c.id === id || c.code === id);
  if (!client) {
    return { status: 404, data: { error: 'Cliente no encontrado' } };
  }
  return { status: 200, data: client };
}

export function handleCreateClient(body, currentUser) {
  const name = (body.name || '').trim();
  if (!name) {
    return { status: 400, data: { error: 'El nombre o razón comercial del cliente es obligatorio.' } };
  }

  const clients = readCollection('clients');
  const newCode = generateNextFolio('clients', 'CLI', 1000);
  const hasCredit = Boolean(body.hasCredit);
  const creditLimit = hasCredit ? Math.max(0, parseFloat(body.creditLimit) || 0) : 0;
  const creditDays = hasCredit ? Math.max(0, parseInt(body.creditDays, 10) || 30) : 0;
  const initialBalance = hasCredit ? Math.max(0, parseFloat(body.currentBalance) || 0) : 0;

  const hasBilling = Boolean(body.hasBilling);
  const now = new Date().toISOString();
  const author = currentUser?.name || 'Administrador';

  const ledger = [];
  if (hasCredit && initialBalance > 0) {
    ledger.push({
      id: `mov-${Date.now()}`,
      folio: `CR-${Math.floor(100 + Math.random() * 900)}`,
      date: now,
      type: 'cargo',
      concept: 'Saldo inicial de apertura de línea de crédito',
      reference: 'APERTURA',
      amount: initialBalance,
      balanceBefore: 0,
      balanceAfter: initialBalance,
      status: 'vigente',
      author
    });
  }

  const newClient = {
    id: `cli-${Date.now()}`,
    code: newCode,
    name,
    contactName: (body.contactName || name).trim(),
    phone: (body.phone || '').trim(),
    email: (body.email || '').trim(),
    address: (body.address || '').trim(),
    status: body.status || 'activo',
    notes: (body.notes || '').trim(),
    hasCredit,
    creditLimit,
    creditDays,
    currentBalance: initialBalance,
    hasBilling,
    rfc: hasBilling ? (body.rfc || 'XAXX010101000').trim().toUpperCase() : '',
    razonSocial: hasBilling ? (body.razonSocial || name).trim().toUpperCase() : '',
    regimenFiscal: hasBilling ? (body.regimenFiscal || '601 - General de Ley Personas Morales').trim() : '',
    usoCfdi: hasBilling ? (body.usoCfdi || 'G03 - Gastos en general').trim() : '',
    cpFiscal: hasBilling ? (body.cpFiscal || '').trim() : '',
    billingEmail: hasBilling ? (body.billingEmail || body.email || '').trim() : '',
    createdAt: now,
    updatedAt: now,
    ledger
  };

  clients.unshift(newClient);
  writeCollection('clients', clients);

  logActivity({
    user: author,
    role: currentUser?.role || 'admin',
    module: 'clients',
    action: `Registró nuevo cliente ${newCode} (${name})${hasCredit ? ` con línea de crédito de $${creditLimit.toFixed(2)}` : ''}`
  });

  return {
    status: 201,
    data: {
      success: true,
      client: newClient
    }
  };
}

export function handleUpdateClient(id, body, currentUser) {
  const clients = readCollection('clients');
  const idx = clients.findIndex(c => c.id === id || c.code === id);
  if (idx === -1) {
    return { status: 404, data: { error: 'Cliente no encontrado' } };
  }

  const current = clients[idx];
  const hasCredit = body.hasCredit !== undefined ? Boolean(body.hasCredit) : Boolean(current.hasCredit);
  const hasBilling = body.hasBilling !== undefined ? Boolean(body.hasBilling) : Boolean(current.hasBilling);

  const updated = {
    ...current,
    name: body.name !== undefined ? String(body.name).trim() : current.name,
    contactName: body.contactName !== undefined ? String(body.contactName).trim() : current.contactName,
    phone: body.phone !== undefined ? String(body.phone).trim() : current.phone,
    email: body.email !== undefined ? String(body.email).trim() : current.email,
    address: body.address !== undefined ? String(body.address).trim() : current.address,
    status: body.status !== undefined ? body.status : current.status,
    notes: body.notes !== undefined ? String(body.notes).trim() : current.notes,
    hasCredit,
    creditLimit: hasCredit
      ? (body.creditLimit !== undefined ? Math.max(0, parseFloat(body.creditLimit) || 0) : Number(current.creditLimit) || 0)
      : 0,
    creditDays: hasCredit
      ? (body.creditDays !== undefined ? Math.max(0, parseInt(body.creditDays, 10) || 0) : Number(current.creditDays) || 30)
      : 0,
    hasBilling,
    rfc: hasBilling
      ? (body.rfc !== undefined ? String(body.rfc).trim().toUpperCase() : current.rfc || '')
      : '',
    razonSocial: hasBilling
      ? (body.razonSocial !== undefined ? String(body.razonSocial).trim().toUpperCase() : current.razonSocial || '')
      : '',
    regimenFiscal: hasBilling
      ? (body.regimenFiscal !== undefined ? String(body.regimenFiscal).trim() : current.regimenFiscal || '')
      : '',
    usoCfdi: hasBilling
      ? (body.usoCfdi !== undefined ? String(body.usoCfdi).trim() : current.usoCfdi || '')
      : '',
    cpFiscal: hasBilling
      ? (body.cpFiscal !== undefined ? String(body.cpFiscal).trim() : current.cpFiscal || '')
      : '',
    billingEmail: hasBilling
      ? (body.billingEmail !== undefined ? String(body.billingEmail).trim() : current.billingEmail || '')
      : '',
    updatedAt: new Date().toISOString()
  };

  clients[idx] = updated;
  writeCollection('clients', clients);

  logActivity({
    user: currentUser?.name || 'Admin',
    role: currentUser?.role || 'admin',
    module: 'clients',
    action: `Actualizó expediente del cliente ${updated.code} (${updated.name})`
  });

  return { status: 200, data: { success: true, client: updated } };
}

export function handleDeleteClient(id, currentUser) {
  const clients = readCollection('clients');
  const idx = clients.findIndex(c => c.id === id || c.code === id);
  if (idx === -1) {
    return { status: 404, data: { error: 'Cliente no encontrado' } };
  }

  const target = clients[idx];
  clients.splice(idx, 1);
  writeCollection('clients', clients);

  logActivity({
    user: currentUser?.name || 'Admin',
    role: currentUser?.role || 'admin',
    module: 'clients',
    action: `Eliminó cliente ${target.code} (${target.name})`
  });

  return { status: 200, data: { success: true, deletedId: target.id } };
}

export function handleRegisterCreditMovement(id, body, currentUser) {
  const clients = readCollection('clients');
  const idx = clients.findIndex(c => c.id === id || c.code === id);
  if (idx === -1) {
    return { status: 404, data: { error: 'Cliente no encontrado' } };
  }

  const client = clients[idx];
  const type = body.type || 'abono'; // 'cargo' | 'abono' | 'liquidacion'
  const balanceBefore = Math.max(0, parseFloat(client.currentBalance) || 0);
  const creditLimit = Math.max(0, parseFloat(client.creditLimit) || 0);
  const author = currentUser?.name || body.author || 'Cajero / Administración';
  const paymentMethod = body.paymentMethod || 'Transferencia';
  const reference = (body.reference || '').trim().toUpperCase();

  let amount = Math.max(0, parseFloat(body.amount) || 0);
  let balanceAfter = balanceBefore;
  let folioPrefix = 'AB';

  if (type === 'cargo') {
    if (!client.hasCredit) {
      return { status: 400, data: { error: 'Este cliente no tiene línea de crédito autorizada.' } };
    }
    if (amount <= 0) {
      return { status: 400, data: { error: 'El monto del cargo debe ser mayor a $0.00.' } };
    }
    if (creditLimit > 0 && balanceBefore + amount > creditLimit) {
      const available = Math.max(0, creditLimit - balanceBefore);
      return {
        status: 400,
        data: {
          error: `El cargo ($${amount.toFixed(2)}) excede el crédito disponible del cliente ($${available.toFixed(2)}).`
        }
      };
    }
    balanceAfter = balanceBefore + amount;
    folioPrefix = 'CR';
  } else if (type === 'liquidacion') {
    if (balanceBefore <= 0) {
      return { status: 400, data: { error: 'El cliente no presenta saldo deudor pendiente por liquidar.' } };
    }
    amount = balanceBefore;
    balanceAfter = 0;
    folioPrefix = 'LQ';
  } else {
    // 'abono'
    if (balanceBefore <= 0) {
      return { status: 400, data: { error: 'El cliente no tiene saldo pendiente para abonar.' } };
    }
    if (amount <= 0) {
      return { status: 400, data: { error: 'El importe del abono debe ser mayor a $0.00.' } };
    }
    if (amount > balanceBefore) {
      amount = balanceBefore;
    }
    balanceAfter = Math.max(0, Number((balanceBefore - amount).toFixed(2)));
    folioPrefix = balanceAfter === 0 ? 'LQ' : 'AB';
  }

  client.ledger = Array.isArray(client.ledger) ? client.ledger : [];
  const movementFolio = `${folioPrefix}-${String(client.ledger.length + 101)}`;
  const isSettledNow = balanceAfter === 0 && (type === 'liquidacion' || type === 'abono');

  const movement = {
    id: `mov-${Date.now()}`,
    folio: movementFolio,
    date: new Date().toISOString(),
    type: isSettledNow && type === 'abono' ? 'liquidacion' : type,
    concept:
      (body.concept || '').trim() ||
      (type === 'cargo'
        ? 'Cargo a cuenta de crédito'
        : isSettledNow
        ? `Liquidación total de saldo (${paymentMethod})`
        : `Abono a cuenta de crédito (${paymentMethod})`),
    reference: reference || (type === 'cargo' ? 'CARGO-MANUAL' : paymentMethod.toUpperCase()),
    paymentMethod: type === 'cargo' ? 'Crédito' : paymentMethod,
    amount,
    balanceBefore,
    balanceAfter,
    status: isSettledNow ? 'liquidado' : 'vigente',
    author
  };

  // If account reached $0.00, mark all previous 'vigente' movements as 'liquidado' (archived credit cycle)
  if (isSettledNow) {
    client.ledger = client.ledger.map(entry => ({
      ...entry,
      status: 'liquidado'
    }));
  }

  client.ledger.unshift(movement);
  client.currentBalance = balanceAfter;
  client.updatedAt = new Date().toISOString();

  clients[idx] = client;
  writeCollection('clients', clients);

  logActivity({
    user: author,
    role: currentUser?.role || 'admin',
    module: 'clients',
    action: `Registró ${movement.type.toUpperCase()} (${movementFolio}) por $${amount.toFixed(2)} a ${client.name}. Nuevo saldo: $${balanceAfter.toFixed(2)}`
  });

  return {
    status: 200,
    data: {
      success: true,
      movement,
      client
    }
  };
}
