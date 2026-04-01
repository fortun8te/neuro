// Research Methodology — 9-step comprehensive market research framework
// Drives orchestrator search strategy, desire analysis layers, and coverage tracking
//
// Based on emotion-driven research: "People don't buy products — they buy fulfillment of desires"

// ─────────────────────────────────────────────────────────────
// Step definitions — each step has research goals + query templates
// ─────────────────────────────────────────────────────────────

export interface MethodologyStep {
  id: string;
  name: string;
  description: string;
  goals: string[];
  queryTemplates: string[];      // Templatized search queries ({brand}, {product}, {category})
  minDataPoints: number;         // Minimum data points before step is "covered"
  coverageDimensions: string[];  // Which coverage dimensions this step maps to
}

export const METHODOLOGY_STEPS: MethodologyStep[] = [
  {
    id: 'brand-product',
    name: 'Brand & Product Analysis',
    description: 'Analyze the brand positioning, mechanisms, price point, and voice',
    goals: [
      'What specific desire or problem does this product address?',
      'Is this a superior product or identity marketing?',
      'What mechanisms make it better than alternatives?',
      'What community or identity is it targeting?',
      'How does it position against direct and indirect competitors?',
      'What is the price point relative to alternatives?',
      'Document 20+ key phrases from brand language',
      'Customer journey from awareness to purchase',
      'Guarantee and risk-reversal elements',
    ],
    queryTemplates: [
      '{brand} website review analysis',
      '{brand} {product} vs alternatives comparison',
      '{brand} unique selling proposition positioning',
      '{brand} customer journey purchase experience',
      '{product} mechanism how it works science',
    ],
    minDataPoints: 10,
    coverageDimensions: ['brand_positioning_gaps'],
  },
  {
    id: 'desire-problem',
    name: 'Desire & Problem Mapping',
    description: 'Core desires driving the market, urgency, emotional states',
    goals: [
      'What are primary desires that drive this market?',
      'How urgent are these desires? (1-10 scale)',
      'What problems prevent people from achieving desires?',
      'How many solutions have people tried before?',
      'Emotional state: desperate, curious, skeptical, hopeful?',
      'Document 30+ examples of exact customer language',
      'Rate intensity and urgency per desire',
      'Identify emotional triggers for each desire/problem',
      'Seasonal or cyclical patterns in desires',
    ],
    queryTemplates: [
      '{category} customer frustrations reddit',
      '{product} "I wish" OR "I need" OR "I want" site:reddit.com',
      '{category} biggest problems complaints forum',
      '{product} emotional impact lifestyle change',
      'why do people buy {product} real reason psychology',
    ],
    minDataPoints: 15,
    coverageDimensions: ['psychological_triggers', 'customer_objections'],
  },
  {
    id: 'competitor-market',
    name: 'Competitor & Market Research',
    description: '10-15 direct competitors, 7-10 indirect alternatives, positioning analysis',
    goals: [
      'List 10-15 direct competitors with websites',
      'Analyze hooks, headlines, desire appeals per competitor',
      'Document visual elements in competitor ads',
      'Positioning strategies and key messaging with examples',
      'Which ads have been running longest (most successful)',
      'Compare pricing strategies and value propositions',
      'Identify 7-10 indirect alternative solutions',
      'Map advantages/disadvantages vs each alternative',
      'Common objections addressed in competitor marketing',
      'Guarantee structures and risk reversal tactics',
    ],
    queryTemplates: [
      '{category} best brands 2025 comparison review',
      '{brand} competitors alternative brands',
      'facebook ad library {category} ads running',
      '{competitor} vs {brand} comparison review',
      '{category} alternative solutions what else works',
      '{product} meta ad library running ads 2025',
      '{competitor} pricing strategy value proposition',
    ],
    minDataPoints: 15,
    coverageDimensions: ['competitor_analysis', 'pricing_strategies'],
  },
  {
    id: 'identity-markers',
    name: 'Identity Markers Research',
    description: 'Values, visual markers, language patterns, influencers, and tribal signals',
    goals: [
      'Document 10+ common values of the identity group',
      'Visual markers: clothing, accessories, aesthetics',
      'Collect 20+ language patterns specific to group',
      'List 15-20 influencers and authorities group respects',
      'Analyze 10+ brands that successfully market to this identity',
      'Document 5-7 common unifying experiences',
      'Media this group consumes: podcasts, YouTube, publications',
      'Aspirations and fears specific to this identity',
      'How group signals belonging to others',
      'Opposing identities group defines itself against',
    ],
    queryTemplates: [
      '{audience} identity values what they care about',
      '{audience} influencers who they follow trust',
      '{audience} language slang how they talk',
      '{audience} community culture visual style aesthetic',
      '{audience} brands they love and why',
      '{audience} podcasts youtube channels media consumption',
      '{audience} tribe signals status markers',
    ],
    minDataPoints: 10,
    coverageDimensions: ['media_consumption_patterns', 'psychological_triggers'],
  },
  {
    id: 'amazon-research',
    name: 'Amazon Research',
    description: 'Customer language, failed solutions, aha moments, objections from reviews',
    goals: [
      'Collect 40+ direct quotes from reviews (positive + negative)',
      'What products have they tried before? What disappointed them?',
      'Document "aha moments" when product works (15+ examples)',
      'What visual proof do customers look for?',
      'What objections cause hesitation? (15+)',
      'How do customers describe decision-making process?',
      'Time frames mentioned for seeing results',
      'Emotional impact of successful products',
      'Feature comparisons customers make between products',
      'Price sensitivity factors in reviews',
      'Secondary benefits discovered (not originally sought)',
      'Analyze Q&A sections for common concerns',
      'Review distributions: what drives 1-star vs 5-star?',
    ],
    queryTemplates: [
      'site:amazon.com {product} reviews',
      'amazon {product} 1 star reviews complaints',
      'amazon {product} "switched from" OR "tried before"',
      'amazon {product} "finally found" OR "game changer" reviews',
      'amazon {competitor} reviews disappointed',
      '{product} amazon review analysis best worst',
    ],
    minDataPoints: 20,
    coverageDimensions: ['customer_objections', 'pricing_strategies'],
  },
  {
    id: 'reddit-research',
    name: 'Reddit Research',
    description: 'Authentic language, failed attempts, success stories, decision processes',
    goals: [
      'Identify 10-15 most relevant subreddits',
      'Collect 50+ direct quotes showing how users talk about desires',
      'Capture language about failed attempts (20+ examples)',
      'Note 10+ recurring themes in success/failure stories',
      'Identify content triggering strong emotional responses',
      'Document comparisons between alternatives',
      'Identify DIY approaches before purchasing',
      'Capture "holy grail" product descriptions',
      'Terminology differences: novices vs experienced users',
      'Price sensitivity discussions and value assessments',
    ],
    queryTemplates: [
      'site:reddit.com {product} recommendation',
      'site:reddit.com {product} "holy grail" OR "game changer" OR "changed my life"',
      'site:reddit.com {category} "what worked" OR "what didn\'t work"',
      'site:reddit.com {product} "switched from" OR "gave up on"',
      'reddit r/{subreddit} {product} honest review',
      'site:reddit.com {category} "waste of money" OR "overrated"',
      'site:reddit.com {product} vs {competitor} which is better',
    ],
    minDataPoints: 20,
    coverageDimensions: ['customer_objections', 'psychological_triggers'],
  },
  {
    id: 'social-media',
    name: 'Social Media Research',
    description: 'Hooks, visuals, comments, influencers, content structures, ad styles',
    goals: [
      'Analyze 20-25 most successful hooks in viral videos',
      'Categorize hook patterns: claim size, speed, authority, before/after, rivals, limitations',
      'Document visual approaches: benefit, problem, product, product-in-action',
      'Analyze 100+ comments for patterns: questions, objections, enthusiasm, testimonials',
      'Identify 5-10 key influencers and their content strategies',
      'Document trending hashtags and content themes',
      'Analyze content structures: symptom>problem>solution>product>offer',
      'Duration trends, engagement patterns, music/sound elements',
      'Caption and hashtag strategies that perform well',
      'UGC vs professional content performance',
      'Call-to-action approaches and placement',
    ],
    queryTemplates: [
      'tiktok {product} viral review trend',
      '{category} tiktok hooks that work 2025',
      '{brand} social media marketing strategy analysis',
      '{category} instagram ads best performing',
      '{product} influencer recommendation tiktok',
      '{category} viral content hooks what works',
      '{brand} facebook ad library current ads',
    ],
    minDataPoints: 15,
    coverageDimensions: ['media_consumption_patterns', 'channel_effectiveness'],
  },
  {
    id: 'market-sophistication',
    name: 'Market Sophistication Analysis',
    description: 'Determine sophistication level 1-5, appropriate positioning strategy',
    goals: [
      'Determine market sophistication level (1-5) with evidence',
      'Level 1: New product, little competition',
      'Level 2: Competition exists, similar benefits claimed',
      'Level 3: Market saturated with similar claims',
      'Level 4: Market disillusioned with previous claims',
      'Level 5: Market highly educated and skeptical',
      'Identify positioning strategy: new mechanism, superior product, identity, depositioning, repositioning',
      'For each strategy: implementation examples, risks, proof elements needed',
    ],
    queryTemplates: [
      '{category} market saturation competition level',
      '{product} too many options overwhelmed choosing',
      '{category} market trends growth decline 2025',
      '{product} skepticism distrust marketing claims',
      '{category} what makes people switch brands',
    ],
    minDataPoints: 8,
    coverageDimensions: ['market_size_trends', 'brand_positioning_gaps'],
  },
  {
    id: 'ad-style-analysis',
    name: 'Ad Style Analysis',
    description: 'Which ad types work: professional vs UGC, emotional vs logical, bright vs dark side',
    goals: [
      'Professional vs UGC content (10+ examples each)',
      'Emotional vs logical appeals (patterns with examples)',
      'Bright side (benefits) vs dark side (problems) focus',
      'Simple vs complex explanations',
      'Short-form vs long-form content performance',
      'Serious vs humorous tone resonance',
      'Male vs female presenters (if relevant)',
      'Studio vs real-world environments',
      'Text-heavy vs image-focused approaches',
      'Technical vs lifestyle framing',
      'Seasonal vs evergreen approaches',
    ],
    queryTemplates: [
      '{category} best performing ad styles 2025',
      '{category} UGC vs professional ads performance',
      '{product} emotional vs rational advertising',
      '{category} ad creative trends what converts',
      '{brand} ad style analysis creative approach',
    ],
    minDataPoints: 10,
    coverageDimensions: ['channel_effectiveness', 'visual_competitive_analysis'],
  },
];

// ─────────────────────────────────────────────────────────────
// Orchestrator search strategy builder
// ─────────────────────────────────────────────────────────────

/**
 * Build methodology-driven search suggestions for the orchestrator.
 * Substitutes {brand}, {product}, {category}, {audience}, {competitor} placeholders.
 */
export function getMethodologySearchSuggestions(
  brand: string,
  product: string,
  category: string,
  audience: string,
  competitors: string[],
  completedSteps: string[]
): { stepId: string; stepName: string; queries: string[] }[] {
  const subs = (template: string): string => {
    let q = template
      .replace(/{brand}/g, brand)
      .replace(/{product}/g, product)
      .replace(/{category}/g, category)
      .replace(/{audience}/g, audience);
    // Replace {competitor} with first known competitor
    if (competitors.length > 0) {
      q = q.replace(/{competitor}/g, competitors[0]);
    }
    // Replace {subreddit} with a guessed subreddit
    q = q.replace(/{subreddit}/g, category.toLowerCase().replace(/[^a-z0-9]/g, ''));
    return q;
  };

  return METHODOLOGY_STEPS
    .filter(step => !completedSteps.includes(step.id))
    .map(step => ({
      stepId: step.id,
      stepName: step.name,
      queries: step.queryTemplates.map(subs),
    }));
}

// ─────────────────────────────────────────────────────────────
// Orchestrator prompt injection — methodology-aware evaluation
// ─────────────────────────────────────────────────────────────

/**
 * Returns a methodology summary for inclusion in the orchestrator's evaluation prompt.
 * Shows which steps are complete vs remaining.
 */
export function getMethodologySummary(
  coveredDimensions: string[],
  totalSources: number,
  totalQuotes: number,
  totalCompetitors: number
): string {
  const stepStatus = METHODOLOGY_STEPS.map(step => {
    const covered = step.coverageDimensions.some(d => coveredDimensions.includes(d));
    return `${covered ? '[x]' : '[ ]'} STEP: ${step.name} — ${step.description}`;
  });

  return `
COMPREHENSIVE RESEARCH METHODOLOGY (9 Steps):
${stepStatus.join('\n')}

PROGRESS AGAINST METHODOLOGY MINIMUMS:
- Sources: ${totalSources} (need 75+)
- Verbatim quotes: ${totalQuotes} (need 40+ from Amazon, 50+ from Reddit)
- Named competitors: ${totalCompetitors} (need 10-15 direct + 7-10 indirect)

CRITICAL GAPS TO ADDRESS:
${METHODOLOGY_STEPS.filter(step => !step.coverageDimensions.some(d => coveredDimensions.includes(d)))
  .map(step => `- ${step.name}: ${step.goals.slice(0, 3).join('; ')}`)
  .join('\n')}

SEARCH STRATEGY BY STEP:
For Amazon research: "site:amazon.com {product} reviews", "amazon {product} 1 star reviews"
For Reddit research: "site:reddit.com {product} recommendation", "reddit {subreddit} honest review"
For Social Media: "tiktok {product} viral", "facebook ad library {category} ads"
For Identity: "{audience} influencers trust", "{audience} language slang"
For Ad Style: "{category} best performing ads 2025", "UGC vs professional ads performance"
`;
}

// ─────────────────────────────────────────────────────────────
// Desire analysis layer enrichment prompts
// ─────────────────────────────────────────────────────────────

export const LAYER_ENRICHMENTS: Record<string, string> = {
  // Layer 1: Avatar + Deep Desire
  'layer-1': `ADDITIONAL DEPTH (from methodology):
- For each desire: document 5-7 examples of EXACT language customers use (direct quotes)
- Rate each desire's intensity and urgency (1-10) with explanation
- Analyze whether each desire is becoming stronger or weaker in marketplace
- Identify emotional triggers associated with each desire
- Note cyclical/seasonal patterns in desires
- Map the complete emotional landscape: desperate, curious, skeptical, hopeful?
- How many solutions have they typically tried before seeking new options?`,

  // Layer 2: Root Cause + Mechanism
  'layer-2': `ADDITIONAL DEPTH (from methodology):
- For superior products: document 3-5 specific mechanisms that make it better
- For each mechanism: explain WHY it works (technical + emotional)
- How does the product address failures of previous solutions? (specific claims)
- What "proof" do customers need to believe this product will work?
- What visual proof elements build belief? (before/after, data, testimonials)
- How EASY is it to use and get results? (effort, sacrifice, cost analysis)
- How FAST can someone expect results? (timeline expectations with evidence)`,

  // Layer 3: Objections + Failed Solutions
  'layer-3': `ADDITIONAL DEPTH (from methodology):
- Document 15+ specific objections causing purchase hesitation
- For each objection: exact customer language + source
- What products have they tried before? What disappointed them? (patterns)
- "Aha moments" when a product finally works (15+ examples)
- Time frames mentioned for seeing results
- Secondary benefits discovered that weren't originally sought
- Price sensitivity: what makes them hesitate vs what justifies premium?
- What character traits do they VALUE vs DESPISE in brands?`,

  // Layer 4: Avatar Behavior + Market Sophistication
  'layer-4': `ADDITIONAL DEPTH (from methodology):
MARKET SOPHISTICATION ANALYSIS:
- Level 1: New product, little competition
- Level 2: Competition exists, similar benefits claimed
- Level 3: Market saturated with similar claims
- Level 4: Market disillusioned with previous claims
- Level 5: Market highly educated and skeptical
Determine EXACT level with evidence.

IDENTITY MARKERS:
- 10+ common values of the identity group with examples
- Visual markers: clothing, accessories, aesthetics
- 20+ language patterns specific to this group
- 15-20 influencers/authorities they respect
- Media they consume: podcasts, YouTube, publications
- How they signal belonging to others in the group
- Opposing identities they define themselves against`,

  // Layer 5: Purchase Journey
  'layer-5': `ADDITIONAL DEPTH (from methodology):
AMAZON INSIGHTS:
- What language do Amazon reviewers use for this product category?
- What drives 1-star vs 5-star reviews? (specific patterns)
- What feature comparisons do customers make between products?
- What questions appear in product Q&A sections?

REDDIT INSIGHTS:
- Which subreddits discuss this category most? (list 10-15)
- What are the "holy grail" product descriptions?
- DIY approaches people try before purchasing
- Terminology differences: novices vs experienced users

DECISION MAPPING:
- Exact search terms used at each stage
- Which review sites they visit
- Comparison criteria they apply
- Who influences their final decision
- What purchasing triggers finally push them to buy?`,

  // Layer 6: Emotional Landscape
  'layer-6': `ADDITIONAL DEPTH (from methodology):
FULL EMOTIONAL MAPPING:
- What are they AFRAID of? (10+ specific fears)
- What are they ANGRY about? Who are they angry AT?
- Top 15+ daily frustrations with examples
- What are they EMBARRASSED about? (social anxieties)
- If describing problems TO A FRIEND over dinner, what would they say? (5+ conversational examples)
- What is keeping them from solving problems NOW? (10+ barriers)
- What would their ideal day look like if problem were solved?
- How do they measure success in this area?
- What is the emotional state: desperate, curious, skeptical, hopeful?

BELIEF SYSTEMS:
- What do they believe is true about themselves and their problems?
- Is there a belief that pain points "used to not exist" or "used to not be this bad"?
- Do they blame anyone/outside forces for problems? Who and why?
- What market trends are they aware of? What do they think about them?`,

  // Layer 7: Competitive Positioning
  'layer-7': `ADDITIONAL DEPTH (from methodology):
FOR EACH COMPETITOR (10-15 direct, 7-10 indirect):
- Hooks and headlines — what desires do they appeal to?
- Visual elements in their ads (environments, actors, product demos)
- Which ads have been running longest? (likely most successful)
- Website structure and sales approach
- Credibility markers and trust signals
- Key claims and how they're substantiated
- Guarantee structures and risk reversal

POSITIONING STRATEGY RECOMMENDATION:
- New mechanism in marketplace?
- Superior product with better results?
- Identity marketing to specific group?
- Depositioning competitors?
- Repositioning for a different desire?
For each: implementation examples, risks, required proof elements.`,
};

// ─────────────────────────────────────────────────────────────
// Final document questions — drives completeness check
// ─────────────────────────────────────────────────────────────

export const FINAL_DOCUMENT_QUESTIONS = {
  desireAndProduct: [
    'What is the primary desire this product fulfills?',
    'How urgent is this desire in the marketplace?',
    'What emotional states drive purchases?',
    'What have people tried before? (10+ alternatives)',
    'Why have previous solutions failed them?',
    'What unique mechanism does this product use?',
    'What proof do customers need to believe it works? (10+ proof elements)',
    'How can we visually demonstrate proof in advertising?',
    'What positioning strategy fits this market sophistication level?',
    'What language patterns resonate most strongly? (20+ examples)',
    'How EASY is it to use and get results?',
    'How FAST can someone expect results?',
    'What is the best way to SHOW NOT TELL?',
    'Most effective credibility markers? (10+)',
  ],
  audience: [
    'Detailed personas: age, gender, location, income, problem',
    'Market AWARENESS level (1-5)',
    'Market SOPHISTICATION level (1-5)',
    'Pain points with symptoms (15+)',
    'Unique mechanism behind their pain point',
    'What are they AFRAID of? (10+)',
    'What are they ANGRY about and at whom?',
    'Top daily FRUSTRATIONS (15+)',
    'What are they EMBARRASSED about?',
    'How they describe problems to a friend over dinner (5+ examples)',
    'What keeps them from solving NOW? (10+ barriers)',
    'Ideal day if problem solved',
    'How they measure success',
  ],
  beliefsAndBuying: [
    'Personalities/celebrities they look up to (15-20)',
    'Brands they respect and why (10+)',
    'Current beliefs about themselves and problems',
    'Buzz phrases they resonate with (30+)',
    'Did pain points used to not exist or be less bad?',
    'Who/what they blame for problems',
    'Current solutions they use',
    'What they LIKE about existing solutions',
    'What they DISLIKE and horror stories',
    'How they evaluate if a solution works',
    'Character traits they VALUE vs DESPISE',
    'Market trends they are aware of',
    'Tribes they belong to and status signals',
    'Who actually buys (if different from user)',
    'Purchasing triggers that push them to buy (10+)',
    'Best buyers profile (high LTV)',
    'What buyers love about product',
    'What buyers complain about',
    'Ideal customer journey map',
  ],
};

// ─────────────────────────────────────────────────────────────
// Ad concept framework — drives make stage
// ─────────────────────────────────────────────────────────────

export const AD_CONCEPT_FRAMEWORK = {
  positioningStrategies: [
    'New mechanism in the marketplace',
    'Superior product in the marketplace',
    'Identity marketing to a specific group',
    'Depositioning competitors',
    'Repositioning for a different desire',
  ],
  adFormats: ['static image', 'video ad', 'carousel ad', 'UGC concept'],
  adStructures: [
    'Symptom > Problem > Solution > Product > Offer',
    'Problem > Solution > Product > Offer',
    'Solution > Product > Offer',
    'Product > Offer',
    'Offer only',
  ],
  hookPatterns: [
    'Size of claim ("Make an extra $X")',
    'Speed of claim ("How to X overnight")',
    'Authority figure ("Leading expert reveals...")',
    'Before/after ("Before this, I was stuck...")',
    'Rival comparison ("3x faster than...")',
    'Remove limitations ("Even if you have no experience")',
    'Question-based ("Who else wants X without Y?")',
    'Information-offering ("How to X in 2025")',
    'Newness emphasis ("NEW strategy doubles results")',
    'Exclusivity ("The only solution that actually...")',
    'Belief-challenging ("I thought X was impossible until...")',
    'Direct call-out ("To the person who has tried everything...")',
  ],
  visualApproaches: [
    'Picture of the benefit (showing desired outcome)',
    'Picture of the problem (showing what\'s being solved)',
    'Picture of the product (focusing on the item)',
    'Picture of product in action (demonstrating use)',
  ],
  requiredPerConcept: [
    'Concept name',
    'Positioning strategy',
    'Ad format',
    'Primary avatar targeted',
    'Key desire/pain point',
    'Hook/headline (5-7 variations)',
    'Visual concept description',
    'Ad structure',
    'Script draft',
    'Visual proof elements',
    'Call to action',
    'Urgency element',
    'Objection handling (top 2-3)',
    'Why this will work (citing research)',
  ],
};
