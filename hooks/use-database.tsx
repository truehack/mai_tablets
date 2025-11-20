// @/hooks/use-database.tsx
import * as FileSystem from 'expo-file-system/legacy';
import { useEffect, useState, useCallback } from 'react';
import { db, db_path, initDatabase } from '@/database';

export interface LocalUser {
  id?: number;
  patient_uuid: string;
  patient_password_hash: string;
  relation_uuid?: string | null;
}

export interface Medication {
  id?: number;
  server_id?: number | null;
  name: string;
  form: 'tablet' | 'drop' | 'spray' | 'other';
  instructions?: string | null;
  start_date: string; // YYYY-MM-DD
  end_date?: string | null;
  schedule_type: 'daily' | 'weekly_days' | 'every_x_days';
  weekly_days?: string[] | null; // ["ПН", "СР"]
  interval_days?: number | null;
  times_list: string[]; // ✅ массив строк
  synced?: boolean;
}

export interface IntakeHistory {
  id?: number;
  server_id?: number | null;
  medication_id: number;
  planned_time: string; // HH:MM или YYYY-MM-DD HH:MM (как в БД)
  datetime: string; // ISO string
  taken: boolean;
  skipped: boolean;
  dose_taken?: number | null;
  notes?: string | null;
  synced?: boolean;
}

export function useDatabase() {
  const [initialized, setInitialized] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      await initDatabase();
      setInitialized(true);
      setLoading(false);
    })();
  }, []);

  // ---------- LOCAL USER ----------
  const getLocalUser = useCallback(async (): Promise<LocalUser | null> => {
    const rows = await db.getAllAsync<LocalUser>(
      `SELECT * FROM local_user LIMIT 1`,
    );
    return rows.length ? rows[0] : null;
  }, []);

  const setLocalUser = useCallback(
    async (user: LocalUser) => {
      const existing = await getLocalUser();

      if (existing?.id) {
        await db.runAsync(
          `UPDATE local_user
           SET patient_uuid = ?, patient_password_hash = ?, relation_uuid = ?, updated_at = CURRENT_TIMESTAMP
           WHERE id = ?`,
          [
            user.patient_uuid,
            user.patient_password_hash,
            user.relation_uuid ?? null,
            existing.id,
          ],
        );
      } else {
        await db.runAsync(
          `INSERT INTO local_user (patient_uuid, patient_password_hash, relation_uuid)
           VALUES (?, ?, ?)`,
          [
            user.patient_uuid,
            user.patient_password_hash,
            user.relation_uuid ?? null,
          ],
        );
      }
    },
    [getLocalUser],
  );

  const deleteLocalUser = useCallback(async () => {
    await db.runAsync(`DELETE FROM local_user`);
  }, []);

  // ---------- MEDICATIONS ----------
  const addMedication = useCallback(async (med: Medication): Promise<number> => {
    const result = await db.runAsync(
      `INSERT INTO medications (
        name, form, instructions, start_date, end_date,
        schedule_type, weekly_days, interval_days, times_list, synced
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
      [
        med.name,
        med.form,
        med.instructions ?? null,
        med.start_date,
        med.end_date ?? null,
        med.schedule_type,
        med.weekly_days ? JSON.stringify(med.weekly_days) : null,
        med.interval_days ?? null,
        JSON.stringify(med.times_list),
      ],
    );
    return result.lastInsertRowId;
  }, []);

  const updateMedicationServerId = useCallback(
    async (localId: number, serverId: number) => {
      await db.runAsync(
        `UPDATE medications SET server_id = ?, synced = 1 WHERE id = ?`,
        [serverId, localId]
      );
    },
    []
  );

  const getMedications = useCallback(async (): Promise<Medication[]> => {
    const rows = await db.getAllAsync<Medication>(
      `SELECT * FROM medications ORDER BY id DESC`,
    );

    return rows.map((m) => ({
      ...m,
      weekly_days: m.weekly_days ? JSON.parse(m.weekly_days) : null,
      times_list: m.times_list ? JSON.parse(m.times_list) : [],
    }));
  }, []);

  const deleteMedication = useCallback(async (id: number) => {
    await db.runAsync(`DELETE FROM medications WHERE id = ?`, [id]);
  }, []);

  // ---------- INTAKE HISTORY ----------
  /**
   * Добавляет запись приёма в локальную БД
   */
  const addIntake = useCallback(async (intake: Omit<IntakeHistory, 'id' | 'server_id' | 'synced'>): Promise<number> => {
    const result = await db.runAsync(
      `INSERT INTO intake_history (
        medication_id, planned_time, datetime, taken, skipped, dose_taken, notes, synced
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 0)`,
      [
        intake.medication_id,
        intake.planned_time,
        intake.datetime,
        intake.taken ? 1 : 0,
        intake.skipped ? 1 : 0,
        intake.dose_taken ?? null,
        intake.notes ?? null,
      ],
    );
    return result.lastInsertRowId;
  }, []);

  /**
   * Получает все приёмы (опционально — только несинхронизированные)
   */
  const getIntakeHistory = useCallback(
    async (onlyUnsynced: boolean = false): Promise<IntakeHistory[]> => {
      const query = onlyUnsynced
        ? `SELECT * FROM intake_history WHERE synced = 0 ORDER BY datetime ASC`
        : `SELECT * FROM intake_history ORDER BY datetime DESC`;

      const rows = await db.getAllAsync<IntakeHistory>(query);

      // SQLite возвращает 0/1 для boolean — приводим к true/false
      return rows.map(row => ({
        ...row,
        taken: Boolean(row.taken),
        skipped: Boolean(row.skipped),
        synced: Boolean(row.synced),
      }));
    },
    []
  );

  /**
   * ✅ НОВОЕ: получает только несинхронизированные приёмы (для retry-синхронизации)
   */
  const getUnsyncedIntakes = useCallback(async (): Promise<IntakeHistory[]> => {
    return getIntakeHistory(true);
  }, [getIntakeHistory]);

  /**
   * ✅ НОВОЕ: обновляет server_id и synced=1 после успешной синхронизации
   */
  const updateIntakeServerId = useCallback(
    async (localId: number, serverId: number) => {
      await db.runAsync(
        `UPDATE intake_history SET server_id = ?, synced = 1 WHERE id = ?`,
        [serverId, localId]
      );
    },
    []
  );

  const deleteIntake = useCallback(async (id: number) => {
    await db.runAsync(`DELETE FROM intake_history WHERE id = ?`, [id]);
  }, []);

  const deleteFutureIntakes = useCallback(async (medicationId: number) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = today.toISOString().split('T')[0]; // YYYY-MM-DD

    await db.runAsync(
      `DELETE FROM intake_history WHERE medication_id = ? AND datetime >= ?`,
      [medicationId, todayStr]
    );
  }, []);

  const markAsTaken = useCallback(
    async (medicationId: number, plannedTime: string) => {
      const now = new Date().toISOString();
      await addIntake({
        medication_id: medicationId,
        planned_time: plannedTime,
        datetime: now,
        taken: true,
        skipped: false,
      });
    },
    [addIntake]
  );

  // ---------- RESET DATABASE ----------
  const resetDatabase = useCallback(async (full: boolean = false) => {
    try {
      if (full) {
        const dbPath = `${FileSystem.documentDirectory}SQLite/${db_path}`;
        const fileInfo = await FileSystem.getInfoAsync(dbPath);
        if (fileInfo.exists) {
          await FileSystem.deleteAsync(dbPath);
          console.log('🗑️ Файл базы данных удалён');
        }
        await initDatabase();
      } else {
        await db.execAsync(`
          DELETE FROM local_user;
          DELETE FROM medications;
          DELETE FROM intake_history;
        `);
      }
    } catch (error) {
      console.error('Ошибка при сбросе базы данных:', error);
    }
  }, []);

  return {
    loading,
    initialized,
    resetDatabase,
    setLocalUser,
    getLocalUser,
    deleteLocalUser,
    // Medications
    addMedication,
    updateMedicationServerId,
    getMedications,
    deleteMedication,
    // ✅ Intake History — полный набор
    addIntake,
    getIntakeHistory,
    getUnsyncedIntakes, // ← для retry-синхронизации
    updateIntakeServerId, // ← после успешной синхронизации
    deleteIntake,
    markAsTaken,
    deleteFutureIntakes,
  };
}