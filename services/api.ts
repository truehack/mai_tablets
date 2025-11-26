// @/services/api.ts
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

  return d.toISOString(); // всегда YYYY-MM-DDTHH:mm:ss.sssZ
};

// 🔐 Вспомогательная функция для получения заголовков с Basic Auth
const getAuthHeaders = async () => {
  const user = await getLocalUser();
  if (!user) throw new Error('Требуется авторизация');

  const credentials = btoa(`${user.patient_uuid}:${user.patient_password_hash}`);
  return {
    'Authorization': `Basic ${credentials}`,
  };
};

export const apiClient = {
  /**
   * POST без аутентификации (например, /auth/token)
   */
  post: async <T = any>(endpoint: string, body: any): Promise<T> => {
    const url = `${API_BASE_URL}${endpoint}`;
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

  /**
   * GET с Basic Auth
   */
  getWithAuth: async <T = any>(endpoint: string): Promise<T> => {
    const url = `${API_BASE_URL}${endpoint}`;
    const headers = await getAuthHeaders();

    const response = await fetch(url, {
      method: 'GET',
      headers,
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

  /**
   * POST с Basic Auth
   */
  postWithAuth: async <T = any>(endpoint: string, body: any): Promise<T> => {
    const url = `${API_BASE_URL}${endpoint}`;
    const headers = await getAuthHeaders();

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...headers,
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

  /**
   * ✅ DELETE с Basic Auth — поддерживает 204 No Content
   */
  deleteWithAuth: async (endpoint: string): Promise<void> => {
    const url = `${API_BASE_URL}${endpoint}`;
    const headers = await getAuthHeaders();

    const response = await fetch(url, {
      method: 'DELETE',
      headers,
    });

    if (!response.ok) {
      let message = `Ошибка ${response.status}`;
      try {
        // Пытаемся прочитать JSON, но не требуем его
        const errorData = await response.json().catch(() => ({}));
        message = errorData.detail || errorData.message || message;
      } catch {}
      throw new Error(message);
    }

    // ✅ Для 204 — не вызываем .json()
    // Если сервер вернёт 200 с телом — можно расширить, но у вас 204
    return; // void
  },

  // 🔹 ==== Специфичные методы API ====

  /**
   * Удалить лекарство на сервере по server_id
   * Вызывает: DELETE /medicines/delete_medication/{medication_id}
   */
  deleteMedication: async (medicationId: number): Promise<void> => {
    if (!Number.isInteger(medicationId) || medicationId <= 0) {
      throw new Error('Некорректный ID лекарства');
    }
    return apiClient.deleteWithAuth(`/medicines/delete_medication/${medicationId}`);
  },

  /**
   * Синхронизация приёма
   */
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

      await apiClient.postWithAuth('/intake/add_or_update', payload);
    } catch (error: any) {
      console.warn('⚠️ Ошибка синхронизации приёма:', error.message);
      throw error;
    }
  },
};

export default apiClient;