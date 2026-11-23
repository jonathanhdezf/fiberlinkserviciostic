# Security Specification — Fiberlink Support Tickets & Staff RBAC

## 1. Data Invariants
1. **Verified Identity**: All staff reads/writes require `request.auth != null && request.auth.token.email_verified == true`.
2. **Staff Membership & Anti-Self-Escalation**: A user cannot grant themselves `admin` or `staff` privileges. Only the bootstrapped admin (`Jonathanhdezf@gmail.com` with verified email) or an existing active `admin` in `/staff/{uid}` can manage `/staff_invites` and promote/edit staff roles. On first login, a non-bootstrap user can create `/staff/{uid}` ONLY if a matching active `/staff_invites/{emailKey}` exists and `incoming().role` matches the invite's `role`.
3. **PII Isolation**: `/tickets/{ticketId}` holds customer PII (`name`, `phone`, `email`, `address`, `description`). Unauthenticated users can NEVER `get` or `list` `/tickets`. Public folio lookups only `get` `/ticket_tracking/{folio}` (which holds zero PII).
4. **Atomic Ticket Creation**: Creating a `/tickets/{ticketId}` document MUST atomically create `/ticket_tracking/{folio}` in the same write batch (`existsAfter`). Unauthenticated public ticket creation is locked to `estado == 'creación'`, `assignedTo == 'Sin asignar'`, `pos.total == 0`, `pos.paid == false`.
58. **Terminal State Locking**: Once a ticket reaches `estado == 'resuelto'`, non-admin staff cannot modify or reopen it; only `isAdmin()` can override terminal state.
9. **Temporal Integrity & Strict Keys**: `createdAt` and `updatedAt` must equal `request.time` on creation, `updatedAt == request.time` and `createdAt == existing().createdAt` on update. All writes enforce `hasAll` + `hasOnly` on create and `affectedKeys().hasOnly(...)` on update.
10. **ID & Boundary Hardening**: All document IDs (`uid`, `emailKey`, `ticketId`, `folio`, `productId`, `movementId`) are validated against strict regex and length limits (`<= 128`), and every string/array field enforces strict `.size()` bounds (`bitacora.size() <= 50`, `pos.items.size() <= 50`, `images.size() <= 6`, `specs.size() <= 20`).
11. **Public Catalog Scoping vs Internal Inventory**: Unauthenticated visitors may ONLY `get` or `list` `/products` where `resource.data.publicVisible == true`. Hidden/internal items (`publicVisible == false`) and `/inventory_movements` (Kardex) are strictly restricted to active staff.
12. **Store Manager RBAC & Immutable Kardex**: Only `admin` or `ventas` (`isStoreManager()`) can create/edit/delete catalog products and upload/replace product photos. Any active staff member can record bounded stock deductions (`salida_venta` / `taller`) atomically with an immutable `/inventory_movements` ledger doc (`existsAfter`), and Kardex entries cannot be updated by anyone.
13. **Sound Library RBAC & Payload Bounds**: Only verified `admin` users (`isAdmin()`) can create, update, or delete custom sound effects in `/sound_library/{soundId}` or change the active cracked-screen sound in `/site_config/cracked_screen`. All audio payloads enforce strict bounds (`audioData` <= 360,000 chars and `data:audio/*` base64 prefix, `audioUrl` <= 500 chars and `https://` prefix, bounded `synthConfig` numeric ranges, `volume` in `0..1`).
14. **PII-Free Public Sound Sync**: Public visitors may ONLY `get` the singleton `/site_config/cracked_screen` document (no public `list` on `/site_config` or `/sound_library`), ensuring zero PII or admin list exposure.

## 2. The "Dirty Dozen" Adversarial Payloads
1. **Unauthenticated Ticket List Scrape**: `list /tickets` with `auth == null` -> `PERMISSION_DENIED`.
2. **Unauthenticated Ticket Get PII Leak**: `get /tickets/1712000000001` with `auth == null` -> `PERMISSION_DENIED`.
3. **Public Tracking List Scrape**: `list /ticket_tracking` with `auth == null` -> `PERMISSION_DENIED`.
4. **Self-Assigned Admin Escalation**: Non-invited user creates `/staff/{uid}` with `role: "admin"` -> `PERMISSION_DENIED`.
5. **Email Spoofing Attack**: User with `email: "Jonathanhdezf@gmail.com"` and `email_verified: false` tries to read `/tickets` or write `/staff_invites` -> `PERMISSION_DENIED`.
6. **Shadow Field Injection on Ticket Create**: Public user creates `/tickets/{id}` with extra ghost field `isAdminApproved: true` -> `PERMISSION_DENIED`.
7. **State Shortcutting on Public Ticket Create**: Public user creates `/tickets/{id}` directly with `estado: "resuelto"` or `assignedTo: "Admin"` -> `PERMISSION_DENIED`.
8. **Orphan Ticket Without Tracking Doc**: Public user creates `/tickets/{id}` without batch-creating `/ticket_tracking/{folio}` -> `PERMISSION_DENIED`.
9. **Timestamp Spoofing**: Client sends backdated `createdAt` instead of `serverTimestamp()` (`request.time`) -> `PERMISSION_DENIED`.
10. **Terminal State Tampering**: Non-admin technician updates a ticket whose `existing().estado == "resuelto"` -> `PERMISSION_DENIED`.
11. **ID Poisoning / Resource Exhaustion**: Client attempts to create `/tickets/{1500_char_id}`, `description` > 2000 chars, or > 6 product photos -> `PERMISSION_DENIED`.
12. **Non-Admin Ticket Deletion & Hidden Catalog Scrape**: Technician tries `delete /tickets/{id}`, public visitor lists `/products` without `publicVisible == true`, or unauthenticated user writes `/products` or `/inventory_movements` -> `PERMISSION_DENIED`.
13. **Non-Admin Sound Hijack**: Non-admin user or unauthenticated user attempts to write `/site_config/cracked_screen` or `/sound_library/{id}` -> `PERMISSION_DENIED`.
14. **Malicious Audio Scheme / Oversized Data Injection**: Admin or attacker submits `audioData: "data:text/html;base64,..."` or `audioUrl: "javascript:alert(1)"` or `audioData` > 360,000 chars -> `PERMISSION_DENIED`.

