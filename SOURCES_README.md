# Enhanced Source Components

Professional, feature-rich source preview and footer components with visual polish, interactive ratings, syntax highlighting, and more.

## Quick Start

### SourceFooter (Message-level sources)
```typescript
import { SourceFooter } from '@/components/SourceFooter';

<SourceFooter 
  sources={extractSourcesFromMessage(content)}
  variant="inline"
  maxVisible={6}
/>
```

### SourceChip (In-text citations)
```typescript
import { SourceChip } from '@/components/SourcePreview';

<SourceChip 
  url="https://example.com"
  snippet="Research shows..."
  quality={5}
/>
```

## Features

- **Favicon Display** — Domain icons from DuckDuckGo CDN
- **Quality Ratings** — 1-5 star system (auto-estimated or manual)
- **Snippet Preview** — On-hover text excerpt with syntax highlighting
- **Thumbnails** — Google Slides-style 16:9 preview images
- **Expandable Lists** — "+N more" button for collapsing long lists
- **Theme Support** — Automatic dark/light mode detection
- **Animations** — Smooth fade-in, elevation, and hover effects
- **Interactive Ratings** — Click stars to rate sources
- **Deduplication** — Automatic removal of duplicate domains
- **Error Handling** — Graceful fallbacks for failed images/URLs

## Documentation

1. **SOURCES_COMPONENTS_GUIDE.md** — Complete API reference and integration guide
2. **SOURCES_IMPLEMENTATION_NOTES.md** — Technical architecture and decisions
3. **SOURCES_INTEGRATION_CHECKLIST.md** — Step-by-step integration steps
4. **SOURCES_BEFORE_AFTER.md** — Visual comparison of improvements
5. **SourceComponentsDemo.tsx** — Interactive demo component

## File Locations

### Components
- `/nomads/frontend/components/SourcePreview.tsx` — SourcePreview & SourceChip
- `/nomads/src/components/SourceFooter.tsx` — SourceFooter

### Documentation
- `/nomads/src/components/SOURCES_COMPONENTS_GUIDE.md` — User guide
- `/nomads/SOURCES_IMPLEMENTATION_NOTES.md` — Technical details
- `/nomads/SOURCES_INTEGRATION_CHECKLIST.md` — Integration steps
- `/nomads/SOURCES_BEFORE_AFTER.md` — Before/after comparison
- `/nomads/src/components/SourceComponentsDemo.tsx` — Demo component

## Integration

**Backward compatible:** Old API still works, new features are optional.

```typescript
// Minimal (backward compatible)
<SourceFooter sources={sources} />

// Enhanced (new features)
<SourceFooter
  sources={sources}
  variant="inline"
  maxVisible={6}
  showQuality={true}
/>
```

## Key Improvements Over Original

| Feature | Before | After |
|---------|--------|-------|
| Display | Domain + favicon | Domain + favicon + title + snippet |
| Hover | Color change | Animated tooltip with preview |
| Quality | None | 1-5 star ratings |
| Thumbnails | No | Google Slides-style preview |
| Syntax highlighting | No | Code block highlighting |
| Expandable list | No | "+N more" button |
| Interactive ratings | No | Click to rate |
| Animations | None | Smooth transitions |

## Example Usage

### In Message Display
```typescript
import { SourceFooter } from '@/components/SourceFooter';

function ChatMessage({ content, sources }) {
  return (
    <>
      <p>{content}</p>
      <SourceFooter 
        sources={sources}
        variant="stacked"
        maxVisible={5}
      />
    </>
  );
}
```

### In In-Text Citations
```typescript
import { SourceChip } from '@/components/SourcePreview';

function ArticleContent() {
  return (
    <p>
      Research shows{' '}
      <SourceChip
        url="https://example.com/study"
        title="Recent Market Study"
        snippet="New data indicates consumer preferences are shifting..."
        quality={5}
      />{' '}
      that sustainable products are growing in popularity.
    </p>
  );
}
```

## Quality Estimation

Automatic 1-5 star ratings based on domain:

```typescript
// 5 stars (highest trust)
.edu, .gov, .org, wikipedia, github, stackoverflow, medium, substack

// 3 stars (medium trust)
.com, .net, reddit, news sites, blogs

// 2 stars (default)
other domains
```

Users can override ratings by clicking stars in preview tooltip.

## Theme Support

Automatic dark/light mode detection via `useTheme()`:

```typescript
const { isDarkMode } = useTheme();
```

Manual override available:

```typescript
<SourceFooter sources={sources} isDarkMode={true} />
```

## Performance

- **Lazy rendering** — Tooltips only rendered on hover
- **Favicon caching** — DuckDuckGo CDN caching
- **Deduplication** — O(n) single-pass algorithm
- **No dependencies** — Uses existing libraries only

## Accessibility

- Semantic HTML (`<a>` tags for links)
- Focus states (basic, can be improved)
- ARIA labels (minimal, can be expanded)
- Keyboard support (coming soon)

See `SOURCES_IMPLEMENTATION_NOTES.md` for accessibility recommendations.

## Browser Support

- Modern browsers (Chrome, Firefox, Safari, Edge)
- IE 11+ (basic support, may need polyfills)
- Mobile browsers (touch hover state issues possible)

## Known Limitations

1. Full page preview — Shows "Loading..." but requires Wayfayer integration
2. Rating persistence — Stored in component state only (can integrate IndexedDB)
3. Favicon fallback — Hidden on error (can add placeholder icon)
4. Syntax highlighting — Backtick-only pattern (can add language detection)

## Future Enhancements

1. Wayfayer integration for real page screenshots
2. IndexedDB persistence for user ratings
3. Domain trust badges
4. Citation formatting (APA, Chicago)
5. Source categorization
6. Advanced syntax highlighting
7. Search/filter UI

## Testing

Run the demo component to see all features:

```typescript
import { SourceComponentsDemo } from '@/components/SourceComponentsDemo';

<SourceComponentsDemo />
```

Toggle light/dark mode, adjust variant and max visible settings, and interact with all features.

## Support

For questions or issues:
1. Check `SOURCES_COMPONENTS_GUIDE.md` for API reference
2. Review `SOURCES_IMPLEMENTATION_NOTES.md` for technical details
3. Run demo to see features in action
4. Check component JSDoc comments

## License

Part of the Nomads project.
