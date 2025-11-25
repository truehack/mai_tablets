// src/utils/debug-log.ts
// Включает/выключает логирование
const DEBUG_ENABLED = true;
const LOG_LEVEL = 'debug'; // 'error' | 'warn' | 'debug'

const COLORS = {
  debug: '\x1b[36m', // cyan
  warn: '\x1b[33m',  // yellow
  error: '\x1b[31m', // red
  reset: '\x1b[0m',
};

function log(level: 'debug' | 'warn' | 'error', prefix: string, message: string, data?: any) {
  if (!DEBUG_ENABLED) return;
  if (level === 'debug' && LOG_LEVEL !== 'debug') return;

  const color = COLORS[level] || '';
  const reset = COLORS.reset;

  const now = new Date().toISOString().slice(11, 23); // HH:mm:ss.SSS
  const tag = `[${now}] [${prefix.toUpperCase()}]`;

  if (data) {
    console.log(`${color}%c${tag} ${message}`, 'color: inherit;', data);
  } else {
    console.log(`${color}%c${tag} ${message}`, 'color: inherit;');
  }
}

export const logDebug = (message: string, data?: any) => log('debug', 'debug', message, data);
export const logWarning = (message: string, data?: any) => log('warn', 'warn', message, data);
export const logError = (message: string, error: any) => {
  const data = error instanceof Error ? { message: error.message, stack: error.stack } : error;
  log('error', 'error', message, data);
};