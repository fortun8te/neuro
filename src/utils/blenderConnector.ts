/**
 * Blender Remote GPU Connector
 * Handles WebSocket communication with Blender addon render server
 * Sends .blend files, receives rendered PNG results
 */

interface BlenderConfig {
  host: string;
  port: number;
}

interface RenderJob {
  blendFile: Buffer;
  width: number;
  height: number;
  samples: number;
  timeout?: number;
}

interface RenderResult {
  success: boolean;
  pngBuffer?: Buffer;
  error?: string;
  timing?: {
    upload: number;
    render: number;
    download: number;
  };
}

let wsConnection: WebSocket | null = null;
let messageQueue: Map<string, (result: RenderResult) => void> = new Map();

export const blenderConnector = {
  /**
   * Connect to Blender render server
   */
  async connect(config: BlenderConfig): Promise<boolean> {
    return new Promise((resolve) => {
      try {
        const url = `ws://${config.host}:${config.port}`;
        wsConnection = new WebSocket(url);

        wsConnection.onopen = () => {
          console.log(`[Blender] Connected to ${url}`);
          resolve(true);
        };

        wsConnection.onerror = (err) => {
          console.error(`[Blender] Connection error:`, err);
          resolve(false);
        };

        wsConnection.onmessage = (event) => {
          try {
            const msg = JSON.parse(event.data);
            const handler = messageQueue.get(msg.jobId);
            if (handler) {
              handler(msg);
              messageQueue.delete(msg.jobId);
            }
          } catch (e) {
            console.error(`[Blender] Message parse error:`, e);
          }
        };

        setTimeout(() => {
          if (!wsConnection || wsConnection.readyState !== WebSocket.OPEN) {
            resolve(false);
          }
        }, 5000);
      } catch (err) {
        console.error(`[Blender] Connection failed:`, err);
        resolve(false);
      }
    });
  },

  /**
   * Send render job and wait for result
   */
  async render(job: RenderJob): Promise<RenderResult> {
    if (!wsConnection || wsConnection.readyState !== WebSocket.OPEN) {
      return { success: false, error: 'Not connected to Blender server' };
    }

    return new Promise((resolve) => {
      const jobId = `job_${Date.now()}_${Math.random()}`;
      const timeout = job.timeout || 300000; // 5 min default

      // Set up message handler
      messageQueue.set(jobId, (result: RenderResult) => {
        resolve(result);
      });

      // Timeout
      setTimeout(() => {
        if (messageQueue.has(jobId)) {
          messageQueue.delete(jobId);
          resolve({ success: false, error: 'Render timeout' });
        }
      }, timeout);

      // Send job
      try {
        const message = {
          type: 'render_request',
          jobId,
          blendFile: job.blendFile.toString('base64'),
          width: job.width,
          height: job.height,
          samples: job.samples,
        };
        wsConnection!.send(JSON.stringify(message));
        console.log(`[Blender] Sent render job ${jobId}`);
      } catch (err) {
        messageQueue.delete(jobId);
        resolve({ success: false, error: String(err) });
      }
    });
  },

  /**
   * Check connection status
   */
  isConnected(): boolean {
    return wsConnection !== null && wsConnection.readyState === WebSocket.OPEN;
  },

  /**
   * Disconnect
   */
  disconnect(): void {
    if (wsConnection) {
      wsConnection.close();
      wsConnection = null;
      messageQueue.clear();
      console.log('[Blender] Disconnected');
    }
  },
};
