import { fsGetDoc, fsPatch, fsPost, fsSetUserProfile } from './firestoreRest';

export const DEFAULT_TEA_BRANCH_ID = 'main';
export const TEA_ROLES = ['admin', 'manager', 'staff'];
export const TEA_RESTOCK_PURCHASE_STATUS = {
  PENDING: 'pending',
  PICKED: 'picked',
  PENDING_CONFIRM: 'pending_confirm',
  RECEIVED: 'received',
  CANCELLED: 'cancelled',
};

const LEGACY_RESTOCK_STATUS_ALIASES = {
  purchased: TEA_RESTOCK_PURCHASE_STATUS.RECEIVED,
};

const USER_CODE_PREFIX_BY_ROLE = {
  admin: 'ADM',
  manager: 'MGR',
  staff: 'STF',
};

export function normalizeTeaRole(role) {
  return TEA_ROLES.includes(role) ? role : 'staff';
}

export function normalizeTeaBranchId(branchId) {
  return String(branchId || DEFAULT_TEA_BRANCH_ID).trim() || DEFAULT_TEA_BRANCH_ID;
}

/** Deterministic fallback userCode: stable per uid/email until a real code is assigned. */
export function buildTeaUserCode({ uid = '', email = '', role = 'staff' } = {}) {
  const normalizedRole = normalizeTeaRole(role);
  const prefix = USER_CODE_PREFIX_BY_ROLE[normalizedRole] || 'STF';
  const seed = String(uid || email || 'user')
    .replace(/[^a-zA-Z0-9]/g, '')
    .toUpperCase()
    .slice(0, 6)
    .padEnd(6, '0');
  return `${prefix}-${seed}`;
}

export function normalizeTeaUserProfile(profile = {}, fallback = {}) {
  const uid = profile.uid || profile.id || fallback.uid || '';
  const email = profile.email || fallback.email || '';
  return {
    ...profile,
    uid,
    email,
    role: normalizeTeaRole(profile.role || fallback.role),
    userCode: profile.userCode || buildTeaUserCode({ uid, email, role: profile.role || fallback.role }),
    branchId: normalizeTeaBranchId(profile.branchId || fallback.branchId),
  };
}

export function buildTeaUserProfile({ uid, email, name, role = 'staff', approved = true, branchId } = {}) {
  const normalizedRole = normalizeTeaRole(role);
  const normalizedBranchId = normalizeTeaBranchId(branchId);
  return {
    name: String(name || email?.split('@')?.[0] || 'ชินชา').trim(),
    email: String(email || '').trim().toLowerCase(),
    role: normalizedRole,
    approved: Boolean(approved),
    uid,
    userCode: buildTeaUserCode({ uid, email, role: normalizedRole }),
    branchId: normalizedBranchId,
    createdAt: new Date().toISOString(),
  };
}

export async function ensureTeaUserFoundation(uid, profile = {}, fallback = {}) {
  const normalized = normalizeTeaUserProfile(profile, { ...fallback, uid });
  const patch = {};
  if (!profile.uid) patch.uid = normalized.uid;
  if (!profile.userCode) patch.userCode = normalized.userCode;
  if (!profile.branchId) patch.branchId = normalized.branchId;
  if (profile.role && profile.role !== normalized.role) patch.role = normalized.role;

  const finalProfile = normalizeTeaUserProfile({ ...profile, ...patch }, { ...fallback, uid });
  if (Object.keys(patch).length > 0) {
    await fsPatch(`users/${uid}`, patch);
  }
  return finalProfile;
}

export async function createTeaUserProfile(uid, data) {
  const profile = buildTeaUserProfile({ ...data, uid });
  await fsSetUserProfile(uid, profile);
  return profile;
}

export async function loadTeaUserProfile(uid, fallback = {}) {
  const profile = await fsGetDoc(`users/${uid}`);
  if (!profile) return null;
  return ensureTeaUserFoundation(uid, profile, fallback);
}

export function actorSnapshot(member = {}) {
  const normalized = normalizeTeaUserProfile(member);
  return {
    actorUid: normalized.uid || '',
    actorName: normalized.name || normalized.email || 'ชินชา',
    actorEmail: normalized.email || '',
    actorRole: normalized.role,
    actorUserCode: normalized.userCode,
    branchId: normalized.branchId,
  };
}

/** Backward-compatible snapshot: new actor* fields plus legacy staff* fields used by rules/docs. */
export function teaWriteSnapshot(member = {}) {
  const actor = actorSnapshot(member);
  return {
    ...actor,
    staffUid: actor.actorUid,
    staffName: actor.actorName,
    staffEmail: actor.actorEmail,
    staffRole: actor.actorRole,
    staffUserCode: actor.actorUserCode,
  };
}

export function normalizeRestockPurchaseStatus(status) {
  const raw = String(status || '').trim();
  const aliased = LEGACY_RESTOCK_STATUS_ALIASES[raw] || raw;
  const allowed = Object.values(TEA_RESTOCK_PURCHASE_STATUS);
  return allowed.includes(aliased) ? aliased : TEA_RESTOCK_PURCHASE_STATUS.PENDING;
}

export function isReceivedRestockPurchaseStatus(status) {
  return normalizeRestockPurchaseStatus(status) === TEA_RESTOCK_PURCHASE_STATUS.RECEIVED;
}

export function restockStatusSnapshot(status, member, extra = {}) {
  return {
    purchaseStatus: normalizeRestockPurchaseStatus(status),
    statusUpdatedAt: new Date().toISOString(),
    statusUpdatedByUid: member?.uid || '',
    statusUpdatedBy: member?.name || member?.email || '—',
    ...actorSnapshot(member),
    ...extra,
  };
}

export async function createTeaRestockRequest({ dateKey, items, member, catalogByKey, restockNameKey }) {
  const now = new Date().toISOString();
  const payload = {
    dateKey,
    uid: member?.uid || 'unknown',
    createdBy: member?.name || 'ชินชา',
    createdByUid: member?.uid || '',
    ...teaWriteSnapshot(member),
    items: (items || []).map((i) => {
      const catalogItem = catalogByKey?.get(restockNameKey ? restockNameKey(i.name) : i.name);
      return {
        name: i.name,
        qty: i.qty,
        status: i.status,
        unit: catalogItem?.unit || 'ชิ้น',
        base_unit: catalogItem?.base_unit || catalogItem?.unit || 'ชิ้น',
        conversion_rate: Math.max(1, Math.round(Number(catalogItem?.conversion_rate) || 1)),
      };
    }),
    purchaseStatus: TEA_RESTOCK_PURCHASE_STATUS.PENDING,
    statusUpdatedAt: now,
    statusUpdatedByUid: member?.uid || '',
    statusUpdatedBy: member?.name || member?.email || '—',
    statusHistory: [{ status: TEA_RESTOCK_PURCHASE_STATUS.PENDING, at: now, byUid: member?.uid || '', by: member?.name || member?.email || '—' }],
    createdAt: now,
  };
  return fsPost('restocks', payload);
}
