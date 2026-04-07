# Sources Enhancement Guide

## Overview

This document describes the enhanced source management system for the Nomads application, featuring advanced citation, metadata display, and export capabilities.

## New Components & Utilities

### 1. **Enhanced SourcesList.tsx**
Complete rewrite of the sources display component with advanced features.

#### Features
- **Inline Citation Badges**: Superscript numbered citations in a circular badge format
- **Expandable Source Cards**: Click to expand and view full metadata
- **Organization Options**: Sort by domain, relevance, or date; group by domain
- **Citation Format Support**: APA, MLA, and Chicago styles
- **Export Capabilities**: JSON, CSV, BibTeX, and formatted bibliography
- **Metadata Display**: URLs, fetch dates, content types, relevance scores
- **Easy Copying**: One-click copy to clipboard for URLs and citations
- **Responsive Design**: Supports inline, sidebar, and modal variants

#### Usage

```tsx
import { SourcesList } from './components/SourcesList';
import type { Source } from './utils/sourceExtractor';

const sources: Source[] = [
  {
    url: 'https://example.com',
    title: 'Example Title',
    domain: 'example.com',
    snippet: 'First paragraph of content...',
    fetchedAt: Date.now(),
    relevanceScore: 95,
  },
];

export function MyComponent() {
  return (
    <SourcesList
      sources={sources}
      maxVisible={5}
      variant="modal"
      groupByDomain={true}
      sortBy="relevance"
      showCitations={true}
      showMetadata={true}
    />
  );
}
```

#### Props

```typescript
interface SourcesListProps {
  sources: Source[];                           // Array of sources to display
  maxVisible?: number;                         // Sources shown before "show more" (default: 3)
  variant?: 'inline' | 'sidebar' | 'modal';   // Display variant (default: 'inline')
  groupByDomain?: boolean;                     // Group by domain (default: false)
  compact?: boolean;                           // Compact display mode (default: false)
  showCitations?: boolean;                     // Show citation badges (default: true)
  showMetadata?: boolean;                      // Show full metadata (default: true)
  sortBy?: 'domain' | 'relevance' | 'date';   // Sort order (default: 'domain')
  inlineText?: string;                         // Text to inject citations into (future use)
}
```

### 2. **Enhanced SearchSources.tsx**
Improved search results component with better source parsing and citation support.

#### Features
- **Source Parsing**: Extracts URLs, titles, snippets from search results
- **Citation Badges**: Numbered badges for each source
- **Relevance Scoring**: Visual relevance indicators with percentage
- **Citation Format Selection**: Choose APA, MLA, or Chicago
- **Sortable Sources**: Sort by relevance, domain, or date
- **Export Menu**: Copy sources as JSON, CSV, or BibTeX
- **Expandable Details**: Click to view full URL, dates, and citations
- **Extracted Content**: Shows page content preview

#### Usage

```tsx
import { SearchSources } from './components/SearchSources';

export function SearchResultsContainer() {
  const resultText = `[web_search] Results for "collagen supplement"...
Sources:
1. Collagen Benefits - Scientific Review
   https://example.com/collagen
   Comprehensive guide to collagen supplements...`;

  return (
    <SearchSources
      resultText={resultText}
      onSourceSelect={(source) => {
        console.log('Selected source:', source);
      }}
    />
  );
}
```

#### Props

```typescript
interface SearchSourcesProps {
  resultText: string;                          // Raw search result text
  onSourceSelect?: (source: Source) => void;   // Callback when source is selected
}
```

### 3. **citationFormatter.ts**
Citation formatting utilities supporting multiple academic styles.

#### Available Formats

**APA (American Psychological Association)**
```
Example Domain (2024). Web Page Title. Retrieved from https://example.com
```

**MLA (Modern Language Association)**
```
"Web Page Title." Example Domain, 2024, https://example.com.
```

**Chicago (Chicago Manual of Style)**
```
"Web Page Title." Example Domain. Accessed April 04, 2026. https://example.com
```

#### Usage

```typescript
import { formatCitation, CitationFormat } from './utils/citationFormatter';

const source: Source = {
  url: 'https://example.com',
  title: 'Example Article',
  domain: 'example.com',
};

// Format in APA style
const apa = formatCitation(source, 'APA');
console.log(apa);
// Output: "example.com (2024). Example Article. Retrieved from https://example.com"

// Format in MLA style
const mla = formatCitation(source, 'MLA');
// Output: ""Example Article." example.com, 2024, https://example.com."

// Format in Chicago style
const chicago = formatCitation(source, 'Chicago');
// Output: ""Example Article." example.com. Accessed April 04, 2026. https://example.com"
```

#### API

```typescript
// Format single citation
formatCitation(source: Source, format: CitationFormat): string

// Format all sources as bibliography
generateBibliography(sources: Source[], format: CitationFormat): string

// Get format description
getFormatDescription(format: CitationFormat): string

// Type definitions
type CitationFormat = 'APA' | 'MLA' | 'Chicago'
```

### 4. **sourceExporter.ts**
Export sources in multiple formats for different use cases.

#### Supported Formats

**JSON** - Structured data with full metadata
```json
[
  {
    "url": "https://example.com",
    "title": "Example Title",
    "domain": "example.com",
    "snippet": "Content preview...",
    "relevanceScore": 95
  }
]
```

**CSV** - Spreadsheet-compatible format
```
URL,Title,Domain,Snippet
https://example.com,"Example Title",example.com,"Content preview..."
```

**BibTeX** - LaTeX bibliography format
```bibtex
@misc{example2024,
  title = {Example Title},
  author = {example.com},
  year = {2024},
  url = {https://example.com},
  urldate = {2024-04-04}
}
```

**Bibliography** - Human-readable citations (uses citationFormatter)

#### Usage

```typescript
import { exportSources, downloadSources, copyToClipboard } from './utils/sourceExporter';

const sources = [...];

// Copy JSON to clipboard
await copyToClipboard(sources, 'JSON');

// Download CSV file
downloadSources(sources, 'CSV');

// Get BibTeX string
const bibtex = exportSources(sources, 'BibTeX');
console.log(bibtex);

// Get formatted bibliography
const bibliography = exportSources(sources, 'Bibliography');
```

#### API

```typescript
// Export sources
exportSources(sources: Source[], format: ExportFormat): string

// Download file
downloadSources(sources: Source[], format: ExportFormat): void

// Copy to clipboard
copyToClipboard(sources: Source[], format: ExportFormat): Promise<void>

// Get format details
getFormatDescription(format: ExportFormat): string

// Type definitions
type ExportFormat = 'JSON' | 'CSV' | 'BibTeX' | 'Bibliography'
```

### 5. **inlineCitations.ts**
Utilities for managing inline citations within text content.

#### Features
- **Citation Extraction**: Find [N] patterns in text
- **Source Mapping**: Link citations to source URLs
- **HTML Generation**: Create interactive citation links
- **Reference Lists**: Generate numbered reference sections
- **Coverage Analysis**: Calculate citation coverage ratio

#### Usage

```typescript
import {
  extractCitationMarkers,
  mapCitationsToSources,
  generateInlineCitationHTML,
  generateCitationReferenceList,
} from './utils/inlineCitations';

const text = 'This is a finding [1] with multiple sources [2] cited.';
const sources = [
  { url: 'https://source1.com', domain: 'source1.com', title: 'Source 1' },
  { url: 'https://source2.com', domain: 'source2.com', title: 'Source 2' },
];

// Extract [N] markers
const citations = extractCitationMarkers(text);
// Result: [{ id: 'cite-...', index: 1, ... }, { id: 'cite-...', index: 2, ... }]

// Map to sources
const mapped = mapCitationsToSources(citations, sources);

// Generate HTML with links
const html = generateInlineCitationHTML(text, mapped, true);
// Result: 'This is a finding <a href="https://source1.com">[1]</a>...'

// Generate reference list
const refs = generateCitationReferenceList(mapped);
// Result: '[1] source1.com — Source 1\n[2] source2.com — Source 2'
```

## Data Structures

### Source Interface
```typescript
interface Source {
  url: string;                    // Full URL
  title?: string;                 // Page title
  domain: string;                 // Domain name
  snippet?: string;               // Content preview
  favicon?: string;               // Favicon URL
  fetchedAt?: number;             // Timestamp
  contentType?: string;           // MIME type
  relevanceScore?: number;        // 0-100 relevance
}
```

### SourceCitation Interface (from types/index.ts)
```typescript
interface SourceCitation {
  url: string;
  title: string;
  relevanceScore: number;         // 0-100
  citedInInsights: number[];      // Which insight blocks cite this
  fetchedAt: number;
  contentType: string;
}
```

## Styling & Themes

All components support dark mode through:
- Tailwind CSS dark mode classes
- Inline theme-aware styling via `isDarkMode` context
- Consistent color scheme across components

### Key Color Palette

- **Primary**: Indigo (99, 102, 241)
- **Success**: Green (34, 197, 94)
- **Text**: Slate 900/200 (light/dark)
- **Borders**: Slate 200/700 (light/dark)
- **Background**: Slate 50/900 (light/dark)

## Performance Considerations

1. **Memoization**: `useMemo` used for sorting/filtering to prevent unnecessary re-renders
2. **Animation**: Framer Motion with optimized entrance/exit animations
3. **Lazy Loading**: Expanded details only rendered when expanded
4. **Efficient Sorting**: In-place sorting with O(n log n) complexity
5. **Copy Operations**: Use native clipboard API for fast operations

## Integration Examples

### In Research Output
```tsx
import { SourcesList } from './components/SourcesList';
import { extractSourcesFromFindings } from './utils/sourceExtractor';

function ResearchOutputDisplay({ findings }) {
  const sources = extractSourcesFromFindings(findings);

  return (
    <div className="space-y-4">
      <h2>Research Findings</h2>
      <p>{findings.insights}</p>
      <SourcesList
        sources={sources}
        variant="modal"
        sortBy="relevance"
        groupByDomain={true}
      />
    </div>
  );
}
```

### In Search Results
```tsx
import { SearchSources } from './components/SearchSources';

function WayfayerResults({ searchOutput }) {
  return (
    <div className="space-y-4">
      <SearchSources
        resultText={searchOutput}
        onSourceSelect={(source) => {
          // Handle source selection
        }}
      />
    </div>
  );
}
```

### Export Flow
```tsx
function ExportButton({ sources }) {
  const handleExport = async () => {
    // Download as formatted bibliography
    downloadSources(sources, 'Bibliography');

    // Or copy BibTeX to clipboard
    await copyToClipboard(sources, 'BibTeX');
  };

  return <button onClick={handleExport}>Export</button>;
}
```

## Future Enhancements

1. **Cross-referencing**: Link citations to specific text passages
2. **Custom Formats**: User-defined citation templates
3. **Annotations**: Add notes to sources
4. **Collaboration**: Share source lists with team members
5. **Integration**: Connect to Zotero, Mendeley, etc.
6. **Analytics**: Track which sources are most cited
7. **Deduplication**: Automatic duplicate source detection
8. **Validation**: Check link validity and availability

## Migration from Old Components

The old `SourcesList` was simpler and is now replaced. If you're using the old version:

**Old:**
```tsx
<SourcesList sources={sources} groupByDomain={true} />
```

**New:**
```tsx
<SourcesList
  sources={sources}
  groupByDomain={true}
  showMetadata={true}
  sortBy="domain"
  showCitations={true}
/>
```

All props are backward compatible, with sensible defaults.

## Troubleshooting

### Sources not appearing
- Check if `sources` array is populated
- Verify `Source` objects have required fields (`url`, `domain`)
- Check console for TypeScript errors

### Citation format not updating
- Ensure `citationFormat` state is being updated in parent
- Check that citation format buttons are wired to `setCitationFormat`

### Export not working
- Browser might be blocking clipboard access
- Check HTTPS requirement for `navigator.clipboard`
- Fallback to download option

### Performance issues
- Reduce `maxVisible` prop for large source lists
- Use `sortBy="domain"` instead of recalculating
- Consider virtual scrolling for 1000+ sources

## Testing

```typescript
// Test citation formatting
import { formatCitation } from './utils/citationFormatter';

const source = {
  url: 'https://example.com',
  title: 'Test',
  domain: 'example.com',
};

expect(formatCitation(source, 'APA')).toContain('example.com');

// Test source extraction
import { extractUrlsFromText } from './utils/sourceExtractor';

const urls = extractUrlsFromText('Visit https://example.com for more');
expect(urls).toContain('https://example.com');
```

## Support

For issues or feature requests, refer to:
- Component prop documentation above
- Source code comments in utility files
- Usage examples in integration sections
