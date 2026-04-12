/**
 * Wayfarer Performance Benchmark
 * Tests actual search and scraping throughput
 */

const WAYFARER_URL = process.env.WAYFARER_URL || 'http://localhost:8889';
const SEARXNG_URL = process.env.SEARXNG_URL || 'http://localhost:8888';

interface SearchResult {
  url: string;
  title: string;
  snippet: string;
  source: string;
}

interface BenchmarkMetrics {
  query: string;
  totalTime: number;
  searchTime: number;
  scrapeTime: number;
  resultsFound: number;
  resultsScraped: number;
  avgTimePerResult: number;
  avgScrapedPerSecond: number;
  successRate: number;
}

async function benchmarkSearch(query: string, pages: number = 5): Promise<{ results: SearchResult[]; time: number }> {
  const start = Date.now();
  try {
    const response = await fetch(`${WAYFARER_URL}/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, num_pages: pages })
    });

    if (!response.ok) throw new Error(`Search failed: ${response.statusText}`);
    const data = (await response.json()) as { results: SearchResult[] };
    return { results: data.results || [], time: Date.now() - start };
  } catch (error) {
    console.error(`❌ Search failed for "${query}":`, error instanceof Error ? error.message : String(error));
    return { results: [], time: Date.now() - start };
  }
}

async function benchmarkScrape(urls: string[]): Promise<{ successful: number; time: number }> {
  const start = Date.now();
  let successful = 0;

  try {
    const results = await Promise.all(
      urls.map(async (url) => {
        try {
          const response = await fetch(`${WAYFARER_URL}/fetch`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url })
          });
          return response.ok;
        } catch {
          return false;
        }
      })
    );

    successful = results.filter(Boolean).length;
  } catch (error) {
    console.error('Scrape batch failed:', error);
  }

  return { successful, time: Date.now() - start };
}

async function runBenchmark(query: string, pages: number = 5): Promise<BenchmarkMetrics> {
  console.log(`\n📊 Benchmarking: "${query}" (${pages} pages)\n`);

  const start = Date.now();

  // Phase 1: Search
  console.log(`🔍 Searching...`);
  const searchResult = await benchmarkSearch(query, pages);
  const searchTime = searchResult.time;
  const resultsFound = searchResult.results.length;

  console.log(`   ✓ Found ${resultsFound} results in ${searchTime}ms`);

  if (resultsFound === 0) {
    console.log(`   ⚠️  No results found - check Wayfarer connection`);
    return {
      query,
      totalTime: Date.now() - start,
      searchTime,
      scrapeTime: 0,
      resultsFound: 0,
      resultsScraped: 0,
      avgTimePerResult: 0,
      avgScrapedPerSecond: 0,
      successRate: 0
    };
  }

  // Phase 2: Scrape (take top 10 or all if fewer)
  const urlsToScrape = searchResult.results.slice(0, Math.min(10, resultsFound)).map((r) => r.url);
  console.log(`\n📥 Scraping ${urlsToScrape.length} pages...`);

  const scrapeResult = await benchmarkScrape(urlsToScrape);
  const scrapeTime = scrapeResult.time;
  const resultsScraped = scrapeResult.successful;

  console.log(`   ✓ Scraped ${resultsScraped}/${urlsToScrape.length} pages in ${scrapeTime}ms`);

  const totalTime = Date.now() - start;
  const avgTimePerResult = resultsFound > 0 ? totalTime / resultsFound : 0;
  const avgScrapedPerSecond = resultsScraped > 0 ? (resultsScraped / (scrapeTime / 1000)) : 0;
  const successRate = resultsFound > 0 ? resultsScraped / resultsFound : 0;

  return {
    query,
    totalTime,
    searchTime,
    scrapeTime,
    resultsFound,
    resultsScraped,
    avgTimePerResult,
    avgScrapedPerSecond,
    successRate
  };
}

async function main() {
  console.log(`
╔════════════════════════════════════════════════════════════════╗
║              Wayfarer Performance Benchmark                     ║
╚════════════════════════════════════════════════════════════════╝

Testing Configuration:
  Wayfarer URL: ${WAYFARER_URL}
  SearXNG URL: ${SEARXNG_URL}
`);

  // Test queries with different complexity
  const queries = [
    'AI trends 2025',
    'climate change solutions',
    'cryptocurrency regulation',
    'sustainable energy technology',
    'mental health digital interventions'
  ];

  const results: BenchmarkMetrics[] = [];

  for (const query of queries) {
    const metrics = await runBenchmark(query, 5);
    results.push(metrics);
  }

  // Summary
  console.log(`
╔════════════════════════════════════════════════════════════════╗
║                        Summary Report                          ║
╚════════════════════════════════════════════════════════════════╝
`);

  console.log('Query Performance:');
  console.log('─'.repeat(100));
  console.log(
    'Query                              | Time (ms) | Found | Scraped | Speed (pages/s) | Success %'
  );
  console.log('─'.repeat(100));

  let totalTime = 0;
  let totalFound = 0;
  let totalScraped = 0;

  for (const m of results) {
    const speed = m.scrapeTime > 0 ? (m.resultsScraped / (m.scrapeTime / 1000)).toFixed(1) : '0.0';
    const success = ((m.successRate) * 100).toFixed(0);
    console.log(
      `${m.query.padEnd(34)} | ${String(m.totalTime).padEnd(8)} | ${String(m.resultsFound).padEnd(5)} | ${String(m.resultsScraped).padEnd(7)} | ${speed.padEnd(14)} | ${success}%`
    );
    totalTime += m.totalTime;
    totalFound += m.resultsFound;
    totalScraped += m.resultsScraped;
  }

  console.log('─'.repeat(100));

  const avgSpeed = totalScraped > 0 ? (totalScraped / (totalTime / 1000)).toFixed(2) : '0.00';
  const overallSuccess = totalFound > 0 ? ((totalScraped / totalFound) * 100).toFixed(0) : '0';

  console.log(`
Key Metrics:
  Total Results Found:   ${totalFound}
  Total Results Scraped: ${totalScraped}
  Total Time:            ${totalTime}ms (${(totalTime / 1000).toFixed(1)}s)
  Overall Throughput:    ${avgSpeed} pages/second
  Overall Success Rate:  ${overallSuccess}%

Projection (at measured throughput):
  100 sources:  ${Math.round((totalTime / totalFound) * 100)}ms
  500 sources:  ${Math.round((totalTime / totalFound) * 500 / 1000)}s
  1000 sources: ${Math.round((totalTime / totalFound) * 1000 / 1000)}s
  5000 sources: ${Math.round((totalTime / totalFound) * 5000 / 1000)}s
  10K sources:  ${Math.round((totalTime / totalFound) * 10000 / 1000)}s
`);
}

main().catch(console.error);
