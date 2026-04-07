/**
 * SourceComponentsDemo — Showcase of enhanced source components
 *
 * Demonstrates all features:
 * - SourcePreview with thumbnails and ratings
 * - SourceChip in-text citations
 * - SourceFooter with multiple sources
 * - Light/Dark mode switching
 * - Interactive rating system
 */

import { useState } from 'react';
import { SourceFooter } from './SourceFooter';
import { SourceChip } from './SourcePreview';
import type { Source } from '../utils/sourceExtractor';

/**
 * Sample sources with metadata
 */
const SAMPLE_SOURCES: Source[] = [
  {
    url: 'https://www.wikipedia.org/wiki/Sustainable_fashion',
    title: 'Sustainable Fashion — Wikipedia',
    domain: 'wikipedia.org',
    snippet: 'Sustainable fashion is a movement and process of reforming the fashion industry towards greater ecological integrity and social justice.',
  },
  {
    url: 'https://www.mckinsey.com/industries/retail/our-insights/the-future-of-fashion',
    title: 'The Future of Fashion',
    domain: 'mckinsey.com',
    snippet: 'McKinsey research shows that consumers are increasingly willing to pay a premium for sustainable fashion products...',
  },
  {
    url: 'https://github.com/awesome-sustainable/fashion-resources',
    title: 'Awesome Sustainable Fashion Resources',
    domain: 'github.com',
    snippet: 'A curated list of resources for sustainable fashion including libraries, tools, and community initiatives.',
  },
  {
    url: 'https://www.reddit.com/r/sustainable-fashion',
    title: 'Sustainable Fashion Community',
    domain: 'reddit.com',
    snippet: 'Community discussions about sustainable fashion brands, practices, and consumer experiences.',
  },
  {
    url: 'https://medium.com/sustainable-living/ethical-fashion-guide',
    title: 'Ethical Fashion Guide for Consumers',
    domain: 'medium.com',
    snippet: 'An in-depth guide on selecting ethical fashion brands and understanding supply chain practices.',
  },
  {
    url: 'https://www.example.com/collagen-supplement-study',
    title: 'Collagen Peptides and Skin Elasticity Study',
    domain: 'example.com',
    snippet: 'New research on collagen bioavailability shows improved skin hydration with `collagen peptides` supplementation.',
  },
  {
    url: 'https://www.stanford.edu/research/consumer-behavior',
    title: 'Consumer Behavior Research Lab',
    domain: 'stanford.edu',
    snippet: 'Stanford university research on how sustainable certifications influence purchase decisions.',
  },
  {
    url: 'https://www.theguardian.com/fashion/sustainability',
    title: 'The Guardian - Sustainable Fashion Coverage',
    domain: 'theguardian.com',
    snippet: 'Investigative journalism on the environmental impact of fast fashion and alternatives.',
  },
];

/**
 * Demo component showing all features
 */
export function SourceComponentsDemo() {
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [selectedVariant, setSelectedVariant] = useState<'inline' | 'stacked'>('inline');
  const [maxVisible, setMaxVisible] = useState(6);

  return (
    <div
      style={{
        padding: 40,
        backgroundColor: isDarkMode ? '#0f0f0f' : '#ffffff',
        color: isDarkMode ? '#ffffff' : '#000000',
        minHeight: '100vh',
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }}
    >
      <div style={{ maxWidth: 900, margin: '0 auto' }}>
        {/* Header */}
        <div style={{ marginBottom: 40 }}>
          <h1 style={{ fontSize: 32, fontWeight: 700, marginBottom: 8 }}>
            Source Components Showcase
          </h1>
          <p style={{ fontSize: 14, opacity: 0.7, marginBottom: 20 }}>
            Interactive demo of enhanced source components with thumbnails, ratings, and syntax highlighting
          </p>

          {/* Controls */}
          <div
            style={{
              display: 'flex',
              gap: 16,
              alignItems: 'center',
              flexWrap: 'wrap',
              padding: 16,
              backgroundColor: isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
              borderRadius: 8,
              border: `1px solid ${isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
            }}
          >
            {/* Dark mode toggle */}
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={isDarkMode}
                onChange={(e) => setIsDarkMode(e.target.checked)}
                style={{ cursor: 'pointer' }}
              />
              <span style={{ fontSize: 12, fontWeight: 500 }}>Dark Mode</span>
            </label>

            {/* Variant selector */}
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <span style={{ fontSize: 12, fontWeight: 500 }}>Variant:</span>
              {(['inline', 'stacked'] as const).map((v) => (
                <button
                  key={v}
                  onClick={() => setSelectedVariant(v)}
                  style={{
                    padding: '4px 12px',
                    borderRadius: 4,
                    border: selectedVariant === v ? '2px solid #3b82f6' : '1px solid #e5e7eb',
                    background: selectedVariant === v ? '#3b82f6' : 'transparent',
                    color: selectedVariant === v ? '#ffffff' : 'inherit',
                    cursor: 'pointer',
                    fontSize: 12,
                    fontWeight: 500,
                    transition: 'all 150ms ease',
                  }}
                >
                  {v}
                </button>
              ))}
            </div>

            {/* Max visible slider */}
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <span style={{ fontSize: 12, fontWeight: 500 }}>Max Visible:</span>
              <input
                type="range"
                min="3"
                max={SAMPLE_SOURCES.length}
                value={maxVisible}
                onChange={(e) => setMaxVisible(Number(e.target.value))}
                style={{ width: 100 }}
              />
              <span style={{ fontSize: 11, fontWeight: 600, minWidth: 30 }}>{maxVisible}</span>
            </div>
          </div>
        </div>

        {/* Section 1: In-Text Citations */}
        <div style={{ marginBottom: 50 }}>
          <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 16 }}>
            Section 1: In-Text Citations (SourceChip)
          </h2>
          <p style={{ fontSize: 14, lineHeight: 1.6, marginBottom: 20 }}>
            Sustainable fashion has become increasingly important. According to{' '}
            <SourceChip
              url="https://www.mckinsey.com/industries/retail/our-insights/the-future-of-fashion"
              title="The Future of Fashion — McKinsey"
              snippet="McKinsey research shows that consumers are increasingly willing to pay a premium..."
              quality={5}
            />
            , consumer demand is driving the market towards eco-friendly practices. Many brands are now implementing{' '}
            <SourceChip
              url="https://www.wikipedia.org/wiki/Sustainable_fashion"
              title="Sustainable Fashion — Wikipedia"
              snippet="Sustainable fashion is a movement and process of reforming the fashion industry..."
              quality={4}
            />
            circular economy models to reduce waste and improve their environmental impact.
          </p>

          <p style={{ fontSize: 14, lineHeight: 1.6 }}>
            Research from{' '}
            <SourceChip
              url="https://github.com/awesome-sustainable/fashion-resources"
              title="Awesome Sustainable Fashion Resources"
              snippet="A curated list of resources including libraries, tools, and community initiatives..."
              quality={3}
            />
            shows that developers are creating tools to help consumers understand supply chains. Additionally,{' '}
            <SourceChip
              url="https://www.stanford.edu/research/consumer-behavior"
              title="Consumer Behavior Research Lab — Stanford"
              snippet="Stanford university research on how sustainable certifications influence purchase..."
              quality={5}
            />
            demonstrates that certification labels drive purchasing decisions.
          </p>

          <div style={{ fontSize: 12, color: 'rgba(107, 114, 128, 0.8)', marginTop: 16 }}>
            Try hovering over the source chips to see the preview tooltip with title, snippet, and quality rating.
          </div>
        </div>

        {/* Section 2: Message Footer Sources */}
        <div
          style={{
            padding: 20,
            backgroundColor: isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
            borderRadius: 8,
            border: `1px solid ${isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
            marginBottom: 50,
          }}
        >
          <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 16 }}>
            Section 2: Message Footer Sources
          </h2>

          <div style={{ marginBottom: 20 }}>
            <p style={{ fontSize: 14, lineHeight: 1.6, marginBottom: 20 }}>
              Based on comprehensive research across multiple sources, the sustainable fashion market is experiencing
              rapid growth. Consumer preferences are shifting towards environmentally conscious brands, with a significant
              portion of the market willing to pay premium prices for ethically produced clothing.
            </p>

            {/* Footer with all sources */}
            <SourceFooter
              sources={SAMPLE_SOURCES}
              isDarkMode={isDarkMode}
              variant={selectedVariant}
              maxVisible={maxVisible}
              showQuality={true}
            />
          </div>

          <div style={{ fontSize: 12, color: 'rgba(107, 114, 128, 0.8)', marginTop: 16 }}>
            The footer above shows {SAMPLE_SOURCES.length} unique sources with automatic quality estimation based on
            domain type (.edu, .org, .gov = 5 stars, etc.). Try hovering over source badges to see snippets, and click
            the "+N more" button to expand the list.
          </div>
        </div>

        {/* Section 3: Features */}
        <div style={{ marginBottom: 40 }}>
          <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 16 }}>
            Features Demonstrated
          </h2>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
              gap: 16,
            }}
          >
            {[
              {
                title: 'Favicon Display',
                description: 'DuckDuckGo icon API with smart fallback handling',
              },
              {
                title: 'Quality Rating',
                description: 'Auto-estimated 1-5 star ratings based on domain type',
              },
              {
                title: 'Snippet Preview',
                description: 'On-hover preview with syntax highlighting for code blocks',
              },
              {
                title: 'Hover States',
                description: 'Smooth animations, elevation, and color transitions',
              },
              {
                title: 'Dark/Light Mode',
                description: 'Automatic theme detection with theme-aware colors',
              },
              {
                title: 'Expandable List',
                description: 'Collapsible "+N more" button for many sources',
              },
              {
                title: 'Deduplication',
                description: 'Automatic removal of duplicate domains',
              },
              {
                title: 'Interactive Ratings',
                description: 'Click stars in preview tooltip to set custom ratings',
              },
              {
                title: 'Variants',
                description: 'Inline or stacked layout options',
              },
            ].map((feature, i) => (
              <div
                key={i}
                style={{
                  padding: 14,
                  borderRadius: 6,
                  backgroundColor: isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
                  border: `1px solid ${isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
                }}
              >
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
                  {feature.title}
                </div>
                <div style={{ fontSize: 12, opacity: 0.7 }}>
                  {feature.description}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            padding: 16,
            borderTop: `1px solid ${isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
            fontSize: 12,
            opacity: 0.6,
          }}
        >
          <p>
            For more details, see <code>SOURCES_COMPONENTS_GUIDE.md</code> for complete API documentation and
            integration examples.
          </p>
        </div>
      </div>
    </div>
  );
}

export default SourceComponentsDemo;
