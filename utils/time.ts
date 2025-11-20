// @/utils/time.ts

/**
 * Преобразует "ПН" → 1, "ВТ" → 2, ..., "ВС" → 7
 */
export const mapDayToNumber = (day: string): number => {
  const map: Record<string, number> = {
    'ПН': 1,
    'ВТ': 2,
    'СР': 3,
    'ЧТ': 4,
    'ПТ': 5,
    'СБ': 6,
    'ВС': 7,
  };
  return map[day] ?? 1;
};

/**
 * Приводит "08:00" → "08:00:00" (для надёжности с Pydantic)
 */
export const formatTimeForServer = (timeStr: string): string => {
  if (!timeStr.includes(':')) return timeStr;
  const parts = timeStr.split(':');
  if (parts.length === 2) {
    return `${parts[0].padStart(2, '0')}:${parts[1].padStart(2, '0')}:00`;
  }
  return timeStr;
};