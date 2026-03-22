/**
 * Freepik Image Generator Client
 *
 * Calls the freepik_server.py backend (port 8890) which automates
 * Freepik Pikaso via Playwright. Streams NDJSON progress events
 * for real-time UI feedback (including server busy warnings).
 *
 * Usage:
 *   const result = await generateImage({
 *     prompt: 'A sleek cologne ad with dark background',
 *     model: 'nano-banana-2',
 *     onProgress: (msg) => setProgress(msg),
 *     onWarning: (msg) => console.warn(msg),
 *     onEtaUpdate: (secs) => setEta(secs),
 *   });
 */

const FREEPIK_SERVER = 'http://localhost:8890';

export interface GenerateImageResult {
  imageBase64: string;          // First image (backward compat)
  imagesBase64?: string[];      // All images when count > 1
  success: boolean;
  error?: string;
}

export interface GenerateImageOptions {
  prompt: string;
  model?: string;
  aspectRatio?: string;  // '1:1' | '9:16' | '16:9' | '4:5' | etc.
  count?: number;  // images per generation (1 = single image, Freepik default can be 2)
  style?: string;  // style tag: 'photo', 'illustration', '3d', etc. → prepended as #style in prompt
  styleReference?: string;  // base64 image for Freepik Style slot (custom style)
  referenceImages?: string[];  // base64 images (data URLs or raw base64)
  signal?: AbortSignal;
  onProgress?: (message: string) => void;
  onWarning?: (message: string) => void;
  onEtaUpdate?: (seconds: number) => void;
}

/**
 * Generate an image via Freepik Pikaso.
 * Streams progress updates from the backend server.
 */
export async function generateImage(
  opts: GenerateImageOptions
): Promise<GenerateImageResult> {
  const {
    prompt,
    model = 'nano-banana-2',
    aspectRatio = '1:1',
    count = 1,
    style = '',
    styleReference,
    referenceImages = [],
    signal,
    onProgress,
    onWarning,
    onEtaUpdate,
  } = opts;

  try {
    // Health check with retry (server may be auto-starting)
    let serverReady = false;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const health = await fetch(`${FREEPIK_SERVER}/api/status`, {
          signal: AbortSignal.timeout(3000),
        });
        if (health.ok) { serverReady = true; break; }
      } catch {
        // Not ready yet
      }
      if (attempt < 2) {
        onProgress?.('Waiting for Freepik server to start...');
        await new Promise(r => setTimeout(r, 3000));
      }
    }
    if (!serverReady) {
      return {
        imageBase64: '',
        success: false,
        error: 'Freepik server not reachable. It should auto-start with the dev server — try again in a few seconds.',
      };
    }

    onProgress?.('Connecting to Freepik server...');

    const response = await fetch(`${FREEPIK_SERVER}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt,
        model,
        aspect_ratio: aspectRatio,
        count,
        style,
        style_reference: styleReference || '',
        reference_images: referenceImages,
      }),
      signal,
    });

    if (!response.ok) {
      return {
        imageBase64: '',
        success: false,
        error: `Server error: ${response.status} ${response.statusText}`,
      };
    }

    // Stream NDJSON events
    const reader = response.body?.getReader();
    if (!reader) {
      return { imageBase64: '', success: false, error: 'No response stream' };
    }

    const decoder = new TextDecoder();
    let buffer = '';
    let result: GenerateImageResult = {
      imageBase64: '',
      success: false,
      error: 'No result received',
    };

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // Keep incomplete line in buffer

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const event = JSON.parse(line);
            switch (event.type) {
              case 'progress':
                onProgress?.(event.message);
                break;
              case 'warning':
                onWarning?.(event.message);
                onProgress?.(event.message);
                break;
              case 'eta_update':
                onEtaUpdate?.(event.seconds);
                break;
              case 'complete':
                result = {
                  imageBase64: event.image_base64,
                  imagesBase64: event.images_base64 || [event.image_base64],
                  success: event.success,
                };
                break;
              case 'error': {
                // Handle special error codes
                let errorMsg = event.message;
                if (event.code === 'UNLIMITED_REQUIRED') {
                  errorMsg = `Freepik Unlimited Required: ${event.message}. Please enable unlimited mode in your Freepik account settings before generating images.`;
                }
                result = {
                  imageBase64: '',
                  success: false,
                  error: errorMsg,
                };
                break;
              }
            }
          } catch {
            // Skip malformed JSON lines
          }
        }
      }
    } catch (streamErr) {
      reader.cancel().catch(() => {});
      throw streamErr;
    }

    return result;
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      return { imageBase64: '', success: false, error: 'Cancelled' };
    }
    return {
      imageBase64: '',
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error',
    };
  }
}

/**
 * Check if the Freepik server is running and ready
 */
export async function checkServerStatus(): Promise<boolean> {
  try {
    const resp = await fetch(`${FREEPIK_SERVER}/api/status`, {
      signal: AbortSignal.timeout(3000),
    });
    return resp.ok;
  } catch {
    return false;
  }
}

/**
 * Force-restart the Freepik browser (kills Playwright, next request launches fresh)
 */
export async function restartFreepikBrowser(): Promise<boolean> {
  try {
    const resp = await fetch(`${FREEPIK_SERVER}/api/restart`, {
      method: 'POST',
      signal: AbortSignal.timeout(10000),
    });
    return resp.ok;
  } catch {
    return false;
  }
}

/**
 * Preload Freepik: open browser, navigate, upload refs, set model/aspect/style.
 * Call this while LLM is thinking so generate() can skip setup.
 * Fire-and-forget — streams progress but we don't need to wait for it.
 */
export async function preloadFreepik(opts: {
  model?: string;
  aspectRatio?: string;
  count?: number;
  style?: string;
  styleReference?: string;
  referenceImages?: string[];
  signal?: AbortSignal;
  onProgress?: (message: string) => void;
}): Promise<boolean> {
  const {
    model = 'nano-banana-2',
    aspectRatio = '1:1',
    count = 1,
    style = '',
    styleReference,
    referenceImages = [],
    signal,
    onProgress,
  } = opts;

  try {
    const response = await fetch(`${FREEPIK_SERVER}/api/preload`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        aspect_ratio: aspectRatio,
        count,
        style,
        style_reference: styleReference || '',
        reference_images: referenceImages,
      }),
      signal,
    });

    if (!response.ok || !response.body) return false;

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buf = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split('\n');
        buf = lines.pop() || '';
        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const event = JSON.parse(line);
            if (event.type === 'progress') onProgress?.(event.message);
            if (event.type === 'error') { onProgress?.(event.message); reader.cancel().catch(() => {}); return false; }
            if (event.type === 'complete') { onProgress?.(event.message); return true; }
          } catch { /* skip */ }
        }
      }
    } catch {
      reader.cancel().catch(() => {});
      return false;
    }
    return true;
  } catch {
    return false;
  }
}


/**
 * Nuclear kill — kills Playwright browser + orphaned Chrome processes via OS-level pkill.
 * Use when /api/restart doesn't actually stop the browser.
 */
export async function forceKillFreepik(): Promise<boolean> {
  try {
    const resp = await fetch(`${FREEPIK_SERVER}/api/force-kill`, {
      method: 'POST',
      signal: AbortSignal.timeout(10000),
    });
    return resp.ok;
  } catch {
    return false;
  }
}

/**
 * Get/set auto-minimize setting for the Freepik browser.
 * When true, browser window is minimized on launch (default).
 * When false, browser stays visible for debugging.
 */
export async function getFreepikAutoMinimize(): Promise<boolean> {
  try {
    const resp = await fetch(`${FREEPIK_SERVER}/api/status`, {
      signal: AbortSignal.timeout(3000),
    });
    if (resp.ok) {
      const data = await resp.json();
      return data.auto_minimize ?? true;
    }
    return true;
  } catch {
    return true;
  }
}

export async function setFreepikAutoMinimize(minimize: boolean): Promise<boolean> {
  try {
    const resp = await fetch(`${FREEPIK_SERVER}/api/settings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ auto_minimize: minimize }),
      signal: AbortSignal.timeout(5000),
    });
    return resp.ok;
  } catch {
    return false;
  }
}
