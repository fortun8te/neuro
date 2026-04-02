# Canvas Components Usage Guide

## Quick Start

### Basic Usage
```typescript
import { CanvasPanel, type CanvasContent } from '@/components/Canvas';

function MyComponent() {
  const [content, setContent] = useState<CanvasContent>({
    title: 'My Document',
    content: '# Hello World',
    fileType: 'md',
  });

  return (
    <CanvasPanel
      content={content}
      onClose={() => console.log('Canvas closed')}
      onContentChange={(text) => console.log('Content changed:', text)}
      onSave={(text) => console.log('Content saved:', text)}
      isAIWriting={false}
    />
  );
}
```

---

## Component Reference

### CanvasPanel (Main Component)

**Props**:
```typescript
interface CanvasPanelProps {
  content: CanvasContent;                              // Required: Document to display
  onClose: () => void;                                // Required: Close handler
  onDownload?: (blob: Blob, filename: string) => void // Optional: Download handler
  onEditModeChange?: (isEditMode: boolean) => void   // Optional: Edit mode toggle
  onContentChange?: (content: string) => void        // Optional: Content change callback
  onSave?: (content: string) => void                 // Optional: Save callback
  isAIWriting?: boolean;                              // Optional: Lock textarea when AI writing
}
```

**Supported File Types**:
- `'md'` — Markdown (GFM)
- `'code'` — Code with syntax highlighting
- `'txt'` — Plain text
- `'html'` — HTML (rendered)
- `'pdf'` — PDF (stub, shows download message)
- `'docx'` — Word document (stub, shows download message)

**Example with All Props**:
```typescript
<CanvasPanel
  content={{
    title: 'analysis.md',
    content: '# Market Analysis\n\n...',
    fileType: 'md',
    isWriting: false,
    language: undefined,
  }}
  onClose={() => setShowCanvas(false)}
  onDownload={(blob, filename) => {
    saveAs(blob, filename);
  }}
  onEditModeChange={(editing) => {
    console.log('Edit mode:', editing);
  }}
  onContentChange={(text) => {
    // Parent updates state if needed
  }}
  onSave={(text) => {
    // Persist to backend
    api.saveDocument(text);
  }}
  isAIWriting={aiIsGenerating}
/>
```

---

### useCanvasState Hook

Custom hook for managing canvas edit state and version history.

**Returns**:
```typescript
{
  editContent: string;                           // Current edit content
  setEditContent: (content: string) => void;     // Update content
  isEditMode: boolean;                           // Currently in edit mode
  setIsEditMode: (editing: boolean) => void;     // Toggle edit mode
  versions: CanvasVersion[];                     // All saved versions
  undoStack: string[];                           // Undo history
  redoStack: string[];                           // Redo history
  hasUnsavedChanges: boolean;                    // Has pending edits
  isLoading: boolean;                            // Loading versions from DB
  // Methods
  handleSave: () => Promise<boolean>;            // Save current version
  handleUndo: () => void;                        // Undo last change
  handleRedo: () => void;                        // Redo last undone change
  revertToVersion: (v: CanvasVersion) => void;   // Revert to specific version
  clearVersions: () => Promise<void>;            // Clear all version history
}
```

**Example**:
```typescript
import { useCanvasState } from '@/components/Canvas';

function Editor() {
  const {
    editContent,
    setEditContent,
    isEditMode,
    setIsEditMode,
    versions,
    handleSave,
    handleUndo,
  } = useCanvasState(initialContent, 'doc-123', 'My Document');

  return (
    <div>
      <textarea
        value={editContent}
        onChange={(e) => setEditContent(e.target.value)}
      />
      <button onClick={handleSave}>Save</button>
      <button onClick={handleUndo}>Undo</button>
      <p>Versions: {versions.length}</p>
    </div>
  );
}
```

---

## Keyboard Shortcuts

| Key Combination | Action |
|---|---|
| **Cmd+S** / **Ctrl+S** | Save changes and exit edit mode |
| **Cmd+Z** / **Ctrl+Z** | Undo last change |
| **Cmd+Shift+Z** / **Ctrl+Shift+Z** | Redo |
| **Escape** | Close panel (view mode) or exit edit mode (edit mode) |
| **Cmd+E** / **Ctrl+E** | Enter edit mode |
| **Tab** | Insert indent (in edit mode) |

---

## Callbacks

### onContentChange
Called on every keystroke in edit mode.

```typescript
onContentChange={(content: string) => {
  // Use to update parent state in real-time
  setDraftContent(content);
}}
```

### onSave
Called when user clicks "Save Changes" button (or presses Cmd+S).

```typescript
onSave={(content: string) => {
  // Persist to backend
  api.saveDocument({
    id: 'doc-123',
    content,
    timestamp: Date.now(),
  });
}}
```

### onDownload
Called when user clicks "Download" button.

```typescript
onDownload={(blob: Blob, filename: string) => {
  // Use file-saver library
  saveAs(blob, filename);
}}
```

---

## Rendering Examples

### Markdown with Tables
```typescript
<CanvasPanel
  content={{
    title: 'Table.md',
    content: `# Data
| Name | Value |
|------|-------|
| A    | 100   |
| B    | 200   |
`,
    fileType: 'md',
  }}
  onClose={() => setShowCanvas(false)}
/>
```

### Code with Syntax Highlighting
```typescript
<CanvasPanel
  content={{
    title: 'example.tsx',
    content: `function App() {
  return <div>Hello World</div>;
}`,
    fileType: 'code',
    language: 'typescript', // Auto-highlights as TS
  }}
  onClose={() => setShowCanvas(false)}
/>
```

### Plain Text
```typescript
<CanvasPanel
  content={{
    title: 'notes.txt',
    content: 'Plain text content here...',
    fileType: 'txt',
  }}
  onClose={() => setShowCanvas(false)}
/>
```

---

## Styling & Customization

All styles are centralized in `src/styles/canvasStyles.ts`:

```typescript
import { CANVAS_COLORS, CANVAS_FONT_SIZE, CANVAS_SPACING, getColorScheme } from '@/styles/canvasStyles';

const colors = getColorScheme(isDarkMode);
// colors.text, colors.border, colors.bg, etc.
```

**Available Exports**:
- `CANVAS_COLORS.dark` — Dark mode palette
- `CANVAS_COLORS.light` — Light mode palette
- `CANVAS_FONT_SIZE` — Font scales (xs, sm, base, lg, xl, 2xl, 3xl)
- `CANVAS_SPACING` — Spacing scale (xs, sm, md, lg, xl, xxl)
- `CANVAS_RADIUS` — Border radii (sm, md, lg)
- `CANVAS_TRANSITIONS` — Animation durations (fast, normal, slow)
- `getCanvasWidth()` — Responsive canvas width (45% desktop, 70% mobile)
- `getColorScheme(isDarkMode)` — Get color palette for mode

---

## Accessibility Features

- ✅ **Semantic HTML**: Proper roles (`main`, `banner`, `complementary`, `status`)
- ✅ **ARIA Labels**: All interactive elements labeled
- ✅ **Keyboard Navigation**: Full keyboard support (no mouse needed)
- ✅ **Focus Management**: Auto-focus textarea on edit mode
- ✅ **Color Contrast**: WCAG 2.1 AA compliant (4.5:1 minimum)
- ✅ **Error States**: Disabled state for locked textareas

---

## Integration with AgentPanel

The refactored Canvas is already integrated into AgentPanel.tsx:

```typescript
import { CanvasPanel, type CanvasContent } from './Canvas';

// In AgentPanel render:
{canvasContent && (
  <CanvasPanel
    content={canvasContent}
    onClose={() => setCanvasContent(null)}
    onDownload={handleDownloadCanvas}
    onEditModeChange={handleCanvasEditMode}
    onContentChange={handleCanvasContentChange}
    onSave={handleCanvasSave}
    isAIWriting={isAIGenerating}
  />
)}
```

---

## Performance Tips

1. **Memoize Callbacks**: Wrap parent handlers in `useCallback` to prevent re-renders
   ```typescript
   const handleSave = useCallback((content) => {
     api.save(content);
   }, []);
   ```

2. **Lazy Load Versions**: Only show version sidebar when needed (toggled by user)

3. **Batch Updates**: Use `onSave` instead of `onContentChange` for backend persistence

4. **Debounce onContentChange**: If updating parent state on every keystroke:
   ```typescript
   const debouncedChange = useMemo(
     () => debounce((text) => setDraft(text), 300),
     []
   );
   ```

---

## Troubleshooting

### Textarea not focusing
Ensure `autoFocus={true}` is passed to `EditableTextarea` (default: true).

### Undo/Redo not working
Check that `undoStack.length > 1` before undo, `redoStack.length > 0` before redo.

### Versions not persisting
Ensure IndexedDB is available (not in private browsing mode). Check browser console for quota errors.

### Syntax highlighting not showing
Verify `language` prop is set to valid Highlight.js language (e.g., `'typescript'`, `'python'`).

---

## Migration from Old CanvasPanel

The refactored component is **100% backward compatible**. No breaking changes:

```typescript
// Old import (still works via redirect)
import { CanvasPanel } from './CanvasPanel';

// New import (preferred)
import { CanvasPanel } from './Canvas';
```

All existing props and behavior maintained. New props (`onContentChange`, `onSave`) are optional.

---

## Related Files

- `src/components/Canvas/CanvasPanel.tsx` — Main orchestrator (351 LOC)
- `src/components/Canvas/useCanvasState.ts` — State hook (164 LOC)
- `src/styles/canvasStyles.ts` — Centralized styles (103 LOC)
- `CANVAS_REFACTOR_SUMMARY.md` — Architecture overview

---

## Support

For issues or feature requests, see the main Canvas refactor documentation:
- Architecture: `CANVAS_REFACTOR_SUMMARY.md`
- Code: `src/components/Canvas/`
