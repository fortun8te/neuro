/**
 * Fact Checker Unit Tests
 * Validates claim extraction, verification, and flagging logic
 */

import { extractClaimables, flagUnlikelyExperts } from '../factChecker';
import type { ResearchFindings } from '../../types';

describe('Fact Checker', () => {
  describe('extractClaimables', () => {
    it('should extract statistical claims from objections', () => {
      const findings: ResearchFindings = {
        deepDesires: [],
        objections: [
          {
            objection: '71% of customers report satisfaction',
            frequency: 'common',
            impact: 'high',
            handlingApproach: 'address directly',
            requiredProof: [],
          },
        ],
        avatarLanguage: [],
        whereAudienceCongregates: [],
        whatTheyTriedBefore: [],
        competitorWeaknesses: [],
      };

      const claims = extractClaimables(findings);
      expect(claims).toHaveLength(1);
      expect(claims[0].claim).toContain('71%');
      expect(claims[0].claimType).toBe('statistic');
    });

    it('should extract positioning claims from competitors', () => {
      const findings: ResearchFindings = {
        deepDesires: [],
        objections: [],
        avatarLanguage: [],
        whereAudienceCongregates: [],
        whatTheyTriedBefore: [],
        competitorWeaknesses: [],
        competitivePositioning: [
          {
            name: 'Competitor A',
            positioning: 'We are the market leader in premium supplements',
            trappedBy: 'Cannot claim budget-friendly',
            adHooks: [],
            pricing: '$99/month',
            structuralWeakness: 'Premium pricing limits market size',
            whatTheyOwn: 'Quality positioning',
            customerComplaint: 'Most customers struggle with the price point',
          },
        ],
      };

      const claims = extractClaimables(findings);
      expect(claims.length).toBeGreaterThan(0);
      const hasPositioning = claims.some((c) => c.sourceSection === 'competitivePositioning');
      expect(hasPositioning).toBe(true);
    });

    it('should extract claims from verbatim quotes', () => {
      const findings: ResearchFindings = {
        deepDesires: [],
        objections: [],
        avatarLanguage: [],
        whereAudienceCongregates: [],
        whatTheyTriedBefore: [],
        competitorWeaknesses: [],
        verbatimQuotes: [
          'Research shows 89% of users prefer natural ingredients',
          'This is just my opinion about the product',
        ],
      };

      const claims = extractClaimables(findings);
      // Should extract first quote, skip second (opinion)
      const verbatimClaim = claims.find((c) => c.sourceSection === 'verbatimQuotes');
      expect(verbatimClaim?.claim).toContain('89%');
    });

    it('should filter out purely subjective content', () => {
      const findings: ResearchFindings = {
        deepDesires: [],
        objections: [
          {
            objection: 'I think this is a great product for people who prefer premium quality',
            frequency: 'common',
            impact: 'high',
            handlingApproach: 'test',
            requiredProof: [],
          },
        ],
        avatarLanguage: [],
        whereAudienceCongregates: [],
        whatTheyTriedBefore: [],
        competitorWeaknesses: [],
      };

      const claims = extractClaimables(findings);
      // Should filter out opinion-based claim
      expect(claims).toHaveLength(0);
    });

    it('should extract timeline claims from purchase journey', () => {
      const findings: ResearchFindings = {
        deepDesires: [],
        objections: [],
        avatarLanguage: [],
        whereAudienceCongregates: [],
        whatTheyTriedBefore: [],
        competitorWeaknesses: [],
        purchaseJourney: {
          searchTerms: [],
          reviewSites: [],
          comparisonCriteria: [],
          decisionInfluencers: [],
          abandonmentReasons: [],
          typicalTimeline: '2 weeks from awareness to purchase',
          firstTouchpoint: 'Google search',
          finalTrigger: 'Customer testimonial',
        },
      };

      const claims = extractClaimables(findings);
      const timelineClaim = claims.find((c) => c.sourceSection === 'purchaseJourney');
      expect(timelineClaim?.claim).toContain('2 weeks');
    });
  });

  describe('flagUnlikelyExperts', () => {
    it('should flag Reddit as authority for medical claims', () => {
      const findings: ResearchFindings = {
        deepDesires: [],
        objections: [
          {
            objection: 'FDA approval for safety claims',
            frequency: 'common',
            impact: 'high',
            handlingApproach: 'verify',
            requiredProof: [],
          },
        ],
        avatarLanguage: [],
        whereAudienceCongregates: ['r/health', 'r/supplements'],
        whatTheyTriedBefore: [],
        competitorWeaknesses: [],
      };

      const flags = flagUnlikelyExperts(findings);
      const hasAuthFlag = flags.some((f) => f.flag === 'low-authority');
      expect(hasAuthFlag).toBe(true);
    });

    it('should flag unattributed statistical claims', () => {
      const findings: ResearchFindings = {
        deepDesires: [],
        objections: [
          {
            objection: 'Studies show 85% customer satisfaction',
            frequency: 'common',
            impact: 'high',
            handlingApproach: 'verify',
            requiredProof: [],
          },
        ],
        avatarLanguage: [],
        whereAudienceCongregates: [],
        whatTheyTriedBefore: [],
        competitorWeaknesses: [],
      };

      const flags = flagUnlikelyExperts(findings);
      const hasAttribFlag = flags.some((f) => f.flag === 'requires-attribution');
      expect(hasAttribFlag).toBe(true);
    });

    it('should not flag properly sourced claims', () => {
      const findings: ResearchFindings = {
        deepDesires: [],
        objections: [],
        avatarLanguage: [],
        whereAudienceCongregates: ['Harvard research database', 'NIH publications'],
        whatTheyTriedBefore: [],
        competitorWeaknesses: [],
        competitivePositioning: [
          {
            name: 'Competitor',
            positioning: 'Industry standard ISO certification',
            trappedBy: 'Cannot claim budget',
            adHooks: [],
            pricing: '$50',
            structuralWeakness: 'None noted',
            whatTheyOwn: 'Premium',
            customerComplaint: 'Positive feedback',
          },
        ],
      };

      const flags = flagUnlikelyExperts(findings);
      expect(flags.length).toBeLessThan(3); // Should have minimal flags for academic sources
    });
  });

  describe('claim filtering', () => {
    it('should skip very short claims', () => {
      const findings: ResearchFindings = {
        deepDesires: [],
        objections: [
          {
            objection: 'Good',
            frequency: 'common',
            impact: 'high',
            handlingApproach: 'test',
            requiredProof: [],
          },
        ],
        avatarLanguage: [],
        whereAudienceCongregates: [],
        whatTheyTriedBefore: [],
        competitorWeaknesses: [],
      };

      const claims = extractClaimables(findings);
      expect(claims).toHaveLength(0);
    });

    it('should extract minimum-length valid claims', () => {
      const findings: ResearchFindings = {
        deepDesires: [],
        objections: [
          {
            objection: 'Market growing 15% annually',
            frequency: 'common',
            impact: 'high',
            handlingApproach: 'test',
            requiredProof: [],
          },
        ],
        avatarLanguage: [],
        whereAudienceCongregates: [],
        whatTheyTriedBefore: [],
        competitorWeaknesses: [],
      };

      const claims = extractClaimables(findings);
      expect(claims.length).toBeGreaterThan(0);
      expect(claims[0].claim.length).toBeGreaterThanOrEqual(10);
    });
  });

  describe('claim metadata', () => {
    it('should assign unique IDs to claims', () => {
      const findings: ResearchFindings = {
        deepDesires: [],
        objections: [
          {
            objection: 'First stat: 50% adoption rate',
            frequency: 'common',
            impact: 'high',
            handlingApproach: 'test',
            requiredProof: [],
          },
          {
            objection: 'Second stat: 75% conversion rate',
            frequency: 'common',
            impact: 'high',
            handlingApproach: 'test',
            requiredProof: [],
          },
        ],
        avatarLanguage: [],
        whereAudienceCongregates: [],
        whatTheyTriedBefore: [],
        competitorWeaknesses: [],
      };

      const claims = extractClaimables(findings);
      const ids = claims.map((c) => c.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length); // All IDs should be unique
    });

    it('should set correct source section and index', () => {
      const findings: ResearchFindings = {
        deepDesires: [],
        objections: [
          {
            objection: 'First objection with 30% stat',
            frequency: 'common',
            impact: 'high',
            handlingApproach: 'test',
            requiredProof: [],
          },
        ],
        avatarLanguage: [],
        whereAudienceCongregates: [],
        whatTheyTriedBefore: [],
        competitorWeaknesses: [],
      };

      const claims = extractClaimables(findings);
      const claim = claims[0];
      expect(claim.sourceSection).toBe('objections');
      expect(claim.sourceIndex).toBe(0);
    });
  });
});
