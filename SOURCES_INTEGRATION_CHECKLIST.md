# Source Components Integration Checklist

Use this checklist when integrating the enhanced source components into your application.

## Pre-Integration Review

- [ ] Read `SOURCES_COMPONENTS_GUIDE.md` for complete API documentation
- [ ] Review `SOURCES_IMPLEMENTATION_NOTES.md` for technical details
- [ ] Run the demo component: `SourceComponentsDemo.tsx`
- [ ] Verify components work in both light and dark modes

## Code Integration

### Phase 1: Import Statements

- [ ] Import `SourceFooter` in components that display message sources
  ```typescript
  import { SourceFooter } from '@/components/SourceFooter';
  ```

- [ ] Import `SourceChip` in components that render inline citations
  ```typescript
  import { SourceChip } from '@/components/SourcePreview';
  ```

- [ ] Verify all imports resolve correctly in TypeScript

### Phase 2: Component Replacement

#### In Message Display Components

- [ ] Locate existing source display code (if any)
- [ ] Replace with new `SourceFooter`:
  ```typescript
  const sources = extractSourcesFromMessage(content);
  return (
    <>
      <p>{content}</p>
      <SourceFooter sources={sources} variant="inline" />
    </>
  );
  ```

#### In In-Text Citation Areas

- [ ] Replace simple text markers with `SourceChip`:
  ```typescript
  // Before
  "See research [1] ..."

  // After
  "See research <SourceChip url="..." /> ..."
  ```

### Phase 3: Data Enrichment

Optional but recommended for better UX:

- [ ] Extract snippets from full text and pass to components
  ```typescript
  const snippet = getSnippetForUrl(content, source.url);
  return <SourceChip url={source.url} snippet={snippet} />;
  ```

- [ ] Add quality ratings from external data source
  ```typescript
  const quality = estimateSourceQuality(source.domain);
  return <SourceChip url={source.url} quality={quality} />;
  ```

- [ ] Integrate with Wayfayer visual scout for thumbnails
  ```typescript
  const thumbnail = visualFindings[source.url]?.screenshot;
  return <SourceChip url={source.url} thumbnail={thumbnail} />;
  ```

## Testing

### Unit Tests

- [ ] Test `SourceFooter` renders with empty sources
- [ ] Test deduplication works correctly
- [ ] Test expandable list shows/hides correctly
- [ ] Test quality estimation logic for various domains

### Integration Tests

- [ ] Test `SourceChip` appears inline in text
- [ ] Test hover tooltip shows and hides
- [ ] Test snippet syntax highlighting works
- [ ] Test rating stars display and can be clicked

### E2E Tests

- [ ] Test hover reveals full preview tooltip
- [ ] Test clicking source badge opens URL in new tab
- [ ] Test theme switching updates component colors
- [ ] Test message with 10+ sources shows expand button

### Dark/Light Mode Tests

- [ ] Verify colors are readable in dark mode
- [ ] Verify colors are readable in light mode
- [ ] Verify theme context is properly connected
- [ ] Test manual `isDarkMode` prop override

## Performance Review

- [ ] Verify no console errors or warnings
- [ ] Check React DevTools for unnecessary re-renders
- [ ] Measure tooltip render time (should be <1ms)
- [ ] Verify favicon images load from cache

## Documentation

- [ ] Add usage examples to component storybook (if applicable)
- [ ] Document any custom favicon provider setup
- [ ] Document any custom color scheme setup
- [ ] Add component to style guide

## Accessibility

- [ ] Test keyboard navigation (Tab key moves between sources)
- [ ] Verify screen reader announces source count
- [ ] Verify links are navigable with keyboard
- [ ] Test with accessibility inspector

## Deployment

- [ ] Build project successfully with no TypeScript errors
- [ ] No console errors in production build
- [ ] Test in production-like environment
- [ ] Monitor performance metrics (no regressions)

## Post-Deployment

- [ ] Monitor user feedback on new source UI
- [ ] Track engagement with quality ratings (if collecting)
- [ ] Monitor favicon load failures
- [ ] Track tooltip interaction patterns

## Optional Enhancements

After successful integration:

- [ ] Add source filtering UI
- [ ] Add "Copy citation" functionality
- [ ] Persist user quality ratings to IndexedDB
- [ ] Integrate real page preview screenshots
- [ ] Add source trust badges
- [ ] Add source categorization
- [ ] Add copy-to-clipboard functionality

## Troubleshooting

### Favicon Images Not Loading

- [ ] Check network tab for DuckDuckGo CDN requests
- [ ] Verify CORS is not blocking icons.duckduckgo.com
- [ ] Check if ad blocker is blocking favicon requests
- [ ] Consider alternative favicon provider (Google, Micro-service)

### Tooltips Not Appearing

- [ ] Verify parent container is not `overflow: hidden`
- [ ] Check z-index conflicts (should be 9999)
- [ ] Verify hover events are firing (React DevTools)
- [ ] Check if tooltip is rendering off-screen

### Colors Looking Wrong

- [ ] Verify ThemeContext is providing `isDarkMode`
- [ ] Check if manual `isDarkMode` prop is conflicting
- [ ] Verify CSS variables are not overriding inline styles
- [ ] Check browser developer tools computed styles

### Performance Issues

- [ ] Profile React rendering with DevTools Profiler
- [ ] Check if many SourceChip components cause slow re-renders
- [ ] Verify favicon caching headers are being set correctly
- [ ] Check if large thumbnail images are optimized

## Rollback Plan

If issues arise:

1. Revert to previous component versions
2. Check git history for old implementations
3. Deploy without new components
4. File issues and iterate

```bash
# Revert to previous version
git revert <commit-hash>
git push
```

## Success Criteria

Integration is complete when:

- [x] All tests pass (unit, integration, E2E)
- [x] No TypeScript errors in build
- [x] No console errors or warnings
- [x] Components render correctly in light and dark mode
- [x] Hover tooltips show and hide correctly
- [x] All links navigate correctly
- [x] No performance regressions
- [x] Accessibility standards met
- [x] User feedback is positive

---

## Support & Questions

- See `SOURCES_COMPONENTS_GUIDE.md` for API reference
- See `SOURCES_IMPLEMENTATION_NOTES.md` for technical details
- Review `SourceComponentsDemo.tsx` for usage examples
- Check component JSDoc comments for inline documentation
