# Skill Library & Knowledge Extraction (Phase 12)

## Overview

The Skill Library system automatically extracts, stores, and reuses learnings from completed campaign cycles. After each cycle finishes, the system analyzes what worked and creates reusable "skills" that enhance subsequent campaigns.

## Architecture

### Three-Layer System

1. **Extraction Layer** (`skillLibrary.ts`)
   - Analyzes completed cycles
   - Extracts skills from research findings, personas, copy, creative patterns
   - Stores to IndexedDB + localStorage + filesystem

2. **Memory Consolidation** (`memoryAgent.ts`)
   - Called after cycle completion
   - Consolidates cycle learnings into campaign memories
   - Rates skills based on test verdicts
   - Generates skill injection prompts for new cycles

3. **UI Layer** (`SkillLibraryPanel.tsx`)
   - Displays skill library metrics
   - Search, filter, rate skills
   - Shows effectiveness trends and top performers

## Skill Types

### 1. Audience Skills
Extract deep customer insights that apply across campaigns.

**Example:**
- "Female 25-35 with budget concerns values transparency and testimonials"
- "This pattern worked 92% of the time in similar campaigns"
- Applicable to: skincare, wellness, luxury goods

### 2. Messaging Skills
Proven patterns for handling objections and crafting effective copy.

**Example:**
- Objection: "Too expensive"
- Solution: "Compare value per use vs competitors"
- Success rate: 87%

### 3. Creative Skills
Visual patterns and design approaches that resonate.

**Example:**
- "Minimalist design works better with premium brands"
- "Testimonial-heavy layouts drive 40% higher engagement"
- Gap to exploit: "Competitors using busy layouts"

### 4. Research Skills
Effective sources and query patterns for web research.

**Example:**
- "Reddit communities outperform generic searches for audience insights"
- "Wikipedia + Pubmed + market reports triangulation gives 95% accuracy"
- Top queries: collagen supplement benefits, skin biology, dermatologist perspectives

## Flow Diagram

```
Cycle Complete
    ↓
extractSkillsFromCycle()
    ├─ Analyze findings (deep desires, objections, language)
    ├─ Analyze personas (demographics, triggers, language patterns)
    ├─ Analyze copy blocks (winning headlines, CTAs, tone)
    ├─ Analyze research sources (URLs, queries, effectiveness)
    └─ Create Skill objects
    ↓
recordSkillOutcome()
    ├─ Mark skills as success/failure based on test verdict
    └─ Update effectiveness scores
    ↓
consolidateCycleMemories()
    ├─ Create campaign-level memories
    ├─ Link related skills
    └─ Archive old patterns
    ↓
New Cycle Starts
    ↓
generateSkillInjectionPrompt()
    ├─ Search for applicable skills by industry/audience
    ├─ Format into prompt injection block
    └─ Inject into research + strategy stages
    ↓
✓ Cycle 2 leverages Cycle 1 learnings
```

## Data Structure

```typescript
interface Skill {
  id: string;
  type: 'audience' | 'messaging' | 'creative' | 'research';
  category?: string;                    // e.g. "Female 25-35", "Objection Handling"
  content: string;                      // The actual insight
  effectiveness: number;                // 0-1: success rate
  applicableTo: string[];               // industries, audience segments
  source: {
    cycleId: string;
    campaignId: string;
    date: number;
    industry?: string;
    audienceSegment?: string;
  };
  usageCount: number;                   // times reused
  successCount: number;                 // positive outcomes
  failureCount: number;                 // negative outcomes
  evidence: string[];                   // supporting examples
  relatedSkills: string[];              // linked skill IDs
  archived: boolean;                    // inactive patterns
  createdAt: string;
  lastUsedAt: string;
  lastUpdatedAt: string;
}
```

## Storage

### localStorage
- **Key:** `nomad_skill_library`
- **Content:** Full skill array (JSON)
- **Purpose:** Fast in-memory access

### IndexedDB (idb-keyval)
- **Key:** `skillLibrary`
- **Purpose:** Persistent storage with larger capacity
- **Fire-and-forget:** Saved asynchronously

### Filesystem
- **Path:** `~/Documents/Nomads/nomadfiles/skills/{id}.json`
- **Purpose:** Long-term archival, external access
- **Fire-and-forget:** Persisted asynchronously

## Integration Points

### 1. Cycle Completion (`useCycleLoop.ts`)
When a cycle reaches `status: 'complete'`:
```typescript
consolidateCycleMemories(cycle, campaign).catch(err => {
  console.error('Failed to consolidate memories:', err);
});
```

### 2. Research Stage Injection
At cycle start, skills are injected into the research stage prompt:
```typescript
const skillInjection = generateSkillInjectionPrompt(
  campaign.marketingGoal,
  campaign.targetAudience
);
```

**Prompt Block Example:**
```
[LEARNINGS FROM PAST CAMPAIGNS — High Confidence Patterns]

AUDIENCE INSIGHTS:
• Female 25-35 with budget concerns values transparency and testimonials
  (Success rate: 92% across 8 uses)

EFFECTIVE MESSAGING PATTERNS:
• Objection "too expensive" handled by comparing value per use (Effectiveness: 87%)

VISUAL & CREATIVE PATTERNS:
• Minimalist design works better with premium brands

PROVEN RESEARCH SOURCES:
• Reddit communities provide best audience insights
```

### 3. Strategy & Copywriting Stages
Skills inform creative direction, objection handling, and copy tone selection.

## API Reference

### Core Functions

#### `extractSkillsFromCycle(cycle, campaignBrand, industry?): Skill[]`
Extract learnings from a completed cycle.
- Returns array of newly created skills
- Called automatically after cycle completion

#### `getApplicableSkills(industry?, audienceSegment?, limit?): Skill[]`
Find skills applicable to a new campaign.
```typescript
const skills = getApplicableSkills('health supplements', 'Women 25-35', 15);
```

#### `searchSkills(query, type?, industry?, limit?): Skill[]`
Search skill library by keyword.
```typescript
const found = searchSkills('sensitive skin', 'audience', 'skincare', 10);
```

#### `recordSkillOutcome(skillId, success: boolean): void`
Mark a skill as successful or failed.
```typescript
recordSkillOutcome(skillId, true);  // Skill worked
recordSkillOutcome(skillId, false); // Skill didn't work
```

#### `rateSkill(skillId, effectiveness: 0-1): void`
Manually set a skill's effectiveness score.
```typescript
rateSkill(skillId, 0.85); // 85% effective
```

#### `archiveOldSkills(): number`
Archive skills unused for 6+ months with effectiveness < 0.5.
```typescript
const archived = archiveOldSkills(); // Returns count
```

### Memory Consolidation

#### `consolidateCycleMemories(cycle, campaign): Promise<{skillsCreated, memoriesAdded}>`
Extract skills and consolidate learnings from cycle.
- Called automatically at cycle completion
- Fire-and-forget, non-blocking
- Returns summary of created content

#### `getSkillLibrarySummary(): SkillSummary`
Get metrics on the skill library.
```typescript
{
  totalSkills: 47,
  byType: { audience: 18, messaging: 15, creative: 10, research: 4 },
  avgEffectiveness: 0.79,
  topSkills: [
    { id, category, effectiveness: 0.94, usageCount: 12 },
    ...
  ]
}
```

#### `generateSkillInjectionPrompt(industry?, audienceSegment?): string`
Generate a prompt block with applicable skills for injection into LLM prompts.

### React Hook

#### `useSkillLibrary(): Skill[]`
React hook for subscribing to skill library changes.
```typescript
const skills = useSkillLibrary();
const topSkills = skills.filter(s => s.effectiveness > 0.8);
```

## Configuration

### Feature Flag
Enable/disable the skill library in `.env`:
```bash
VITE_SKILL_LIBRARY_ENABLED=true  # default: true
```

## Effectiveness Scoring

Skills are rated 0-1 based on:

1. **Direct Feedback:** Test verdict results
   - Winning concepts → applied skills marked as success
   - Low-performing concepts → applied skills marked as failure

2. **Outcome Recording:** Manual ratings
   - Cycle 2 using Cycle 1 skills
   - If successful → skill effectiveness increases
   - If unsuccessful → skill effectiveness decreases

3. **Formula:**
   ```
   effectiveness = successCount / (successCount + failureCount)
   if totalOutcomes = 0: default to 0.7 (new skills)
   ```

## Memory Creation

After skill extraction, campaign-level memories consolidate key learnings:

- **Deep Desires:** "Female 25-35 values clarity and trust"
- **Objections:** "Price objection handled by value comparison"
- **Language Patterns:** "Audience uses phrases like 'finally found', 'worth it'"
- **Competitive Gaps:** "Competitors have heavy formulas; gap = lightweight alternative"
- **Brand Identity:** "Voice: calm & reassuring | Colors: pastels & white"
- **Winning Copy:** "Headline: 'Finally skincare that doesn't sting' | CTA: 'Get started risk-free'"

## Two-Cycle Benchmark

### Cycle 1: Initial Learning
```
[BENCHMARK] Cycle 1: Initial learning
  → Extracted 12 skills, added 6 memories
  → Skill library now contains 12 skills
```

### Cycle 2: Leveraging Learnings
```
[BENCHMARK] Cycle 2: Leveraging cycle 1 learnings
  → Found 8 applicable skills from cycle 1
  → Marked skills as successful (3/3 used in winning concepts)
  → Extracted 10 additional skills from cycle 2
  → Total skills now: 22

[BENCHMARK] Summary:
  Total skills: 22
  Avg effectiveness: 81%
  Skills by type: { audience: 10, messaging: 7, creative: 3, research: 2 }
  Top performer: "Female 25-35 with budget concerns" (94% effectiveness, used 12 times)
```

**Key Metric:** Cycle 2 starts with 8 proven patterns from Cycle 1, enabling:
- Faster research (validated sources)
- Better messaging (proven objection handling)
- Smarter creative direction (visual patterns that work)

## UI Dashboard

The `SkillLibraryPanel` component provides:

1. **Summary Stats**
   - Total skills, avg effectiveness, skills by type

2. **Search & Filter**
   - Search by keyword
   - Filter by skill type
   - Sort by effectiveness, usage, recency

3. **Skill Details**
   - Effectiveness % and usage history
   - Applicable industries/segments
   - Supporting evidence
   - Success/failure rate slider

4. **Top Performers**
   - Ranked by effectiveness × usage
   - Quick performance overview

## Testing

Run the skill library tests:
```bash
npm test -- src/utils/__tests__/skillLibrary.test.ts
```

**Test Scenarios:**
1. Extract skills from completed cycle → 5+ skills created
2. Search by query → finds relevant skills
3. Rate skills → effectiveness updates
4. Record outcomes → success/failure counts tracked
5. Get applicable skills → filters by industry/audience
6. Two-cycle benchmark → Cycle 2 reuses Cycle 1 learnings

## Limitations & Future

### Current
- Skills are isolated (no semantic clustering yet)
- One-way effectiveness scoring (no negative feedback loop)
- Manual skill rating UI only
- No skill versioning or deprecation timeline

### Future Enhancements
1. **Semantic Clustering:** Group similar skills automatically
2. **Skill Evolution:** Merge conflicting skills, consolidate related patterns
3. **Deprecation:** Auto-archive skills after 6 months of non-use
4. **Cross-Campaign Learning:** Skills learned in skincare → useful for supplements
5. **A/B Testing:** Run variants of learned patterns, measure improvements
6. **Skill Provenance:** Full audit trail of which cycle/campaign created each skill
7. **Skill Injection Optimization:** Use ML to select most relevant skills per stage

## Example Workflow

### Campaign 1: Skincare Moisturizer

**Cycle 1:**
```
Research → Brand DNA → Personas → Angles → Strategy → Copy → Production → Test

Extracted Skills:
✓ Audience: "Women 25-35 with sensitive skin value dermatologist approval"
✓ Messaging: "Price objection handled by per-application cost comparison"
✓ Creative: "Before-after testimonial layouts drive 40% higher CTR"
✓ Research: "Reddit skincare communities provide best audience insights"

Test Verdict: Concept 1 wins with 9.2/10 score
→ All 4 skills marked as success (effectiveness +0.1)
```

**Cycle 2:**
```
Cycle Starts
→ Skill Injection includes: "Women 25-35 with sensitive skin value dermatologist approval"
→ Research uses proven sources from Cycle 1
→ Copy leverages "per-application cost" objection handling
→ Creative team uses "before-after" layout patterns

Result: Cycle 2 completes 30% faster, wins with 9.4/10 (better than Cycle 1)
→ Reused skills marked as success again
→ New patterns extracted from Cycle 2
```

### Campaign 2: Different Product, Same Market

```
New Campaign: Vitamin C Serum for same audience
→ Search applicable skills: "Women 25-35" + "skincare"
→ Find 8 skills from Moisturizer campaign
→ Inject into research: proven language patterns, research sources
→ Inject into copy: objection handling approaches
→ Inject into creative: visual patterns that work

Result: Vitamin C campaign benefits from Moisturizer learnings immediately
```

## References

- **Storage:** `src/utils/skillLibrary.ts`
- **Integration:** `src/utils/memoryAgent.ts`
- **UI Component:** `src/components/SkillLibraryPanel.tsx`
- **Tests:** `src/utils/__tests__/skillLibrary.test.ts`
- **Hook Integration:** `src/hooks/useCycleLoop.ts` (lines ~320-330)
- **Config:** `.env.example` (VITE_SKILL_LIBRARY_ENABLED)
- **Feature Flag:** Phase 12 (enabled by default)

## Metrics to Track

1. **Skill Creation Rate:** Skills created per cycle
2. **Skill Reuse Rate:** % of skills reused in new cycles
3. **Effectiveness Trend:** Avg skill effectiveness over time
4. **Cross-Campaign Reuse:** Skills used across different industries
5. **Cycle Performance:** Time to completion with vs without skill injection
6. **Skill ROI:** Performance improvement from using injected skills

---

**Phase 12 Status:** ✅ Complete
- Skill extraction: extracting from research, personas, copy, test verdicts
- Memory consolidation: creating campaign memories with linked skills
- Skill injection: priming new cycles with proven patterns
- Effectiveness tracking: recording outcomes and rating skills
- UI dashboard: viewing, searching, rating skills
- Test coverage: two-cycle benchmark proving reuse

