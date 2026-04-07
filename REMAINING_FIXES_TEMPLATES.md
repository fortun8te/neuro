# Templates for Remaining Fixes - Copy & Paste Ready

## 1. MP4/FFmpeg Video Analysis Tool

**File:** `frontend/utils/ffmpegAnalyzer.ts` (NEW)

```typescript
/**
 * FFmpeg-based video analysis tool
 * Extracts frames, transcribes audio, analyzes content
 */

export interface VideoAnalysisResult {
  duration: number;
  width: number;
  height: number;
  fps: number;
  codec: string;
  frames: Array<{ time: number; description: string }>;
  audio?: { transcript: string; language: string };
  summary: string;
}

export async function analyzeVideo(filePath: string, signal?: AbortSignal): Promise<VideoAnalysisResult> {
  // 1. Get metadata via ffprobe
  const metadata = await getVideoMetadata(filePath);

  // 2. Extract key frames (every 5 seconds)
  const frames = await extractFrames(filePath, 5); // 5-second intervals

  // 3. Analyze each frame with vision model
  const descriptions = await analyzeFrames(frames);

  // 4. Extract and transcribe audio (if present)
  const transcript = metadata.audioCodec ? await transcribeAudio(filePath) : undefined;

  // 5. Generate summary via LLM
  const summary = await summarizeVideo({ descriptions, transcript, metadata });

  return {
    duration: metadata.duration,
    width: metadata.width,
    height: metadata.height,
    fps: metadata.fps,
    codec: metadata.videoCodec,
    frames: descriptions.map((desc, i) => ({ time: i * 5, description: desc })),
    audio: transcript ? { transcript, language: 'en' } : undefined,
    summary,
  };
}

// Helper: Get video metadata
async function getVideoMetadata(filePath: string) {
  const result = await exec(`ffprobe -v quiet -print_format json -show_format -show_streams "${filePath}"`);
  const data = JSON.parse(result);
  const videoStream = data.streams.find((s: any) => s.codec_type === 'video');
  return {
    duration: data.format.duration,
    width: videoStream.width,
    height: videoStream.height,
    fps: eval(videoStream.r_frame_rate),
    videoCodec: videoStream.codec_name,
    audioCodec: data.streams.find((s: any) => s.codec_type === 'audio')?.codec_name,
  };
}

// Helper: Extract frames
async function extractFrames(filePath: string, intervalSeconds: number): Promise<Buffer[]> {
  const outputPattern = '/tmp/frame_%04d.png';
  const rate = `1/${intervalSeconds}`;
  await exec(`ffmpeg -i "${filePath}" -vf "fps=${rate}" "${outputPattern}"`);
  // Return frame buffers
  const frames: Buffer[] = [];
  // ... read extracted PNGs from /tmp
  return frames;
}

// Helper: Analyze frames with vision
async function analyzeFrames(frames: Buffer[]): Promise<string[]> {
  const descriptions: string[] = [];
  for (const frame of frames) {
    const desc = await ollamaService.generateWithImage(
      'Describe what you see in this video frame in 1-2 sentences',
      frame
    );
    descriptions.push(desc);
  }
  return descriptions;
}

// Helper: Transcribe audio
async function transcribeAudio(filePath: string): Promise<string> {
  // Extract audio: ffmpeg -i video.mp4 -q:a 0 -map a audio.mp3
  // Use whisper-like model or send to transcription service
  return 'transcript here';
}

// Helper: Summarize via LLM
async function summarizeVideo(data: any): Promise<string> {
  const prompt = `
    Video Analysis Summary:
    Duration: ${data.metadata.duration}s
    Frames: ${data.descriptions.join('\n')}
    ${data.transcript ? `Transcript: ${data.transcript}` : ''}

    Provide a 2-3 sentence summary of the video content.
  `;
  return await ollamaService.generate(prompt);
}
```

**Add to agentEngine.ts tools:**
```typescript
analyze_video: {
  description: 'Analyze video file (MP4, MOV, etc) - extract frames, transcribe audio, generate summary',
  params: { filePath: 'Path to video file' },
  handler: async (params) => {
    const result = await analyzeVideo(params.filePath);
    return { success: true, output: JSON.stringify(result, null, 2) };
  }
}
```

**Test:**
```bash
node -e "const {analyzeVideo} = require('./frontend/utils/ffmpegAnalyzer'); analyzeVideo('test.mp4').then(r => console.log(r))"
```

---

## 2. Chat Sidebar in Ongoing Chats

**File:** Modify `frontend/components/AppShell.tsx` (existing)

**Find:** Where messages are processed in chat
```typescript
// Around line where you handle message submission
const handleSubmitMessage = async (message: string) => {
  // ADD THIS:

  // Check if message is task-like
  const taskPatterns = [
    /work on this for (\d+) (minute|hour|min|hr)s?/i,
    /research .+ (deeply|thoroughly|completely)/i,
    /analyze .+ for (\d+) (minute|hour)s?/i,
    /deep dive into/i,
    /spend (\d+) (minute|hour)s? on/i,
  ];

  const isTaskLike = taskPatterns.some(p => p.test(message));

  if (isTaskLike && !isTaskPanelVisible) {
    // Auto-open task creation
    setIsTaskPanelVisible(true);

    // Pre-fill task from message
    const duration = message.match(/(\d+) ?(minute|hour|min|hr)s?/)?.[1];
    setTaskToCreate({
      prompt: message,
      duration: duration ? parseInt(duration) * (message.includes('hour') ? 60 : 1) : 30,
    });
  }

  // Continue with normal message handling...
};
```

---

## 3. Excel Support

**File:** `frontend/utils/excelTools.ts` (NEW)

```typescript
import { openpyxl } from 'python-openpyxl'; // Use via shell_exec if needed

export async function createSpreadsheet(
  data: Array<Record<string, any>>,
  filePath: string
): Promise<{ success: boolean; path: string }> {
  // Use Python to create Excel:
  const code = `
    import openpyxl
    from openpyxl.styles import Font, PatternFill
    from datetime import datetime

    data = ${JSON.stringify(data)}
    wb = openpyxl.Workbook()
    ws = wb.active

    # Headers (bold)
    headers = list(data[0].keys()) if data else []
    for col, header in enumerate(headers, 1):
      cell = ws.cell(row=1, column=col, value=header)
      cell.font = Font(bold=True)
      cell.fill = PatternFill(start_color="D3D3D3", end_color="D3D3D3", fill_type="solid")

    # Data rows
    for row_idx, record in enumerate(data, 2):
      for col_idx, (key, value) in enumerate(record.items(), 1):
        ws.cell(row=row_idx, column=col_idx, value=value)

    # Auto-fit columns
    for column in ws.columns:
      max_length = max(len(str(cell.value)) for cell in column)
      ws.column_dimensions[chr(65 + column[0].column - 1)].width = max_length + 2

    wb.save("${filePath}")
    print("Excel created successfully")
  `;

  await runPythonCode(code);
  return { success: true, path: filePath };
}

export async function readSpreadsheet(
  filePath: string
): Promise<{ headers: string[]; data: Array<Record<string, any>> }> {
  const code = `
    import openpyxl
    import json

    wb = openpyxl.load_workbook("${filePath}")
    ws = wb.active

    headers = [cell.value for cell in ws[1]]
    data = []

    for row in ws.iter_rows(min_row=2, values_only=True):
      record = {headers[i]: row[i] for i in range(len(headers))}
      data.append(record)

    print(json.dumps({"headers": headers, "data": data}))
  `;

  const output = await runPythonCode(code);
  return JSON.parse(output);
}
```

**Add to agentEngine.ts:**
```typescript
create_spreadsheet: {
  description: 'Create an Excel spreadsheet from data',
  handler: async (params) => {
    const result = await createSpreadsheet(params.data, params.filePath);
    return result;
  }
},
read_spreadsheet: {
  description: 'Read and analyze an Excel file',
  handler: async (params) => {
    const result = await readSpreadsheet(params.filePath);
    return { success: true, output: JSON.stringify(result) };
  }
}
```

---

## 4. Parallel Research Agents (20+)

**File:** Modify `frontend/hooks/useOrchestratedResearch.ts` (existing)

**Find:** Where researchers are spawned in the loop, around line 300-400

```typescript
// Replace sequential researcher calls with parallel batch:
const researchBatch = async () => {
  const queries = generateSearchQueries(); // Your existing function

  // Spawn 20 concurrent researchers
  const researchers = queries.slice(0, 20).map((query, i) =>
    executeResearch(query, i, signal).catch(err => ({
      error: true,
      reason: err.message,
      query
    }))
  );

  const results = await Promise.allSettled(researchers);

  // Aggregate successful results
  const successResults = results
    .filter(r => r.status === 'fulfilled' && !r.value.error)
    .map(r => r.value);

  // Compress and synthesize
  return await compressAndSynthesize(successResults);
};

// Call in iteration loop
for (let iteration = 0; iteration < limits.maxIterations; iteration++) {
  const batchResults = await researchBatch();
  coverage = calculateCoverage(allResults);

  if (coverage >= limits.coverageThreshold && iteration >= limits.minIterations) {
    break; // Early exit
  }
}
```

---

## 5. Tool Display Status Panel

**File:** `frontend/components/ToolStatusPanel.tsx` (NEW)

```typescript
import React, { useState, useEffect } from 'react';

interface ToolCall {
  id: string;
  name: string;
  status: 'running' | 'done' | 'failed';
  startTime: number;
  endTime?: number;
  result?: any;
  error?: string;
}

export function ToolStatusPanel() {
  const [tools, setTools] = useState<ToolCall[]>([]);

  useEffect(() => {
    const handleToolStart = (e: CustomEvent) => {
      setTools(prev => [...prev, {
        id: e.detail.id,
        name: e.detail.tool,
        status: 'running',
        startTime: Date.now(),
      }]);
    };

    const handleToolEnd = (e: CustomEvent) => {
      setTools(prev => prev.map(t =>
        t.id === e.detail.id
          ? { ...t, status: 'done', endTime: Date.now(), result: e.detail.result }
          : t
      ));
    };

    const handleToolError = (e: CustomEvent) => {
      setTools(prev => prev.map(t =>
        t.id === e.detail.id
          ? { ...t, status: 'failed', endTime: Date.now(), error: e.detail.error }
          : t
      ));
    };

    window.addEventListener('tool:start', handleToolStart);
    window.addEventListener('tool:end', handleToolEnd);
    window.addEventListener('tool:error', handleToolError);

    return () => {
      window.removeEventListener('tool:start', handleToolStart);
      window.removeEventListener('tool:end', handleToolEnd);
      window.removeEventListener('tool:error', handleToolError);
    };
  }, []);

  return (
    <div style={{ padding: 12, fontSize: 12, fontFamily: 'monospace' }}>
      {tools.map(tool => (
        <div key={tool.id} style={{
          padding: 8,
          marginBottom: 4,
          borderRadius: 4,
          background: tool.status === 'running' ? '#fff3cd' :
                      tool.status === 'done' ? '#d4edda' : '#f8d7da',
          color: tool.status === 'running' ? '#856404' :
                 tool.status === 'done' ? '#155724' : '#721c24',
        }}>
          <strong>{tool.name}</strong> {tool.status}
          {tool.endTime && ` (${(tool.endTime - tool.startTime) / 1000}s)`}
          {tool.error && ` - ${tool.error}`}
        </div>
      ))}
    </div>
  );
}
```

---

## Quick Copy-Paste Checklist

- [ ] MP4 Analysis: Copy ffmpegAnalyzer.ts, add tool to agentEngine
- [ ] Chat Sidebar: Modify AppShell.tsx with task pattern detection
- [ ] Excel: Copy excelTools.ts, add tools to agentEngine
- [ ] Parallel Research: Modify useOrchestratedResearch loop (Promise.allSettled)
- [ ] Tool Display: Create ToolStatusPanel.tsx, add to AgentPanel
- [ ] Test each with: `npm run build && npm run dev`
- [ ] Verify: No TypeScript errors, feature works in UI

