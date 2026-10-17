// ==========================================
// REPORTS & ANALYTICS CONTROLLER (Reportes & KPIs)
// ==========================================

import { readCollection } from '../db/jsonStore.js';

export function handleGetReportsSummary(searchParams) {
  const tickets = readCollection('tickets');
  const workshop = readCollection('workshop');
  const products = readCollection('products');
  const sales = readCollection('sales');
  const activity = readCollection('activity');

  const activeSales = sales.filter(s => s.status !== 'cancelada');

  // 1. Financial Metrics
  const grossRevenue = activeSales.reduce((sum, s) => sum + (parseFloat(s.total) || 0), 0);
  let estimatedCost = 0;
  activeSales.forEach(s => {
    (s.items || []).forEach(it => {
      estimatedCost += (parseFloat(it.cost) || 0) * (Number(it.qty) || 1);
    });
  });
  const estimatedProfit = grossRevenue - estimatedCost;
  const avgTicketSale = activeSales.length > 0 ? grossRevenue / activeSales.length : 0;

  // Pending accounts receivable from Tickets & Workshop
  const pendingTicketsBalance = tickets
    .filter(t => !t.pos?.paid && (parseFloat(t.pos?.total) || 0) > 0)
    .reduce((sum, t) => sum + (parseFloat(t.pos?.total) || 0), 0);

  const pendingWorkshopBalance = workshop
    .filter(w => !w.paid && (parseFloat(w.total) || 0) > 0)
    .reduce((sum, w) => sum + Math.max(0, (parseFloat(w.total) || 0) - (parseFloat(w.advancePayment) || 0)), 0);

  // Payment Methods Breakdown
  const byPaymentMethod = {
    Efectivo: 0,
    Tarjeta: 0,
    Transferencia: 0
  };
  activeSales.forEach(s => {
    const m = s.paymentMethod || 'Efectivo';
    byPaymentMethod[m] = (byPaymentMethod[m] || 0) + (parseFloat(s.total) || 0);
  });

  // 2. Tickets Breakdown
  const ticketStats = {
    total: tickets.length,
    creacion: tickets.filter(t => t.estado === 'creación' || t.estado === 'creacion').length,
    diagnostico: tickets.filter(t => t.estado === 'diagnostico').length,
    proceso: tickets.filter(t => t.estado === 'proceso').length,
    resuelto: tickets.filter(t => t.estado === 'resuelto').length,
    urgente: tickets.filter(t => t.priority === 'Urgente' && t.estado !== 'resuelto').length
  };

  // Tickets by Service Type
  const serviceCounts = {};
  tickets.forEach(t => {
    const srv = t.service || 'Otros';
    serviceCounts[srv] = (serviceCounts[srv] || 0) + 1;
  });

  // 3. Workshop Breakdown
  const workshopStats = {
    total: workshop.length,
    recepcion: workshop.filter(w => w.estado === 'recepcion').length,
    diagnostico: workshop.filter(w => w.estado === 'diagnostico').length,
    esperando_refaccion: workshop.filter(w => w.estado === 'esperando_refaccion').length,
    en_reparacion: workshop.filter(w => w.estado === 'en_reparacion').length,
    listo_entrega: workshop.filter(w => w.estado === 'listo_entrega').length,
    entregado: workshop.filter(w => w.estado === 'entregado').length,
    garantia: workshop.filter(w => w.estado === 'garantia').length
  };

  // 4. Inventory & Store Metrics
  const physicalProducts = products.filter(p => !p.isService);
  const lowStockItems = physicalProducts.filter(p => Number(p.stock) <= Number(p.minStock || 3));
  const inventoryCostValue = physicalProducts.reduce(
    (sum, p) => sum + (parseFloat(p.cost) || 0) * Math.max(0, Number(p.stock) || 0),
    0
  );
  const inventoryRetailValue = physicalProducts.reduce(
    (sum, p) => sum + (parseFloat(p.price) || 0) * Math.max(0, Number(p.stock) || 0),
    0
  );

  // Top Selling Products
  const productSalesMap = {};
  activeSales.forEach(s => {
    (s.items || []).forEach(it => {
      const key = it.sku || it.name;
      if (!productSalesMap[key]) {
        productSalesMap[key] = { sku: it.sku || 'S/SKU', name: it.name, qty: 0, revenue: 0 };
      }
      productSalesMap[key].qty += Number(it.qty) || 1;
      productSalesMap[key].revenue += parseFloat(it.subtotal) || 0;
    });
  });
  const topProducts = Object.values(productSalesMap)
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 6);

  // 5. Technician Workload & Performance
  const techMap = {};
  tickets.forEach(t => {
    const tech = t.assignedTo || 'Sin asignar';
    if (!techMap[tech]) techMap[tech] = { name: tech, ticketsActive: 0, ticketsResolved: 0, workshopActive: 0, workshopReady: 0 };
    if (t.estado === 'resuelto') techMap[tech].ticketsResolved++;
    else techMap[tech].ticketsActive++;
  });
  workshop.forEach(w => {
    const tech = w.assignedTech || 'Sin asignar';
    if (!techMap[tech]) techMap[tech] = { name: tech, ticketsActive: 0, ticketsResolved: 0, workshopActive: 0, workshopReady: 0 };
    if (w.estado === 'listo_entrega' || w.estado === 'entregado') techMap[tech].workshopReady++;
    else techMap[tech].workshopActive++;
  });

  return {
    status: 200,
    data: {
      generatedAt: new Date().toISOString(),
      financials: {
        grossRevenue,
        estimatedCost,
        estimatedProfit,
        avgTicketSale,
        totalSalesCount: activeSales.length,
        pendingReceivables: pendingTicketsBalance + pendingWorkshopBalance,
        pendingTicketsBalance,
        pendingWorkshopBalance,
        byPaymentMethod
      },
      tickets: {
        ...ticketStats,
        byService: serviceCounts
      },
      workshop: workshopStats,
      inventory: {
        totalCatalogItems: products.length,
        physicalItemsCount: physicalProducts.length,
        lowStockCount: lowStockItems.length,
        lowStockItems,
        inventoryCostValue,
        inventoryRetailValue
      },
      topProducts,
      technicians: Object.values(techMap),
      recentActivity: activity.slice(0, 20)
    }
  };
}
