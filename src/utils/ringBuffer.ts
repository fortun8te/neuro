/**
 * Ring buffer for efficiently managing large, streaming text output.
 * Prevents O(n²) string concatenation overhead by using an array of strings
 * instead of repeatedly concatenating into a single string.
 *
 * Key benefit: Appending is O(1), toString() is O(n where n is total characters).
 * Without this: Each append creates a new string allocation (O(n²) for n appends).
 */
export class RingBuffer {
  buffer: string[] = [];
  totalChars = 0;
  maxChars: number;

  constructor(maxChars?: number) {
    this.maxChars = maxChars ?? 2_000_000;
  }

  /**
   * Append text to the buffer.
   * Automatically prunes from the beginning if size exceeds maxChars.
   */
  append(text: string): void {
    if (!text) return;

    this.buffer.push(text);
    this.totalChars += text.length;

    // Prune from front while over capacity
    while (this.totalChars > this.maxChars && this.buffer.length > 1) {
      const removed = this.buffer.shift();
      if (removed) {
        this.totalChars -= removed.length;
      }
    }

    // If single item still too large, truncate it
    if (this.totalChars > this.maxChars && this.buffer.length === 1) {
      const item = this.buffer[0];
      const excess = this.totalChars - this.maxChars;
      this.buffer[0] = item.slice(excess);
      this.totalChars = this.maxChars;
    }
  }

  /**
   * Get the full text content (performs single join operation).
   */
  toString(): string {
    return this.buffer.join('');
  }

  /**
   * Get current size in characters.
   */
  size(): number {
    return this.totalChars;
  }

  /**
   * Clear the buffer.
   */
  clear(): void {
    this.buffer = [];
    this.totalChars = 0;
  }

  /**
   * Check if buffer contains content.
   */
  isEmpty(): boolean {
    return this.buffer.length === 0;
  }
}
