export const TEA_ROLES = ['admin', 'manager', 'staff'];
export const DEFAULT_TEA_BRANCH_ID = 'main';

function cleanEmail(email = '') {
  return String(email || '').trim().toLowerCase();
}

function cleanUid(uid = '') {
  return String(uid || '').trim();
}

export function normalizeTeaRole(role) {
  return TEA_ROLES.includes(role) ? role : 'staff';
}

export function normalizeBranchId(branchId) {
  const value = String(branchId || '').trim();
  return value || DEFAULT_TEA_BRANCH_ID;
}

export function deterministicTeaUserCode({ uid = '', email = '' } = {}) {
  const seed = cleanUid(uid) || cleanEmail(email) || 'tea-user';
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = ((hash << 5) - hash + seed.charCodeAt(i)) | 0;
  }
  const code = Math.abs(hash).toString(36).toUpperCase().padStart(6, '0').slice(-6);
  return `TEA-${code}`;
}

export function normalizeTeaMember(member = {}) {
  const email = cleanEmail(member.email);
  const uid = cleanUid(member.uid || member.id);
  return {
    ...member,
    uid: member.uid || member.id || '',
    email: member.email || email,
    role: normalizeTeaRole(member.role),
    branchId: normalizeBranchId(member.branchId),
    userCode: member.userCode || deterministicTeaUserCode({ uid, email }),
  };
}

export function buildTeaUserProfile({ uid, email, name, role, approved = true, createdAt } = {}) {
  const clean = cleanEmail(email);
  const userCode = deterministicTeaUserCode({ uid, email: clean });
  return {
    name: String(name || clean.split('@')[0] || 'ชินชา').trim(),
    email: clean,
    role: normalizeTeaRole(role),
    approved,
    uid,
    userCode,
    branchId: DEFAULT_TEA_BRANCH_ID,
    createdAt: createdAt || new Date().toISOString(),
  };
}

export function actorSnapshot(member = {}) {
  const normalized = normalizeTeaMember(member);
  return {
    uid: normalized.uid || '',
    userCode: normalized.userCode || deterministicTeaUserCode(normalized),
    name: normalized.name || normalized.email || 'ชินชา',
    email: normalized.email || '',
    role: normalized.role,
    branchId: normalized.branchId,
  };
}
