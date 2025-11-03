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
    start_date: string;
    end_date?: string | null;
    schedule_type: 'daily' | 'weekly_days' | 'every_x_days';
    weekly_days?: string | null;
    interval_days?: number | null;
    times_list: string | string[];
    synced?: boolean;
}

export interface IntakeHistory {
    id?: number;
    server_id?: number | null;
    medication_id: number;
    planned_time: string;
    datetime: string;
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

    // ---------- LOCAL USER (Singleton) ----------
    const getLocalUser = useCallback(async (): Promise<LocalUser | null> => {
        const rows = await db.getAllAsync<LocalUser>(
            `SELECT * FROM local_user LIMIT 1`,
        );
        return rows.length ? rows[0] : null;
    }, []);

    const setLocalUser = useCallback(
        async (user: LocalUser) => {
            // Проверяем, есть ли уже пользователь
            const existing = await getLocalUser();

            if (existing) {
                // Обновляем запись
                await db.runAsync(
                    `UPDATE local_user
       SET patient_uuid = ?, patient_password_hash = ?, relation_uuid = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
                    [
                        user.patient_uuid ?? null,
                        user.patient_password_hash ?? null,
                        user.relation_uuid ?? null,
                        existing.id ?? null,
                    ],
                );
            } else {
                // Создаём нового
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
    const addMedication = useCallback(async (med: Medication) => {
        await db.runAsync(
            `INSERT INTO medications (
        name, form, instructions, start_date, end_date,
        schedule_type, weekly_days, interval_days, times_list
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                med.name,
                med.form,
                med.instructions ?? null,
                med.start_date,
                med.end_date ?? null,
                med.schedule_type,
                med.weekly_days ?? null,
                med.interval_days ?? null,
                typeof med.times_list === 'string'
                    ? med.times_list
                    : JSON.stringify(med.times_list),
            ],
        );
    }, []);

    const getMedications = useCallback(async (): Promise<Medication[]> => {
        return await db.getAllAsync<Medication>(
            `SELECT * FROM medications ORDER BY id DESC`,
        );
    }, []);

    const deleteMedication = useCallback(async (id: number) => {
        await db.runAsync(`DELETE FROM medications WHERE id = ?`, [id]);
    }, []);

    // ---------- INTAKE HISTORY ----------
    const addIntake = useCallback(async (intake: IntakeHistory) => {
        await db.runAsync(
            `INSERT INTO intake_history (
        medication_id, planned_time, datetime, taken, skipped, dose_taken, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
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
    }, []);

    const getIntakeHistory = useCallback(async (): Promise<IntakeHistory[]> => {
        return await db.getAllAsync<IntakeHistory>(
            `SELECT * FROM intake_history ORDER BY datetime DESC`,
        );
    }, []);

    const deleteIntake = useCallback(async (id: number) => {
        await db.runAsync(`DELETE FROM intake_history WHERE id = ?`, [id]);
    }, []);

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
        addMedication,
        getMedications,
        deleteMedication,
        addIntake,
        getIntakeHistory,
        deleteIntake,
    };
}
