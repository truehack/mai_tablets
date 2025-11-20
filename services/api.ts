// @/services/api.ts
import { API_BASE_URL } from '@/config/api';
import { getLocalUser } from '@/services/localUser.service';

interface ApiError extends Error {
  status?: number;
}

/**
 * Надёжное приведение к ISO 8601 UTC (Z-суффикс)
 * Поддерживает: "09:00", "2025-04-05 09:00", "2025-04-05T09:00+03:00", "2025-04-05T09:00:00.000Z"
 */
const ensureISOZ = (dt: string | Date): string => {
  let d: Date;

  if (dt instanceof Date) {
    d = dt;
  } else {
    let str = dt.trim().replace(' ', 'T');

    // Если только время — дополняем сегодняшней датой в UTC
    if (/^\d{1,2}:\d{2}(:\d{2})?$/.test(str)) {
      const now = new Date();
      str = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}-${String(now.getUTCDate()).padStart(2, '0')}T${str}`;
    }

    // Заменяем Z и смещения на +00:00 для совместимости
    str = str.replace(/Z$/, '+00:00').replace(/([+-]\d{2}):?(\d{2})$/, '$1:$2');

    d = new Date(str);
  }

  if (isNaN(d.getTime())) {
    throw new Error(`Invalid date: ${dt}`);
  }

  return d.toISOString(); // всегда YYYY-MM-DDTHH:mm:ss.sssZ
};

export const apiClient = {
  // ✅ GET без авторизации
  get: async <T = any>(endpoint: string): Promise<T> => {
    const url = `${API_BASE_URL}${endpoint}`;
    console.log(`📡 GET ${url}`);

    const response = await fetch(url, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });

    if (!response.ok) {
      let message = `Ошибка ${response.status}`;
      try {
        const errorData = await response.json();
        message = errorData.detail || message;
      } catch {}
      throw new Error(message);
    }

    return response.json();
  },

  // ✅ GET с авторизацией (Basic Auth)
  getWithAuth: async <T = any>(endpoint: string): Promise<T> => {
    const url = `${API_BASE_URL}${endpoint}`;
    console.log(`📡 GET (auth) ${url}`);

    const user = await getLocalUser();
    if (!user) throw new Error('Требуется авторизация');

    const credentials = btoa(`${user.patient_uuid}:${user.patient_password_hash}`);
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${credentials}`,
      },
    });

    if (!response.ok) {
      let message = `Ошибка ${response.status}`;
      try {
        const errorData = await response.json();
        message = errorData.detail || message;
      } catch {}
      throw new Error(message);
    }

    return response.json();
  },

  // ✅ POST без авторизации
  post: async <T = any>(endpoint: string, body: any): Promise<T> => {
    const url = `${API_BASE_URL}${endpoint}`;
    console.log(`📡 POST ${url}`);

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      let message = `Ошибка ${response.status}`;
      try {
        const errorData = await response.json();
        message = errorData.detail || message;
      } catch {}
      throw new Error(message);
    }

    return response.json();
  },

  // ✅ POST с авторизацией
  postWithAuth: async <T = any>(endpoint: string, body: any): Promise<T> => {
    const url = `${API_BASE_URL}${endpoint}`;
    console.log(`📡 POST (auth) ${url}`);

    const user = await getLocalUser();
    if (!user) throw new Error('Требуется авторизация');

    const credentials = btoa(`${user.patient_uuid}:${user.patient_password_hash}`);
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${credentials}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      let message = `Ошибка ${response.status}`;
      try {
        const errorData = await response.json();
        message = errorData.detail || message;
      } catch {}
      throw new Error(message);
    }

    return response.json();
  },

  /**
   * 🔄 Синхронизация приёма: локальный формат → серверный
   */
  intakeSync: async (localIntake: {
    medication_id: number;
    planned_time: string;   // как в БД: "09:00" или "2025-04-05 09:00"
    datetime: string;       // как в БД: ISO string
    taken: boolean;
    skipped: boolean;
    notes?: string;
  }): Promise<void> => {
    try {
      const payload = {
        medication_id: localIntake.medication_id,
        scheduled_time: ensureISOZ(localIntake.planned_time),
        taken_time: ensureISOZ(localIntake.datetime),
        status: localIntake.taken ? 'taken' : 'skipped',
        notes: localIntake.notes,
      };

      console.log('📤 Синхронизация приёма →', payload);
      await apiClient.postWithAuth('/intake/add_or_update', payload);
      console.log('✅ Синхронизация успешна');
    } catch (error: any) {
      console.warn('⚠️ Ошибка синхронизации:', error.message);
      throw error;
    }
  },
};

export default apiClient;