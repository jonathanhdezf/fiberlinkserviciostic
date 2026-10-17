// ==========================================
// AUTH & USERS CONTROLLER (RBAC)
// ==========================================

import { readCollection, writeCollection, logActivity } from '../db/jsonStore.js';
import { ROLES, ROLE_PERMISSIONS } from '../config/constants.js';

function sanitizeUser(u) {
  if (!u) return null;
  const { password, ...safe } = u;
  return {
    ...safe,
    permissions: ROLE_PERMISSIONS[u.role] || ROLE_PERMISSIONS[ROLES.RECEPCION]
  };
}

export function extractCurrentUser(req) {
  const authHeader = req.headers['authorization'] || '';
  if (authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7).trim();
    try {
      const decoded = Buffer.from(token, 'base64').toString('utf-8');
      const [userId] = decoded.split(':');
      const users = readCollection('users');
      const found = users.find(u => u.id === userId && u.active !== false);
      if (found) return sanitizeUser(found);
    } catch (e) {
      // Ignore invalid token
    }
  }
  return null;
}

export function handleLogin(body) {
  const { username, password } = body || {};
  const users = readCollection('users');

  // Also support legacy 'fiberlink' / 'teziutlan2026' alias for admin
  let user = users.find(
    u => u.username.toLowerCase() === String(username || '').toLowerCase() && u.password === password
  );

  if (!user && username === 'fiberlink' && password === 'teziutlan2026') {
    user = users.find(u => u.role === ROLES.ADMIN);
  }

  if (!user) {
    return { status: 401, data: { error: 'Usuario o contraseña incorrectos.' } };
  }

  if (user.active === false) {
    return { status: 403, data: { error: 'Esta cuenta de usuario está desactivada.' } };
  }

  const token = Buffer.from(`${user.id}:${user.role}:${Date.now()}`).toString('base64');
  const safeUser = sanitizeUser(user);

  logActivity({
    user: safeUser.name,
    role: safeUser.role,
    module: 'auth',
    action: `Inició sesión en el sistema (${safeUser.permissions.label})`
  });

  return {
    status: 200,
    data: {
      success: true,
      token,
      user: safeUser
    }
  };
}

export function handleListUsers() {
  const users = readCollection('users').map(sanitizeUser);
  return { status: 200, data: users };
}

export function handleCreateUser(body, currentUser) {
  const users = readCollection('users');
  const username = (body.username || '').trim().toLowerCase();
  if (!username || !body.password || !body.name) {
    return { status: 400, data: { error: 'Nombre, usuario y contraseña requeridos.' } };
  }
  if (users.some(u => u.username.toLowerCase() === username)) {
    return { status: 409, data: { error: 'El nombre de usuario ya existe.' } };
  }

  const role = Object.values(ROLES).includes(body.role) ? body.role : ROLES.TECNICO;
  const newUser = {
    id: `u-${Date.now()}`,
    username,
    password: body.password,
    name: body.name.trim(),
    role,
    email: (body.email || '').trim(),
    phone: (body.phone || '').trim(),
    specialty: (body.specialty || '').trim(),
    active: true,
    createdAt: new Date().toISOString()
  };

  users.push(newUser);
  writeCollection('users', users);

  logActivity({
    user: currentUser?.name || 'Admin',
    role: currentUser?.role || 'admin',
    module: 'users',
    action: `Creó usuario ${newUser.name} (@${newUser.username}) con rol ${role}`
  });

  return { status: 201, data: { success: true, user: sanitizeUser(newUser) } };
}

export function handleUpdateUser(id, body, currentUser) {
  const users = readCollection('users');
  const idx = users.findIndex(u => u.id === id);
  if (idx === -1) {
    return { status: 404, data: { error: 'Usuario no encontrado' } };
  }

  if (body.name !== undefined) users[idx].name = body.name.trim();
  if (body.role && Object.values(ROLES).includes(body.role)) users[idx].role = body.role;
  if (body.email !== undefined) users[idx].email = body.email.trim();
  if (body.phone !== undefined) users[idx].phone = body.phone.trim();
  if (body.specialty !== undefined) users[idx].specialty = body.specialty.trim();
  if (body.active !== undefined) users[idx].active = Boolean(body.active);
  if (body.password && body.password.trim()) users[idx].password = body.password.trim();

  writeCollection('users', users);

  logActivity({
    user: currentUser?.name || 'Admin',
    role: currentUser?.role || 'admin',
    module: 'users',
    action: `Actualizó perfil de usuario ${users[idx].name}`
  });

  return { status: 200, data: { success: true, user: sanitizeUser(users[idx]) } };
}

export function handleDeleteUser(id, currentUser) {
  let users = readCollection('users');
  const target = users.find(u => u.id === id);
  if (!target) {
    return { status: 404, data: { error: 'Usuario no encontrado' } };
  }
  if (target.username === 'admin') {
    return { status: 400, data: { error: 'No se puede eliminar la cuenta principal de administrador.' } };
  }

  users = users.filter(u => u.id !== id);
  writeCollection('users', users);

  logActivity({
    user: currentUser?.name || 'Admin',
    role: currentUser?.role || 'admin',
    module: 'users',
    action: `Eliminó usuario ${target.name} (@${target.username})`
  });

  return { status: 200, data: { success: true } };
}
