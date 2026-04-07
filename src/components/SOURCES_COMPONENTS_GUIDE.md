# Source Components Enhancement Guide

## Overview

The source components have been enhanced with professional, visually polished features inspired by Google Slides and modern search engines. These components provide rich, interactive source previews and footer displays.

## Components

### 1. SourcePreview & SourceChip

**File:** `frontend/components/SourcePreview.tsx`

#### Features

- **Favicon Display** — DuckDuckGo icon API with fallback handling
- **Domain Display** — Clean domain name extraction and WWW removal
- **Google Slides-style Thumbnails** — 16:9 aspect ratio preview images
- **Syntax Highlighting** — Backtick-wrapped code fragments highlighted in snippet
- **Star/Rating System** — 1-5 star quality ratings (interactive, persistent)
- **Full Page Preview** — Shows "Loading preview..." on extended hover (1.5s delay)
- **Hover Animations** — Smooth fade-in, scale, and elevation effects
- **Dark/Light Mode** — Automatic theme detection via ThemeContext

#### SourcePreview Props

```typescript
interface SourcePreviewProps {
  url: string;
  title?: string;
  snippet?: string;
  quality?: number; // 1-5 star rating
  thumbnail?: string; // base64 or URL for preview image
  children: React.ReactNode;
}
```

#### SourceChip Props

```typescript
interface SourceChipProps {
  url: string;
  title?: string;
  snippet?: string;
  quality?: number;
  thumbnail?: string;
}
```

#### Usage Example

```typescript
import { SourceChip } from '@/components/SourcePreview';

export function MessageContent() {
  return (
    <p>
      According to research{' '}
      <SourceChip
        url="https://example.com/article"
        title="Market Trends 2025"
        snippet="Recent studies show that consumer preferences are shifting towards sustainable products with emphasis on..."
        quality={5}
        thumbnail="data:image/jpeg;base64,..."
      />
      , the market is growing rapidly.
    </p>
  );
}
```

#### CSS Animation Classes

The component includes a `@keyframes fadeIn` animation (0.15s) for smooth tooltip appearance.

---

### 2. SourceFooter

**File:** `src/components/SourceFooter.tsx`

#### Features

- **Domain Badges** — Clickable source links with favicon
- **Quality Star Rating** — Auto-estimated for .edu, .gov, .org domains
- **Snippet Preview Tooltips** — On-hover snippet display (no extra styling)
- **Source Count Badge** — Total source count display
- **Expandable List** — Collapsible "+N more" button for many sources
- **Hover States** — Elevation, background color, and transform effects
- **Inline/Stacked Layout** — Responsive variant support
- **Deduplication** — Automatic domain-based deduplication

#### SourceFooter Props

```typescript
interface SourceFooterProps {
  sources: Source[];
  isDarkMode?: boolean;
  variant?: 'inline' | 'stacked';
  showQuality?: boolean;
  maxVisible?: number; // Default: 6
}
```

#### Source Type

```typescript
interface Source {
  url: string;
  title?: string;
  domain: string;
  snippet?: string;
  favicon?: string;
}
```

#### Quality Estimation

Automatic quality rating based on domain:
- **5 stars:** .edu, .gov, .org, Wikipedia, GitHub, Stack Overflow, Medium, Substack
- **3 stars:** .com, .net, Reddit, news sites, blogs
- **2 stars:** Other domains

#### Usage Example

```typescript
import { SourceFooter } from '@/components/SourceFooter';
import { extractSourcesFromMessage } from '@/utils/sourceExtractor';

export function ChatMessage({ content }) {
  const sources = extractSourcesFromMessage(content);

  return (
    <div>
      <p>{content}</p>
      <SourceFooter
        sources={sources}
        variant="inline"
        maxVisible={5}
        showQuality={true}
      />
    </div>
  );
}
```

---

## Syntax Highlighting

The snippet preview includes automatic syntax highlighting for code blocks:

```
Input: "Configure API with `apiKey` parameter to enable..."
Output: "Configure API with [apiKey highlighted in blue] parameter to enable..."
```

Highlighted segments use a subtle background color:
- **Dark mode:** `rgba(100,200,255,0.1)` background, `#60a5fa` text
- **Light mode:** `rgba(37,99,235,0.08)` background, `#2563eb` text

---

## Star Rating System

### Interactive Ratings (SourcePreview only)

Users can click stars to assign custom ratings (persists in component state):

```typescript
const [userRating, setUserRating] = useState<number | null>(null);
const effectiveRating = userRating || quality || 0;
```

### Auto-Estimated Ratings (SourceFooter)

Quality is estimated from domain type and only displays for ratings >= 4 stars:

```typescript
function estimateSourceQuality(domain: string): number {
  // Returns 5, 3, or 2 based on domain pattern
}
```

---

## Hover State Behaviors

### SourceChip Hover
- **Scale:** 1 → 1.04
- **Background:** +8% opacity increase
- **Duration:** 150ms ease

### SourceFooter Badge Hover
- **Transform:** translateY(0) → translateY(-2px)
- **Background:** +30% opacity increase
- **Shadow:** Subtle 4px 12px shadow added
- **Duration:** 150ms ease

### Tooltip Fade-In
- **Animation:** 0.15s ease-out from opacity 0 → 1
- **Transform:** translateY(-4px) → translateY(0)

---

## Dark/Light Mode

Both components detect theme automatically via `useTheme()` hook:

```typescript
const { isDarkMode } = useTheme();
```

Color palette:
- **Dark:** Grays 700–800, blue 400–500, amber 400
- **Light:** Grays 100–300, blue 600–700, amber 500

Manual override available via `isDarkMode` prop in SourceFooter.

---

## Integration with Research Pipeline

### From ResearchFindings

```typescript
import { extractSourcesFromFindings } from '@/utils/sourceExtractor';

const findings = { /* research data */ };
const sources = extractSourcesFromFindings(findings);

return <SourceFooter sources={sources} variant="stacked" />;
```

### From Agent Messages

```typescript
import { extractSourcesFromMessage } from '@/utils/sourceExtractor';

const agentReply = "Based on [1] https://example.com...";
const sources = extractSourcesFromMessage(agentReply);

return <SourceFooter sources={sources} />;
```

---

## Performance Considerations

1. **Favicon Caching** — DuckDuckGo CDN caches favicons; fallback to hidden state
2. **Lazy Tooltips** — Tooltips render only on hover (not pre-rendered)
3. **Image Optimization** — Thumbnail images should be optimized (use base64 or compressed JPEG)
4. **Snippet Truncation** — Snippets clamped to 120 characters and 3 lines max

---

## Known Limitations

1. **Full Page Preview** — "Loading preview..." indicator shown but real preview requires separate infrastructure (Wayfayer/Playwright integration)
2. **Favicon Fallback** — If favicon fails to load, icon is simply hidden (no placeholder icon)
3. **Thumbnail Source** — Must be provided externally (e.g., from Wayfayer visual scout)
4. **User Ratings** — Stored in component state only; not persisted to storage

---

## Future Enhancements

1. Integrate full page screenshots via Wayfayer visual scout API
2. Persist user quality ratings to IndexedDB
3. Add source filtering/search UI
4. Add "Copy citation" button (APA/Chicago format)
5. Add domain trust badge (security reputation from checks)
6. Support for rich media previews (video, charts, tables)
7. Source categorization (academic, news, blog, etc.)
