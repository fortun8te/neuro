/**
 * QuickMenu — Phase 1 Quick Access to Common Commands
 * Features:
 * - Variable substitution ($MODEL, $STAGE, $LAST, etc.)
 * - /reference and /image-batch command handling
 * - Output tracking via outputStore
 */

import { useContext, useState, useCallback } from 'react';
import { CampaignContext } from '../context/CampaignContext';
import {
  substituteVariables,
  parseReferenceCommand,
  resolveReference,
} from '../utils/commandRouter';
import {
  storeCommandOutput,
} from '../utils/outputStore';
import {
  parseImageBatchArgs,
  resolveImageSource,
  formatImageBatchResultMarkdown,
} from '../utils/imageBatchRouter';

interface QuickMenuProps {
  onCommandExecute?: (command: string, result: string) => void;
}

export function QuickMenu({ onCommandExecute }: QuickMenuProps) {
  const campaign = useContext(CampaignContext);
  const [input, setInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastOutput, setLastOutput] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [turnNumber, setTurnNumber] = useState(0);

  const handleCommand = useCallback(
    async (userInput: string) => {
      if (!userInput.trim()) return;

      setIsProcessing(true);
      setError(null);

      try {
        // 1. Build variable context from campaign
        const variableContext = campaign?.variableContext || {
          context: {},
        };

        // 2. Substitute variables in message
        const substitutedMessage = await substituteVariables(
          userInput,
          variableContext
        );

        let output = '';

        // 3. Check for special commands (before parsing slash hints)
        if (substitutedMessage.startsWith('/reference ')) {
          const args = substitutedMessage.slice('/reference '.length);
          const parsed = parseReferenceCommand(args);

          if (!parsed) {
            output = 'Invalid /reference syntax.\nUsage: /reference file.md lines 10-20\nOr: /reference file.md section "Header"';
          } else {
            const resolved = await resolveReference(parsed.file, parsed.selector);
            if (!resolved) {
              output = `Could not resolve reference: ${parsed.file}`;
            } else {
              output = `Reference content from ${parsed.file}:\n\n${resolved.content}`;
              if (resolved.lineRange) {
                output += `\n\n[Lines ${resolved.lineRange[0]}-${resolved.lineRange[1]}]`;
              }
            }
          }

          await storeCommandOutput('reference', args, output, turnNumber, 'system');
          setLastOutput(output);
          if (onCommandExecute) onCommandExecute('reference', output);
        } else if (substitutedMessage.startsWith('/image-batch ')) {
          const args = substitutedMessage.slice('/image-batch '.length);
          const parsed = parseImageBatchArgs(args);

          if (!parsed) {
            output = 'Invalid /image-batch syntax.\nUsage: /image-batch ~/screenshots/ --depth detailed --colors';
          } else {
            const images = await resolveImageSource(parsed.source);
            if (!images || images.length === 0) {
              output = `No images found at: ${parsed.source}`;
            } else {
              if (parsed.options.export === 'markdown') {
                output = formatImageBatchResultMarkdown(images, parsed.options);
              } else {
                output = `Found ${images.length} images at ${parsed.source}\n${images.join('\n')}`;
              }
            }
          }

          await storeCommandOutput('image-batch', args, output, turnNumber, 'system');
          setLastOutput(output);
          if (onCommandExecute) onCommandExecute('image-batch', output);
        } else {
          // 4. For regular messages, just record and pass to callback
          await storeCommandOutput('message', userInput, substitutedMessage, turnNumber, 'user');
          setLastOutput(substitutedMessage);
          if (onCommandExecute) onCommandExecute('message', substitutedMessage);
        }

        setTurnNumber(t => t + 1);
        setInput('');
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        setError(errorMsg);
        console.error('[QuickMenu] Command error:', err);
      } finally {
        setIsProcessing(false);
      }
    },
    [campaign, turnNumber, onCommandExecute]
  );

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      handleCommand(input);
    },
    [input, handleCommand]
  );

  return (
    <div className="quick-menu border border-slate-300 rounded-lg p-4 bg-white">
      <h3 className="text-sm font-semibold text-slate-700 mb-3">Quick Menu</h3>

      {/* Status info */}
      <div className="grid grid-cols-2 gap-2 text-xs mb-3 p-2 bg-slate-50 rounded">
        <div>
          <span className="text-slate-600">Stage:</span>
          <span className="ml-1 font-mono text-slate-800">
            {campaign?.variableContext?.context?.STAGE || '—'}
          </span>
        </div>
        <div>
          <span className="text-slate-600">Cycle:</span>
          <span className="ml-1 font-mono text-slate-800">
            {campaign?.variableContext?.context?.CYCLE || '—'}
          </span>
        </div>
        <div>
          <span className="text-slate-600">Model:</span>
          <span className="ml-1 font-mono text-slate-800">
            {campaign?.variableContext?.context?.MODEL || '—'}
          </span>
        </div>
        <div>
          <span className="text-slate-600">Depth:</span>
          <span className="ml-1 font-mono text-slate-800">
            {campaign?.variableContext?.context?.RESEARCH_DEPTH || '—'}
          </span>
        </div>
      </div>

      {/* Input form */}
      <form onSubmit={handleSubmit} className="space-y-2">
        <textarea
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="Type command or message. Use variables like $STAGE, $MODEL, $LAST. Or /reference file.md or /image-batch folder/"
          className="w-full p-2 border border-slate-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          rows={3}
          disabled={isProcessing}
        />

        <div className="flex gap-2">
          <button
            type="submit"
            disabled={isProcessing || !input.trim()}
            className="px-3 py-1 bg-blue-500 text-white text-sm rounded hover:bg-blue-600 disabled:bg-slate-300"
          >
            {isProcessing ? 'Processing...' : 'Send'}
          </button>
        </div>
      </form>

      {/* Output display */}
      {error && (
        <div className="mt-3 p-2 bg-red-50 border border-red-200 rounded text-sm text-red-700">
          Error: {error}
        </div>
      )}

      {lastOutput && (
        <div className="mt-3 p-2 bg-slate-50 border border-slate-200 rounded text-sm">
          <div className="text-slate-600 font-semibold text-xs mb-1">Last Output</div>
          <pre className="text-xs overflow-auto max-h-40 whitespace-pre-wrap">
            {lastOutput}
          </pre>
        </div>
      )}

      {/* Help */}
      <div className="mt-3 text-xs text-slate-600 space-y-1">
        <div>
          <span className="font-semibold">Variables:</span> $MODEL, $STAGE, $CYCLE,
          $TIMESTAMP, $RESEARCH_DEPTH, $LAST, $TURN_N
        </div>
        <div>
          <span className="font-semibold">Commands:</span> /reference, /image-batch
        </div>
      </div>
    </div>
  );
}
