import { fsPatch } from './firestoreRest';
import { shouldMigrateStaffToManager } from './shrimpRoles';

/**
 * ย้าย staff เก่า (คนในบ้าน) → manager ยกเว้นอีเมลลูกมือ
 * @returns {Promise<number>} จำนวนที่อัปเดต
 */
export async function migrateLegacyStaffToManager(users) {
  const targets = users.filter(
    (u) => u.id && shouldMigrateStaffToManager(u.role, u.email),
  );
  await Promise.all(
    targets.map((u) => fsPatch(`shrimp_users/${u.id}`, { role: 'manager' })),
  );
  return targets.length;
}
