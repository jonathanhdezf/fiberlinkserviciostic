import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  getDocFromServer
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

export const BOOTSTRAP_ADMIN_EMAIL = 'jonathanhdezf@gmail.com';

export const ROLES = {
  ADMIN: 'admin',
  TECNICO: 'tecnico',
  VENTAS: 'ventas',
  RECEPCION: 'recepcion'
};

export const ROLE_PERMISSIONS = {
  [ROLES.ADMIN]: {
    label: 'Administrador General',
    modules: ['overview', 'tickets', 'workshop', 'pos', 'store', 'clients', 'shifts', 'reports', 'users', 'settings'],
    canDelete: true,
    canManageUsers: true,
    canEditInventory: true,
    canProcessSales: true
  },
  [ROLES.TECNICO]: {
    label: 'Técnico de Taller y Campo',
    modules: ['overview', 'tickets', 'workshop', 'pos', 'store', 'clients', 'shifts', 'reports'],
    canDelete: false,
    canManageUsers: false,
    canEditInventory: false,
    canProcessSales: true
  },
  [ROLES.VENTAS]: {
    label: 'Cajero / Punto de Venta',
    modules: ['overview', 'pos', 'store', 'clients', 'tickets', 'workshop', 'shifts', 'reports'],
    canDelete: false,
    canManageUsers: false,
    canEditInventory: true,
    canProcessSales: true
  },
  [ROLES.RECEPCION]: {
    label: 'Recepción y Mesa de Ayuda',
    modules: ['overview', 'tickets', 'workshop', 'pos', 'store', 'clients', 'shifts', 'reports'],
    canDelete: false,
    canManageUsers: false,
    canEditInventory: false,
    canProcessSales: true
  }
};

export const OperationType = {
  CREATE: 'create',
  UPDATE: 'update',
  DELETE: 'delete',
  LIST: 'list',
  GET: 'get',
  WRITE: 'write'
};

export function handleFirestoreError(error, operationType, path) {
  const errInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid || null,
      email: auth.currentUser?.email || null,
      emailVerified: auth.currentUser?.emailVerified ?? null,
      isAnonymous: auth.currentUser?.isAnonymous ?? null,
      tenantId: auth.currentUser?.tenantId || null,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email
        })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export function emailToKey(email) {
  return String(email || '')
    .trim()
    .toLowerCase()
    .replace(/@/g, '__AT__')
    .replace(/\./g, '__DOT__')
    .replace(/[^a-z0-9_-]/g, '_');
}

async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration. Firestore client is offline.');
    }
  }
}

testConnection();

export {
  app,
  signInWithPopup,
  signOut,
  onAuthStateChanged
};
