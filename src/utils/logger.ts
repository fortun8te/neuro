/**
 * Simple logger for CLI and backend services
 */

export interface Logger {
  info(message: string, meta?: any): void;
  warn(message: string, meta?: any): void;
  error(message: string, meta?: any): void;
  debug(message: string, meta?: any): void;
}

export function createLogger(name: string): Logger {
  const prefix = `[${name}]`;

  return {
    info: (message: string, meta?: any) => {
      console.log(`${prefix} ${message}`, meta ? JSON.stringify(meta) : '');
    },
    warn: (message: string, meta?: any) => {
      console.warn(`${prefix} ⚠️  ${message}`, meta ? JSON.stringify(meta) : '');
    },
    error: (message: string, meta?: any) => {
      console.error(`${prefix} ❌ ${message}`, meta ? JSON.stringify(meta) : '');
    },
    debug: (message: string, meta?: any) => {
      if (process.env.DEBUG) {
        console.debug(`${prefix} 🔍 ${message}`, meta ? JSON.stringify(meta) : '');
      }
    }
  };
}
