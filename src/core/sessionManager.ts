/**
 * Session Manager — Persist research sessions across invocations
 *
 * Enables follow-up queries with knowledge carryover:
 * Session 1: "Research collagen supplements"
 * Session 2: "You found X, how does Y compare?" ← uses knowledge from Session 1
 */

import Database from 'better-sqlite3';
import { createLogger } from '../utils/logger.js';
import { join } from 'path';
import { homedir } from 'os';

const log = createLogger('session-manager');

export interface Session {
  sessionId: string,
  userId?: string,
  createdAt: number,
  updatedAt: number,
  question: string,
  metadata?: Record<string, any>,
  findingCount: number,
  sourceCount: number,
  lastQueryResult?: string
}

export class SessionManager {
  private db: Database.Database;

  constructor() {
    const dbPath = join(homedir(), '.deep-research', 'sessions.db');
    this.db = new Database(dbPath);
    this.initSchema();
  }

  private initSchema(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS sessions (
        sessionId TEXT PRIMARY KEY,
        userId TEXT,
        question TEXT NOT NULL,
        metadata TEXT,
        findingCount INTEGER DEFAULT 0,
        sourceCount INTEGER DEFAULT 0,
        lastQueryResult TEXT,
        createdAt INTEGER DEFAULT 0,
        updatedAt INTEGER DEFAULT 0
      );

      CREATE INDEX IF NOT EXISTS idx_userId ON sessions(userId);
      CREATE INDEX IF NOT EXISTS idx_createdAt ON sessions(createdAt DESC);

      CREATE TABLE IF NOT EXISTS session_knowledge (
        id TEXT PRIMARY KEY,
        sessionId TEXT NOT NULL,
        fact TEXT NOT NULL,
        sources TEXT,
        confidence REAL DEFAULT 0.5,
        timestamp INTEGER DEFAULT 0,

        FOREIGN KEY (sessionId) REFERENCES sessions(sessionId),
        CREATED_AT DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_sessionId ON session_knowledge(sessionId);
    `);
  }

  createSession(question: string, userId?: string, metadata?: Record<string, any>): string {
    try {
      const sessionId = `sess_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
      const now = Date.now();

      const stmt = this.db.prepare(`
        INSERT INTO sessions
        (sessionId, userId, question, metadata, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, ?, ?)
      `);

      stmt.run(
        sessionId,
        userId || null,
        question,
        metadata ? JSON.stringify(metadata) : null,
        now,
        now
      );

      log.info(`Created session ${sessionId} for question: ${question.slice(0, 50)}...`);
      return sessionId;
    } catch (err) {
      log.error('createSession failed:', err);
      throw err;
    }
  }

  loadSession(sessionId: string): Session | null {
    try {
      const row = this.db.prepare(`
        SELECT * FROM sessions WHERE sessionId = ?
      `).get(sessionId) as any;

      if (!row) return null;

      return {
        sessionId: row.sessionId,
        userId: row.userId,
        question: row.question,
        metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
        findingCount: row.findingCount,
        sourceCount: row.sourceCount,
        lastQueryResult: row.lastQueryResult,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt
      };
    } catch (err) {
      log.error('loadSession failed:', err);
      return null;
    }
  }

  appendFinding(sessionId: string, fact: string, sources: string[], confidence: number = 0.5): void {
    try {
      const id = `skb_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

      const stmt = this.db.prepare(`
        INSERT INTO session_knowledge
        (id, sessionId, fact, sources, confidence, timestamp)
        VALUES (?, ?, ?, ?, ?, ?)
      `);

      stmt.run(
        id,
        sessionId,
        fact,
        JSON.stringify(sources),
        confidence,
        Date.now()
      );

      // Update session metadata
      this.db.prepare(`
        UPDATE sessions
        SET findingCount = (SELECT COUNT(*) FROM session_knowledge WHERE sessionId = ?),
            sourceCount = (SELECT COUNT(DISTINCT sources) FROM session_knowledge WHERE sessionId = ?),
            updatedAt = ?
        WHERE sessionId = ?
      `).run(sessionId, sessionId, Date.now(), sessionId);

      log.debug(`Appended finding to session ${sessionId}`);
    } catch (err) {
      log.error('appendFinding failed:', err);
    }
  }

  async querySession(
    sessionId: string,
    followUpQuestion: string
  ): Promise<{answer: string, sources: string[], confidence: number}> {
    try {
      const session = this.loadSession(sessionId);
      if (!session) {
        throw new Error(`Session ${sessionId} not found`);
      }

      // Search knowledge base within this session's context
      const rows = this.db.prepare(`
        SELECT fact, sources FROM session_knowledge
        WHERE sessionId = ?
        LIMIT 20
      `).all(sessionId) as any[];

      const context = rows
        .map(r => `- ${r.fact} (sources: ${JSON.parse(r.sources).join(', ')})`)
        .join('\n');

      const answer = `Based on previous research ("${session.question}"), here's what we know:\n\n${context}\n\nTo answer "${followUpQuestion}", you may need additional research beyond this session's knowledge base.`;

      const sources = rows.flatMap(r => JSON.parse(r.sources));
      const confidence = rows.length > 0 ? 0.7 : 0;

      // Store query result
      this.db.prepare(`
        UPDATE sessions
        SET lastQueryResult = ?, updatedAt = ?
        WHERE sessionId = ?
      `).run(answer, Date.now(), sessionId);

      const uniqueSources = Array.from(new Set(sources));
      return {answer, sources: uniqueSources, confidence};
    } catch (err) {
      log.error('querySession failed:', err);
      return {answer: 'Session query failed', sources: [], confidence: 0};
    }
  }

  exportSession(sessionId: string, format: 'json' | 'markdown' = 'markdown'): string {
    try {
      const session = this.loadSession(sessionId);
      if (!session) throw new Error(`Session ${sessionId} not found`);

      const rows = this.db.prepare(`
        SELECT fact, sources FROM session_knowledge WHERE sessionId = ?
      `).all(sessionId) as any[];

      if (format === 'json') {
        return JSON.stringify({
          session,
          findings: rows.map(r => ({
            fact: r.fact,
            sources: JSON.parse(r.sources)
          }))
        }, null, 2);
      }

      // Markdown
      let md = `# Research Session: ${session.question}\n\n`;
      md += `**Created:** ${new Date(session.createdAt).toISOString()}\n`;
      md += `**Findings:** ${session.findingCount} facts from ${session.sourceCount} sources\n\n`;
      md += `## Knowledge Base\n\n`;

      rows.forEach((r, i) => {
        md += `${i + 1}. ${r.fact}\n`;
        md += `   Sources: ${JSON.parse(r.sources).join(', ')}\n\n`;
      });

      return md;
    } catch (err) {
      log.error('exportSession failed:', err);
      return '';
    }
  }

  listSessions(userId?: string, limit: number = 20): Session[] {
    try {
      const query = userId
        ? `SELECT * FROM sessions WHERE userId = ? ORDER BY createdAt DESC LIMIT ?`
        : `SELECT * FROM sessions ORDER BY createdAt DESC LIMIT ?`;

      const params = userId ? [userId, limit] : [limit];
      const rows = this.db.prepare(query).all(...params) as any[];

      return rows.map(r => ({
        sessionId: r.sessionId,
        userId: r.userId,
        question: r.question,
        metadata: r.metadata ? JSON.parse(r.metadata) : undefined,
        findingCount: r.findingCount,
        sourceCount: r.sourceCount,
        lastQueryResult: r.lastQueryResult,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt
      }));
    } catch (err) {
      log.error('listSessions failed:', err);
      return [];
    }
  }

  close(): void {
    this.db.close();
  }
}

export const sessionManager = new SessionManager();
