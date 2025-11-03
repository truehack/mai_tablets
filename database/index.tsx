import { openDatabaseSync } from 'expo-sqlite';

export const db_path = 'smartdoctor.db'

export const db = openDatabaseSync(db_path);

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
