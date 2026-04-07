# Source Components Feature Map & Visual Reference

## Component Hierarchy

```
SourcePreview (Tooltip wrapper)
├── SourceChip (Inline pill + trigger)
└── Tooltip Content
    ├── Domain header + Star rating
    ├── Thumbnail (16:9 preview)
    ├── Title
    ├── Snippet (with syntax highlighting)
    └── Footer (Open link + Loading indicator)

SourceFooter (Message-level)
├── Label ("SOURCES [N]")
├── Source badges (list)
│   ├── Favicon
│   ├── Domain
│   └── Quality star (if >= 4)
└── Expand button (if hidden sources exist)
```

## Feature Matrix

### SourceChip (In-text Citations)

```
FEATURE              | TYPE        | IMPLEMENTATION        | INTERACTIVE
─────────────────────┼─────────────┼──────────────────────┼─────────────
Favicon              | Visual      | DuckDuckGo CDN       | No
Domain text          | Text        | Extracted from URL   | No
Quality stars        | Visual      | Auto-estimated       | Yes (click)
Hover tooltip        | Interactive | Positioned absolutely| Yes
Snippet preview      | Text        | Clipped to 3 lines   | No
Syntax highlighting  | Visual      | Backtick parsing     | No
Thumbnail image      | Visual      | 16:9 aspect ratio    | No
Animation            | Motion      | Fade-in 0.15s        | No
Scale on hover       | Motion      | 1.04x transform      | Yes
Loading indicator    | Text        | "Loading preview..."  | No
```

### SourceFooter (Message Footer)

```
FEATURE              | TYPE        | IMPLEMENTATION        | INTERACTIVE
─────────────────────┼─────────────┼──────────────────────┼─────────────
Source count badge   | Text/Visual | Numeric badge        | No
Domain badges        | Visual      | Clickable links       | Yes (click)
Favicon per domain   | Visual      | DuckDuckGo CDN       | No
Quality stars        | Visual      | Auto-estimated       | No
Snippet tooltip      | Text        | Hover-triggered      | Yes
Deduplication        | Logic       | Map-based             | No
Expandable list      | Interactive | "+N more" button      | Yes (click)
Layout variants      | Style       | Inline/stacked       | No
Theme support        | Style       | Dark/light mode       | Automatic
Elevation on hover   | Motion      | translateY(-2px)     | Yes
```

---

## Visual Breakdown: SourceChip

### States

```
DEFAULT STATE:
┌──────────────────────┐
│ [icon] domain.com ★  │  ← Pill with favicon, domain, optional star
└──────────────────────┘

HOVER STATE:
┌──────────────────────────────────────────────┐
│ [icon] domain.com ★★★★★                      │
│ ┌──────────────────────────────────────────┐ │
│ │ ┌──────────────────────────────────────┐ │ │
│ │ │ [16:9 THUMBNAIL IMAGE]               │ │ │
│ │ └──────────────────────────────────────┘ │ │
│ │                                          │ │
│ │ Full page title                          │ │
│ │                                          │ │
│ │ Snippet text with `code highlighted`    │ │
│ │ in blue. Can span up to 3 lines and     │ │
│ │ will be clipped if longer.               │ │
│ │                                          │ │
│ │ → Open         Loading preview...         │ │
│ └──────────────────────────────────────────┘ │
└──────────────────────────────────────────────┘

EXTENDED HOVER (1.5s+):
Shows "Loading preview..." indicator
(requires Wayfayer integration for full implementation)
```

### Styling Details

```
PILL BADGE:
─────────────────────────────────────
Padding:     3px 10px
Border-radius: 14px
Border:      1px solid (theme-aware)
Gap between: 4px
Font size:   11px
Font weight: 500

HOVER EFFECT:
─────────────────────────────────────
Scale:       1 → 1.04
Background:  +8% opacity
Duration:    150ms ease
```

---

## Visual Breakdown: SourceFooter

### States

```
COMPACT STATE (< maxVisible sources):
┌────────────────────────────────────────────────────┐
│ SOURCES [3]                                        │
│ [icon] domain1 ★★★★★  [icon] domain2  [icon] d3  │
└────────────────────────────────────────────────────┘

EXPANDED STATE (6+ sources):
┌────────────────────────────────────────────────────┐
│ SOURCES [8]                                        │
│ [icon] domain1 ★★★★★  [icon] domain2  [icon] d3  │
│ [icon] domain4 ★★★   [icon] domain5  [icon] d6  │
│ [icon] domain7       [icon] domain8 ★★★★★       │
│ +9 more  ▼ (click to expand)                      │
└────────────────────────────────────────────────────┘

STACKED STATE:
┌────────────────────────────────────────────────────┐
│ SOURCES [8]                                        │
│                                                    │
│ [icon] domain1 ★★★★★                              │
│ [icon] domain2                                     │
│ [icon] domain3 ★★★★                               │
│ [icon] domain4                                     │
│ [icon] domain5 ★★★★★                              │
│ [icon] domain6                                     │
│ [icon] domain7                                     │
│ [icon] domain8 ★★★★★                              │
│ +10 more  ▼                                        │
└────────────────────────────────────────────────────┘

TOOLTIP ON BADGE HOVER:
┌──────────────────────────────┐
│ Domain snippet text would... │  ← Shows on hover
│ display here, limited to 2   │
│ lines with ellipsis.         │
└──────────────────────────────┘
```

### Styling Details

```
CONTAINER:
─────────────────────────────────────
Margin-top:  10px
Padding-top: 8px
Border-top:  1px solid (theme-aware)
Gap:         6px (inline) or 8px (stacked)
Flex-wrap:   wrap

LABEL:
─────────────────────────────────────
Font size:   10px
Font weight: 600
Letter-spacing: 0.4px
Text-transform: uppercase

COUNT BADGE:
─────────────────────────────────────
Font size:   9px
Padding:     2px 6px
Border-radius: 3px
Background:  theme-aware (low opacity)

DOMAIN BADGE:
─────────────────────────────────────
Padding:     4px 10px
Border-radius: 6px
Font size:   11px
Font weight: 500

HOVER EFFECT:
─────────────────────────────────────
Transform:   translateY(0) → translateY(-2px)
Background:  +30% opacity
Shadow:      0 4px 12px (theme-aware)
Duration:    150ms ease

EXPAND BUTTON:
─────────────────────────────────────
Padding:     4px 8px
Border-radius: 6px
Font size:   10px
Icon:        ChevronDown (rotates on expand)
Duration:    150ms ease
```

---

## Color Scheme Reference

### Dark Mode

```
TOOLTIP BACKGROUND:      #1e1e2e
TOOLTIP BORDER:          rgba(255, 255, 255, 0.12)
TEXT PRIMARY:            rgba(255, 255, 255, 0.9)
TEXT SECONDARY:          rgba(255, 255, 255, 0.5)
CODE BACKGROUND:         rgba(100, 200, 255, 0.1)
CODE TEXT:               #60a5fa
LINK COLOR:              #60a5fa
STAR COLOR:              #fbbf24
SHADOW:                  rgba(0, 0, 0, 0.5-0.6)
```

### Light Mode

```
TOOLTIP BACKGROUND:      #ffffff
TOOLTIP BORDER:          rgba(0, 0, 0, 0.12)
TEXT PRIMARY:            rgba(0, 0, 0, 0.85)
TEXT SECONDARY:          rgba(0, 0, 0, 0.45)
CODE BACKGROUND:         rgba(37, 99, 235, 0.08)
CODE TEXT:               #2563eb
LINK COLOR:              #2563eb
STAR COLOR:              #f59e0b
SHADOW:                  rgba(0, 0, 0, 0.12-0.15)
```

---

## Animation Timeline

### SourceChip Tooltip Appearance

```
TIME    EVENT                           EFFECT
────────────────────────────────────────────────────
0ms     User hovers over chip          Delayed 200ms
200ms   Timer fires                     Start fade-in animation
200ms   Tooltip renders                 opacity: 0 → 1
200ms   Transform applies               translateY(-4px) → 0
215ms   Animation complete              Full opacity, position set
1500ms  Extended hover                  "Loading preview..." appears
2000ms  User moves away                 Tooltip starts hide
2150ms  Hide animation                  Opacity 1 → 0
2150ms  Remove from DOM                 Complete cleanup
```

### SourceFooter Badge Hover

```
TIME    EVENT                           EFFECT
────────────────────────────────────────────────────
0ms     User hovers over badge         No delay
0ms     Hover effects activate          background +30% opacity
0ms     Transform applies               translateY(-2px)
0ms     Shadow applied                  0 4px 12px
150ms   Hover animation complete        Full effect visible
X ms    User moves away                 Reverse all effects
150ms   Leave animation complete        Back to normal state
```

---

## Feature Interaction Flowchart

### SourceChip Flow

```
User hovers over pill
       ↓
[200ms delay]
       ↓
Tooltip renders with fade-in animation (150ms)
       ↓
User can read title + snippet + see stars
       ↓
[Two paths:]
  Path A: User clicks star → Rating stored in state
  Path B: User continues hovering [1.5s+] → "Loading preview..."
       ↓
User moves away → Tooltip fades out and removes from DOM
```

### SourceFooter Flow

```
Sources extracted from message
       ↓
Deduplicated by domain
       ↓
Sorted (if quality enabled)
       ↓
Limited to maxVisible (default 6)
       ↓
Rendered with quality stars (if >= 4 stars)
       ↓
[If remaining sources > 0:]
  Show "+N more" button
  User clicks → isExpanded = true
  List expands to show all sources
  Button text changes to "- Collapse"
       ↓
User hovers over badge → Snippet tooltip appears
User clicks badge → Opens URL in new tab
```

---

## Props Flow

### SourceChip Props

```
url ─────→ getDomain() ──────→ Favicon URL
           ↓
           Used in <a href>
snippet ──→ highlightSnippet() → Colored code segments
quality ──→ Render stars (or let user click to set)
thumbnail → Display in 16:9 container
title ────→ Display as heading
children ──→ Render the pill (SourceChip)
```

### SourceFooter Props

```
sources ──────→ Deduplicate by domain
                ↓
                Map to SourceBadgeWithTooltip
isDarkMode ───→ Color scheme selector
variant ──────→ Flex-direction (row/column)
maxVisible ───→ Slice for expansion logic
showQuality ──→ Render stars or skip
```

---

## Responsive Behavior

### SourceChip

```
MOBILE (< 768px):
  - Tooltip positions may overflow
  - Viewport detection prevents above/below spillover
  - Touch hover state unreliable (recommend @media touch)

DESKTOP (>= 768px):
  - Full tooltip support
  - Hover states work as designed
  - Positioning calculated correctly
```

### SourceFooter

```
MOBILE (< 768px):
  variant="stacked" recommended
  - Badges stack vertically
  - Less horizontal crowding
  - Better for small screens

TABLET (768px - 1024px):
  variant="inline" with maxVisible=4
  - Inline works with wrapping
  - Expand button clearly visible

DESKTOP (>= 1024px):
  variant="inline" with maxVisible=6-8
  - Full inline display
  - Expand button shows remaining sources
```

---

## Accessibility Visual Indicators

### Focus State (Recommended Enhancement)

```
DEFAULT:
┌──────────────────────┐
│ [icon] domain.com ★  │
└──────────────────────┘

FOCUSED:
┌──────────────────────┐
│ [icon] domain.com ★  │  ← 2px solid #3b82f6 outline
└──────────────────────┘
     (blue focus ring)
```

### Keyboard Navigation (Recommended)

```
TAB ──→ Navigate to next source badge
SHIFT+TAB ──→ Navigate to previous source badge
ENTER ──→ Open URL / Activate focused element
SPACE ──→ Same as ENTER or open tooltip
ESCAPE ──→ Close tooltip if open
```

---

## Performance Metrics

```
OPERATION              | TIME       | NOTES
───────────────────────┼────────────┼─────────────────────────────
Favicon load           | 100-200ms  | Cached by browser CDN
Tooltip render         | <1ms       | Lazy rendered on hover
Domain extraction      | <1ms       | Simple string parsing
Deduplication (100)    | <5ms       | O(n) Map iteration
Snippet highlight      | <2ms       | Regex-based splitting
Quality estimation     | <1ms       | Domain pattern matching
Component mount        | <5ms       | Standard React overhead
```

---

## QA Checklist: Visual Elements

- [ ] Favicons display correctly
- [ ] Domain names are readable (not truncated)
- [ ] Star ratings are visible at appropriate zoom levels
- [ ] Hover states trigger smoothly (no lag)
- [ ] Tooltips appear in correct position (above/below)
- [ ] Animations are smooth (60fps)
- [ ] Colors are accessible (WCAG AA contrast)
- [ ] Dark/light mode colors are correct
- [ ] Expand/collapse button works smoothly
- [ ] Snippet text is properly clipped
- [ ] Code blocks are highlighted correctly
- [ ] Thumbnail images load and display
- [ ] No layout shift when expanding/collapsing
- [ ] No tooltip text overflow
- [ ] Mobile responsiveness works
- [ ] Touch states don't interfere with click handlers
