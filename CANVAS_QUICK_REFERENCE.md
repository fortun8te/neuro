# Canvas Components — Quick Reference Guide

## Using Canvas Buttons

### Basic Button
```tsx
<button
  className="canvas-button"
  data-theme={isDarkMode ? 'dark' : 'light'}
  onClick={handleClick}
  title="Tooltip text"
  aria-label="Accessible description"
>
  <Icon size={12} />
  Button Text
</button>
```

### Active/Toggle Button
```tsx
<button
  className={`canvas-button ${isActive ? 'active' : ''}`}
  data-theme={theme}
  aria-pressed={isActive}
>
  ⏱ Versions ({count})
</button>
```

### Status Buttons
```tsx
{/* Success */}
<button className="canvas-button canvas-button-success" data-theme={theme}>
  ✓ Copied
</button>

{/* Error */}
<button className="canvas-button canvas-button-error" data-theme={theme}>
  Error
</button>

{/* Info */}
<button className="canvas-button canvas-button-info" data-theme={theme}>
  Save
</button>
```

### Disabled Button
```tsx
<button
  className="canvas-button"
  data-theme={theme}
  disabled={!canUndo}
  aria-label={canUndo ? 'Undo' : 'Cannot undo (no history)'}
>
  ↶ Undo
</button>
```

---

## CSS Classes Reference

### `.canvas-button`
- Base button styling
- Requires `data-theme="dark"` or `data-theme="light"`
- States: `:hover`, `:focus-visible`, `:active`, `:disabled`

### `.canvas-button-success`
- Green background/text
- Used for confirmations (e.g., "Copied!")

### `.canvas-button-error`
- Red background/text
- Used for warnings/errors

### `.canvas-button-info`
- Blue background/text
- Used for primary actions (e.g., "Save")

### `.active`
- Toggle button active state
- Darker background, different color
- Use with `aria-pressed` attribute

---

## Color Scheme Values

### Dark Mode
```ts
{
  text: '#ffffff',
  textSecondary: 'rgba(255,255,255,0.85)',
  textTertiary: 'rgba(255,255,255,0.65)',
  textQuaternary: 'rgba(255,255,255,0.55)',
  infoText: '#3b82f6',
  successText: '#22c55e',
  errorText: '#ef4444',
}
```

### Light Mode
```ts
{
  text: '#000000',
  textSecondary: 'rgba(0,0,0,0.85)',
  textTertiary: 'rgba(0,0,0,0.65)',
  textQuaternary: 'rgba(0,0,0,0.55)',
  infoText: '#1d4ed8',
  successText: '#15803d',
  errorText: '#dc2626',
}
```

---

## Responsive Breakpoints

### Mobile (< 640px)
- Canvas width: 70%
- Sidebar width: 150px
- Button font: 10px
- Button padding: 5px 7px

### Tablet (640px - 1024px)
- Canvas width: 45%
- Sidebar width: 180px
- Button font: 11px
- Button padding: 6px 8px

### Desktop (> 1024px)
- Canvas width: 45%
- Sidebar width: 200px
- Button font: 11px
- Button padding: 6px 8px

---

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| Cmd+E | Enter edit mode |
| Cmd+S | Save changes |
| Cmd+Z | Undo |
| Cmd+Shift+Z | Redo |
| Escape | Close canvas or exit edit |
| Tab | Next button |
| Shift+Tab | Previous button |
| Enter | Activate focused button |

---

## Accessibility Checklist

When creating new Canvas components:

- [ ] Use semantic HTML (button, not div)
- [ ] Add `aria-label` for screen readers
- [ ] Add `aria-pressed` for toggle buttons
- [ ] Add `aria-disabled` for disabled elements
- [ ] Use `:focus-visible` for focus management
- [ ] Test with Tab key navigation
- [ ] Verify 4.5:1 color contrast
- [ ] Add `aria-live="polite"` for dynamic updates
- [ ] Test with VoiceOver (macOS) or NVDA (Windows)

---

## Common Patterns

### Edit Mode Toggle
```tsx
const [isEditMode, setIsEditMode] = useState(false);

<button
  onClick={() => setIsEditMode(!isEditMode)}
  className="canvas-button"
  data-theme={theme}
  disabled={isAIWriting}
>
  <Edit2 size={12} />
  {isEditMode ? 'Done' : 'Edit'}
</button>
```

### Status Indication
```tsx
const [copiedRecently, setCopiedRecently] = useState(false);

<button
  onClick={() => {
    navigator.clipboard.writeText(content);
    setCopiedRecently(true);
    setTimeout(() => setCopiedRecently(false), 2000);
  }}
  className={`canvas-button ${copiedRecently ? 'canvas-button-success' : ''}`}
  data-theme={theme}
>
  <Copy size={12} />
  {copiedRecently ? 'Copied' : 'Copy'}
</button>
```

### Responsive Width
```tsx
const [sidebarWidth, setSidebarWidth] = useState(getSidebarWidth());

useEffect(() => {
  const handleResize = () => setSidebarWidth(getSidebarWidth());
  window.addEventListener('resize', handleResize);
  return () => window.removeEventListener('resize', handleResize);
}, []);

return (
  <motion.div style={{ width: sidebarWidth }}>
    {/* Sidebar content */}
  </motion.div>
);
```

---

## Focus Management Example

```tsx
const handleKeyDown = (e: React.KeyboardEvent) => {
  // Escape: Close or exit edit
  if (e.key === 'Escape') {
    e.preventDefault();
    if (isEditMode) {
      setIsEditMode(false);
    } else {
      onClose();
    }
  }

  // Tab in textarea: Indent, not blur
  if (e.key === 'Tab' && e.currentTarget === textareaRef.current) {
    e.preventDefault();
    // Insert tab character
  }
};
```

---

## File Structure

```
src/
  styles/
    canvasStyles.ts          ← Color scheme, spacing, functions
    canvasButtons.css        ← Button styling (unified)
  components/
    Canvas/
      CanvasPanel.tsx        ← Main panel component
      CanvasHeader.tsx       ← Header with buttons
      EditableTextarea.tsx   ← Edit mode textarea
      VersionHistorySidebar.tsx ← Version list
      MarkdownRenderer.tsx   ← Markdown rendering
      CodeRenderer.tsx       ← Code block rendering
      ContentRenderer.tsx    ← Content type router
      TextRenderer.tsx       ← Plain text rendering
      useCanvasState.ts      ← State management
      index.ts              ← Exports
```

---

## Debugging Tips

### Focus Outline Not Showing
- Check `data-theme` attribute is set
- Verify CSS is imported: `import '../../styles/canvasButtons.css'`
- Check browser DevTools: Styles tab → `.canvas-button:focus-visible`

### Button Hover Looks Janky
- Ensure button uses `className="canvas-button"`, not inline styles
- Check for competing CSS rules (specificity issue)
- DevTools → Rendering → Paint flashing (should be minimal)

### Contrast Issues
- Use DevTools → Accessibility → Contrast checker
- Check `data-theme` matches actual theme
- Verify colors from `canvasStyles.ts` are being used

### Responsive Sidebar Broken
- Import `getSidebarWidth` from canvasStyles
- Add resize listener with cleanup
- Check breakpoints: 640px, 1024px

### Screen Reader Not Announcing
- Verify `aria-label` is present and descriptive
- Check for `aria-live="polite"` on status regions
- Use semantic HTML (button, not div)
- Test with actual screen reader (VoiceOver, NVDA)

---

## Performance Optimization

### Avoid
```tsx
{/* ❌ Direct style manipulation */}
onMouseEnter={(e) => e.currentTarget.style.background = colors.hover}

{/* ❌ Creating new style objects each render */}
style={{ background: isDark ? 'color1' : 'color2', ... }}

{/* ❌ Unthrottled resize listeners */}
window.addEventListener('resize', handleResize);
```

### Do This Instead
```tsx
{/* ✓ Use CSS :hover pseudo-class */}
className="canvas-button"

{/* ✓ Use constants or component props */}
data-theme={isDarkMode ? 'dark' : 'light'}

{/* ✓ Debounce resize events */}
const handleResize = debounce(() => setSidebarWidth(getSidebarWidth()), 150);
```

---

## Browser DevTools Shortcuts

| Action | Shortcut |
|--------|----------|
| Open DevTools | F12 |
| Toggle Dark Mode | Cmd+Shift+D |
| Inspect Element | Cmd+Shift+C |
| Focus Console | Cmd+Option+J |
| Check Contrast | DevTools → Accessibility |
| Emulate Mobile | DevTools → Device |

---

## Resources

- **Full Audit**: See `CANVAS_AUDIT_REPORT.md`
- **Test Guide**: See `CANVAS_TEST_CHECKLIST.md`
- **Summary**: See `CANVAS_FIXES_SUMMARY.md`
- **Build Docs**: See `package.json` scripts
- **Component Code**: See `src/components/Canvas/`

---

**Last Updated**: April 2, 2026
**Version**: 1.0
**Status**: Production Ready ✓
