/**
 * Real Wayfarer Performance Benchmark
 * Tests actual working endpoints (analyze-page)
 */

const WAYFARER_URL = process.env.WAYFARER_URL || 'http://100.74.135.83:8891';

interface AnalysisResult {
  url: string;
  image_base64?: string;
  analysis?: string;
  metadata?: Record<string, any>;
}

interface PageBenchmark {
  url: string;
  time: number;
  success: boolean;
  dataSize: number;
  error?: string;
}

async function analyzePage(url: string): Promise<PageBenchmark> {
  const start = Date.now();
  try {
    const response = await fetch(`${WAYFARER_URL}/analyze-page`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url })
    });

    if (!response.ok) {
      return {
        url,
        time: Date.now() - start,
        success: false,
        dataSize: 0,
        error: `HTTP ${response.status}`
      };
    }

    const text = await response.text();
    const time = Date.now() - start;

    return {
      url,
      time,
      success: true,
      dataSize: text.length
    };
  } catch (error) {
    return {
      url,
      time: Date.now() - start,
      success: false,
      dataSize: 0,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

async function main() {
  const testUrls = [
    'https://wikipedia.org/wiki/Artificial_intelligence',
    'https://www.bbc.com/future/article/20250101-ai-trends-2025',
    'https://www.theguardian.com/technology/artificialintelligence',
    'https://www.nature.com/articles/nature12373',
    'https://arxiv.org/abs/2301.00774',
    'https://www.techcrunch.com/tag/artificial-intelligence',
    'https://openai.com/research',
    'https://www.deepmind.com',
    'https://github.com/openai/gpt-4',
    'https://huggingface.co/models'
  ];

  console.log(`
╔════════════════════════════════════════════════════════════════╗
║          Real Wayfarer Performance Benchmark                   ║
║                  (Visual Analysis Mode)                        ║
╚════════════════════════════════════════════════════════════════╝

Wayfarer URL: ${WAYFARER_URL}
Testing ${testUrls.length} pages...
`);

  const results: PageBenchmark[] = [];

  for (let i = 0; i < testUrls.length; i++) {
    const url = testUrls[i];
    process.stdout.write(`[${i + 1}/${testUrls.length}] Analyzing ${url.substring(0, 50)}... `);

    const result = await analyzePage(url);
    results.push(result);

    if (result.success) {
      console.log(`✓ ${result.time}ms (${(result.dataSize / 1024).toFixed(1)}KB)`);
    } else {
      console.log(`✗ ${result.error}`);
    }
  }

  // Analysis
  const successful = results.filter((r) => r.success);
  const failed = results.filter((r) => !r.success);
  const totalTime = successful.reduce((sum, r) => sum + r.time, 0);
  const totalData = successful.reduce((sum, r) => sum + r.dataSize, 0);
  const avgTime = successful.length > 0 ? totalTime / successful.length : 0;
  const avgData = successful.length > 0 ? totalData / successful.length : 0;

  console.log(`
╔════════════════════════════════════════════════════════════════╗
║                      Performance Summary                       ║
╚════════════════════════════════════════════════════════════════╝

Results:
  Successful: ${successful.length}/${testUrls.length}
  Failed:     ${failed.length}/${testUrls.length}

Timing:
  Total time:  ${totalTime}ms (${(totalTime / 1000).toFixed(2)}s)
  Avg/page:    ${avgTime.toFixed(0)}ms
  Min/page:    ${successful.length > 0 ? Math.min(...successful.map((r) => r.time)) : 0}ms
  Max/page:    ${successful.length > 0 ? Math.max(...successful.map((r) => r.time)) : 0}ms

Data Transfer:
  Total data:  ${(totalData / 1024 / 1024).toFixed(2)}MB
  Avg/page:    ${(avgData / 1024).toFixed(1)}KB

Throughput:
  Pages/sec:   ${(1000 / avgTime).toFixed(2)} pages/s
  MB/sec:      ${(totalData / 1024 / 1024 / (totalTime / 1000)).toFixed(2)} MB/s

Projections (at measured throughput):
  50 pages:    ${(50 * avgTime / 1000).toFixed(1)}s
  100 pages:   ${(100 * avgTime / 1000).toFixed(1)}s
  500 pages:   ${(500 * avgTime / 1000).toFixed(1)}s
  1000 pages:  ${(1000 * avgTime / 1000).toFixed(1)}s
  5000 pages:  ${(5000 * avgTime / 1000).toFixed(1)}s
  10K pages:   ${(10000 * avgTime / 1000).toFixed(1)}s

Data Volume Projections:
  1000 pages:  ${(1000 * avgData / 1024 / 1024).toFixed(1)}MB
  5000 pages:  ${(5000 * avgData / 1024 / 1024).toFixed(1)}MB
  10K pages:   ${(10000 * avgData / 1024 / 1024).toFixed(1)}MB
`);

  if (failed.length > 0) {
    console.log(`Failed URLs:`);
    failed.forEach((r) => {
      console.log(`  • ${r.url}: ${r.error}`);
    });
  }
}

main().catch(console.error);
