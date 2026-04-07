# Adaptive Research Depth Configuration

## Problem
Current system does fixed research depth (2 searches always). This is either:
- Too shallow for complex questions (like "AI regulations across 3 regions")
- Wasteful for simple questions (like "What is X?")

## Solution
**Adaptive Research** — AI reasoning layer evaluates question complexity and decides research depth dynamically.

## How It Works

### Step 1: Question Analysis
Before research begins, orchestrator analyzes:
```
- Question length & structure
- Number of subtopics
- Temporal scope (historical? current? future?)
- Geographic scope (local? global?)
- Data type needed (stats? opinions? trends?)
- Urgency of accuracy (casual info? critical decision?)
```

### Step 2: Complexity Score (1-10)
```
1-2:   Factual lookup ("What is X?")
       → 2-3 searches min

3-4:   Simple comparison ("A vs B")
       → 4-5 searches min

5-6:   Multi-factor analysis ("Why does X happen?")
       → 8-10 searches min

7-8:   Cross-domain research ("Trends + sentiment + competitors")
       → 12-15 searches min

9-10:  Comprehensive strategic research ("Full market analysis")
       → 20-30+ searches min
```

### Step 3: Dynamic Query Count
```python
def calculate_research_depth(complexity_score, config):
    base_searches = 3  # Minimum
    
    if complexity_score <= 2:
        searches = 3
    elif complexity_score <= 4:
        searches = 5
    elif complexity_score <= 6:
        searches = 10
    elif complexity_score <= 8:
        searches = 15
    else:
        searches = 25
    
    # Apply user research depth preset modifier
    if config.research_depth == "quick":
        searches = searches // 2
    elif config.research_depth == "deep":
        searches = int(searches * 1.5)
    
    return max(base_searches, searches)
```

### Step 4: Multi-Tier Strategy
Once search count decided, split across tiers:
```
Low complexity (3-5 searches):
  Tier 1: 3-5 broad searches

Medium complexity (8-10 searches):
  Tier 1: 4 broad searches
  Tier 2: 4-6 targeted searches

High complexity (15-20 searches):
  Tier 1: 5 broad searches
  Tier 2: 8-10 targeted searches
  Tier 3: 2-5 deep creative searches

Very high complexity (25+ searches):
  Tier 1: 8 broad searches
  Tier 2: 12 targeted searches
  Tier 3: 5-10 deep creative searches
```

## Example Questions

### Q1: "What is the capital of France?"
- Complexity: 1 (factual)
- Searches: 2 (simple lookup)
- Tiers: Tier 1 only (1 broad search)
- Sources: 3-5

### Q2: "Compare React and Vue frameworks"
- Complexity: 4 (simple comparison)
- Searches: 5 (benchmarks + adoption + opinions)
- Tiers: Tier 1 (4) + quick Tier 2 (1)
- Sources: 20-30

### Q3: "What are latest AI regulations and implications?"
- Complexity: 8 (cross-regional policy analysis)
- Searches: 15 (regulations per region + implications + compliance)
- Tiers: Tier 1 (5) + Tier 2 (8) + Tier 3 (2)
- Sources: 100-150

### Q4: "Comprehensive market analysis for X product"
- Complexity: 9 (strategic research)
- Searches: 25 (market + competitors + trends + psychology + identity + sentiment)
- Tiers: Tier 1 (8) + Tier 2 (12) + Tier 3 (5)
- Sources: 200+

## Implementation

### Phase 1: Complexity Scoring (LLM-based)
```
Prompt: "Analyze this question's research complexity (1-10)"
Input: User question
Output: Complexity score + reasoning
```

### Phase 2: Research Depth Calculation
```
Input: Complexity score + user config (quick/normal/deep)
Output: Number of searches + tier breakdown
```

### Phase 3: Dynamic Query Generation
```
Input: Research depth + question
Output: Tier-1 queries, Tier-2 queries, Tier-3 queries
```

### Phase 4: Conditional Tier Execution
```
Execute Tier 1: Always
Execute Tier 2: If complexity > 5
Execute Tier 3: If complexity > 7
```

## Benefits

✅ **No wasted research** — Simple questions don't get 30 searches
✅ **No shallow research** — Complex questions get proper depth
✅ **Configurable** — User can request "quick" or "deep" variant
✅ **Reasonable** — AI decides based on actual needs
✅ **Traceable** — Logs show why research depth chosen

## Configuration
```json
{
  "research": {
    "enableAdaptiveDepth": true,
    "minSearches": 2,
    "maxSearches": 30,
    "complexityThresholds": {
      "simple": 3,
      "medium": 8,
      "complex": 15,
      "deep": 25
    },
    "userPresets": {
      "quick": 0.5,
      "normal": 1.0,
      "deep": 1.5
    }
  }
}
```

## Status
- [ ] Implement complexity scoring LLM call
- [ ] Implement research depth calculation
- [ ] Implement dynamic query generation
- [ ] Add logging for transparency
- [ ] Test on variety of question types
- [ ] Deploy to production
