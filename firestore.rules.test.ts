/**
 * Payload-First Security Test Specification (Dirty Dozen)
 * Verifies Fiberlink Firestore Security Rules invariants.
 */

export const DIRTY_DOZEN_CASES = [
  {
    name: '1. Unauthenticated list /tickets must fail',
    auth: null,
    operation: 'list',
    path: 'tickets',
    expected: 'PERMISSION_DENIED'
  },
  {
    name: '2. Unauthenticated get /tickets/{id} must fail (PII isolation)',
    auth: null,
    operation: 'get',
    path: 'tickets/1712000000001',
    expected: 'PERMISSION_DENIED'
  },
  {
    name: '3. Unauthenticated list /ticket_tracking must fail',
    auth: null,
    operation: 'list',
    path: 'ticket_tracking',
    expected: 'PERMISSION_DENIED'
  },
  {
    name: '4. Uninvited user self-assigning admin role in /staff/{uid} must fail',
    auth: { uid: 'attacker1', email: 'attacker@example.com', email_verified: true },
    operation: 'create',
    path: 'staff/attacker1',
    payload: { uid: 'attacker1', email: 'attacker@example.com', name: 'Attacker', role: 'admin', active: true },
    expected: 'PERMISSION_DENIED'
  },
  {
    name: '5. Unverified email spoofing bootstrap admin must fail',
    auth: { uid: 'spoof1', email: 'Jonathanhdezf@gmail.com', email_verified: false },
    operation: 'list',
    path: 'tickets',
    expected: 'PERMISSION_DENIED'
  },
  {
    name: '6. Shadow field injection on /tickets create must fail',
    auth: null,
    operation: 'create',
    path: 'tickets/t_shadow_1',
    payload: { id: 't_shadow_1', folio: 'FL-9999', estado: 'creación', shadowAdmin: true },
    expected: 'PERMISSION_DENIED'
  },
  {
    name: '7. Public ticket create with pre-assigned technician or non-initial estado must fail',
    auth: null,
    operation: 'create',
    path: 'tickets/t_shortcut_1',
    payload: { id: 't_shortcut_1', folio: 'FL-9998', estado: 'resuelto', assignedTo: 'Ing. Roberto' },
    expected: 'PERMISSION_DENIED'
  },
  {
    name: '8. Creating /tickets without atomic /ticket_tracking doc must fail',
    auth: null,
    operation: 'create',
    path: 'tickets/t_orphan_1',
    batchTrackingDoc: false,
    expected: 'PERMISSION_DENIED'
  },
  {
    name: '9. Client-provided timestamp spoofing on create must fail',
    auth: null,
    operation: 'create',
    path: 'tickets/t_time_1',
    payload: { createdAt: '2020-01-01T00:00:00Z' },
    expected: 'PERMISSION_DENIED'
  },
  {
    name: '10. Non-admin modifying terminal resolved ticket must fail',
    auth: { uid: 'tech1', email: 'tech@fiberlink.mx', email_verified: true, role: 'tecnico' },
    operation: 'update',
    path: 'tickets/t_resolved_1',
    existingEstado: 'resuelto',
    payload: { estado: 'proceso' },
    expected: 'PERMISSION_DENIED'
  },
  {
    name: '11. ID poisoning (>128 chars) or oversized description (>2000 chars) must fail',
    auth: null,
    operation: 'create',
    path: `tickets/${'a'.repeat(200)}`,
    expected: 'PERMISSION_DENIED'
  },
  {
    name: '12. Non-admin staff deleting ticket must fail',
    auth: { uid: 'tech1', email: 'tech@fiberlink.mx', email_verified: true, role: 'tecnico' },
    operation: 'delete',
    path: 'tickets/t_1001',
    expected: 'PERMISSION_DENIED'
  },
  {
    name: '13. Unauthenticated blanket list /products (including hidden products) must fail',
    auth: null,
    operation: 'list',
    path: 'products',
    expected: 'PERMISSION_DENIED'
  },
  {
    name: '14. Non-manager technician modifying product price or photos must fail',
    auth: { uid: 'tech1', email: 'tech@fiberlink.mx', email_verified: true, role: 'tecnico' },
    operation: 'update',
    path: 'products/prod-101',
    payload: { price: 1 },
    expected: 'PERMISSION_DENIED'
  },
  {
    name: '15. Creating product with > 6 images or oversized image string must fail',
    auth: { uid: 'admin1', email: 'Jonathanhdezf@gmail.com', email_verified: true, role: 'admin' },
    operation: 'create',
    path: 'products/prod_overflow',
    payload: { images: ['a', 'b', 'c', 'd', 'e', 'f', 'g'] },
    expected: 'PERMISSION_DENIED'
  },
  {
    name: '16. Updating immutable Kardex /inventory_movements entry must fail',
    auth: { uid: 'admin1', email: 'Jonathanhdezf@gmail.com', email_verified: true, role: 'admin' },
    operation: 'update',
    path: 'inventory_movements/kdx-1001',
    payload: { delta: 999 },
    expected: 'PERMISSION_DENIED'
  }
];
