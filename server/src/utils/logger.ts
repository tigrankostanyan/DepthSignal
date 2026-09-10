const LOG_LEVEL = process.env.LOG_LEVEL || 'info';
type LogLevel = 'error' | 'warn' | 'info' | 'debug';

const levels: Record<LogLevel, number> = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
};

const currentLevel = levels[LOG_LEVEL as LogLevel] ?? levels.info;

// Should log
function shouldLog(level: LogLevel): boolean {
  return levels[level] <= currentLevel;
}

// Format args
function formatArgs(args: any[]): string {
  return args.map(arg => {
    if (typeof arg === 'object') {
      try {
        return JSON.stringify(arg);
      } catch {
        return String(arg);
      }
    }
    return String(arg);
  }).join(' ');
}

// Logger
export const logger = {
  error: (...args: any[]) => shouldLog('error') && console.error('[ERROR]', formatArgs(args)),
  warn: (...args: any[]) => shouldLog('warn') && console.warn('[WARN]', formatArgs(args)),
  info: (...args: any[]) => shouldLog('info') && console.log('[INFO]', formatArgs(args)),
  debug: (...args: any[]) => shouldLog('debug') && console.log('[DEBUG]', formatArgs(args)),
};

export default logger;