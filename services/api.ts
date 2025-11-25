import { API_BASE_URL } from '@/config/api';
import { getLocalUser } from '@/services/localUser.service';

interface ApiError extends Error {
  status?: number;
}

/**
 * 🔑 ИСПРАВЛЕНО: для "09:00" — используем ЛОКАЛЬНУЮ дату (не UTC!)
 * Поддерживает: "09:00", "2025-04-05 09:00", "2025-04-05T09:00+03:00", "2025-04-05T09:00:00.000Z"
 */
const ensureISOZ = (dt: string | Date): string => {
  let d: Date;

  if (dt instanceof Date) {
    d = dt;
  } else {
    let str = dt.trim().replace(' ', 'T');

    // ✅ Если только время (например, "09:00" или "09:00:00") — берём текущую ЛОКАЛЬНУЮ дату
    if (/^\d{1,2}:\d{2}(:\d{2})?$/.test(str)) {
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const day = String(now.getDate()).padStart(2, '0');
      str = `${year}-${month}-${day}T${str}`;
      // console.log(`[ensureISOZ] Время "${dt}" → локальная дата: ${str}`);
    }

    // Нормализуем временные зоны для корректного парсинга
    str = str
      .replace(/Z$/, '+00:00')
      .replace(/([+-]\d{2}):?(\d{2})$/, '$1:$2');

    d = new Date(str);

    if (isNaN(d.getTime())) {
      throw new Error(`Invalid date after parsing: "${str}" (original: "${dt}")`);
    }
  }

  const result = d.toISOString(); // всегда YYYY-MM-DDTHH:mm:ss.sssZ
  // console.log(`[ensureISOZ] "${dt}" → "${result}"`);
  return result;
};

export const apiClient = {
  post: async <T = any>(endpoint: string, body: any): Promise<T> => {
    const url = `${API_BASE_URL}${endpoint}`;
    // console.log(`📡 POST ${url}`);

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      let message = `Ошибка ${response.status}`;
      try {
        const errorData = await response.json();
        message = errorData.detail || errorData.message || message;
      } catch {}
      throw new Error(message);
    }

    return response.json();
  },

  postWithAuth: async <T = any>(endpoint: string, body: any): Promise<T> => {
    const url = `${API_BASE_URL}${endpoint}`;
    // console.log(`📡 POST (auth) ${url}`);

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
        message = errorData.detail || errorData.message || message;
      } catch {}
      throw new Error(message);
    }

    return response.json();
  },

  getWithAuth: async <T = any>(endpoint: string): Promise<T> => {
    const url = `${API_BASE_URL}${endpoint}`;
    // console.log(`📡 GET (auth) ${url}`);

    const user = await getLocalUser();
    if (!user) throw new Error('Требуется авторизация');

    const credentials = btoa(`${user.patient_uuid}:${user.patient_password_hash}`);
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${credentials}`,
      },
    });

    if (!response.ok) {
      let message = `Ошибка ${response.status}`;
      try {
        const errorData = await response.json();
        message = errorData.detail || errorData.message || message;
      } catch {}
      throw new Error(message);
    }

    return response.json();
  },

  deleteWithAuth: async <T = any>(endpoint: string): Promise<T> => {
    const url = `${API_BASE_URL}${endpoint}`;
    // console.log(`📡 DELETE (auth) ${url}`);

    const user = await getLocalUser();
    if (!user) throw new Error('Требуется авторизация');

    const credentials = btoa(`${user.patient_uuid}:${user.patient_password_hash}`);
    const response = await fetch(url, {
      method: 'DELETE',
      headers: {
        'Authorization': `Basic ${credentials}`,
      },
    });

    if (!response.ok) {
      let message = `Ошибка ${response.status}`;
      try {
        const errorData = await response.json();
        message = errorData.detail || errorData.message || message;
      } catch {}
      throw new Error(message);
    }

    return response.json();
  },

  intakeSync: async (localIntake: {
    medication_id: number;
    planned_time: string;
    datetime: string;
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

      // console.log('📤 Синхронизация приёма →', payload);
      await apiClient.postWithAuth('/intake/add_or_update', payload);
      // console.log('✅ Синхронизация успешна');
    } catch (error: any) {
      console.warn('⚠️ Ошибка синхронизации:', error.message);
      throw error;
    }
  },
};

export default apiClient;