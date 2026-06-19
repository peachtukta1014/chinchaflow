// Cache admin check for 5 minutes
const adminCache = new Map();

export const isTeaAdmin = (member) => {
  if (!member?.uid) return false;
  
  const cacheKey = `${member.uid}-admin`;
  if (adminCache.has(cacheKey)) {
    return adminCache.get(cacheKey);
  }
  
  const isAdmin = member?.roles?.includes('admin') || member?.roles?.includes('owner');
  adminCache.set(cacheKey, isAdmin);
  setTimeout(() => adminCache.delete(cacheKey), 300000); // 5 min cache
  return isAdmin;
};