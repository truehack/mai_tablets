// @/services/localUser.service.ts
import { db } from '@/database';

export interface LocalUser {
  id: number;
  patient_uuid: string;
  patient_password: string; // ← открытый пароль для Basic Auth
  relation_uuid: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Сохраняет или обновляет единственную запись пользователя (id = 1)
 * Соответствует схеме: local_user (id, patient_uuid, patient_password, ...)
 */
export async function saveLocalUser({
  uuid,
  password,
  username,
}: {
  uuid: string;
  password: string;
  username?: string;
}): Promise<void> {
  try {
    await db.runAsync(
      `INSERT INTO local_user (
        id,
        patient_uuid,
        patient_password_hash,
        relation_uuid
      ) VALUES (
        1,
        ?,
        ?,
        NULL
      )
      ON CONFLICT(id) DO UPDATE SET
        patient_uuid = excluded.patient_uuid,
        patient_password_hash = excluded.patient_password_hash,
        updated_at = CURRENT_TIMESTAMP;`,
      [uuid, password]
    );
    console.log('✅ Пользователь сохранён в SQLite:', { uuid });
  } catch (error) {
    console.error('❌ Ошибка сохранения в БД:', error);
    throw new Error('Не удалось сохранить данные локально');
  }
}

/** Возвращает текущего пользователя из SQLite */
export async function getLocalUser(): Promise<LocalUser | null> {
  try {
    const user = await db.getFirstAsync<LocalUser>(
      'SELECT * FROM local_user WHERE id = 1'
    );
    return user || null;
  } catch (error) {
    console.error('❌ Ошибка чтения пользователя:', error);
    return null;
  }
}