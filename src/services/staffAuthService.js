import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc
} from 'firebase/firestore';
import {
  auth,
  BOOTSTRAP_ADMIN_EMAIL,
  db,
  emailToKey,
  googleProvider,
  handleFirestoreError,
  onAuthStateChanged,
  OperationType,
  ROLE_PERMISSIONS,
  ROLES,
  signInWithPopup,
  signOut
} from './firebase.js';

function normalizeTimestamp(val) {
  if (!val) return new Date().toISOString();
  if (typeof val.toDate === 'function') return val.toDate().toISOString();
  return String(val);
}

function formatStaffUser(data, fallbackUid = '') {
  const role = Object.values(ROLES).includes(data.role) ? data.role : ROLES.RECEPCION;
  const email = String(data.email || '').trim().toLowerCase();
  return {
    id: data.uid || fallbackUid,
    uid: data.uid || fallbackUid,
    email,
    username: email.split('@')[0] || 'staff',
    name: String(data.name || email.split('@')[0] || 'Staff Fiberlink'),
    role,
    specialty: data.specialty || '',
    phone: data.phone || '',
    photoURL: data.photoURL || '',
    active: data.active !== false,
    createdAt: normalizeTimestamp(data.createdAt),
    updatedAt: normalizeTimestamp(data.updatedAt),
    permissions: ROLE_PERMISSIONS[role] || ROLE_PERMISSIONS[ROLES.RECEPCION]
  };
}

export const staffAuthService = {
  async signInWithGoogle() {
    try {
      const cred = await signInWithPopup(auth, googleProvider);
      return await this.resolveAuthorizedStaff(cred.user);
    } catch (err) {
      if (err?.code === 'auth/popup-closed-by-user') {
        throw new Error('Inicio de sesión cancelado por el usuario.');
      }
      if (err?.code === 'auth/popup-blocked') {
        throw new Error('El navegador bloqueó la ventana emergente de Google. Permite ventanas emergentes e intenta de nuevo.');
      }
      throw err;
    }
  },

  async resolveAuthorizedStaff(firebaseUser) {
    if (!firebaseUser) return null;
    const email = String(firebaseUser.email || '').trim().toLowerCase();
    if (!email || !firebaseUser.emailVerified) {
      await signOut(auth).catch(() => {});
      throw new Error('Tu cuenta de Google debe tener un correo electrónico verificado.');
    }

    const uid = firebaseUser.uid;
    const staffRef = doc(db, 'staff', uid);
    let staffSnap;
    try {
      staffSnap = await getDoc(staffRef);
    } catch (err) {
      handleFirestoreError(err, OperationType.GET, `staff/${uid}`);
    }

    if (staffSnap.exists()) {
      const staffData = staffSnap.data();
      if (staffData.active === false) {
        await signOut(auth).catch(() => {});
        throw new Error(`Tu cuenta de staff (${email}) ha sido desactivada por un administrador.`);
      }
      return formatStaffUser(staffData, uid);
    }

    // Check if bootstrap admin or invited staff member
    const isBootstrap = email === BOOTSTRAP_ADMIN_EMAIL;
    const inviteKey = emailToKey(email);
    let inviteData = null;

    if (!isBootstrap) {
      try {
        const inviteSnap = await getDoc(doc(db, 'staff_invites', inviteKey));
        if (inviteSnap.exists()) {
          inviteData = inviteSnap.data();
        }
      } catch (err) {
        // Non-invited user will get permission-denied if reading someone else's invite,
        // or not-found for their own key if it doesn't exist
        inviteData = null;
      }
    }

    if (!isBootstrap && (!inviteData || inviteData.active !== true)) {
      await signOut(auth).catch(() => {});
      throw new Error(
        `Acceso denegado para ${email}. Solicita a un administrador de Fiberlink que autorice tu correo en "Usuarios & Roles".`
      );
    }

    const assignedRole = isBootstrap ? ROLES.ADMIN : inviteData.role;
    const displayName = String(
      (inviteData?.name || firebaseUser.displayName || email.split('@')[0] || 'Staff Fiberlink')
    ).slice(0, 120);

    const profilePayload = {
      uid,
      email,
      name: displayName,
      role: assignedRole,
      specialty: String(inviteData?.specialty || (isBootstrap ? 'Dirección General & Redes' : 'Operaciones TIC')).slice(0, 140),
      phone: String(inviteData?.phone || '').slice(0, 32),
      photoURL: String(firebaseUser.photoURL || '').slice(0, 500),
      active: true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };

    try {
      await setDoc(staffRef, profilePayload);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `staff/${uid}`);
    }

    // Ensure bootstrap admin also has an invite entry for directory visibility
    if (isBootstrap) {
      try {
        const invRef = doc(db, 'staff_invites', inviteKey);
        const invSnap = await getDoc(invRef);
        if (!invSnap.exists()) {
          await setDoc(invRef, {
            email,
            name: displayName,
            role: ROLES.ADMIN,
            specialty: profilePayload.specialty,
            phone: profilePayload.phone,
            active: true,
            invitedBy: uid,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
          });
        }
      } catch (_) {}
    }

    return formatStaffUser(
      { ...profilePayload, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
      uid
    );
  },

  subscribeAuth(callback) {
    return onAuthStateChanged(auth, async (fbUser) => {
      if (!fbUser) {
        callback({ status: 'unauthenticated', user: null, error: null });
        return;
      }
      try {
        const staffUser = await this.resolveAuthorizedStaff(fbUser);
        callback({ status: 'authenticated', user: staffUser, error: null });
      } catch (err) {
        callback({
          status: 'unauthorized',
          user: null,
          error: err instanceof Error ? err.message : 'No autorizado'
        });
      }
    });
  },

  async logout() {
    await signOut(auth);
  },

  async listStaffDirectory(isAdmin = false) {
    const entries = [];
    const seenEmails = new Set();

    try {
      const staffSnap = await getDocs(query(collection(db, 'staff'), orderBy('name', 'asc')));
      staffSnap.forEach((d) => {
        const u = formatStaffUser(d.data(), d.id);
        seenEmails.add(u.email);
        entries.push({ ...u, sourceType: 'staff', verifiedGoogle: true });
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, 'staff');
    }

    if (isAdmin) {
      try {
        const invSnap = await getDocs(collection(db, 'staff_invites'));
        invSnap.forEach((d) => {
          const data = d.data();
          const email = String(data.email || '').trim().toLowerCase();
          if (!seenEmails.has(email)) {
            const role = Object.values(ROLES).includes(data.role) ? data.role : ROLES.TECNICO;
            entries.push({
              id: `invite:${d.id}`,
              inviteKey: d.id,
              email,
              username: email.split('@')[0],
              name: data.name || email,
              role,
              specialty: data.specialty || '',
              phone: data.phone || '',
              active: data.active !== false,
              permissions: ROLE_PERMISSIONS[role] || ROLE_PERMISSIONS[ROLES.TECNICO],
              sourceType: 'invite',
              verifiedGoogle: false
            });
          }
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.LIST, 'staff_invites');
      }
    }

    return entries;
  },

  async inviteOrUpdateStaff(payload, currentAdminUid) {
    const email = String(payload.email || '').trim().toLowerCase();
    if (!email || !email.includes('@')) {
      throw new Error('Ingresa un correo electrónico de Google válido.');
    }
    const name = String(payload.name || '').trim().slice(0, 120);
    if (name.length < 2) {
      throw new Error('Ingresa el nombre completo del colaborador (mínimo 2 caracteres).');
    }
    const role = Object.values(ROLES).includes(payload.role) ? payload.role : ROLES.TECNICO;
    const specialty = String(payload.specialty || '').trim().slice(0, 140);
    const phone = String(payload.phone || '').trim().slice(0, 32);
    const active = payload.active !== false;
    const key = emailToKey(email);
    const invRef = doc(db, 'staff_invites', key);

    try {
      const existingInv = await getDoc(invRef);
      if (existingInv.exists()) {
        await updateDoc(invRef, {
          name,
          role,
          specialty,
          phone,
          active,
          invitedBy: currentAdminUid,
          updatedAt: serverTimestamp()
        });
      } else {
        await setDoc(invRef, {
          email,
          name,
          role,
          specialty,
          phone,
          active,
          invitedBy: currentAdminUid,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `staff_invites/${key}`);
    }

    // If staff member already has a /staff/{uid} document, sync role/active/profile
    if (payload.uid && !String(payload.uid).startsWith('invite:')) {
      const staffRef = doc(db, 'staff', payload.uid);
      try {
        await updateDoc(staffRef, {
          name,
          role,
          specialty,
          phone,
          active,
          updatedAt: serverTimestamp()
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `staff/${payload.uid}`);
      }
    } else {
      // Find matching /staff doc by email if any
      try {
        const staffSnap = await getDocs(collection(db, 'staff'));
        for (const d of staffSnap.docs) {
          if (String(d.data().email || '').toLowerCase() === email) {
            await updateDoc(doc(db, 'staff', d.id), {
              name,
              role,
              specialty,
              phone,
              active,
              updatedAt: serverTimestamp()
            });
          }
        }
      } catch (_) {}
    }

    return true;
  },

  async deleteStaffAccess(entryId, email) {
    if (email && email.toLowerCase() === BOOTSTRAP_ADMIN_EMAIL) {
      throw new Error('No se puede eliminar la cuenta principal de administrador.');
    }

    if (String(entryId).startsWith('invite:')) {
      const key = entryId.replace('invite:', '');
      try {
        await deleteDoc(doc(db, 'staff_invites', key));
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, `staff_invites/${key}`);
      }
      return true;
    }

    try {
      await deleteDoc(doc(db, 'staff', entryId));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `staff/${entryId}`);
    }

    if (email) {
      const key = emailToKey(email);
      try {
        await deleteDoc(doc(db, 'staff_invites', key));
      } catch (_) {}
    }
    return true;
  }
};
