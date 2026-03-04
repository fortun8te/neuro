// Enhanced preset campaign templates with RICH DETAIL for QuickChat
// These presets answer all Zakaria Framework questions comprehensively

export const DEFAULT_PRESET = {
  id: 'clean-skincare',
  label: 'Natural Skincare Brand',
  brand: {
    name: 'Upfront.',
    website: 'www.upfront.nl',
    socials: 'instagram.com/upfront.skincare | tiktok.com/@upfrontskincare | YouTube: Upfront Science',
    description: 'Clean, transparent skincare brand combining Dutch herbal traditions with modern science. Every ingredient is traceable, every claim is backed by data. Founded 2019 by Dr. Marit van den Berg (former dermatologist)',
    industry: 'Beauty / Clean Beauty / Skincare',
    positioning: 'The transparent skincare brand that puts ingredient integrity first — for people tired of being lied to by the beauty industry',
    tone: 'Honest, educational, friendly but never patronizing, data-backed. Always explain the WHY. Never use buzzwords without backing.',
    colors: 'Sage green (trust/growth) + cream (approachability) + charcoal (authority)',
    fonts: 'Inter for body (modern, clean), Courier for technical specs (credibility)',
    personality: 'The Scientist Friend — approachable, nerdy about ingredients, always explains WHY, never talks down to you',
    bigEnemy: 'Greenwashing brands that hide toxic ingredients behind buzzwords. Also: beauty industry gatekeeping (hiding formulas, confusing INCI names)',
    brandWhy: 'Dr. Marit saw patients destroyed by "clean" products that weren\'t. She got tired of lying and built the antidote: radical transparency.',
    categoryBeliefs: [
      '"Natural = ineffective" — Myth. We prove plant compounds outperform synthetics in clinical trials',
      '"Premium = unaffordable" — Myth. €0.65/use is cheaper than coffee',
      '"Skincare needs 10 steps" — Myth. Minimal routines work better',
      '"Transparency is expensive" — Myth. We publish supply chain at same price as competitors',
    ],
  },

  audience: {
    name: 'Emma, The Conscious Skeptic',
    ageRange: '32-38 (peak earning, buying power)',
    location: 'Europe: Netherlands, Belgium, Germany, UK (cold climate = barrier damage)',
    income: '€50k-200k household',
    job: 'Senior product manager at tech company (analytical, research-driven)',
    education: 'University educated, likely STEM background',

    currentSituation: 'Buys skincare but feels anxious about choices. Reads 10+ reviews before buying. Has been burned by greenwashing multiple times. Frustrated by misleading ingredient lists.',
    desiredSituation: 'Wants to find ONE brand that doesn\'t lie, actually works, and aligns with values. Wants confidence that skin investment was smart.',

    painPoints: {
      primary: 'Confusing ingredient lists and fear of being duped (daily frustration when shopping)',
      secondary: 'Wasted money on ineffective products (€200+/year lost to experimental purchases)',
      tertiary: 'Sensitive skin reactions from harsh chemicals (had flare-ups after product switches)',
      quaternary: 'Greenwashing guilt — bought "clean" products that weren\'t, felt foolish on Reddit',
      deepestPain: 'Fear of looking older before her time (sun damage anxiety). Wants to age gracefully, not "fight aging".',
    },

    values: {
      transparency: 'Reads every label, cross-references on CosDNA, wants to understand WHY each ingredient',
      efficacy: 'Needs clinical data, not influencer hype. Will pay premium for proof.',
      sustainability: 'Checks sourcing, cares about packaging waste, buys recyclable when possible',
      evidenceBased: 'Trusts science > marketing. Would rather hear dermatologists than influencers',
      timeSaving: 'Won\'t do 10-step routines. Needs minimal, effective routine (2-3 products max)',
    },

    platforms: {
      instagram: '3 hrs/day — follows dermatologists, skincare educators, brand accounts',
      tiktok: '1 hr/day — discovers trends, skeptical of viral solutions',
      reddit: '30 min/day on r/SkincareAddiction, r/30PlusSkinCare — reads detailed user experiences',
      youtube: '2x/week for product reviews and dermatologist content',
      pinterest: 'Weekly for mood boards and skincare routines',
      blogs: 'Lab Muffin Beauty Science, Kindred Bylaws for deep dives',
    },

    buyingBehavior: 'Heavy researcher: reads 10+ reviews, checks ingredients, looks at Reddit 3+ months. Strong impulse control. Buys when: solves problem + has data + trusted person mentions it.',
    trustFactors: 'Third-party lab testing | Specific dermatologist endorsements | Long-term customer testimonials with photos | Supply chain documentation | Honest about limitations',

    identityShift: 'From "skeptic burned by marketing lies" → "someone who found a brand worthy of trust with skin AND wallet"',
    mustBelieve: 'Natural ingredients CAN be as effective as synthetic ones. This is non-negotiable.',
    deepDesire: 'Being in control of her beauty choices. Confidence that she made the smart choice. Aging gracefully without vanity.',

    dayInLife: 'Wake 6:30am → workout → work 8-6 → dinner 7pm → skincare 9:30pm (sacred me time) → reads reviews → sleep 11pm',
    purchaseHistory: 'CeraVe (too basic) | Korean brands (too complex, 10 steps) | The Ordinary (cheap, inconsistent) | Drunk Elephant (overpriced hype) | Paula\'s Choice (sterile, expensive)',

    psychographicTriggers: {
      respondTo: 'Data/proof | Before-afters with methodology | Ingredient breakdowns | "No BS" messaging | Price transparency | Supply chain stories',
      turnOff: 'Influencer shills | Vague claims | Pink tax | "Miracle" language | Buzzwords | Overpackaging | Overly feminine aesthetic',
      anxieties: 'Wasting money | Being lied to | Wrong choice | Ineffective product | Environmental guilt | Looking foolish',
      aspirations: 'Healthy radiant skin | In control of choices | Looking naturally good | Aging gracefully',
    },
  },

  product: {
    name: 'Vitamin C Brightening Serum 30ml (aka "The Glow Serum")',
    category: 'Skincare → Serums → Brightening',
    description: 'Stabilized L-ascorbic acid 15% with hyaluronic acid + ferulic acid complex. Lightweight, fast-absorbing. Pure science, no filler.',

    problemSolved: 'Hyperpigmentation from sun damage and post-acne marks (measurable discoloration, not just dullness)',
    secondaryProblems: 'Fine lines, loss of radiance, tired-looking skin',

    features: {
      active: 'L-ascorbic acid 15% (2x higher than most competitors)',
      supporting: 'Hyaluronic acid 2%, Ferulic acid complex',
      format: 'Fast-absorbing (60 sec), pH 3.5 (optimal), airless glass bottle',
      format2: 'No fragrance, parabens, sulfates, silicones. Vegan.',
    },

    functionalBenefits: {
      day3: 'Hydration boost visible, skin feels plumped',
      week1: 'Glow appears, texture improved, fine lines softer',
      week2: 'Confident without makeup, fine lines noticeably softer',
      week4: 'Brown spots lighter (15% reduction), skin tone more even',
      week8: 'Significant improvement (40% spot reduction), consistent glow',
    },

    emotionalBenefits: [
      'Confidence without makeup (spots don\'t need coverage)',
      'Not hiding spots in photos anymore',
      'Feeling like you\'re "glowing" naturally',
      'Reclaiming your skin identity',
      'Peace of mind (know exactly what\'s in product)',
      'Feeling smart (science-backed vs trends)',
    ],

    usp: 'ONLY product with: 15% L-ascorbic acid (competitors use 10%) + ferulic stabilizer + published clinical data + full supply chain transparency + €0.65 per use cost.',
    provenResults: '8-week clinical study (n=50): 92% saw visible brightness improvement, 40% brown spot reduction. Published data on site.',

    resultTimeline: 'Week 1: glow | Week 2: fine lines soften | Week 4: 15% spot reduction | Week 8: 40% reduction + even tone',
    resultTimeline2: 'Money-back guarantee if nothing by week 2',

    bestFor: 'Sun damage, post-acne pigmentation, dull/tired skin, 30+, all skin types',
    notFor: 'Very sensitive skin (patch test), active acne, pregnant women, on Accutane',

    pricing: '€65 | €0.65 per use (100 uses) | Cheaper per result than competitors',
    guarantee: '60-day money-back guarantee, no questions asked',

    usageFrequency: 'Apply 2-3 drops daily (AM or AM+PM for faster results)',
    usageDuration: 'Results visible in 2-4 weeks, significant in 8 weeks',
    compatibility: 'Works with: moisturizer, sunscreen (essential). Avoid: vitamin E, retinol (irritating together), acids',
  },

  competitive: {
    mainCompetitors: [
      'The Ordinary (€5.90) — Threat: price, ignorance | Weakness: unstable formula, no data',
      'Drunk Elephant (€80) — Threat: hype, influencers | Weakness: overpriced, marketing > results',
      'Paula\'s Choice (€50-60) — Threat: science messaging | Weakness: sterile brand, complex lineup',
    ],
    yourAdvantage: [
      'Only transparent supply chain documentation',
      'Higher concentration (15%) at lower cost (€0.65/use)',
      'Published clinical data (competitors just claim "clinically tested")',
      'Founder is dermatologist (Dr. Marit van den Berg, 15 yrs experience)',
      'Stability guarantee with published oxidation rates',
      'No greenwashing (honest about natural vs synthetic)',
    ],
    marketGap: 'No brand owns "radically transparent + scientifically proven + affordable premium + founder credibility + clean without greenwashing"',
  },

  messaging: {
    coreMessage: 'Get visible results in 2 weeks with ingredients you can trace back to their source. No BS, just science.',
    subclaims: [
      'Clinically proven efficacy (92% saw improvement in study)',
      'Transparent ingredients (full supply chain published)',
      'Results or money back (60-day guarantee)',
    ],
    mainObjections: {
      doubt1: '"Will it work?" → 92% improvement in 8-week study. Money-back guarantee.',
      doubt2: '"Too expensive?" → €0.65/use, cheaper than coffee. Competitor X at €80 works worse.',
      doubt3: '"Is it natural?" → 60% natural, 40% synthesized. We\'re honest, not greenwashing.',
      doubt4: '"How long?" → Glow in 7 days, spots fade in 4 weeks, significant in 8 weeks.',
    },
    linguisticPatterns: '"Finally works", "No more hiding spots", "Glow is real", "I understand what\'s in it", "Worth every penny"',
    avoidLanguage: '"Miracle", "Anti-aging", "Chemical-free", "Girl boss", vague "self-care"',
    contentFormats: 'Before/afters with methodology | Ingredient breakdowns | Lab behind-the-scenes | Dermatologist Q&A | Real testimonials | Supply chain documentary | Myth-busting',
  },

  goal: 'Drive trial conversions among skeptical clean beauty seekers, establish "transparent brand" authority, build 40%+ repeat loyalty in 6 months',
  budget: '€15k/month — 40% Instagram, 35% TikTok, 25% YouTube',
  timeline: 'Q1: awareness + education | Q2: trial + conversions | Q3-Q4: retention + referral',
  kpis: 'Conversion 3%+ | CAC €25-35 | Repeat 40%+ | AOV €65+ | NPS 70+',
};

export const ALTERNATIVE_PRESET_TECH = {
  id: 'productivity-saas',
  label: 'Productivity SaaS Tool',
  brand: {
    name: 'FocusOS',
    positioning: 'The OS for deep work — for knowledge workers tired of context-switching and Slack interruptions',
    tone: 'Direct, no-nonsense, technical but accessible',
  },
  audience: {
    name: 'Marcus, The Overthinking Founder',
    desiredSituation: 'Complete focused work blocks without guilt. Ship projects without constant interruptions.',
    painPoints: {
      primary: 'Context-switching kills productivity (every Slack ping loses 23 min focus)',
      secondary: 'No way to batch work time vs collaboration time',
    },
    mustBelieve: 'It\'s possible to be collaborative AND productive (not either/or)',
    deepDesire: 'Feeling like a capable, focused builder again (not a meeting-attending chaos manager)',
  },
};
