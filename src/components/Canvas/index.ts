/**
 * Canvas Component Module Exports
 */

export { CanvasPanel, type CanvasContent } from './CanvasPanel';
export { CanvasHeader } from './CanvasHeader';
export { ContentRenderer, type ContentRendererContent } from './ContentRenderer';
export { MarkdownRenderer } from './MarkdownRenderer';
export { CodeRenderer } from './CodeRenderer';
export { TextRenderer } from './TextRenderer';
export { EditableTextarea } from './EditableTextarea';
export { VersionHistorySidebar } from './VersionHistorySidebar';
export { useCanvasState, type CanvasVersion } from './useCanvasState';

// Data Visualization Components (Tier 1)
export { SemanticHighlight, type HighlightType } from './SemanticHighlight';
export { CalloutBox, type CalloutType } from './CalloutBox';
export { Badge, type BadgeType } from './Badge';
export { DataTable, type Column } from './DataTable';
export { ProgressBar, CircularProgress } from './ProgressIndicator';
