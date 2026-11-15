import { db } from './index.ts';
import { users, cloudSaves, expeditionLogs } from './schema.ts';
import { eq, desc } from 'drizzle-orm';
import { isEmailAdmin } from '../lib/firebase-admin.ts';

export async function getOrCreateUser(uid: string, email: string, displayName?: string) {
  try {
    const computedRole = isEmailAdmin(email) ? 'admin' : 'survivor';
    const result = await db
      .insert(users)
      .values({
        uid,
        email,
        displayName: displayName || email.split('@')[0] || 'Outcast Survivor',
        role: computedRole,
        unifiedProjectName: 'Aetheria: Outcast Lands',
      })
      .onConflictDoUpdate({
        target: users.uid,
        set: {
          email,
          ...(isEmailAdmin(email) ? { role: 'admin' } : {}),
        },
      })
      .returning();

    return result[0];
  } catch (error) {
    console.error('Database query failed in getOrCreateUser:', error);
    throw new Error('Failed to synchronize user profile.', { cause: error });
  }
}

export async function saveUserProgressToSql(
  uid: string,
  level: number,
  moralKarma: number,
  dayCount: number,
  savePayloadJson: string
) {
  try {
    const result = await db
      .insert(cloudSaves)
      .values({
        userUid: uid,
        level,
        moralKarma,
        dayCount,
        savePayloadJson,
      })
      .onConflictDoUpdate({
        target: cloudSaves.userUid,
        set: {
          level,
          moralKarma,
          dayCount,
          savePayloadJson,
          updatedAt: new Date(),
        },
      })
      .returning();

    return result[0];
  } catch (error) {
    console.error('Database query failed in saveUserProgressToSql:', error);
    throw new Error('Failed to save progress to Cloud SQL.', { cause: error });
  }
}

export async function getUserProgressFromSql(uid: string) {
  try {
    const rows = await db
      .select()
      .from(cloudSaves)
      .where(eq(cloudSaves.userUid, uid));
    return rows[0] || null;
  } catch (error) {
    console.error('Database query failed in getUserProgressFromSql:', error);
    throw new Error('Failed to load progress from Cloud SQL.', { cause: error });
  }
}

export async function createExpeditionLogInSql(
  uid: string,
  title: string,
  summary: string,
  googleDocId?: string
) {
  try {
    const result = await db
      .insert(expeditionLogs)
      .values({
        userUid: uid,
        title,
        summary,
        googleDocId: googleDocId || null,
      })
      .returning();
    return result[0];
  } catch (error) {
    console.error('Database query failed in createExpeditionLogInSql:', error);
    throw new Error('Failed to record expedition log.', { cause: error });
  }
}

export async function getExpeditionLogsForUser(uid: string) {
  try {
    return await db
      .select()
      .from(expeditionLogs)
      .where(eq(expeditionLogs.userUid, uid))
      .orderBy(desc(expeditionLogs.createdAt));
  } catch (error) {
    console.error('Database query failed in getExpeditionLogsForUser:', error);
    throw new Error('Failed to fetch expedition logs.', { cause: error });
  }
}

export async function getAllUsersForAdmin() {
  try {
    return await db.select().from(users).orderBy(desc(users.createdAt));
  } catch (error) {
    console.error('Database query failed in getAllUsersForAdmin:', error);
    throw new Error('Failed to fetch user directory.', { cause: error });
  }
}
