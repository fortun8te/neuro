/**
 * documentStore — Agent document types.
 */

export interface AgentDocument {
  id: string;
  title: string;
  content: string;      // full text (markdown-like)
  type: 'doc' | 'plan' | 'research';
  createdAt: number;    // Unix ms
}
