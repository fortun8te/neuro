# Approval Modal Test Checklist

**Component:** ApprovalModal, ExecutionPlanModal, PermissionApprovalBanner
**Date:** April 2, 2026
**Tester:** [Name]
**Platform:** [MacOS/Windows/Linux]
**Browser:** [Chrome/Safari/Firefox]

---

## ApprovalModal Test Cases

### Basic Functionality
- [ ] Modal opens when approval request is triggered
- [ ] Stage name displays correctly (formatted)
- [ ] Token count displays and is formatted with commas
- [ ] Estimated cost displays with correct decimal places ($X.XX)
- [ ] Risk level badge displays with correct label (Low/Medium/High)
- [ ] Risk badge color matches risk level (blue/amber/red)
- [ ] Risk icon displays correctly (checkmark/info/warning)
- [ ] Model name displays when provided
- [ ] Modal is centered on screen
- [ ] Backdrop is semi-transparent and clickable

### Keyboard Navigation
- [ ] Tab key cycles through: Deny button → Checkbox → Approve button
- [ ] Shift+Tab cycles backwards through interactive elements
- [ ] Escape key closes modal (calls onDeny)
- [ ] Enter key activates focused button
- [ ] Checkbox toggleable with Space key
- [ ] All buttons have visible focus ring when tabbed
- [ ] Focus ring appears on checkbox when tabbed

### Approval Actions
- [ ] Clicking Deny button closes modal without approving
- [ ] Clicking Approve button closes modal and approves
- [ ] Always Approve checkbox toggles on/off
- [ ] Approve button text changes to "Always Approve" when checkbox checked
- [ ] Clicking "Always Approve" approves AND saves preference
- [ ] Preference is saved to localStorage (check DevTools)
- [ ] On subsequent modals for same stage, modal doesn't appear (uses saved pref)

### Accessibility (Screen Reader)
- [ ] Modal announced as "dialog" by screen reader
- [ ] Heading "Approve Operation?" is associated with modal
- [ ] Risk badge is announced with role="status"
- [ ] All buttons have descriptive aria-label
- [ ] Checkbox has aria-label: "Always approve this stage in future"
- [ ] Stage name is announced
- [ ] Token count and cost are announced with labels

### Visual Appearance
- [ ] Dark mode: Background is dark slate, text is light
- [ ] Light mode: Background is light, text is dark
- [ ] All text is readable in both modes (high contrast)
- [ ] Risk badge colors are distinct and clear
- [ ] Button hover states are visible
- [ ] Button active states are visible
- [ ] Modal has smooth shadow
- [ ] Border color matches theme

### Animation & Performance
- [ ] Modal scales in smoothly (spring animation)
- [ ] Backdrop fades in smoothly
- [ ] Modal exits smoothly (spring animation)
- [ ] No animation jank on mobile devices
- [ ] No animation lag when resizing window
- [ ] Hover animations are responsive

### Responsive Design
- [ ] Desktop (1280px): Modal is centered, readable
- [ ] Tablet (768px): Modal is centered, readable
- [ ] Mobile (375px): Modal fits within viewport with padding
- [ ] Mobile (375px): Buttons are not cut off
- [ ] Mobile (375px): Text is not too small to read
- [ ] Mobile (375px): No horizontal scrolling
- [ ] Modal height doesn't exceed viewport on mobile

---

## ExecutionPlanModal Test Cases

### Basic Functionality
- [ ] Modal opens when plan is provided
- [ ] Title "Execution Plan" displays
- [ ] Plan summary displays: "{N} tool(s) will be executed in sequence"
- [ ] Plan tree displays all items with proper nesting (indentation)
- [ ] Read/Write/Delete badges display with correct counts
- [ ] Type badges show correct colors (blue/amber/red)
- [ ] Estimated total duration displays when provided
- [ ] Duration is formatted correctly (ms / s)
- [ ] Each plan item shows its duration (if provided)
- [ ] Plan tree is scrollable if it exceeds max-height
- [ ] Abort, Request Changes, and Approve buttons are visible

### Keyboard Navigation
- [ ] Tab key cycles through all buttons in order: Abort → Request Changes → Approve
- [ ] Shift+Tab cycles backwards
- [ ] Escape key closes modal (calls onAbort)
- [ ] Enter key activates focused button
- [ ] All buttons have visible focus ring when tabbed
- [ ] Focus ring is visible with good contrast

### Request Changes Flow
- [ ] Clicking "Request Changes" button shows textarea
- [ ] Textarea placeholder text is helpful
- [ ] Tab into textarea works correctly
- [ ] Text can be typed into textarea
- [ ] Submit Changes button is disabled when textarea is empty
- [ ] Submit Changes button is enabled when text is present
- [ ] Clicking "Submit Changes" calls onRequestChanges with text
- [ ] Modal closes after submitting changes
- [ ] Clicking "Cancel" hides textarea without submitting
- [ ] Focus returns to "Request Changes" button when canceling

### Approval Actions
- [ ] Clicking "Approve Plan" closes modal and approves
- [ ] Clicking "Abort" closes modal without approving
- [ ] Escape key calls onAbort

### Accessibility (Screen Reader)
- [ ] Modal announced as "dialog" by screen reader
- [ ] Heading "Execution Plan" is associated with modal
- [ ] Status text is announced with role="status"
- [ ] Type badges are announced (Read: X, Write: Y, Delete: Z)
- [ ] All buttons have descriptive aria-label
- [ ] Button labels describe what will happen

### Visual Appearance
- [ ] Dark mode: Background is dark, text is light
- [ ] Light mode: Background is light, text is dark
- [ ] All text is readable in both modes
- [ ] Type badge colors are distinct
- [ ] Plan tree indentation is clear
- [ ] Duration values are right-aligned and monospaced
- [ ] Textarea has visible focus state
- [ ] Button hover states are visible

### Plan Tree Display
- [ ] Plan items display with correct type badge (Read/Write/Delete/Other)
- [ ] Plan items display with name and description
- [ ] Nested items are indented correctly
- [ ] Icons/badges are aligned properly
- [ ] Durations are right-aligned
- [ ] Description text wraps if too long
- [ ] Plan tree scrolls when it exceeds max-height

### Animation & Performance
- [ ] Modal fades in smoothly
- [ ] No animation jank when scrolling plan tree
- [ ] Textarea appears smoothly
- [ ] No performance lag with large plan trees (50+ items)

### Responsive Design
- [ ] Desktop (1280px): Modal is max-w-2xl and centered
- [ ] Tablet (768px): Modal is centered, readable
- [ ] Mobile (375px): Modal fits within viewport with padding
- [ ] Mobile (375px): Plan tree is scrollable if too tall
- [ ] Mobile (375px): Buttons don't wrap awkwardly
- [ ] Mobile (375px): Textarea is usable

---

## PermissionApprovalBanner Test Cases

### Basic Functionality
- [ ] Banner appears inline above chat input
- [ ] Tool name is extracted and displayed in code block
- [ ] Tool verb is correct (Read/Write/Delete/Run/Search/Browse/Store)
- [ ] Tool description is accurate
- [ ] Tool arguments are displayed in code block (if present)
- [ ] Risk color matches risk level (blue/amber/red)
- [ ] Risk color shows as left border accent
- [ ] Banner has smooth backdrop blur effect

### Keyboard Navigation
- [ ] Tab key cycles through: Deny button → Allow once button
- [ ] Shift+Tab cycles backwards
- [ ] Escape key denies permission
- [ ] Cmd+Enter (Mac) / Ctrl+Enter (Windows) approves permission
- [ ] All buttons have visible focus ring when tabbed
- [ ] Focus ring contrast is sufficient

### Approval Actions
- [ ] Clicking "Deny" button denies permission
- [ ] Clicking "Allow once" button approves permission
- [ ] Escape key denies and closes banner
- [ ] Cmd+Enter / Ctrl+Enter approves and closes banner
- [ ] Banner animates out after action
- [ ] Chat input is accessible after banner closes

### Accessibility (Screen Reader)
- [ ] Keyboard shortcuts shown in kbd elements
- [ ] Deny button aria-label includes keyboard shortcut
- [ ] Allow once button aria-label includes keyboard shortcut
- [ ] Tool name is announced in code styling
- [ ] Tool description is announced
- [ ] Tool arguments are announced if present

### Visual Appearance
- [ ] Dark mode: Background is dark slate
- [ ] Light mode: Background is light
- [ ] All text is readable in both modes
- [ ] Risk color is visible as left border
- [ ] Code block is styled appropriately
- [ ] Button hover states are visible
- [ ] Button focus states are visible

### Banner Positioning
- [ ] Banner appears between messages and input on AgentPanel
- [ ] Banner does not overlap with chat input
- [ ] Banner does not block access to input field
- [ ] Chat input is still focusable when banner is visible
- [ ] User can click input to dismiss banner (if default behavior)

### Animation & Performance
- [ ] Banner slides in smoothly (spring animation)
- [ ] Banner scales in smoothly
- [ ] Banner exits smoothly
- [ ] No animation jank on mobile
- [ ] No performance lag with fast successive permissions

### Responsive Design
- [ ] Desktop (1280px): Banner is readable, buttons visible
- [ ] Tablet (768px): Banner is readable, buttons visible
- [ ] Mobile (375px): Banner fits within viewport
- [ ] Mobile (375px): Buttons don't wrap to multiple lines
- [ ] Mobile (375px): Code block is not cut off
- [ ] Mobile (375px): Tool args code block scrolls if too long

---

## Cross-Component Integration Tests

### Z-Index Hierarchy
- [ ] Banner (z-[100]) is above normal content but below modals
- [ ] ApprovalModal (z-50) appears above banner when open
- [ ] ExecutionPlanModal (z-[110]) appears above all others
- [ ] No overlapping glitches when multiple modals open

### State Management
- [ ] Opening ApprovalModal doesn't affect ExecutionPlanModal visibility
- [ ] Opening ExecutionPlanModal doesn't affect ApprovalModal visibility
- [ ] PermissionBanner is independent of both modals
- [ ] Dismissing one modal doesn't dismiss others

### Error Handling
- [ ] Modal handles missing stage name gracefully
- [ ] Modal handles zero tokens gracefully
- [ ] Modal handles large token counts (1M+) without breaking
- [ ] ExecutionPlanModal handles empty plan array
- [ ] PermissionBanner handles unparseable tool names

### Performance
- [ ] Opening/closing modals doesn't cause lag
- [ ] Opening multiple modals sequentially works smoothly
- [ ] No memory leaks when opening/closing modals repeatedly
- [ ] Large plan trees (100+ items) don't freeze UI

---

## Browser-Specific Tests

### Chrome
- [ ] All modals render correctly
- [ ] Animations are smooth
- [ ] Focus rings are visible
- [ ] Keyboard navigation works

### Safari
- [ ] All modals render correctly
- [ ] Backdrop blur works smoothly
- [ ] Animations are smooth
- [ ] Keyboard navigation works

### Firefox
- [ ] All modals render correctly
- [ ] Focus rings are visible and clear
- [ ] Keyboard navigation works
- [ ] Animations are smooth

---

## Platform-Specific Tests

### MacOS
- [ ] Cmd+Enter works for permission approval
- [ ] Escape key works for dismissal
- [ ] Touch trackpad gestures don't interfere
- [ ] Retina display renders crisp

### Windows
- [ ] Ctrl+Enter works for permission approval
- [ ] Escape key works for dismissal
- [ ] Touch input works on touchscreen devices
- [ ] DPI scaling displays correctly

### Linux
- [ ] All keyboard shortcuts work
- [ ] Display scaling is correct
- [ ] Dark mode detection works

---

## Dark Mode Tests

### ApprovalModal Dark Mode
- [ ] Background: from-slate-900 to-slate-950 visible
- [ ] Text: White text readable on dark background
- [ ] Borders: Slate-800 borders visible
- [ ] Risk badge dark color scheme applied
- [ ] Buttons: Hover states visible
- [ ] Focus ring: Blue outline visible

### ApprovalModal Light Mode
- [ ] Background: from-white to-slate-50 visible
- [ ] Text: Dark text readable on light background
- [ ] Borders: Slate-200 borders visible
- [ ] Risk badge light color scheme applied
- [ ] Buttons: Hover states visible
- [ ] Focus ring: Blue outline visible

---

## Notes / Issues Found

(Space for documenting any issues found during testing)

---

## Sign-Off

- Tested by: ________________
- Date: ________________
- All tests passed: [ ] Yes [ ] No
- Issues found: (if any)

