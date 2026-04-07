/**
 * frontend/utils/storageAdapter.ts
 *
 * IndexedDB persistence layer for metrics storage.
 * Enables historical metrics retention and trend analysis across sessions.
 *
 * Database structure:
 * - store: "metrics-sessions"
 *   - key: sessionId
 *   - data: { sessionId, startTime, metrics[], sessionMetrics }
 *
 * - store: "metrics-archive"
 *   - key: [sessionId, timestamp]
 *   - data: individual click metrics for long-term analysis
 *
 * Usage:
 *   const storage = StorageAdapter.getInstance();
 *   await storage.saveMetrics(sessionId, sessionMetrics, clickMetrics);
 *   const historic = await storage.loadMetrics(sessionId);
 *   const allSessions = await storage.getAllSessions();
 */

import type { ClickMetric, SessionMetrics } from './metricsCollector';
import { createLogger } from './logger';

const log = createLogger('storageAdapter');

const DB_NAME = 'nomads-metrics';
const DB_VERSION = 2;
const STORE_SESSIONS = 'metrics-sessions';
const STORE_ARCHIVE = 'metrics-archive';

/**
 * Stored session data
 */
interface StoredSession {
  sessionId: string;
  startTime: string;
  endTime?: string;
  metrics: ClickMetric[];
  sessionMetrics: SessionMetrics;
  exportedAt: string;
  successRate?: number;
  avgAccuracy?: number;
  metricsCount?: number;
}

/**
 * Archive entry for long-term storage
 */
interface ArchiveEntry {
  sessionId: string;
  timestamp: string;
  metric: ClickMetric;
}

/**
 * Session summary for querying
 */
export interface SessionSummary {
  sessionId: string;
  startTime: string;
  metricsCount: number;
  successRate: number;
  avgAccuracy: number;
}

/**
 * Trend data for multiple sessions
 */
export interface TrendData {
  sessionId: string;
  timestamp: string;
  successRate: number;
  avgDistance: number;
  avgConfidence: number;
}

/**
 * StorageAdapter — Singleton for IndexedDB access
 */
export class StorageAdapter {
  private static instance: StorageAdapter;

  private db: IDBDatabase | null = null;
  private initPromise: Promise<void> | null = null;
  // BUG FIX #5: Serialize writes to prevent concurrent update races
  private saveMetricsQueue: Promise<void> = Promise.resolve();

  /**
   * Get singleton instance
   */
  static getInstance(): StorageAdapter {
    if (!this.instance) {
      this.instance = new StorageAdapter();
    }
    return this.instance;
  }

  /**
   * Initialize IndexedDB connection
   */
  async init(): Promise<void> {
    if (this.db) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = this._initDb();
    return this.initPromise;
  }

  /**
   * Save metrics to IndexedDB
   * BUG FIX #5: Serialize writes to prevent concurrent update races
   */
  async saveMetrics(
    sessionId: string,
    sessionMetrics: SessionMetrics,
    clickMetrics: ClickMetric[],
  ): Promise<void> {
    // Enqueue this write operation to serialize access per session
    return new Promise<void>((resolve, reject) => {
      this.saveMetricsQueue = this.saveMetricsQueue
        .catch(() => { /* continue on previous failure */ })
        .then(async () => {
          await this.init();

          const stored: StoredSession = {
            sessionId,
            startTime: sessionMetrics.startTime,
            metrics: clickMetrics,
            sessionMetrics,
            exportedAt: new Date().toISOString(),
          };

          return this._withTransaction(STORE_SESSIONS, 'readwrite', (store) => {
            return new Promise<void>((res, rej) => {
              const req = store.put(stored);
              req.onsuccess = () => {
                log.debug(`Saved metrics for session ${sessionId}`);
                res();
              };
              req.onerror = () => rej(req.error);
            });
          });
        })
        .then(resolve)
        .catch(reject);
    });
  }

  /**
   * Load metrics for a specific session
   */
  async loadMetrics(sessionId: string): Promise<StoredSession | null> {
    await this.init();

    return this._withTransaction(STORE_SESSIONS, 'readonly', (store) => {
      return new Promise((resolve, reject) => {
        const req = store.get(sessionId);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => reject(req.error);
      });
    });
  }

  /**
   * Get all session summaries
   */
  async getAllSessions(): Promise<SessionSummary[]> {
    await this.init();

    return this._withTransaction(STORE_SESSIONS, 'readonly', (store) => {
      return new Promise((resolve, reject) => {
        const req = store.getAll();
        req.onsuccess = () => {
          const sessions = (req.result as StoredSession[]).map(s => ({
            sessionId: s.sessionId,
            startTime: s.startTime,
            metricsCount: s.metrics.length,
            successRate: s.sessionMetrics.successRate,
            avgAccuracy: s.sessionMetrics.avgDistance,
          }));
          resolve(sessions);
        };
        req.onerror = () => reject(req.error);
      });
    });
  }

  /**
   * Delete a session from storage
   */
  async deleteSession(sessionId: string): Promise<void> {
    await this.init();

    return this._withTransaction(STORE_SESSIONS, 'readwrite', (store) => {
      return new Promise((resolve, reject) => {
        const req = store.delete(sessionId);
        req.onsuccess = () => {
          log.debug(`Deleted session ${sessionId}`);
          resolve();
        };
        req.onerror = () => reject(req.error);
      });
    });
  }

  /**
   * Export all sessions as JSON
   */
  async exportAllSessions(): Promise<string> {
    const sessions = await this._getAllSessions();
    return JSON.stringify(sessions, null, 2);
  }

  /**
   * Import sessions from JSON
   */
  async importSessions(jsonData: string): Promise<number> {
    const sessions: StoredSession[] = JSON.parse(jsonData);
    let count = 0;

    for (const session of sessions) {
      await this.saveMetrics(session.sessionId, session.sessionMetrics, session.metrics);
      count++;
    }

    log.debug(`Imported ${count} sessions`);
    return count;
  }

  /**
   * Get trend data across multiple sessions
   */
  async getTrends(limit = 10): Promise<TrendData[]> {
    const sessions = await this._getAllSessions();

    return sessions
      .slice(-limit)
      .map(s => ({
        sessionId: s.sessionId,
        timestamp: s.startTime,
        successRate: s.successRate,
        avgDistance: s.avgAccuracy,
        avgConfidence: 0, // Would need to store in sessionMetrics
      }));
  }

  /**
   * Clear all metrics (destructive — use with care)
   */
  async clear(): Promise<void> {
    await this.init();

    return this._withTransaction([STORE_SESSIONS, STORE_ARCHIVE], 'readwrite', (store: IDBObjectStore) => {
      return new Promise<void>((resolve, reject) => {
        const req = store.clear();

        if (req instanceof IDBRequest) {
          req.onsuccess = () => {
            log.debug('Cleared all metrics');
            resolve();
          };
          req.onerror = () => reject(req.error);
        } else {
          resolve();
        }
      });
    });
  }

  /**
   * Get storage statistics
   */
  async getStats(): Promise<{
    sessionCount: number;
    totalMetrics: number;
    oldestSession: string | null;
    newestSession: string | null;
  }> {
    const sessions = await this._getAllSessions();

    const totalMetrics = sessions.reduce((sum, s) => sum + s.metricsCount, 0);
    const sorted = sessions.sort((a, b) =>
      new Date(a.startTime).getTime() - new Date(b.startTime).getTime(),
    );

    return {
      sessionCount: sessions.length,
      totalMetrics,
      oldestSession: sorted[0]?.startTime || null,
      newestSession: sorted[sorted.length - 1]?.startTime || null,
    };
  }

  /**
   * Archive a metric entry for long-term analysis
   */
  async archiveMetric(metric: ClickMetric, sessionId: string): Promise<void> {
    await this.init();

    const entry: ArchiveEntry = {
      sessionId,
      timestamp: metric.timestamp,
      metric,
    };

    return this._withTransaction(STORE_ARCHIVE, 'readwrite', (store) => {
      return new Promise((resolve, reject) => {
        // Use compound key for efficient time-range queries
        const req = store.add(entry);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    });
  }

  /**
   * Query metrics in a time range
   */
  async queryRange(startTime: string, endTime: string): Promise<ClickMetric[]> {
    const sessions = await this._getAllSessions();

    const filtered = sessions.filter(s => {
      const sTime = new Date(s.startTime).getTime();
      return sTime >= new Date(startTime).getTime() && sTime <= new Date(endTime).getTime();
    });

    const allMetrics: ClickMetric[] = [];
    for (const summary of filtered) {
      const session = await this.loadMetrics(summary.sessionId);
      if (session) {
        allMetrics.push(...session.metrics);
      }
    }

    return allMetrics;
  }

  /**
   * Internal: Open database connection
   */
  private async _initDb(): Promise<void> {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);

      req.onerror = () => {
        log.error('Failed to open IndexedDB');
        reject(req.error);
      };

      req.onsuccess = () => {
        this.db = req.result;
        log.debug('IndexedDB initialized');
        resolve();
      };

      req.onupgradeneeded = (e) => {
        const db = (e.target as IDBOpenDBRequest).result;

        // Create sessions store
        if (!db.objectStoreNames.contains(STORE_SESSIONS)) {
          db.createObjectStore(STORE_SESSIONS, { keyPath: 'sessionId' });
        }

        // Create archive store
        if (!db.objectStoreNames.contains(STORE_ARCHIVE)) {
          const archiveStore = db.createObjectStore(STORE_ARCHIVE, { keyPath: ['sessionId', 'timestamp'] });
          archiveStore.createIndex('sessionId', 'sessionId', { unique: false });
          archiveStore.createIndex('timestamp', 'timestamp', { unique: false });
        }

        log.debug('Database schema upgraded');
      };
    });
  }

  /**
   * Internal: Execute transaction on store(s)
   */
  private async _withTransaction<T>(
    storeNames: string | string[],
    mode: IDBTransactionMode,
    callback: (store: IDBObjectStore) => Promise<T> | T,
  ): Promise<T> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    const tx = this.db.transaction(storeNames, mode);
    const store = Array.isArray(storeNames) ? tx.objectStore(storeNames[0]) : tx.objectStore(storeNames);

    return new Promise((resolve, reject) => {
      Promise.resolve(callback(store))
        .then(result => {
          tx.oncomplete = () => resolve(result);
          tx.onerror = () => reject(tx.error);
        })
        .catch(err => {
          tx.abort();
          reject(err);
        });
    });
  }

  /**
   * Internal: Get all sessions
   */
  private async _getAllSessions(): Promise<StoredSession[]> {
    return this._withTransaction(STORE_SESSIONS, 'readonly', (store) => {
      return new Promise((resolve, reject) => {
        const req = store.getAll();
        req.onsuccess = () => resolve(req.result as StoredSession[]);
        req.onerror = () => reject(req.error);
      });
    });
  }
}
