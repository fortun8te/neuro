# UI/UX Accessibility Audit - Implementation Guide
## Ad Agent Project (Nomads)
### Quick-Fix Priority List

---

## PHASE 1: CRITICAL ACCESSIBILITY FIXES (Weeks 1-2)

### Issue 1.1: Button Aria-Label Mass Fix
**Severity: CRITICAL | Impact: Screen reader users cannot use 96% of buttons**

#### Location: `/src/components/` (all .tsx files with `<button>` elements)
#### Affected Files (sample):
- `ActionSidebarCompact.tsx` - 50+ unlabeled buttons
- `Dashboard.tsx` - 20+ buttons
- `AgentPanel.tsx` - 15+ buttons
- Various modals and controls

#### Quick Fix Template:
```typescript
// BEFORE (inaccessible)
<button onClick={handleClick} style={{...}}>
  <IconComponent />
</button>

// AFTER (accessible)
<button 
  onClick={handleClick}
  aria-label="Clear all campaigns"
  title="Clear all campaigns"
  style={{...}}
>
  <IconComponent />
</button>
```

#### Audit Script to Find Unlabeled Buttons:
```bash
grep -n "<button" /Users/mk/Downloads/nomads/src/components/*.tsx | \
  grep -v "aria-label\|title=" | \
  head -50
```

#### Priority Sequence:
1. `ActionSidebarCompact.tsx` - Highest visibility
2. `Dashboard.tsx` - Core feature buttons
3. `ApprovalModal.tsx` - User action buttons
4. `CycleTimeline.tsx` - Navigation buttons
5. All remaining modals

### Issue 1.2: Keyboard Navigation (Tab Order)
**Severity: CRITICAL | Impact: Keyboard-only users cannot navigate**

#### Current State: Only 27 onKeyDown handlers for 370+ interactive elements

#### Fix Template:
```typescript
// Add tabIndex for focusable elements
<button
  tabIndex={0}
  aria-label="Start cycle"
  onKeyDown={(e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleClick();
    }
  }}
>
  Start
</button>

// For custom interactive divs
<div
  tabIndex={0}
  role="button"
  aria-label="Toggle sidebar"
  onKeyDown={(e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      toggleSidebar();
    }
  }}
>
  Menu
</div>
```

#### Implementation Order:
1. Audit all interactive elements: `grep -r "onClick=" /src/components/*.tsx`
2. Add `tabIndex={0}` to each
3. Add `onKeyDown` handler with Enter/Space detection
4. Test with Tab key navigation
5. Add focus visible indicators (see Issue 1.4)

### Issue 1.3: Muted Text Contrast Fix
**Severity: MEDIUM | Impact: Hard to read text for visually impaired users**

#### Problem:
- Muted text (#6B7280) on light bg (#F5F3EF): 4.36:1 (FAILS AA requirement of 4.5:1)
- 720 low-opacity text instances

#### Location: `/src/index.css` (lines 44-46)
```css
/* Current (FAILS) */
--text-muted: #6B7280;  /* 4.36:1 contrast - FAILS */

/* Fixed (PASSES AA) */
--text-muted: #5A5C66;  /* ~5.2:1 contrast - PASSES AA */
```

#### Also Fix: Opacity Text Variables
```css
/* Current: Variable and potentially inaccessible */
--glass-text-light: rgba(0, 0, 0, 0.5);      /* 4.7:1 on light bg */
--glass-text-medium: rgba(0, 0, 0, 0.7);     /* 7.5:1 */
--glass-text-dark: rgba(0, 0, 0, 0.85);      /* 13:1 */

/* These are ACCEPTABLE for light mode on #F5F3EF background */
/* BUT verify dark mode equivalents */
```

#### Testing Contrast:
```javascript
// Use WebAIM Contrast Checker for final values
// Current failing color:
// #6B7280 on #F5F3EF = 4.36:1 (FAIL)
// Suggested fix:
// #5A5C66 on #F5F3EF = 5.2:1 (PASS AA)
// #45474F on #F5F3EF = 7.8:1 (PASS AAA)
```

### Issue 1.4: Focus Indicators
**Severity: MEDIUM | Impact: Keyboard users cannot see focused element**

#### Add Global Focus Styles
Location: `/src/index.css` (add after line 200)

```css
/* ── WCAG AA Compliant Focus Indicators ── */
button:focus,
input:focus,
select:focus,
textarea:focus,
[tabindex]:focus,
a[tabindex]:focus {
  outline: 2px solid var(--accent-blue);
  outline-offset: 2px;
}

.dark button:focus,
.dark input:focus,
.dark select:focus,
.dark textarea:focus,
.dark [tabindex]:focus {
  outline: 2px solid #3b82f6;
  outline-offset: 2px;
}

/* Remove focus:outline-none where used incorrectly */
/* Search for "focus:outline-none" and evaluate each case */
```

#### Files to Update:
1. `MakeStudio.tsx` - Remove `focus:outline-none` on critical inputs
2. Review any component using `focus:outline-none`

---

## PHASE 2: FORM ACCESSIBILITY (Week 3)

### Issue 2.1: Form Label Association
**Severity: MEDIUM | Impact: Screen readers cannot associate labels with inputs**

#### Current Problem:
- 159 form elements found
- Many lack `<label htmlFor="id">` associations
- Placeholders are used instead of labels (insufficient)

#### Fix Template:
```typescript
// BEFORE (inaccessible)
<input type="text" placeholder="Campaign name" />

// AFTER (accessible)
<label htmlFor="campaign-name">Campaign name</label>
<input id="campaign-name" type="text" placeholder="Enter name..." />
```

#### Affected Files to Audit:
- `ControlPanel.tsx` - Research parameter inputs
- `CampaignSelector.tsx` - Campaign form
- `MakeStudio.tsx` - Creative input forms
- Any component with `<input>` or `<textarea>`

#### Script to Find Unlabeled Inputs:
```bash
grep -n "<input\|<textarea\|<select" /Users/mk/Downloads/nomads/src/components/*.tsx | \
  grep -v "placeholder=\|aria-label=\|type=\"hidden\""
```

### Issue 2.2: Error Message Associations
**Severity: MEDIUM | Impact: Users don't know what went wrong with form submission**

#### Add aria-describedby Pattern:
```typescript
<div>
  <label htmlFor="email">Email</label>
  <input
    id="email"
    type="email"
    aria-describedby={error ? "email-error" : undefined}
  />
  {error && (
    <p id="email-error" role="alert" className="text-red-600 text-sm">
      {error}
    </p>
  )}
</div>
```

---

## PHASE 3: RESPONSIVE DESIGN (Weeks 4-5)

### Issue 3.1: Mobile Viewport Testing (375px)
**Severity: MEDIUM | Impact: App broken on mobile devices**

#### Steps:
1. Open Chrome DevTools (F12)
2. Click device toggle (mobile icon)
3. Select "iPhone 12 mini" (375px)
4. Test all user flows:
   - Campaign creation
   - Research execution
   - Result viewing
   - Settings/modals

#### Known Problem Areas:
- Sidebar may not collapse
- Fixed pixel widths: 79 instances
- Touch targets < 44px

#### Files to Audit:
- `AppShell.tsx` - Sidebar layout
- `Dashboard.tsx` - Main content layout
- `ActionSidebarCompact.tsx` - Activity panel

### Issue 3.2: Replace Hardcoded Pixels
**Severity: MEDIUM | Impact: Non-responsive design**

#### Current Issues (79 instances):
```typescript
// BEFORE (not responsive)
<img style={{ width: 80, height: 50 }} />
<div style={{ padding: "10px 40px" }} />
<button style={{ width: 200 }} />

// AFTER (responsive)
<img className="w-20 h-12 md:w-32 md:h-24 lg:w-40 lg:h-32" />
<div className="px-2.5 md:px-10 lg:px-16" />
<button className="w-full md:w-48 lg:w-64" />
```

#### Key Files (79 hardcoded pixels):
1. `ActionSidebarCompact.tsx` - Multiple inline styles
2. `Dashboard.tsx` - Layout dimensions
3. `MakeStudio.tsx` - Form field widths
4. Canvas and rendering components

#### Tailwind Width Classes to Use:
```
w-auto, w-full, w-screen, w-min, w-max, w-fit
w-0, w-px, w-0.5, w-1, w-2, w-3, w-4, w-5, w-6, ...
w-14 (56px), w-16 (64px), w-20 (80px), w-32 (128px), w-48 (192px)
```

### Issue 3.3: Tablet Testing (768px)
**Severity: MEDIUM | Impact: App not optimized for tablets**

#### Steps:
1. Chrome DevTools → iPad (768px)
2. Test:
   - Two-column layouts
   - Touch interactions
   - Modal sizing
   - Form field sizes (min 44px tall)

---

## PHASE 4: SEMANTIC HTML (Week 6)

### Issue 4.1: Add ARIA Landmarks
**Severity: MEDIUM | Impact: Screen readers cannot navigate page structure**

#### Add to Root Components:

**AppShell.tsx:**
```typescript
<div className="flex h-screen">
  <nav aria-label="Sidebar">
    {/* Sidebar content */}
  </nav>
  <main className="flex-1">
    {/* Main content */}
  </main>
</div>
```

**Dashboard.tsx:**
```typescript
<header role="banner">
  <h1>Ad Agent</h1>
  <ServiceHealthDot aria-label="Service health" />
</header>
<main>
  {/* Main content */}
</main>
<footer>
  {/* Footer info */}
</footer>
```

### Issue 4.2: Semantic Elements Replacement
**Severity: LOW | Impact: Improved code semantics**

#### Pattern:
```typescript
// BEFORE (using div for everything)
<div className="card">
  <div className="heading">Results</div>
  <div>List of items</div>
</div>

// AFTER (semantic elements)
<section className="card">
  <h2>Results</h2>
  <ul>
    <li>Item 1</li>
  </ul>
</section>
```

#### Elements to Use:
- `<nav>` - Navigation
- `<header>` - Page header
- `<main>` - Main content
- `<article>` - Independent content
- `<section>` - Thematic grouping
- `<aside>` - Sidebar/supplementary
- `<footer>` - Footer
- `<h1>-<h6>` - Headings (maintain hierarchy)

---

## PHASE 5: INTERNATIONALIZATION (Future)

### Issue 5.1: Extract Hard-coded Strings (406 total)
**Severity: LOW | Impact: Cannot support multiple languages**

#### Only pursue if:
- Global expansion planned
- International user base required
- Budget/timeline allows

#### If Proceeding:
1. Add i18n library: `npm install react-intl`
2. Create translation files: `/locales/en.json`
3. Wrap strings: `<FormattedMessage id="button.start" />`
4. Support languages: en, es, fr, de, etc.

---

## TESTING TOOLS & VALIDATION

### Automated Tools:
```bash
# Install accessibility testing tools
npm install --save-dev axe-core pa11y

# Quick axe-core scan of built app
npm run build && npx axe https://localhost:5173
```

### Browser Extensions (Install & Test):
1. **axe DevTools** (Chrome/Firefox) - Automated scanning
2. **WAVE** (Chrome/Firefox) - Visual feedback
3. **Lighthouse** (Chrome DevTools) - Accessibility scoring
4. **Color Contrast Analyzer** (manual testing)

### Manual Testing Checklist:
```
Keyboard Navigation:
- [ ] Tab through all controls (forward)
- [ ] Shift+Tab through all controls (backward)
- [ ] Enter activates buttons
- [ ] Space toggles checkboxes
- [ ] Escape closes modals
- [ ] Arrow keys work in lists (if applicable)

Focus Indicators:
- [ ] Every interactive element has visible focus outline
- [ ] Focus outline is 2px minimum
- [ ] Focus outline has sufficient contrast
- [ ] Focus order is logical (left to right, top to bottom)

Screen Reader (VoiceOver on Mac):
- [ ] Open VoiceOver: Cmd+F5
- [ ] Navigate with VO+Arrow keys
- [ ] All buttons announce purpose
- [ ] Form labels announced
- [ ] Error messages announced
- [ ] Landmarks announced (nav, main, etc.)

Mobile (375px):
- [ ] All buttons tappable (44px minimum)
- [ ] No horizontal scroll
- [ ] Touch targets spaced properly
- [ ] Text readable without zoom
- [ ] Forms mobile-friendly
```

---

## BUILD & DEPLOYMENT CHECKLIST

### Before Merging:
- [ ] Fix TypeScript error (tokenCounter)
- [ ] Run `npm run build` successfully
- [ ] Zero accessibility warnings in console
- [ ] Lighthouse accessibility score > 90
- [ ] All 357 buttons have aria-label or title
- [ ] All form elements have labels
- [ ] Keyboard navigation tested
- [ ] Focus indicators visible

### Deployment:
- [ ] Conduct accessibility regression testing
- [ ] Document accessibility features in release notes
- [ ] Add accessibility statement to footer
- [ ] Set up accessibility testing in CI/CD pipeline

---

## QUICK REFERENCE: Common Fixes

### 1. Button Without Label
```typescript
// Add one of these:
<button aria-label="Close modal">X</button>
<button title="Close modal">X</button>
```

### 2. Interactive Div
```typescript
<div
  role="button"
  tabIndex={0}
  aria-label="Click to expand"
  onKeyDown={(e) => e.key === 'Enter' && expand()}
>
  Click me
</div>
```

### 3. Form Input
```typescript
<label htmlFor="email">Email</label>
<input id="email" type="email" />
```

### 4. Image Without Alt
```typescript
<img src="logo.png" alt="Company logo" />
```

### 5. Hidden Text (for screen readers)
```typescript
<span className="sr-only">Loading results</span>
```

---

## METRICS TO TRACK

**Before Audit:**
- Accessibility score: Unknown
- WCAG compliance: Level A (estimated)
- Keyboard navigation: ~7% (27/370 elements)
- Button labeling: ~4% (14/357 buttons)

**Target After Phase 1:**
- WCAG compliance: Level AA
- Keyboard navigation: 100%
- Button labeling: 100%
- Focus indicators: 100%

**Target After Phase 4:**
- WCAG compliance: Level AA
- Responsive design: Mobile/tablet/desktop
- Semantic HTML: 90%+
- All tests passing

---

**Guide Version:** 1.0
**Last Updated:** April 2, 2026
**Next Review:** After Phase 1 completion

