// database/index.ts
import { openDatabaseSync } from 'expo-sqlite';

export const db_path = 'smartdoctor.db';
export const db = openDatabaseSync(db_path);

export type LocalUser = {
  id: number;
  patient_uuid: string;
  patient_password_hash: string;
  relation_uuid: string | null;
  created_at: string;
  updated_at: string;
};

export async function initDatabase() {
  await db.execAsync(`
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS local_user (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      patient_uuid TEXT UNIQUE NOT NULL,
      patient_password_hash TEXT NOT NULL,
      relation_uuid TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS medications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      server_id INTEGER UNIQUE,
      name TEXT NOT NULL,
      form TEXT NOT NULL CHECK(form IN ('tablet', 'drop', 'spray', 'other')),
      instructions TEXT,
      start_date DATE NOT NULL,
      end_date DATE,
      schedule_type TEXT NOT NULL CHECK(schedule_type IN ('daily', 'weekly_days', 'every_x_days')),
      weekly_days TEXT,
      interval_days INTEGER CHECK (interval_days > 0 AND interval_days <= 30),
      times_list TEXT NOT NULL,
      synced BOOLEAN NOT NULL DEFAULT FALSE
    );

    CREATE TABLE IF NOT EXISTS intake_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      server_id INTEGER UNIQUE,
      medication_id INTEGER NOT NULL,
      planned_time TIME NOT NULL,
      datetime DATETIME NOT NULL,
      taken BOOLEAN NOT NULL CHECK(taken IN (0, 1)),
      skipped BOOLEAN NOT NULL CHECK(skipped IN (0, 1)),
      dose_taken REAL,
      notes TEXT,
      synced BOOLEAN NOT NULL DEFAULT FALSE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (medication_id) REFERENCES medications (id) ON DELETE CASCADE
    );
  `);
}

export async function getLocalUser(): Promise<LocalUser | null> {
  const result = await db.getFirstAsync<LocalUser>(
    'SELECT * FROM local_user LIMIT 1'
  );
  return result;
}

// ✅ ОСНОВНОЕ ИЗМЕНЕНИЕ: переименовано + упрощено
export async function saveMedFriend(relation_uuid: string): Promise<void> {
  // Получаем ID текущего пользователя
  const user = await getLocalUser();
  if (!user) throw new Error('Local user not found');

  // Обновляем relation_uuid
  await db.runAsync(
    `UPDATE local_user SET relation_uuid = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
    [relation_uuid, user.id]
  );
}

// ✅ Добавим removeMedFriend — для будущего "Отключить"
export async function removeMedFriend(): Promise<void> {
  const user = await getLocalUser();
  if (!user) throw new Error('Local user not found');

  await db.runAsync(
    `UPDATE local_user SET relation_uuid = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
    [user.id]
  );
}

// ✅ И getMedFriendUuid — для проверки в профиле
export async function getMedFriendUuid(): Promise<string | null> {
  const user = await getLocalUser();
  return user?.relation_uuid ?? null;
}