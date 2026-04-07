# Queued Prompts Integration Examples

Complete examples showing how to integrate queued prompts with your Ad Agent system.

## Example 1: Full Campaign Workflow

Create a complete campaign from research to final ad output using queued prompts:

```typescript
import { useQueuedPrompts } from './hooks/useQueuedPrompts';
import { useCampaign } from './hooks/useCampaign'; // Your existing hook

function CampaignWorkflow() {
  const { createQueue, addItemsToQueue, executeQueue } = useQueuedPrompts();
  const { campaign, updateCampaign } = useCampaign();

  const startCampaignWorkflow = async () => {
    // Create the main campaign queue
    const queue = await createQueue(
      `${campaign.name} - Full Workflow`,
      `Complete campaign from research to final ads`,
    );

    // Phase 1: Research
    const researchItems = await addItemsToQueue(queue.id, [
      {
        label: 'Customer Desires Analysis',
        prompt: `Analyze deep customer desires for product: ${campaign.product}
                 Market segment: ${campaign.targetAudience}
                 Price point: ${campaign.pricePoint}

                 Output as JSON with: desires[], pain_points[], motivations[]`,
        model: 'qwen3.5:4b',
        maxTokens: 2000,
      },
      {
        label: 'Objection Identification',
        prompt: `Based on these customer desires and our product positioning:
                 Desires: {output_0}

                 Identify the top 10 purchase objections our target audience might have.
                 For each, provide counter-arguments and proof points.
                 Output as JSON: objections[], counter_arguments[]`,
        model: 'qwen3.5:4b',
        maxTokens: 2000,
      },
      {
        label: 'Audience Deep Dive',
        prompt: `Create a detailed audience profile based on:
                 Desires: {output_0}
                 Objections: {output_1}

                 Include: demographics, psychographics, preferred content, communication style,
                 trusted sources, pain triggers, aspiration triggers
                 Output as detailed JSON profile`,
        model: 'qwen3.5:4b',
        maxTokens: 2500,
      },
    ]);

    // Phase 2: Creative Direction
    const creativeItems = await addItemsToQueue(queue.id, [
      {
        label: 'Taste & Creative Direction',
        prompt: `Based on audience profile: {output_2}

                 Define creative direction for ad campaign:
                 - Visual style (colors, imagery, tone)
                 - Copy tone and voice
                 - Emotional hooks
                 - Positioning angle
                 - Differentiation vs competitors

                 Output as structured JSON with specific guidance`,
        model: 'qwen3.5:4b',
        temperature: 0.8,
        maxTokens: 2000,
        dependsOnIds: [researchItems[2].id],
      },
    ]);

    // Phase 3: Ad Concept Generation
    const conceptItems = await addItemsToQueue(queue.id, [
      {
        label: 'Generate 5 Ad Concepts',
        prompt: `Create 5 distinct ad concepts addressing:
                 Audience Desires: {output_0}
                 Key Objections to Address: {output_1}
                 Audience Profile: {output_2}
                 Creative Direction: {output_3}

                 For EACH concept provide:
                 - Headline
                 - Body copy (2-3 sentences)
                 - Call-to-action
                 - Why this appeals to audience
                 - Which objection it addresses

                 Make them diverse and test different angles.`,
        model: 'qwen3.5:9b',
        temperature: 0.9,
        maxTokens: 3000,
        dependsOnIds: [creativeItems[0].id],
      },
    ]);

    // Phase 4: Concept Evaluation
    const evaluationItems = await addItemsToQueue(queue.id, [
      {
        label: 'Evaluate & Rank Concepts',
        prompt: `Evaluate these 5 ad concepts: {output_4}

                 For each, rate on:
                 - Relevance to audience desires (1-10)
                 - Strength of objection handling (1-10)
                 - Creative uniqueness (1-10)
                 - Likelihood to convert (1-10)

                 Identify the top 2 concepts.
                 Suggest improvements for each top concept.

                 Output as JSON with rankings and detailed feedback.`,
        model: 'qwen3.5:9b',
        maxTokens: 2000,
        dependsOnIds: [conceptItems[0].id],
      },
    ]);

    // Phase 5: Polish & Finalize
    const finalItems = await addItemsToQueue(queue.id, [
      {
        label: 'Polish Top Concepts',
        prompt: `Polish the top 2 concepts based on feedback: {output_5}

                 For each:
                 - Refine headline for maximum impact
                 - Tighten copy while maintaining persuasion
                 - Optimize CTA for conversion
                 - Add social proof/credibility elements
                 - Ensure no grammatical issues

                 Output as final, production-ready ad copy in JSON format.`,
        model: 'qwen3.5:9b',
        temperature: 0.6,
        maxTokens: 1500,
        dependsOnIds: [evaluationItems[0].id],
      },
      {
        label: 'Create Copy Variations',
        prompt: `For the top concept, create 3 variations:
                 {output_6}

                 Variation 1: Value-focused (emphasize ROI/benefits)
                 Variation 2: Urgency-focused (scarcity/limited time)
                 Variation 3: Social-proof-focused (testimonials/numbers)

                 Keep same headline, vary body and CTA.`,
        model: 'qwen3.5:9b',
        temperature: 0.7,
        maxTokens: 1200,
        dependsOnIds: [finalItems[0].id],
      },
    ]);

    // Execute the entire workflow
    try {
      const result = await executeQueue(queue.id, {
        onProgress: (progress) => {
          console.log(`Campaign workflow: ${progress.percentage}% complete`);
          updateCampaign({
            ...campaign,
            workflowProgress: progress.percentage,
          });
        },
        onItemComplete: (item, output) => {
          console.log(`✓ ${item.label} completed`);
        },
        onItemError: (item, error) => {
          console.error(`✗ ${item.label} failed: ${error}`);
        },
        onQueueComplete: (queue) => {
          // Extract final ads from queue
          const finalAds = queue.items.find((i) => i.label === 'Create Copy Variations');
          if (finalAds?.output) {
            updateCampaign({
              ...campaign,
              adConcepts: JSON.parse(finalAds.output),
              status: 'ready_for_review',
            });
          }
        },
      });

      return result;
    } catch (error) {
      console.error('Campaign workflow failed:', error);
      throw error;
    }
  };

  return (
    <button onClick={startCampaignWorkflow} className="btn btn-primary">
      Start Campaign Workflow
    </button>
  );
}
```

## Example 2: A/B Testing Framework

Set up A/B test variant generation:

```typescript
async function generateABTestVariants() {
  const { createQueue, addItemsToQueue, executeQueue } = useQueuedPrompts();

  const queue = await createQueue('A/B Testing Framework');

  // Original ad
  const originalAd = {
    headline: 'Revolutionary AI Tool for Marketing',
    body: 'Automate your campaigns with AI-powered insights',
    cta: 'Try Free Trial',
  };

  // Generate variants
  await addItemsToQueue(queue.id, [
    {
      label: 'Variant A - Emotion Focus',
      prompt: `Based on this ad: "${originalAd.headline}" / "${originalAd.body}"

               Create a variation that emphasizes emotional benefits and transformation.
               Keep the same product/service, different emotional angle.
               Output format: { headline: string, body: string, cta: string }`,
      model: 'qwen3.5:9b',
      temperature: 0.8,
    },
    {
      label: 'Variant B - Logic Focus',
      prompt: `Based on this ad: "${originalAd.headline}" / "${originalAd.body}"

               Create a variation that emphasizes ROI, data, and logical benefits.
               Keep the same product/service, different rational angle.
               Output format: { headline: string, body: string, cta: string }`,
      model: 'qwen3.5:9b',
      temperature: 0.8,
    },
    {
      label: 'Variant C - Urgency Focus',
      prompt: `Based on this ad: "${originalAd.headline}" / "${originalAd.body}"

               Create a variation that emphasizes scarcity, limited time, and urgency.
               Keep the same product/service, different urgency angle.
               Output format: { headline: string, body: string, cta: string }`,
      model: 'qwen3.5:9b',
      temperature: 0.8,
    },
  ]);

  const result = await executeQueue(queue.id);

  // Extract variants
  const variants = result.items
    .filter((i) => i.label.startsWith('Variant'))
    .map((i) => ({
      name: i.label,
      ad: JSON.parse(i.output || '{}'),
    }));

  return {
    control: originalAd,
    variants,
  };
}
```

## Example 3: Competitive Intelligence Pipeline

Research competitors and synthesize insights:

```typescript
async function competitiveIntelligencePipeline(competitors: string[]) {
  const { createQueue, addItemsToQueue, executeQueue } = useQueuedPrompts();

  const queue = await createQueue(
    'Competitive Intelligence',
    `Analyze ${competitors.length} competitors`,
  );

  // Research each competitor in parallel
  const competitorItems = await addItemsToQueue(
    queue.id,
    competitors.map((competitor) => ({
      label: `Analyze ${competitor}`,
      prompt: `Research ${competitor} and provide:
               - Core value proposition
               - Target audience
               - Pricing strategy
               - Key differentiators
               - Marketing messaging
               - Weaknesses/gaps

               Output as structured JSON.`,
      model: 'qwen3.5:4b',
      maxTokens: 1500,
    })),
  );

  // Set all to execute in parallel (no dependencies)
  queue.parallelExecutionLimit = competitors.length;

  // Synthesis step
  const synthesisOutputs = competitorItems.map((_, i) => `output_${i}`).join(', ');

  await addItemsToQueue(queue.id, [
    {
      label: 'Synthesize Competitive Analysis',
      prompt: `Analyze these competitor profiles: {${synthesisOutputs}}

               Provide:
               1. Market landscape overview
               2. Positioning gaps we can exploit
               3. Feature parity checklist
               4. Pricing strategy recommendations
               5. Marketing angle opportunities

               Output as strategic recommendations JSON.`,
      model: 'qwen3.5:9b',
      temperature: 0.8,
      dependsOnIds: competitorItems.map((i) => i.id),
    },
  ]);

  const result = await executeQueue(queue.id);

  // Extract synthesis
  const synthesis = result.items.find((i) => i.label === 'Synthesize Competitive Analysis');

  return {
    competitorAnalyses: competitorItems.map((item) => ({
      competitor: item.label.replace('Analyze ', ''),
      analysis: JSON.parse(item.output || '{}'),
    })),
    strategicRecommendations: synthesis ? JSON.parse(synthesis.output || '{}') : null,
  };
}
```

## Example 4: Message Testing Matrix

Generate and test multiple messaging angles:

```typescript
async function generateMessageTestingMatrix() {
  const { createQueue, addItemsToQueue, executeQueue } = useQueuedPrompts();

  const benefits = ['save_time', 'save_money', 'increase_revenue'];
  const audiences = ['startups', 'enterprises', 'agencies'];

  const queue = await createQueue('Message Testing Matrix');

  // Create message variants for each benefit × audience combination
  const messageVariants = [];

  for (const benefit of benefits) {
    for (const audience of audiences) {
      const item = await addItemsToQueue(queue.id, [
        {
          label: `Message: ${audience} → ${benefit}`,
          prompt: `Create ad message for:
                   Target: ${audience}
                   Primary benefit: ${benefit}

                   Provide:
                   - Headline (max 10 words)
                   - Body (2-3 sentences)
                   - Why this resonates with audience

                   JSON format.`,
          model: 'qwen3.5:9b',
          temperature: 0.8,
        },
      ]);

      messageVariants.push(item[0].id);
    }
  }

  // Set parallel execution
  queue.parallelExecutionLimit = 9;

  // Evaluation phase
  await addItemsToQueue(queue.id, [
    {
      label: 'Evaluate Message Effectiveness',
      prompt: `Compare these 9 message variants: {${messageVariants.map((_, i) => `output_${i}`).join(', ')}}

               For each:
               - Rate relevance (1-10)
               - Rate persuasiveness (1-10)
               - Identify best-performing audience
               - Suggest improvement

               Create matrix showing top 3 overall messages.

               Output as JSON matrix.`,
      model: 'qwen3.5:9b',
      maxTokens: 2500,
      dependsOnIds: messageVariants,
    },
  ]);

  const result = await executeQueue(queue.id);

  // Extract matrix results
  const matrix = result.items.find(
    (i) => i.label === 'Evaluate Message Effectiveness',
  );

  return {
    variants: result.items.filter((i) => i.label.startsWith('Message:')),
    evaluationMatrix: matrix ? JSON.parse(matrix.output || '{}') : null,
  };
}
```

## Example 5: Real-Time Feedback Loop

Continuous optimization using feedback:

```typescript
async function continuousOptimizationLoop(
  campaign: Campaign,
  feedbackData: FeedbackData,
) {
  const { createQueue, addItemsToQueue, executeQueue } = useQueuedPrompts();

  const queue = await createQueue(
    `${campaign.name} - Optimization Round ${campaign.optimizationRound}`,
  );

  // Analyze recent performance
  const performanceItems = await addItemsToQueue(queue.id, [
    {
      label: 'Analyze Performance Data',
      prompt: `Analyze this campaign performance data:
               ${JSON.stringify(feedbackData, null, 2)}

               Identify:
               - What's working well
               - What's underperforming
               - Audience segments with highest/lowest engagement
               - Recommended optimizations

               Output as JSON analysis.`,
      model: 'qwen3.5:4b',
      maxTokens: 2000,
    },
  ]);

  // Generate improvements
  const improvementItems = await addItemsToQueue(queue.id, [
    {
      label: 'Generate Improved Variants',
      prompt: `Based on performance analysis: {output_0}

               Current campaign: ${campaign.currentAdCopy}

               Generate 3 improved variants:
               1. Fix the main weakness identified
               2. Double-down on what's working
               3. Test completely different angle

               Each variant: { headline, body, cta, reason_for_change }`,
      model: 'qwen3.5:9b',
      temperature: 0.85,
      maxTokens: 2000,
      dependsOnIds: performanceItems.map((i) => i.id),
    },
  ]);

  // Compare variants
  await addItemsToQueue(queue.id, [
    {
      label: 'Predict Performance',
      prompt: `Predict performance of these improved variants: {output_1}

               Based on:
               - Current performance data: {output_0}
               - Historical patterns
               - Variant characteristics

               For each variant estimate:
               - Expected CTR improvement
               - Expected conversion improvement
               - Confidence level
               - Risk assessment

               Recommend which to test first.`,
      model: 'qwen3.5:9b',
      maxTokens: 1500,
      dependsOnIds: improvementItems.map((i) => i.id),
    },
  ]);

  const result = await executeQueue(queue.id);

  return {
    analysis: result.items[0],
    improvedVariants: result.items[1],
    predictions: result.items[2],
    readyToTest: true,
  };
}
```

## Example 6: Custom Hook for Campaign Workflows

Create a reusable hook for your most common workflows:

```typescript
export function useCampaignWorkflow() {
  const { createQueue, addItemsToQueue, executeQueue } = useQueuedPrompts();

  const runFullCampaignWorkflow = async (campaign: Campaign) => {
    const queue = await createQueue(`${campaign.name} - Full Workflow`);

    // Add all workflow items in the correct order
    const researcItems = await addItemsToQueue(queue.id, [
      // Research phase items
    ]);

    const creativeItems = await addItemsToQueue(queue.id, [
      // Creative phase items
      // Some depend on researchItems
    ]);

    const refinementItems = await addItemsToQueue(queue.id, [
      // Refinement phase items
      // Depends on creativeItems
    ]);

    // Execute with progress callback
    return new Promise((resolve, reject) => {
      executeQueue(queue.id, {
        onQueueComplete: (completedQueue) => {
          resolve(completedQueue);
        },
        onItemError: (item, error) => {
          reject(new Error(`${item.label} failed: ${error}`));
        },
      });
    });
  };

  return { runFullCampaignWorkflow };
}

// Usage in component
function CampaignComponent() {
  const { runFullCampaignWorkflow } = useCampaignWorkflow();

  const handleStart = async () => {
    const result = await runFullCampaignWorkflow(campaign);
    console.log('Campaign completed:', result);
  };

  return <button onClick={handleStart}>Start Campaign</button>;
}
```

## Integration Checklist

- [ ] Add types to your type definitions
- [ ] Import useQueuedPrompts in your component
- [ ] Create queues for your workflows
- [ ] Add progress callbacks for UI updates
- [ ] Handle errors with retry logic
- [ ] Store results back to campaign state
- [ ] Test with small queues first
- [ ] Monitor token usage
- [ ] Set up queue history for analytics
- [ ] Create templates for repeated workflows

## Performance Tips

1. **Parallel Execution:** Set appropriate `parallelExecutionLimit`
2. **Model Selection:** Use smaller models for fast analysis, larger for creative
3. **Token Budgets:** Set reasonable `maxTokens` per item
4. **Batching:** Group related items together
5. **Temperature:** Use 0.5-0.7 for analysis, 0.8-1.0 for creative
6. **Timeouts:** Set appropriate timeouts for long-running items
7. **Monitoring:** Subscribe to events for progress updates

