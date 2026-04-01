import { useState, useCallback, useEffect, useRef } from 'react';
import { ollamaService } from '../utils/ollama';

export function useOllama() {
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [output, setOutput] = useState('');

  // Guard against setState after unmount (async generate/checkConnection in-flight).
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const checkConnection = useCallback(async () => {
    try {
      const connected = await ollamaService.checkConnection();
      if (!mountedRef.current) return connected;
      setIsConnected(connected);
      if (!connected) {
        setError('Cannot connect to Ollama. Using remote Cloudflare tunnel.');
      } else {
        setError(null);
      }
      return connected;
    } catch (err) {
      if (!mountedRef.current) return false;
      setIsConnected(false);
      setError('Checking Ollama connection...');
      return false;
    }
  }, []);

  const generate = useCallback(
    async (
      prompt: string,
      systemPrompt: string,
      options?: {
        model?: string;
        signal?: AbortSignal;
        onChunk?: (chunk: string) => void;
      }
    ) => {
      const { model = 'qwen3.5:9b', signal, onChunk } = options || {};
      if (mountedRef.current) {
        setIsLoading(true);
        setError(null);
        setOutput('');
      }

      try {
        const result = await ollamaService.generateStream(prompt, systemPrompt, {
          model,
          signal,
          onChunk: (chunk) => {
            onChunk?.(chunk);
            if (mountedRef.current) setOutput((prev) => prev + chunk);
          },
          onError: (err) => { if (mountedRef.current) setError(err.message); },
        });

        return result;
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Unknown error';
        if (mountedRef.current) setError(errorMsg);
        throw err;
      } finally {
        if (mountedRef.current) setIsLoading(false);
      }
    },
    []
  );

  return {
    isConnected,
    isLoading,
    error,
    output,
    generate,
    checkConnection,
  };
}
