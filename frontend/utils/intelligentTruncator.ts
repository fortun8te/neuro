/**
 * Entity-preserving truncation with importance scoring
 */

interface TextEntity {
  type: 'named_entity' | 'number' | 'date' | 'quote' | 'code_block' | 'table' | 'list_item';
  text: string;
  importance: number; // 0-1
  startPos: number;
  endPos: number;
}

export class IntelligentTruncator {
  private readonly namedEntityPattern = /\b[A-Z][a-z]+ (?:[A-Z][a-z]+)*\b/g;
  private readonly numberPattern = /\b\d+\.?\d*%?|\d+%/g;
  private readonly datePattern = /\b\d{1,2}[-/]\d{1,2}[-/]\d{2,4}\b/g;
  private readonly quotePattern = /"([^"]*)"/g;
  private readonly codePattern = /```[\s\S]*?```/g;
  private readonly tablePattern = /\|[\s\S]*?\|/g;
  private readonly listPattern = /^[\s]*[-*+]\s+.+$/gm;

  /**
   * Extract all entities from text
   */
  extractEntities(text: string): TextEntity[] {
    const entities: TextEntity[] = [];

    // Named entities (higher importance if all-caps or proper nouns)
    let match;
    this.namedEntityPattern.lastIndex = 0;
    while ((match = this.namedEntityPattern.exec(text)) !== null) {
      entities.push({
        type: 'named_entity',
        text: match[0],
        importance: this.isAllCaps(match[0]) ? 0.95 : 0.8,
        startPos: match.index,
        endPos: match.index + match[0].length,
      });
    }

    // Numbers and percentages
    this.numberPattern.lastIndex = 0;
    while ((match = this.numberPattern.exec(text)) !== null) {
      entities.push({
        type: 'number',
        text: match[0],
        importance: match[0].includes('%') ? 0.9 : 0.75,
        startPos: match.index,
        endPos: match.index + match[0].length,
      });
    }

    // Dates
    this.datePattern.lastIndex = 0;
    while ((match = this.datePattern.exec(text)) !== null) {
      entities.push({
        type: 'date',
        text: match[0],
        importance: 0.85,
        startPos: match.index,
        endPos: match.index + match[0].length,
      });
    }

    // Quotes (highest importance)
    this.quotePattern.lastIndex = 0;
    while ((match = this.quotePattern.exec(text)) !== null) {
      entities.push({
        type: 'quote',
        text: match[0],
        importance: 0.95,
        startPos: match.index,
        endPos: match.index + match[0].length,
      });
    }

    // Code blocks
    this.codePattern.lastIndex = 0;
    while ((match = this.codePattern.exec(text)) !== null) {
      entities.push({
        type: 'code_block',
        text: match[0],
        importance: 0.9,
        startPos: match.index,
        endPos: match.index + match[0].length,
      });
    }

    // Tables
    this.tablePattern.lastIndex = 0;
    while ((match = this.tablePattern.exec(text)) !== null) {
      entities.push({
        type: 'table',
        text: match[0],
        importance: 0.85,
        startPos: match.index,
        endPos: match.index + match[0].length,
      });
    }

    // Lists
    this.listPattern.lastIndex = 0;
    while ((match = this.listPattern.exec(text)) !== null) {
      entities.push({
        type: 'list_item',
        text: match[0],
        importance: 0.75,
        startPos: match.index,
        endPos: match.index + match[0].length,
      });
    }

    return entities;
  }

  /**
   * Truncate text while preserving important entities
   */
  truncate(text: string, maxChars: number = 20000): string {
    if (text.length <= maxChars) {
      return text;
    }

    // Phase 1: Extract entities
    const entities = this.extractEntities(text);

    // Phase 2: Split into head, middle, tail
    const headSize = Math.floor(maxChars * 0.35);  // 35% head
    const tailSize = Math.floor(maxChars * 0.35);  // 35% tail
    const metaSize = maxChars - headSize - tailSize;  // 30% for metadata

    const head = text.slice(0, headSize);
    const tail = text.slice(-tailSize);
    const middleStart = headSize;
    const middleEnd = text.length - tailSize;

    // Phase 3: Find important entities lost in truncation
    const lostEntities = entities.filter(e =>
      e.startPos >= middleStart && e.endPos <= middleEnd
    );

    // Phase 4: Sort by importance, take top N
    const preserved = lostEntities
      .sort((a, b) => b.importance - a.importance)
      .slice(0, Math.floor(metaSize / 30)); // ~30 chars per entity

    // Phase 5: Build output
    let output = head;

    if (preserved.length > 0) {
      output += '\n\n[PRESERVED ENTITIES FROM MIDDLE SECTION]\n';
      preserved.forEach((e, idx) => {
        output += `${idx + 1}. ${e.type}: ${e.text.slice(0, 60)}${e.text.length > 60 ? '...' : ''}\n`;
      });
      output += '\n';
    }

    const elidedChars = middleEnd - middleStart;
    output += `[... ${elidedChars.toLocaleString()} characters omitted (${(elidedChars / text.length * 100) | 0}% of original) ...]\n\n`;
    output += tail;

    return output;
  }

  private isAllCaps(text: string): boolean {
    const upper = text.replace(/[^A-Z]/g, '');
    return upper.length >= 3 && upper.length >= text.length * 0.7;
  }
}

export const intelligentTruncator = new IntelligentTruncator();
