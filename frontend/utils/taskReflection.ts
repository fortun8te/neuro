/**
 * Task Reflection — LLM-based self-grading for completed tasks
 * After each task, grades performance and stores improvement notes.
 */
import { ollamaService } from './ollama';
import type { TaskLog, TaskReflection } from './taskStore';
import { updateTaskLog } from './taskStore';

// Use a fast model for reflection — doesn't need to be the biggest
const REFLECTION_MODEL = 'qwen3.5:4b';

export async function gradeTask(
  taskLog: TaskLog,
  signal?: AbortSignal,
): Promise<TaskReflection> {
  const duration = taskLog.durationMs
    ? `${(taskLog.durationMs / 1000).toFixed(1)}s`
    : 'unknown duration';

  const toolSummary = taskLog.toolCalls.length > 0
    ? taskLog.toolCalls.slice(0, 20).map(tc =>
        `  ${tc.success ? '+' : 'x'} ${tc.toolName}(${JSON.stringify(tc.args).slice(0, 60)}) [${tc.durationMs}ms]`
      ).join('\n')
    : '  (no tool calls recorded)';

  const resultText = (taskLog.result || taskLog.error || 'No output').slice(0, 400);

  const prompt = `You are critically grading your own task performance. Be honest, specific, and hard on yourself.

TASK: ${taskLog.name}
${taskLog.description ? `GOAL: ${taskLog.description}` : ''}
STATUS: ${taskLog.status}
DURATION: ${duration}

TOOLS USED (${taskLog.toolCalls.length} calls):
${toolSummary}

RESULT/OUTPUT:
${resultText}

Grade yourself on these dimensions (0-10, be harsh):
- goalAchieved: Did you fully complete the task? Missing anything?
- toolEfficiency: Right tools chosen? Too many redundant calls? Parallelized where possible?
- researchQuality: Did you actually verify claims? Enough sources? Or just assumed?

Output ONLY valid JSON:
{
  "goalAchieved": 7,
  "toolEfficiency": 5,
  "researchQuality": 6,
  "overallGrade": "C",
  "whatWorked": ["found relevant information quickly", "used parallel search"],
  "whatFailed": ["made 4 redundant file reads", "didn't verify the main claim"],
  "improvements": ["use batch_read instead of sequential file_read calls", "always fact_check research results", "fewer tool calls = faster execution"],
  "summary": "Completed the core task but wasted time on redundant reads and skipped verification."
}`;

  let output = '';
  await ollamaService.generateStream(
    prompt,
    'Output ONLY valid JSON. No markdown fences, no commentary, just the JSON object.',
    {
      model: REFLECTION_MODEL,
      onChunk: (chunk: string) => { output += chunk; },
      signal,
    },
  );

  // Parse — strip markdown fences if present
  const cleaned = output.replace(/```json\n?|\n?```/g, '').trim();
  // Extract JSON object
  const jsonMatch = cleaned.match(/\{[\s\S]*\}/);

  let reflection: TaskReflection;
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]);
      reflection = {
        goalAchieved: Number(parsed.goalAchieved) || 5,
        toolEfficiency: Number(parsed.toolEfficiency) || 5,
        researchQuality: Number(parsed.researchQuality) || 5,
        overallGrade: parsed.overallGrade || 'C',
        whatWorked: Array.isArray(parsed.whatWorked) ? parsed.whatWorked : [],
        whatFailed: Array.isArray(parsed.whatFailed) ? parsed.whatFailed : [],
        improvements: Array.isArray(parsed.improvements) ? parsed.improvements : [],
        summary: String(parsed.summary || ''),
        gradedAt: Date.now(),
      };
    } catch {
      reflection = buildDefaultReflection(taskLog);
    }
  } else {
    reflection = buildDefaultReflection(taskLog);
  }

  // Persist reflection to task log
  await updateTaskLog(taskLog.id, { reflection });

  // If grade is C or lower, save improvement notes to neuroMemory
  const gradeScore = { A: 4, B: 3, C: 2, D: 1, F: 0 }[reflection.overallGrade] ?? 2;
  if (gradeScore <= 2 && reflection.improvements.length > 0) {
    try {
      const { neuroMemory } = await import('./neuroMemory');
      if (neuroMemory.ready) {
        await neuroMemory.remember(
          `Task "${taskLog.name}" grade ${reflection.overallGrade}: ${reflection.improvements.join('; ')}`,
          'principle',
          'task-reflection',
        );
      }
    } catch { /* neuroMemory not available — silent */ }
  }

  return reflection;
}

function buildDefaultReflection(taskLog: TaskLog): TaskReflection {
  return {
    goalAchieved: taskLog.status === 'completed' ? 7 : 2,
    toolEfficiency: 5,
    researchQuality: 5,
    overallGrade: taskLog.status === 'completed' ? 'B' : 'D',
    whatWorked: [],
    whatFailed: taskLog.error ? [taskLog.error.slice(0, 100)] : [],
    improvements: [],
    summary: taskLog.status === 'completed' ? 'Task completed.' : `Task failed: ${taskLog.error || 'unknown error'}`,
    gradedAt: Date.now(),
  };
}
