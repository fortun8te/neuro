/**
 * Environment loader that works in both Vite (browser) and Node.js contexts
 */

export const getEnvVariable = (key: string): string | undefined => {
  try {
    // Try Vite/browser context first
    const env = (import.meta.env as any)[key];
    if (env) return env;
  } catch (e) {
    // import.meta not available in Node.js, fall through to process.env
  }

  // Fall back to Node.js process.env (only if process is available)
  if (typeof process !== 'undefined' && process.env) {
    return process.env[key];
  }

  return undefined;
};

export const getEnv = (key: string, defaultValue: string = ''): string => {
  return getEnvVariable(key) || defaultValue;
};
