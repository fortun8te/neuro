# Sources Enhancement — Quick Start Guide

## 5-Minute Setup

### 1. Import and Use SourcesList

```tsx
import { SourcesList } from './components/SourcesList';
import type { Source } from './utils/sourceExtractor';

function MyComponent() {
  const sources: Source[] = [
    {
      url: 'https://example.com',
      title: 'Example Article',
      domain: 'example.com',
      snippet: 'Content preview...',
    },
  ];

  return <SourcesList sources={sources} variant="modal" />;
}
```

That's it! You get:
- ✅ Citation badges
- ✅ Expandable cards with metadata
- ✅ Sort/filter menu
- ✅ Export options
- ✅ Dark mode support

### 2. Format a Single Citation

```tsx
import { formatCitation } from './utils/citationFormatter';

const citation = formatCitation(source, 'APA');
console.log(citation);
// Output: "example.com (2024). Example Article. Retrieved from https://example.com"
```

Supports: `'APA'`, `'MLA'`, `'Chicago'`

### 3. Export Sources

```tsx
import { downloadSources, copyToClipboard } from './utils/sourceExporter';

// Download as file
downloadSources(sources, 'Bibliography');

// Copy to clipboard
await copyToClipboard(sources, 'JSON');
```

Supports: `'JSON'`, `'CSV'`, `'BibTeX'`, `'Bibliography'`

### 4. Use Inline Citations

```tsx
import { injectCitationsIntoText } from './utils/inlineCitations';

const text = 'Research shows [1] that collagen is effective [2].';
const { citations } = injectCitationsIntoText(text, sources);

// Now you have structured citation data
```

---

## Component Props Cheat Sheet

### SourcesList
```tsx
<SourcesList
  sources={sources}              // Required: Source[]
  maxVisible={3}                 // Optional: number (default: 3)
  variant="modal"                // Optional: 'inline'|'sidebar'|'modal'
  groupByDomain={true}           // Optional: boolean
  sortBy="relevance"             // Optional: 'domain'|'relevance'|'date'
  showCitations={true}           // Optional: boolean
  showMetadata={true}            // Optional: boolean
/>
```

### SearchSources
```tsx
<SearchSources
  resultText={webSearchResult}   // Required: string
  onSourceSelect={handleSelect}  // Optional: (source) => void
/>
```

---

## Common Patterns

### Pattern 1: Research Output Display
```tsx
import { SourcesList } from './components/SourcesList';
import { extractSourcesFromFindings } from './utils/sourceExtractor';

function ResearchResults({ findings }) {
  const sources = extractSourcesFromFindings(findings);

  return (
    <>
      <h2>Research Findings</h2>
      <p>{findings.insights}</p>
      <SourcesList
        sources={sources}
        sortBy="relevance"
        variant="modal"
      />
    </>
  );
}
```

### Pattern 2: Search Results
```tsx
function SearchResults({ searchOutput }) {
  return (
    <SearchSources
      resultText={searchOutput}
      onSourceSelect={(source) => {
        console.log('User selected:', source.title);
      }}
    />
  );
}
```

### Pattern 3: Export Button
```tsx
import { downloadSources } from './utils/sourceExporter';

function ExportButton({ sources }) {
  return (
    <button onClick={() => downloadSources(sources, 'Bibliography')}>
      Download as Bibliography
    </button>
  );
}
```

### Pattern 4: Citation List
```tsx
import { generateBibliography } from './utils/citationFormatter';

function Bibliography({ sources }) {
  const bibText = generateBibliography(sources, 'APA');

  return (
    <pre className="whitespace-pre-wrap">
      {bibText}
    </pre>
  );
}
```

---

## Features at a Glance

| Feature | Component | Utility | How to Use |
|---------|-----------|---------|-----------|
| **Citation Badges** | SourcesList, SearchSources | — | Use `showCitations={true}` |
| **Expandable Cards** | SourcesList, SearchSources | — | Default behavior |
| **Sort Sources** | SourcesList, SearchSources | — | Use `sortBy="relevance"` |
| **Group by Domain** | SourcesList | — | Use `groupByDomain={true}` |
| **APA Format** | — | citationFormatter | `formatCitation(source, 'APA')` |
| **MLA Format** | — | citationFormatter | `formatCitation(source, 'MLA')` |
| **Chicago Format** | — | citationFormatter | `formatCitation(source, 'Chicago')` |
| **Export JSON** | SourcesList, SearchSources | sourceExporter | Click menu or `copyToClipboard(sources, 'JSON')` |
| **Export CSV** | SourcesList, SearchSources | sourceExporter | Click menu or use `exportSources(sources, 'CSV')` |
| **Export BibTeX** | SourcesList, SearchSources | sourceExporter | Click menu or use `exportSources(sources, 'BibTeX')` |
| **Bibliography** | SourcesList | citationFormatter + sourceExporter | Click download or `generateBibliography(sources, 'APA')` |
| **Inline Citations** | — | inlineCitations | `injectCitationsIntoText(text, sources)` |

---

## Styling & Theme

All components automatically support dark mode via the `useTheme()` context.

```tsx
// No styling needed! Dark mode is automatic
<SourcesList sources={sources} />

// Works with:
// - Tailwind dark mode
// - CSS custom properties
// - isDarkMode context
```

---

## TypeScript Support

Full type definitions included:

```tsx
import type { Source } from './utils/sourceExtractor';
import type { CitationFormat } from './utils/citationFormatter';
import type { ExportFormat } from './utils/sourceExporter';

const source: Source = { url: '...', domain: '...', title: '...' };
const format: CitationFormat = 'APA';
const exportType: ExportFormat = 'JSON';
```

---

## Troubleshooting

### Sources not appearing?
- Check `sources` array is not empty
- Verify each source has `url` and `domain`

### Citation format not changing?
- Make sure `citationFormat` state is being updated
- Component listens to changes automatically

### Export not working?
- Check browser allows clipboard access (HTTPS required)
- Try refresh button if menu seems stuck

### Dark mode not working?
- Verify `ThemeContext` is provided at app root
- Check `isDarkMode` is being set correctly

---

## File Locations

```
/frontend/
  ├─ components/
  │  ├─ SourcesList.tsx           (Enhanced)
  │  └─ SearchSources.tsx         (Enhanced)
  ├─ utils/
  │  ├─ citationFormatter.ts       (NEW)
  │  ├─ sourceExporter.ts         (NEW)
  │  ├─ inlineCitations.ts        (NEW)
  │  └─ sourceExtractor.ts        (Existing)
  ├─ SOURCES_ENHANCEMENT_GUIDE.md  (Complete docs)
  ├─ SOURCES_EXAMPLES.tsx          (7 examples)
  └─ SOURCES_QUICK_START.md        (This file)
```

---

## Next Steps

1. **Try the examples**: Open `SOURCES_EXAMPLES.tsx` for working code
2. **Read the guide**: See `SOURCES_ENHANCEMENT_GUIDE.md` for full API
3. **Integrate**: Use patterns above in your components
4. **Customize**: Adjust props to fit your needs

---

## API Quick Reference

### citationFormatter
```tsx
formatCitation(source, format)          // Single citation
generateBibliography(sources, format)   // All citations
getFormatDescription(format)             // Format name
```

### sourceExporter
```tsx
exportSources(sources, format)           // Get string
downloadSources(sources, format)         // Save file
copyToClipboard(sources, format)         // Copy to clipboard
getFormatDescription(format)             // Format info
```

### inlineCitations
```tsx
extractCitationMarkers(text)             // Find [1] patterns
mapCitationsToSources(citations, sources) // Link to sources
generateInlineCitationHTML(text, citations) // Create HTML
generateCitationReferenceList(citations) // Reference list
getCitationCoverage(citations, sourceCount) // Coverage %
```

### sourceExtractor (existing)
```tsx
extractSourcesFromFindings(findings)     // From research
extractUrlsFromText(text)                // URLs from text
deduplicateSources(sources)              // Remove duplicates
sortSourcesByRelevance(sources)          // Sort by score
```

---

## Support

- Full docs: `SOURCES_ENHANCEMENT_GUIDE.md`
- Examples: `SOURCES_EXAMPLES.tsx`
- API: Type definitions in each utility file
- Issues: Check "Troubleshooting" in guide

Happy citing! 🎯
