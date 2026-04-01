/**
 * useSourcesFromMessage — Extract and manage sources from agent messages
 *
 * Hook that:
 * - Extracts sources from message text
 * - Extracts sources from research findings
 * - Merges and deduplicates
 * - Provides sorted, formatted sources for UI display
 */

import { useMemo } from 'react';
import {
  extractSourcesFromMessage,
  extractSourcesFromFindings,
  mergeSources,
  sortSourcesByRelevance,
  deduplicateSources,
  type Source,
} from '../utils/sourceExtractor';

interface UseSourcesFromMessageOptions {
  /** Message text containing potential sources */
  messageText?: string;
  /** Research findings object (from agent output) */
  findings?: any;
  /** Whether to sort by relevance (default: true) */
  sortByRelevance?: boolean;
}

export function useSourcesFromMessage({
  messageText = '',
  findings,
  sortByRelevance = true,
}: UseSourcesFromMessageOptions): {
  sources: Source[];
  sourceCount: number;
  hasSources: boolean;
} {
  return useMemo(() => {
    const sourceLists: Source[][] = [];

    // Extract from message text
    if (messageText) {
      sourceLists.push(extractSourcesFromMessage(messageText));
    }

    // Extract from research findings
    if (findings) {
      sourceLists.push(extractSourcesFromFindings(findings));
    }

    // Merge and deduplicate
    const merged = mergeSources(...sourceLists);
    const deduped = deduplicateSources(merged);

    // Sort by relevance if requested
    const sorted = sortByRelevance ? sortSourcesByRelevance(deduped) : deduped;

    return {
      sources: sorted,
      sourceCount: sorted.length,
      hasSources: sorted.length > 0,
    };
  }, [messageText, findings, sortByRelevance]);
}

export default useSourcesFromMessage;
