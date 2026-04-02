/**
 * Phase 1 Command Handler — Route and execute Phase 1 commands
 * Integrates with:
 * - Variable substitution (commandRouter)
 * - Reference resolution (commandRouter)
 * - Image batch operations (imageBatchRouter)
 * - Output tracking (outputStore)
 */

import {
  substituteVariables,
  parseReferenceCommand,
  resolveReference,
  type VariableContext,
} from './commandRouter';
import {
  parseImageBatchArgs,
  resolveImageSource,
  formatImageBatchResultMarkdown,
} from './imageBatchRouter';
import {
  storeCommandOutput,
  getLastCommandOutput,
  getAvailableOutputVariables,
} from './outputStore';

export interface Phase1CommandResult {
  success: boolean;
  command: string;
  output: string;
  error?: string;
  tokens?: number;
  model?: string;
}

/**
 * Process a user message through Phase 1 pipeline:
 * 1. Substitute variables ($MODEL, $STAGE, $LAST, etc.)
 * 2. Detect and route special commands (/reference, /image-batch)
 * 3. Track output for variable references
 *
 * Returns either the processed message (for regular messages) or command output.
 */
export async function handlePhase1Message(
  userMessage: string,
  variableContext: VariableContext,
  turnNumber: number,
  model?: string
): Promise<Phase1CommandResult> {
  try {
    // 1. Substitute variables
    const substitutedMessage = await substituteVariables(userMessage, variableContext);

    // 2. Route special commands
    if (substitutedMessage.startsWith('/reference ')) {
      return handleReferenceCommand(substitutedMessage, turnNumber, model);
    }

    if (substitutedMessage.startsWith('/image-batch ')) {
      return handleImageBatchCommand(substitutedMessage, turnNumber, model);
    }

    // 3. Regular message — track and return
    await storeCommandOutput('message', userMessage, substitutedMessage, turnNumber, model);

    return {
      success: true,
      command: 'message',
      output: substitutedMessage,
      model,
    };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      command: 'message',
      output: '',
      error: errorMsg,
    };
  }
}

/**
 * Handle /reference file.md lines 10-20
 */
async function handleReferenceCommand(
  command: string,
  turnNumber: number,
  model?: string
): Promise<Phase1CommandResult> {
  try {
    const args = command.slice('/reference '.length);
    const parsed = parseReferenceCommand(args);

    if (!parsed) {
      const output = 'Invalid /reference syntax.\nUsage: /reference file.md lines 10-20\nOr: /reference file.md section "Header"';
      await storeCommandOutput('reference', args, output, turnNumber, model);
      return {
        success: false,
        command: 'reference',
        output,
        error: 'Invalid syntax',
      };
    }

    const resolved = await resolveReference(parsed.file, parsed.selector);
    if (!resolved) {
      const output = `Could not resolve reference: ${parsed.file}`;
      await storeCommandOutput('reference', args, output, turnNumber, model);
      return {
        success: false,
        command: 'reference',
        output,
        error: 'File or selector not found',
      };
    }

    let output = `Reference content from ${parsed.file}:\n\n${resolved.content}`;
    if (resolved.lineRange) {
      output += `\n\n[Lines ${resolved.lineRange[0]}-${resolved.lineRange[1]}]`;
    }

    await storeCommandOutput('reference', args, output, turnNumber, model);
    return {
      success: true,
      command: 'reference',
      output,
      model,
    };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      command: 'reference',
      output: '',
      error: errorMsg,
    };
  }
}

/**
 * Handle /image-batch folder/ --options
 */
async function handleImageBatchCommand(
  command: string,
  turnNumber: number,
  model?: string
): Promise<Phase1CommandResult> {
  try {
    const args = command.slice('/image-batch '.length);
    const parsed = parseImageBatchArgs(args);

    if (!parsed) {
      const output = 'Invalid /image-batch syntax.\nUsage: /image-batch ~/screenshots/ --depth detailed --colors';
      await storeCommandOutput('image-batch', args, output, turnNumber, model);
      return {
        success: false,
        command: 'image-batch',
        output,
        error: 'Invalid syntax',
      };
    }

    const images = await resolveImageSource(parsed.source);
    if (!images || images.length === 0) {
      const output = `No images found at: ${parsed.source}`;
      await storeCommandOutput('image-batch', args, output, turnNumber, model);
      return {
        success: false,
        command: 'image-batch',
        output,
        error: 'No images found',
      };
    }

    let output: string;
    if (parsed.options.export === 'markdown') {
      output = formatImageBatchResultMarkdown(images, parsed.options);
    } else {
      output = `Found ${images.length} images at ${parsed.source}\n${images.join('\n')}`;
    }

    await storeCommandOutput('image-batch', args, output, turnNumber, model);
    return {
      success: true,
      command: 'image-batch',
      output,
      model,
    };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      command: 'image-batch',
      output: '',
      error: errorMsg,
    };
  }
}

/**
 * Get all available variables for the current session.
 * Used for variable autocomplete / help.
 */
export async function getAvailableVariables() {
  const outputVars = await getAvailableOutputVariables();
  return {
    contextVariables: [
      '$MODEL',
      '$STAGE',
      '$CYCLE',
      '$TIMESTAMP',
      '$TOKENS_USED',
      '$RESEARCH_DEPTH',
      '$MODE',
      '$MEMORY_COUNT',
      '$CANVAS_ITEMS',
    ],
    outputVariables: outputVars,
  };
}
