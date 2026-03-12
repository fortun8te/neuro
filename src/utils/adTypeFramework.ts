/**
 * Ad Type Framework
 * Core creative classification system that determines which ad format
 * addresses which customer objection. Referenced by all marketing brains.
 *
 * 5 Ad Types × 5 Headline Hooks × Audience Matching = Creative Direction
 */

// ─────────────────────────────────────────────────────────────
// 5 Ad Types — each overcomes a specific customer objection
// ─────────────────────────────────────────────────────────────

export interface AdTypeDefinition {
  name: string;
  overcomes: string;           // the core objection this type addresses
  when: string[];              // situations where this type works best
  visualRules: string[];       // what the visual MUST do
  avoid: string;               // what kills this type
  copyStructure: string;       // how copy should work for this type
}

export const AD_TYPES: Record<string, AdTypeDefinition> = {
  'product-focused': {
    name: 'Product-Focused',
    overcomes: 'Is this product worth my money?',
    when: [
      'Unique visual features that need showcasing',
      'Customer knows they need it but unsure WHICH one to get',
      'Premium products where quality justifies price',
      'Retargeting ads (already interested, need the push)',
    ],
    visualRules: [
      'Perfect lighting, high-end product shot',
      'Show VALUE through visual details — texture, craftsmanship, ingredients',
      'Product as hero — not lifestyle, not model, the PRODUCT',
      'Can do more with product than lifestyle in this scenario',
    ],
    avoid: 'Trying to convince them they need it — they already know. Show why THIS one.',
    copyStructure: 'Feature → benefit → value justification. Short, confident, premium.',
  },
  'before-after': {
    name: 'Before/After (Transformation)',
    overcomes: 'Does this actually work?',
    when: [
      'Clear, measurable visual change is possible',
      'Transformation is the core promise',
      'Audience has tried other solutions that failed',
      'Skeptical market (sophistication level 3-4)',
    ],
    visualRules: [
      'Transformation must be OBVIOUS but REALISTIC',
      'Audience can smell fake — achievable > dramatic',
      'Bigger is NOT directly better — believable is better',
      'Not the most dramatic result, but an achievable one',
    ],
    avoid: 'Over-dramatic transformations that trigger BS detectors. Fake = dead.',
    copyStructure: 'Pain state → transformation → proof. Let the visual do most of the work.',
  },
  'lifestyle': {
    name: 'Lifestyle',
    overcomes: 'Is this for people like me?',
    when: [
      'Selling identity/aspiration, not features',
      'Fashion, beauty, wellness categories',
      'Target audience is identity-driven',
      'Mostly works in fashion and aspirational categories',
    ],
    visualRules: [
      'NOT about showing the product — about showing the LIFE',
      'Must feel ATTAINABLE — slightly better than their current life, not fantasy',
      'Aspirational but achievable — selling the story they want for themselves',
      'The product enables this world, but the world is the hero',
    ],
    avoid: 'Showing the product prominently. Show the world the product enables.',
    copyStructure: 'Identity statement → aspiration → subtle product tie-in. Minimal copy.',
  },
  'problem-solution': {
    name: 'Problem-Solution',
    overcomes: 'Will this solve my problem?',
    when: [
      'Clear, relatable pain point exists',
      'Solution is visually demonstrable',
      'Before state is universally recognized (messy vs clean, pain vs relief)',
      'Great for utility products with clear function',
    ],
    visualRules: [
      'Relatable pain point must hit INSTANTLY — no explanation needed',
      'Solution must be OBVIOUS in the visual',
      'Split frame or sequence: problem → solution',
      'The contrast does the selling',
    ],
    avoid: 'Complicated problems that need explanation. Must be instant recognition in 13ms.',
    copyStructure: 'Problem agitation → mechanism → solution demonstration. "If X... then Y" works.',
  },
  'testimonial': {
    name: 'Testimonial / Social Proof',
    overcomes: "I don't trust this brand",
    when: [
      'Trust is the primary purchase barrier',
      'Have authentic user content available',
      'Market sophistication level 4 (skeptical, tried everything)',
      'New brand entering established market',
    ],
    visualRules: [
      'MORE authentic = MORE raw = MORE trust',
      'Should look like real Facebook UI, real screenshot, real review',
      'Use actual reviews even if imperfect — imperfection = credibility',
      'Polished = fake. Raw = real. The messier the more believable.',
    ],
    avoid: 'Over-designed testimonials. Studio-quality "testimonials" that look like ads.',
    copyStructure: 'Their words, not yours. Direct quotes. Real language. Minimal brand polish.',
  },
};

// ─────────────────────────────────────────────────────────────
// 5 Headline Hook Types — must match the AUDIENCE, not just product
// ─────────────────────────────────────────────────────────────

export interface HeadlineHookDefinition {
  name: string;
  description: string;
  example: string;
  bestFor: string;             // which audience responds to this
  structure: string;           // the pattern
}

export const HEADLINE_HOOKS: Record<string, HeadlineHookDefinition> = {
  curiosity: {
    name: 'Curiosity',
    description: 'Open a loop the brain MUST close',
    example: 'The strange tropical fruit that melts fat while you sleep',
    bestFor: 'Cold audiences, browsers, people who don\'t know they have a problem yet',
    structure: 'The [unexpected modifier] [thing] that [surprising result]',
  },
  fomo: {
    name: 'FOMO',
    description: 'Fear of missing out — social proof + exclusion anxiety',
    example: 'Why skinny people eat this one food before bed',
    bestFor: 'Social-proof-driven buyers, trend followers, people who copy what "winners" do',
    structure: 'Why [aspirational group] [does unexpected thing]',
  },
  quickSolution: {
    name: 'Quick Solution',
    description: 'Speed + ease — minimal effort, maximum result',
    example: 'Two capsules before bed = wake up lighter',
    bestFor: 'Busy people, skeptics who tried complex solutions, "I don\'t have time" crowd',
    structure: '[Simple action] = [desirable outcome]',
  },
  identity: {
    name: 'Identity',
    description: 'Self-identification — "this is for people like ME"',
    example: 'For people who hate dieting but love results',
    bestFor: 'Identity-driven buyers, tribe-seekers, people who buy based on who they ARE',
    structure: 'For [identity group] who [relatable trait]',
  },
  controversy: {
    name: 'Controversy',
    description: 'Challenge existing beliefs — make them question what they "know"',
    example: 'Why your morning jog is making you gain weight',
    bestFor: 'Educated audiences, people stuck in old approaches, market sophistication 3-4',
    structure: 'Why [thing they believe in] is [opposite of what they expect]',
  },
};

// ─────────────────────────────────────────────────────────────
// Scenario-Based Ad Pattern
// "If you were X... you'd want Y" — combines identity + problem-solution
// ─────────────────────────────────────────────────────────────

export const SCENARIO_PATTERN = {
  name: 'Scenario Hook',
  description: 'Places the viewer in an aspirational or high-stakes scenario, then positions the product as the obvious choice',
  structure: 'If you were [scenario]... you\'d [want/wear/use] [product]',
  examples: [
    'If you were stranded here tomorrow, you\'d wish you had one of these',
    'If you were negotiating here tomorrow, you\'d wear a Rolex',
  ],
  why: 'Bypasses rational objections by making the viewer IMAGINE themselves in the scenario. System 1 takes over — they feel the need before logic kicks in.',
  bestFor: 'Premium products, survival/utility products, identity-status products',
  combines: ['identity', 'problem-solution'],
};

// ─────────────────────────────────────────────────────────────
// Utility Functions
// ─────────────────────────────────────────────────────────────

/** Map a primary objection to the best ad type */
export function getAdTypeForObjection(objection: string): string {
  const lower = objection.toLowerCase();
  if (lower.includes('worth') || lower.includes('money') || lower.includes('expensive') || lower.includes('price')) {
    return 'product-focused';
  }
  if (lower.includes('work') || lower.includes('effective') || lower.includes('results') || lower.includes('actually')) {
    return 'before-after';
  }
  if (lower.includes('people like me') || lower.includes('for me') || lower.includes('identity') || lower.includes('lifestyle')) {
    return 'lifestyle';
  }
  if (lower.includes('solve') || lower.includes('problem') || lower.includes('fix') || lower.includes('help')) {
    return 'problem-solution';
  }
  if (lower.includes('trust') || lower.includes('scam') || lower.includes('legit') || lower.includes('real')) {
    return 'testimonial';
  }
  return 'problem-solution'; // safe default
}

/** Get the best headline hook for a market sophistication level */
export function getHookForSophistication(level: number): string[] {
  switch (level) {
    case 1: return ['curiosity', 'quickSolution'];       // virgin market — intrigue them
    case 2: return ['fomo', 'quickSolution'];             // early competition — outperform
    case 3: return ['controversy', 'identity'];           // crowded — differentiate
    case 4: return ['identity', 'controversy'];           // skeptical — relate + challenge
    default: return ['curiosity', 'identity'];
  }
}

/** Build a compact framework summary for LLM prompts */
export function getAdTypeFrameworkPrompt(): string {
  const types = Object.entries(AD_TYPES)
    .map(([_key, t]) => `${t.name}: Overcomes "${t.overcomes}" | Visual: ${t.visualRules[0]} | Copy: ${t.copyStructure}`)
    .join('\n');

  const hooks = Object.entries(HEADLINE_HOOKS)
    .map(([_key, h]) => `${h.name}: "${h.example}" — ${h.bestFor}`)
    .join('\n');

  return `AD TYPE FRAMEWORK:
${types}

HEADLINE HOOK TYPES (must match AUDIENCE, not just product):
${hooks}

SCENARIO PATTERN: "${SCENARIO_PATTERN.structure}" — ${SCENARIO_PATTERN.why}

CRITICAL: Hook type must match the AUDIENCE. A curiosity hook fails on skeptical Level 4 audiences. An identity hook fails on someone who doesn't identify with the tribe yet.`;
}
