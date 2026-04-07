// @ts-nocheck
/**
 * SOURCES_EXAMPLES.tsx — Complete examples for using the enhanced sources system
 *
 * This file demonstrates how to use:
 * - SourcesList with all features
 * - SearchSources with result parsing
 * - citationFormatter for different styles
 * - sourceExporter for multiple formats
 * - inlineCitations for text integration
 */

import { useState } from 'react';
import { SourcesList } from './components/SourcesList';
import { SearchSources } from './components/SearchSources';
import {
  formatCitation,
  generateBibliography,
  type CitationFormat,
} from './utils/citationFormatter';
import {
  exportSources,
  downloadSources,
  copyToClipboard,
  type ExportFormat,
} from './utils/sourceExporter';
import {
  extractCitationMarkers,
  mapCitationsToSources,
  generateInlineCitationHTML,
  generateCitationReferenceList,
} from './utils/inlineCitations';
import type { Source } from './utils/sourceExtractor';

// ════════════════════════════════════════════════════════════════════════════════
// EXAMPLE 1: Basic SourcesList with Default Settings
// ════════════════════════════════════════════════════════════════════════════════

export function Example1_BasicSourcesList() {
  const mockSources: Source[] = [
    {
      url: 'https://www.healthline.com/nutrition/collagen-benefits',
      title: 'Collagen Benefits: A Complete Guide',
      domain: 'healthline.com',
      snippet: 'Collagen is the most abundant protein in your body...',
      relevanceScore: 95,
    },
    {
      url: 'https://www.ncbi.nlm.nih.gov/pmc/articles/PMC6162619/',
      title: 'The Health Benefits of Collagen',
      domain: 'ncbi.nlm.nih.gov',
      snippet: 'A systematic review of collagen supplementation...',
      relevanceScore: 92,
    },
    {
      url: 'https://www.reddit.com/r/Supplements/comments/collagen',
      title: 'Collagen Supplements Discussion',
      domain: 'reddit.com',
      snippet: 'Real user experiences and recommendations...',
      relevanceScore: 78,
    },
  ];

  return (
    <div className="p-4 max-w-2xl">
      <h1 className="text-2xl font-bold mb-4">Example 1: Basic Sources List</h1>
      <SourcesList sources={mockSources} maxVisible={2} variant="modal" />
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════════
// EXAMPLE 2: SourcesList with All Features Enabled
// ════════════════════════════════════════════════════════════════════════════════

export function Example2_AdvancedSourcesList() {
  const mockSources: Source[] = [
    {
      url: 'https://www.ncbi.nlm.nih.gov/pmc/articles/PMC6162619/',
      title: 'Effects of Oral Collagen Peptides on Skin Hydration',
      domain: 'ncbi.nlm.nih.gov',
      snippet: 'This randomized study examined the effects of collagen peptides...',
      relevanceScore: 98,
      fetchedAt: Date.now() - 86400000, // 1 day ago
      contentType: 'application/pdf',
    },
    {
      url: 'https://www.nature.com/articles/s41598-021-12345-6',
      title: 'Collagen Bioavailability and Cellular Uptake',
      domain: 'nature.com',
      snippet: 'The bioavailability of hydrolyzed collagen depends on...',
      relevanceScore: 94,
      fetchedAt: Date.now() - 172800000, // 2 days ago
      contentType: 'text/html',
    },
    {
      url: 'https://www.sciencedirect.com/science/article/pii/S123456789',
      title: 'Clinical Evidence for Collagen Supplementation',
      domain: 'sciencedirect.com',
      snippet: 'Multiple clinical trials have shown positive effects...',
      relevanceScore: 91,
      fetchedAt: Date.now() - 259200000, // 3 days ago
      contentType: 'text/html',
    },
  ];

  return (
    <div className="p-4 max-w-4xl">
      <h1 className="text-2xl font-bold mb-4">Example 2: Advanced Features</h1>
      <SourcesList
        sources={mockSources}
        variant="modal"
        groupByDomain={true}
        sortBy="relevance"
        showCitations={true}
        showMetadata={true}
        maxVisible={2}
      />
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════════
// EXAMPLE 3: Citation Format Selector
// ════════════════════════════════════════════════════════════════════════════════

export function Example3_CitationFormats() {
  const [format, setFormat] = useState<CitationFormat>('APA');

  const source: Source = {
    url: 'https://www.healthline.com/nutrition/collagen-benefits',
    title: 'Collagen Benefits: A Complete Guide',
    domain: 'healthline.com',
    fetchedAt: Date.now(),
  };

  const citationText = formatCitation(source, format);

  return (
    <div className="p-4 max-w-2xl space-y-4">
      <h1 className="text-2xl font-bold">Example 3: Citation Formats</h1>

      {/* Format Selector */}
      <div className="flex gap-2">
        {(['APA', 'MLA', 'Chicago'] as const).map(fmt => (
          <button
            key={fmt}
            onClick={() => setFormat(fmt)}
            className={`px-4 py-2 rounded ${
              format === fmt
                ? 'bg-blue-600 text-white'
                : 'bg-gray-200 text-gray-800 hover:bg-gray-300'
            }`}
          >
            {fmt}
          </button>
        ))}
      </div>

      {/* Citation Output */}
      <div className="bg-gray-50 p-4 rounded border border-gray-200">
        <p className="text-sm font-semibold text-gray-600 mb-2">{format} Format:</p>
        <p className="text-gray-800 italic">{citationText}</p>
      </div>

      {/* All Formats */}
      <div className="space-y-3">
        {(['APA', 'MLA', 'Chicago'] as const).map(fmt => (
          <div key={fmt} className="bg-gray-50 p-3 rounded border border-gray-200">
            <p className="text-xs font-semibold text-gray-600 mb-1">{fmt}:</p>
            <p className="text-sm text-gray-800">{formatCitation(source, fmt)}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════════
// EXAMPLE 4: Export Multiple Formats
// ════════════════════════════════════════════════════════════════════════════════

export function Example4_ExportFormats() {
  const [copied, setCopied] = useState(false);

  const mockSources: Source[] = [
    {
      url: 'https://example1.com',
      title: 'Source 1',
      domain: 'example1.com',
    },
    {
      url: 'https://example2.com',
      title: 'Source 2',
      domain: 'example2.com',
    },
  ];

  const handleCopy = async (format: ExportFormat) => {
    await copyToClipboard(mockSources, format);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="p-4 max-w-2xl space-y-4">
      <h1 className="text-2xl font-bold">Example 4: Export Formats</h1>

      {/* Export Buttons */}
      <div className="grid grid-cols-2 gap-2">
        {(['JSON', 'CSV', 'BibTeX', 'Bibliography'] as const).map(format => (
          <button
            key={format}
            onClick={() => {
              if (format === 'Bibliography') {
                downloadSources(mockSources, format);
              } else {
                handleCopy(format);
              }
            }}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            {format === 'Bibliography' ? 'Download' : 'Copy'} {format}
          </button>
        ))}
      </div>

      {copied && (
        <p className="text-green-600 font-semibold">Copied to clipboard!</p>
      )}

      {/* Format Previews */}
      <div className="space-y-3">
        <div className="bg-gray-50 p-3 rounded border border-gray-200">
          <p className="font-semibold text-sm mb-2">JSON Preview:</p>
          <pre className="text-xs overflow-auto max-h-40 bg-white p-2 rounded border border-gray-200">
            {JSON.stringify(mockSources, null, 2)}
          </pre>
        </div>

        <div className="bg-gray-50 p-3 rounded border border-gray-200">
          <p className="font-semibold text-sm mb-2">CSV Preview:</p>
          <pre className="text-xs overflow-auto max-h-40 bg-white p-2 rounded border border-gray-200">
            {exportSources(mockSources, 'CSV')}
          </pre>
        </div>

        <div className="bg-gray-50 p-3 rounded border border-gray-200">
          <p className="font-semibold text-sm mb-2">BibTeX Preview:</p>
          <pre className="text-xs overflow-auto max-h-40 bg-white p-2 rounded border border-gray-200">
            {exportSources(mockSources, 'BibTeX')}
          </pre>
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════════
// EXAMPLE 5: Inline Citations in Text
// ════════════════════════════════════════════════════════════════════════════════

export function Example5_InlineCitations() {
  const textWithCitations =
    'Collagen is an essential protein [1] that makes up about 30% of proteins in the human body [2]. Studies show that collagen supplements can improve skin health [3] and joint mobility [1].';

  const mockSources: Source[] = [
    {
      url: 'https://www.ncbi.nlm.nih.gov/pmc/articles/PMC1234567/',
      title: 'The Role of Collagen in Body Structure',
      domain: 'ncbi.nlm.nih.gov',
    },
    {
      url: 'https://www.nature.com/articles/nature12345',
      title: 'Protein Composition and Distribution',
      domain: 'nature.com',
    },
    {
      url: 'https://www.healthline.com/skin-health',
      title: 'Collagen and Skin Health',
      domain: 'healthline.com',
    },
  ];

  // Process citations
  const citations = extractCitationMarkers(textWithCitations);
  const mappedCitations = mapCitationsToSources(citations, mockSources);
  const referenceList = generateCitationReferenceList(mappedCitations);
  const htmlText = generateInlineCitationHTML(textWithCitations, mappedCitations, true);

  return (
    <div className="p-4 max-w-2xl space-y-4">
      <h1 className="text-2xl font-bold">Example 5: Inline Citations</h1>

      {/* Original Text */}
      <div className="bg-blue-50 p-4 rounded border border-blue-200">
        <p className="text-sm font-semibold text-gray-600 mb-2">Original Text:</p>
        <p className="text-gray-800">{textWithCitations}</p>
      </div>

      {/* HTML Rendered */}
      <div className="bg-green-50 p-4 rounded border border-green-200">
        <p className="text-sm font-semibold text-gray-600 mb-2">
          Rendered with Links:
        </p>
        <div
          className="text-gray-800 prose prose-sm"
          dangerouslySetInnerHTML={{ __html: htmlText }}
        />
      </div>

      {/* Reference List */}
      <div className="bg-gray-50 p-4 rounded border border-gray-200">
        <p className="text-sm font-semibold text-gray-600 mb-2">Reference List:</p>
        <pre className="text-xs whitespace-pre-wrap text-gray-800">
          {referenceList}
        </pre>
      </div>

      {/* Citation Statistics */}
      <div className="bg-purple-50 p-4 rounded border border-purple-200">
        <p className="text-sm font-semibold text-gray-600 mb-2">Citation Stats:</p>
        <ul className="text-sm text-gray-800 space-y-1">
          <li>Total citations in text: {citations.length}</li>
          <li>Unique sources cited: {new Set(mappedCitations.map(c => c.index)).size}</li>
          <li>Coverage: {((new Set(mappedCitations.map(c => c.index)).size / mockSources.length) * 100).toFixed(1)}%</li>
        </ul>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════════
// EXAMPLE 6: Search Results with Sources
// ════════════════════════════════════════════════════════════════════════════════

export function Example6_SearchResults() {
  const mockSearchResults = `[web_search] Results for "collagen supplement benefits" (8/10 pages):

Sources:
1. Collagen Benefits: A Complete Guide
   https://www.healthline.com/nutrition/collagen-benefits
   Collagen is a protein that gives your skin elasticity and provides strength to your bones. Learn about the potential benefits of collagen supplements.

2. Does Collagen Really Work? What Research Shows
   https://www.medicalnewstoday.com/articles/329042
   We explain what the research says about collagen supplements and their effects on skin, hair, joints, and gut health.

3. The Complete Guide to Collagen
   https://www.verywell.com/collagen-5203299
   Collagen supplements have become increasingly popular. Here's what you need to know about types, benefits, and side effects.

Extracted content:
Collagen supplements have gained popularity in recent years due to their potential benefits for skin, joints, and gut health...`;

  const handleSourceSelect = (source: any) => {
    console.log('Source selected:', source);
  };

  return (
    <div className="p-4 max-w-2xl">
      <h1 className="text-2xl font-bold mb-4">Example 6: Search Results</h1>
      <SearchSources
        resultText={mockSearchResults}
        onSourceSelect={handleSourceSelect}
      />
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════════
// EXAMPLE 7: Complete Research Report with Sources
// ════════════════════════════════════════════════════════════════════════════════

export function Example7_ResearchReport() {
  const researchFindings = {
    topic: 'Collagen Supplements in Beauty and Wellness',
    summary:
      'Collagen is the most abundant protein in the human body and has numerous applications in beauty and wellness.',
    keyInsights: [
      'Collagen makes up about 30% of protein in the human body [1]',
      'Hydrolyzed collagen peptides show 70-90% bioavailability [2]',
      'Clinical studies demonstrate improvements in skin elasticity [3]',
    ],
  };

  const mockSources: Source[] = [
    {
      url: 'https://www.ncbi.nlm.nih.gov/pmc/articles/PMC6162619/',
      title: 'Collagen in Dermatology',
      domain: 'ncbi.nlm.nih.gov',
      relevanceScore: 98,
      fetchedAt: Date.now() - 86400000,
    },
    {
      url: 'https://www.nature.com/articles/nature12345',
      title: 'Bioavailability of Collagen Peptides',
      domain: 'nature.com',
      relevanceScore: 95,
      fetchedAt: Date.now() - 172800000,
    },
    {
      url: 'https://www.sciencedirect.com/science/article/pii/123456789',
      title: 'Clinical Evidence for Collagen Supplementation',
      domain: 'sciencedirect.com',
      relevanceScore: 92,
      fetchedAt: Date.now() - 259200000,
    },
  ];

  return (
    <div className="p-4 max-w-4xl space-y-6">
      <h1 className="text-3xl font-bold">{researchFindings.topic}</h1>

      <div className="bg-gray-50 p-4 rounded border border-gray-200">
        <p className="text-gray-800">{researchFindings.summary}</p>
      </div>

      <div className="space-y-2">
        <h2 className="text-xl font-bold">Key Insights</h2>
        <ul className="space-y-2">
          {researchFindings.keyInsights.map((insight, idx) => (
            <li key={idx} className="flex gap-2">
              <span className="text-blue-600 font-bold">{idx + 1}.</span>
              <span>{insight}</span>
            </li>
          ))}
        </ul>
      </div>

      <div>
        <h2 className="text-xl font-bold mb-3">Sources</h2>
        <SourcesList
          sources={mockSources}
          variant="modal"
          sortBy="relevance"
          groupByDomain={false}
          maxVisible={3}
        />
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════════
// Example Component Index
// ════════════════════════════════════════════════════════════════════════════════

export const EXAMPLES = [
  { name: 'Basic Sources List', component: Example1_BasicSourcesList },
  { name: 'Advanced Features', component: Example2_AdvancedSourcesList },
  { name: 'Citation Formats', component: Example3_CitationFormats },
  { name: 'Export Formats', component: Example4_ExportFormats },
  { name: 'Inline Citations', component: Example5_InlineCitations },
  { name: 'Search Results', component: Example6_SearchResults },
  { name: 'Research Report', component: Example7_ResearchReport },
];

export function ExamplesGallery() {
  const [selectedExample, setSelectedExample] = useState(0);

  const SelectedComponent = EXAMPLES[selectedExample].component;

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="flex h-screen">
        {/* Sidebar */}
        <div className="w-64 bg-white border-r border-gray-200 p-4 overflow-y-auto">
          <h1 className="text-2xl font-bold mb-4">Sources Examples</h1>
          <nav className="space-y-2">
            {EXAMPLES.map((example, idx) => (
              <button
                key={idx}
                onClick={() => setSelectedExample(idx)}
                className={`w-full text-left px-4 py-2 rounded ${
                  selectedExample === idx
                    ? 'bg-blue-600 text-white font-semibold'
                    : 'text-gray-800 hover:bg-gray-100'
                }`}
              >
                {example.name}
              </button>
            ))}
          </nav>
        </div>

        {/* Main Content */}
        <div className="flex-1 overflow-y-auto bg-white">
          <SelectedComponent />
        </div>
      </div>
    </div>
  );
}
