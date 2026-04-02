# Canvas Components — Manual Test Checklist

## Pre-Test Setup
- [ ] Start dev server: `npm run dev`
- [ ] Open DevTools (F12)
- [ ] Clear browser cache (Cmd+Shift+Delete)
- [ ] Test in both Chrome and Safari (macOS)
- [ ] Enable Dark mode and Light mode testing
- [ ] Have a screen reader available (VoiceOver on macOS)

---

## 1. KEYBOARD NAVIGATION TESTS

### 1.1 Keyboard Shortcuts

**Test: Cmd+S (Save)**
- [ ] Open Canvas panel
- [ ] Click Edit button
- [ ] Type some text
- [ ] Press Cmd+S
- [ ] Verify: Save button not clicked, text still in edit mode
- [ ] Click Save button manually first
- [ ] Now press Cmd+S (should work)

**Test: Cmd+Z (Undo)**
- [ ] In edit mode, type "hello"
- [ ] Type " world"
- [ ] Press Cmd+Z
- [ ] Verify: Text is now "hello"
- [ ] Press Cmd+Z again
- [ ] Verify: Text is now empty
- [ ] Press Cmd+Z again (no change, at top of undo stack)

**Test: Cmd+Shift+Z (Redo)**
- [ ] After undoing to "hello", press Cmd+Shift+Z
- [ ] Verify: Text is " world" (no, it's "hello world")
- [ ] Actually, verify text shows "hello world" after redo

**Test: Cmd+E (Edit Mode)**
- [ ] View mode (not editing)
- [ ] Press Cmd+E
- [ ] Verify: Textarea appears, focus moves to it
- [ ] Type something
- [ ] Press Cmd+E again (should do nothing in edit mode)

**Test: Escape (Close/Exit)**
- [ ] In edit mode
- [ ] Press Escape
- [ ] Verify: Exits edit mode, shows rendered view
- [ ] Press Escape again
- [ ] Verify: Canvas panel closes

### 1.2 Tab Navigation

**Test: Tab Through Buttons**
- [ ] Open Canvas, view mode
- [ ] Press Tab repeatedly
- [ ] Verify order: Edit → Copy → Download → Versions → Close
- [ ] Each button shows focus outline (2px colored outline)
- [ ] Tab into Edit mode buttons: Edit disappears, Undo/Redo appear
- [ ] Undo/Redo show as disabled (grayed) if no history

**Test: Shift+Tab (Reverse)**
- [ ] Press Tab several times (move forward)
- [ ] Press Shift+Tab once
- [ ] Verify: Focus moves back one button
- [ ] Continue Shift+Tab to cycle backward

**Test: Tab Into Textarea**
- [ ] Enter edit mode
- [ ] Press Tab (should be in textarea after exiting buttons)
- [ ] Type text to verify focus
- [ ] Type Shift+Tab to go back to header buttons

### 1.3 Enter Key

**Test: Enter Activates Button**
- [ ] Tab to Copy button (focus visible)
- [ ] Press Enter
- [ ] Verify: "Copied!" feedback appears
- [ ] Check clipboard: `Cmd+V` should paste content

**Test: Enter in Textarea**
- [ ] Tab into textarea
- [ ] Press Enter
- [ ] Verify: Newline inserted (not button activation)
- [ ] Height auto-expands

---

## 2. RESPONSIVE DESIGN TESTS

### 2.1 Mobile (375px width)

**Setup**: DevTools → Mobile → iPhone SE (375x667)

- [ ] Canvas takes ~70% width of viewport
- [ ] Version sidebar width: ~150px (visible without scroll)
- [ ] All buttons readable (no text overflow)
- [ ] Header text doesn't wrap (uses ellipsis)
- [ ] Footer status visible
- [ ] Textarea doesn't overflow right edge
- [ ] Scroll works smoothly (no jank)

**Test Font Sizes**:
- [ ] Button text: 10px (smaller than desktop)
- [ ] Header title: readable, ellipsis on overflow
- [ ] Body text in rendered view: readable

### 2.2 Tablet (768px width)

**Setup**: DevTools → Mobile → iPad (768x1024)

- [ ] Canvas takes 45% width
- [ ] Version sidebar: ~180px
- [ ] All buttons fit in header (no wrapping)
- [ ] Padding/spacing comfortable
- [ ] No weird gaps or overflow

### 2.3 Desktop (1440px width)

**Setup**: DevTools → Desktop (1440x900)

- [ ] Canvas takes 45% width (~650px)
- [ ] Version sidebar: 200px optimal width
- [ ] Lots of breathing room
- [ ] All content easily readable
- [ ] No horizontal scroll needed

### 2.4 Resize Handling

**Test: Dynamically Resize**
- [ ] Open Canvas panel at 1440px
- [ ] Resize down to 600px
- [ ] Verify: Sidebar width changes, no jank
- [ ] Resize back to 1440px
- [ ] Verify: Sidebar width back to 200px

---

## 3. BUTTON STATE TESTS

### 3.1 Normal State
- [ ] Edit button: light background, no outline
- [ ] Copy button: light background
- [ ] Download button: light background
- [ ] Close button: light background

### 3.2 Hover State
- [ ] Hover over Edit button
- [ ] Verify: Background slightly darker, smooth transition
- [ ] Hover over Copy button
- [ ] Verify: Same background change

### 3.3 Focus State
- [ ] Tab to Edit button
- [ ] Verify: 2px colored outline visible
- [ ] In dark mode: outline should be light (white-ish)
- [ ] In light mode: outline should be dark (black-ish)
- [ ] Outline should have 2px offset from button edge

### 3.4 Active State
- [ ] Click and hold on a button
- [ ] Verify: Button slightly scales down (0.98x) for tactile effect
- [ ] Release mouse
- [ ] Verify: Button returns to normal size

### 3.5 Disabled State
- [ ] Enter edit mode
- [ ] If nothing in undo stack: Undo button should be disabled
- [ ] Verify: Undo button is grayed out (opacity 0.5)
- [ ] Verify: Cursor changes to not-allowed on hover
- [ ] Click disabled button (nothing happens)
- [ ] Make a change and press Cmd+Z
- [ ] Verify: Undo button becomes enabled

### 3.6 Disabled + Focus State
- [ ] Tab to disabled Undo button
- [ ] Verify: Outline visible but button not clickable
- [ ] Press Enter (nothing happens)

### 3.7 Toggle Button State
- [ ] Click Versions button (shows sidebar)
- [ ] Verify: Button appears "active" (darker background, different color)
- [ ] Click again (hides sidebar)
- [ ] Verify: Button returns to normal state

---

## 4. COLOR & CONTRAST TESTS

### 4.1 Dark Mode Testing

**Setup**: Enable dark mode

- [ ] Background: #141420 (very dark, comfortable)
- [ ] White text: fully readable
- [ ] Secondary text: readable (not too faint)
- [ ] Tertiary text (labels): still readable
- [ ] Quaternary text (metadata): should be 4.8:1 contrast minimum
- [ ] Error text (red): bright enough
- [ ] Success text (green): bright enough
- [ ] Info text (blue): bright enough

**Contrast Check**:
- [ ] Open DevTools → Accessibility → Contrast
- [ ] Hover over each text element
- [ ] Verify: All show 4.5:1 or higher

### 4.2 Light Mode Testing

**Setup**: Enable light mode

- [ ] Background: #EEECEA (warm beige)
- [ ] Black text: fully readable
- [ ] Dark gray text: readable
- [ ] Medium gray text: readable
- [ ] Error text (dark red): bright enough
- [ ] Success text (dark green): bright enough
- [ ] Info text (dark blue): bright enough

**Contrast Check**:
- [ ] Open DevTools → Accessibility → Contrast
- [ ] Verify: All elements meet 4.5:1 minimum

### 4.3 Color Blind Simulation

**Using Chrome DevTools**:
- [ ] DevTools → Rendering → Emulate CSS media feature prefers-color-scheme
- [ ] Simulate Deuteranopia (red-green colorblind)
- [ ] Verify: Error messages still distinguishable by text/shape
- [ ] Verify: Success messages still distinguishable

---

## 5. ACCESSIBILITY (SCREEN READER) TESTS

### 5.1 VoiceOver (macOS)

**Enable**: Cmd+F5 (or System Preferences → Accessibility → VoiceOver)

- [ ] Press VO+U to open rotor
- [ ] Verify: All buttons listed with descriptive names
- [ ] "Edit button" vs just "button"
- [ ] "Version history (5 versions)" vs just "button"
- [ ] Navigate with VO+Right Arrow
- [ ] Verify: Each button announces its purpose
- [ ] Undo button announces: "Undo, button, disabled" (when disabled)

**Status Region**:
- [ ] VoiceOver announces changes to status text
- [ ] "Streaming... (42 words)" updates live
- [ ] "✓ Complete (100 words)" announces when done

**Edit Mode**:
- [ ] Textarea announces: "Edit content, text input"
- [ ] Undo/Redo buttons announce "disabled" state
- [ ] Save button announces when available

### 5.2 ARIA Landmarks

- [ ] Header: role="banner" announced
- [ ] Main: role="main" for content area
- [ ] Sidebar: role="complementary" for version history
- [ ] Status: role="status" for footer

---

## 6. EDIT MODE TESTS

### 6.1 Textarea Behavior

- [ ] Click Edit button
- [ ] Textarea appears with focus (cursor visible)
- [ ] Type text
- [ ] Verify: Height auto-expands as you type
- [ ] Paste long text (e.g., 100 lines)
- [ ] Verify: Height expands to max-height (not beyond viewport)
- [ ] Scroll inside textarea (not page)
- [ ] Tab key: indents text (inserts \t), doesn't blur

### 6.2 Undo/Redo

- [ ] Type "hello"
- [ ] Undo button enabled (clickable)
- [ ] Press Cmd+Z
- [ ] Text reverts to empty
- [ ] Undo button disabled
- [ ] Redo button enabled
- [ ] Press Cmd+Shift+Z
- [ ] Text back to "hello"
- [ ] Type " world"
- [ ] Redo button disabled (new input clears redo stack)

### 6.3 Save and Exit

- [ ] In edit mode, make changes
- [ ] Click Save button
- [ ] Verify: Modal/status shows "saved"
- [ ] Verify: Edit mode exits
- [ ] Textarea disappears
- [ ] Rendered view shows updated content

### 6.4 AI Writing Blocked

- [ ] Simulate AI writing (if available in your app)
- [ ] Textarea should be disabled (grayed out)
- [ ] Cannot type or edit
- [ ] Edit button disappears (replaced with "AI writing" badge)
- [ ] Cmd+E doesn't enter edit mode

---

## 7. VERSION HISTORY TESTS

### 7.1 Sidebar Toggle

- [ ] Click Versions button
- [ ] Sidebar slides in from right (smooth animation)
- [ ] Button shows "active" state (darker)
- [ ] Click again
- [ ] Sidebar slides out
- [ ] Button returns to normal state

### 7.2 Version List

- [ ] Sidebar shows "Versions (N)" header
- [ ] Each version shows:
  - [ ] Version number (v5, v4, v3...)
  - [ ] Time saved (e.g., "2:30 PM")
  - [ ] Character count (e.g., "542 chars")
- [ ] Versions are in reverse order (newest first)

### 7.3 Revert to Version

- [ ] Click on a version
- [ ] Verify: Content reverts to that version
- [ ] Verify: Edit mode enters automatically
- [ ] Verify: Has unsaved indicator appears
- [ ] Can edit the reverted content
- [ ] Save to create new version

### 7.4 Responsive Width

**Mobile (375px)**:
- [ ] Sidebar width: ~150px (no overflow)
- [ ] Content area still readable

**Tablet (768px)**:
- [ ] Sidebar width: ~180px
- [ ] Good balance of space

**Desktop (1440px)**:
- [ ] Sidebar width: 200px
- [ ] Optimal width for version list

---

## 8. STREAMING TESTS

### 8.1 Progress Indicator

- [ ] Trigger content generation (if available)
- [ ] Progress bar appears at top of canvas
- [ ] Bar animates smoothly (uses transform, not background)
- [ ] No jank or stuttering
- [ ] Progress bar is small (2px height) but visible

### 8.2 Streaming Content

- [ ] Content appears character-by-character
- [ ] Blinking cursor visible at end (▌)
- [ ] Cursor blinks smoothly (0.8s interval)
- [ ] Status shows "• streaming... (N words)"
- [ ] Word count updates live
- [ ] Content height auto-expands as text grows

### 8.3 Interrupt Stream

- [ ] While streaming, press Escape
- [ ] Verify: Streaming stops
- [ ] Content is preserved (not cleared)
- [ ] Can edit the partial content
- [ ] Status changes to "✓ Complete (N words)"

---

## 9. COPY & DOWNLOAD TESTS

### 9.1 Copy Button

- [ ] Open Canvas with some content
- [ ] Click Copy button
- [ ] Button changes to "Copied" (green background)
- [ ] Button reverts to "Copy" after 2 seconds
- [ ] Check clipboard: `Cmd+V` pastes the content
- [ ] Content is exactly as displayed (renders markdown)

### 9.2 Download Button

- [ ] Click Download button
- [ ] Browser downloads file
- [ ] Filename matches canvas title
- [ ] File can be opened in appropriate editor

---

## 10. ANIMATION TESTS

### 10.1 Smooth Transitions

- [ ] Hover over button
- [ ] Background color fades smoothly (0.15s transition)
- [ ] No jank or choppiness

### 10.2 Sidebar Animation

- [ ] Toggle version sidebar
- [ ] Slides in/out smoothly
- [ ] Width animates proportionally
- [ ] No layout shift or jank

### 10.3 Focus Outline

- [ ] Tab to a button
- [ ] Outline appears instantly (no animation)
- [ ] Tab away
- [ ] Outline disappears instantly

---

## 11. DARK/LIGHT MODE SWITCHING TESTS

### 11.1 Mid-Session Switch

- [ ] Open Canvas in dark mode
- [ ] Switch to light mode (via your app's theme toggle)
- [ ] Verify: All colors update immediately
- [ ] Buttons, text, backgrounds all change
- [ ] No reload needed

### 11.2 Consistency

- [ ] In dark mode: All text readable
- [ ] In light mode: All text readable
- [ ] Same functionality in both modes
- [ ] Focus outline visible in both modes

---

## 12. BROWSER COMPATIBILITY TESTS

### 12.1 Chrome (Latest)
- [ ] All features work
- [ ] Keyboard navigation works
- [ ] CSS focus-visible works
- [ ] Animations smooth

### 12.2 Safari (Latest)
- [ ] All features work
- [ ] Keyboard navigation works
- [ ] CSS focus-visible works (may require -webkit prefix)
- [ ] Animations smooth

### 12.3 Firefox (Latest)
- [ ] All features work
- [ ] Keyboard navigation works
- [ ] CSS focus-visible works
- [ ] Animations smooth

---

## 13. EDGE CASE TESTS

### 13.1 Very Long Content

- [ ] Paste 5000+ character document
- [ ] Textarea expands (but respects max-height)
- [ ] Can scroll within textarea
- [ ] Save/Undo/Redo still work
- [ ] Rendering performant (no freeze)

### 13.2 Very Long Title

- [ ] Set canvas title to 100+ characters
- [ ] Header title uses ellipsis
- [ ] Doesn't break layout
- [ ] Tooltip shows full title on hover

### 13.3 Many Versions

- [ ] Create 50+ versions
- [ ] Sidebar shows all (scrollable)
- [ ] Performance is still good
- [ ] No lag when clicking versions

### 13.4 Rapid Interactions

- [ ] Click buttons rapidly
- [ ] Copy/Copy/Copy
- [ ] Verify: Doesn't break or show errors
- [ ] No console errors

---

## 14. BUG REGRESSION TESTS

### 14.1 Previous Issues

- [ ] Focus outline wasn't visible → NOW visible ✓
- [ ] Button hover was janky → NOW smooth ✓
- [ ] Mobile sidebar overflow → NOW responsive ✓
- [ ] Color contrast too low → NOW WCAG AA ✓
- [ ] Undo button always enabled → NOW properly disabled ✓

---

## Test Results Summary

| Category | Tests | Passed | Failed | Notes |
|----------|-------|--------|--------|-------|
| Keyboard Navigation | 8 | __ | __ | |
| Responsive Design | 4 | __ | __ | |
| Button States | 7 | __ | __ | |
| Color & Contrast | 3 | __ | __ | |
| Accessibility | 2 | __ | __ | |
| Edit Mode | 4 | __ | __ | |
| Version History | 4 | __ | __ | |
| Streaming | 3 | __ | __ | |
| Copy/Download | 2 | __ | __ | |
| Animations | 3 | __ | __ | |
| Theme Switching | 2 | __ | __ | |
| Browser Compat | 3 | __ | __ | |
| Edge Cases | 4 | __ | __ | |
| Regression | 5 | __ | __ | |

**Total: 54 tests**

---

## Tester Sign-Off

**Tested By**: _________________
**Date**: _________________
**Overall Result**: [ ] PASS [ ] FAIL [ ] NEEDS REVIEW

**Issues Found**:
1. ___________________
2. ___________________
3. ___________________

**Comments**:
___________________
___________________

---

**Created**: April 2, 2026
**Last Updated**: April 2, 2026
