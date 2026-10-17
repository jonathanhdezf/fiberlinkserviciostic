// ==========================================
// POINT OF SALE CONTROLLER (Punto de Venta & Caja)
// ==========================================

import { readCollection, writeCollection, generateNextFolio, logActivity } from '../db/jsonStore.js';

export function handleListSales(searchParams) {
  let sales = readCollection('sales');
  const paymentMethod = searchParams.get('paymentMethod');
  const status = searchParams.get('status');
  const q = searchParams.get('q');

  if (paymentMethod) {
    sales = sales.filter(s => s.paymentMethod === paymentMethod);
  }
  if (status) {
    sales = sales.filter(s => s.status === status);
  }
  if (q) {
    const query = q.toLowerCase();
    sales = sales.filter(s =>
      (s.folio && s.folio.toLowerCase().includes(query)) ||
      (s.clientName && s.clientName.toLowerCase().includes(query)) ||
      (s.linkedRef && s.linkedRef.toLowerCase().includes(query)) ||
      (s.cashier && s.cashier.toLowerCase().includes(query))
    );
  }

  sales.sort((a, b) => new Date(b.date) - new Date(a.date));
  return { status: 200, data: sales };
}

export function handleGetSale(id) {
  const sales = readCollection('sales');
  const sale = sales.find(s => s.id === id || s.folio === id);
  if (!sale) {
    return { status: 404, data: { error: 'Venta no encontrada' } };
  }
  return { status: 200, data: sale };
}

export function handleCreateSale(body, currentUser) {
  const items = Array.isArray(body.items) ? body.items : [];
  if (items.length === 0) {
    return { status: 400, data: { error: 'El carrito de venta está vacío.' } };
  }

  const products = readCollection('products');
  const sales = readCollection('sales');
  const newFolio = generateNextFolio('sales', 'VTA', 1000);

  let subtotal = 0;
  const processedItems = items.map(it => {
    const qty = Math.max(1, Number(it.qty) || 1);
    const price = parseFloat(it.price) || 0;
    const lineTotal = qty * price;
    subtotal += lineTotal;

    // Deduct stock if linked to a physical product
    let cost = parseFloat(it.cost) || 0;
    let sku = it.sku || 'MANUAL';
    if (it.productId) {
      const pIdx = products.findIndex(p => p.id === it.productId);
      if (pIdx !== -1) {
        cost = parseFloat(products[pIdx].cost) || 0;
        sku = products[pIdx].sku;
        if (!products[pIdx].isService) {
          products[pIdx].stock = Math.max(0, (Number(products[pIdx].stock) || 0) - qty);
          products[pIdx].updatedAt = new Date().toISOString();
        }
      }
    }

    return {
      productId: it.productId || null,
      sku,
      name: it.name || it.concept || 'Concepto de venta',
      qty,
      price,
      cost,
      subtotal: lineTotal
    };
  });

  // Persist updated product stocks
  writeCollection('products', products);

  const discount = Math.max(0, parseFloat(body.discount) || 0);
  const total = Math.max(0, subtotal - discount);
  const paymentMethod = body.paymentMethod || 'Efectivo';
  const amountReceived = Math.max(total, parseFloat(body.amountReceived) || total);
  const change = Math.max(0, amountReceived - total);
  const cashier = currentUser?.name || body.cashier || 'Cajero en Turno';
  const linkedRef = (body.linkedRef || '').trim().toUpperCase();

  const newSale = {
    id: `sale-${Date.now()}`,
    folio: newFolio,
    date: new Date().toISOString(),
    cashier,
    clientName: (body.clientName || 'Mostrador / Público en General').trim(),
    paymentMethod,
    linkedRef,
    status: 'completada',
    items: processedItems,
    subtotal,
    discount,
    total,
    amountReceived,
    change
  };

  sales.unshift(newSale);
  writeCollection('sales', sales);

  // If linkedRef is a Ticket (FL-XXXX) or Workshop Order (OS-XXXX), mark it paid/updated
  if (linkedRef.startsWith('FL-')) {
    const tickets = readCollection('tickets');
    const tIdx = tickets.findIndex(t => t.folio === linkedRef);
    if (tIdx !== -1) {
      tickets[tIdx].pos = tickets[tIdx].pos || { items: [], total };
      tickets[tIdx].pos.paid = true;
      tickets[tIdx].pos.saleFolio = newFolio;
      tickets[tIdx].bitacora = tickets[tIdx].bitacora || [];
      tickets[tIdx].bitacora.push({
        id: `b-${Date.now()}`,
        date: new Date().toISOString(),
        author: cashier,
        note: `Cobro liquidado en Punto de Venta (${newFolio}) por $${total.toFixed(2)} (${paymentMethod}).`
      });
      writeCollection('tickets', tickets);
    }
  } else if (linkedRef.startsWith('OS-')) {
    const workshop = readCollection('workshop');
    const wIdx = workshop.findIndex(w => w.folio === linkedRef);
    if (wIdx !== -1) {
      workshop[wIdx].paid = true;
      workshop[wIdx].saleFolio = newFolio;
      workshop[wIdx].bitacora = workshop[wIdx].bitacora || [];
      workshop[wIdx].bitacora.push({
        id: `wb-${Date.now()}`,
        date: new Date().toISOString(),
        author: cashier,
        note: `Orden liquidada en Punto de Venta (${newFolio}) por $${total.toFixed(2)} (${paymentMethod}).`
      });
      writeCollection('workshop', workshop);
    }
  }

  logActivity({
    user: cashier,
    role: currentUser?.role || 'ventas',
    module: 'pos',
    action: `Registró venta ${newFolio} por $${total.toFixed(2)} (${paymentMethod})${linkedRef ? ' [' + linkedRef + ']' : ''}`
  });

  return {
    status: 201,
    data: {
      success: true,
      sale: newSale
    }
  };
}

export function handleCancelSale(id, currentUser) {
  const sales = readCollection('sales');
  const idx = sales.findIndex(s => s.id === id || s.folio === id);
  if (idx === -1) {
    return { status: 404, data: { error: 'Venta no encontrada' } };
  }
  if (sales[idx].status === 'cancelada') {
    return { status: 400, data: { error: 'La venta ya se encuentra cancelada.' } };
  }

  // Restore inventory stock
  const products = readCollection('products');
  (sales[idx].items || []).forEach(it => {
    if (it.productId) {
      const pIdx = products.findIndex(p => p.id === it.productId);
      if (pIdx !== -1 && !products[pIdx].isService) {
        products[pIdx].stock = (Number(products[pIdx].stock) || 0) + (Number(it.qty) || 1);
      }
    }
  });
  writeCollection('products', products);

  sales[idx].status = 'cancelada';
  sales[idx].cancelledAt = new Date().toISOString();
  sales[idx].cancelledBy = currentUser?.name || 'Admin';
  writeCollection('sales', sales);

  logActivity({
    user: currentUser?.name || 'Admin',
    role: currentUser?.role || 'admin',
    module: 'pos',
    action: `Canceló venta ${sales[idx].folio} y restauró existencias en almacén`
  });

  return { status: 200, data: { success: true, sale: sales[idx] } };
}
