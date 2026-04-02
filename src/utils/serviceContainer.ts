/**
 * Service Container — Dependency Injection for Singleton Services
 *
 * Centralizes all service instances and provides a clean interface for dependency injection.
 * This makes testing easier and reduces coupling between modules.
 *
 * Usage:
 *   const ollama = container.get('ollama');
 *   const storage = container.get('storage');
 *   const wayfarer = container.get('wayfarer');
 */

import { ollamaService } from './ollama';
import { vramManager } from './vramManager';
import { semanticRouter } from './neuroContext';
import { neuroMemory } from './neuroMemory';
import { blackboard } from './blackboard';
import { agentCoordinator } from './agentCoordinator';
import { wayfarerService, screenshotService } from './wayfarer';
import { sandboxService } from './sandboxService';
import { isEmbeddingAvailable, probeEmbeddingModel } from './embeddingService';
import { context1Service, isContext1Available } from './context1Service';
import { vfs } from './sessionFileSystem';

/**
 * Service registry for all singleton instances.
 */
export type ServiceKey =
  | 'ollama'
  | 'vram'
  | 'semanticRouter'
  | 'neuroMemory'
  | 'blackboard'
  | 'agentCoordinator'
  | 'wayfarer'
  | 'screenshot'
  | 'sandbox'
  | 'embedding'
  | 'context1'
  | 'vfs';

export interface ServiceRegistry {
  ollama: typeof ollamaService;
  vram: typeof vramManager;
  semanticRouter: typeof semanticRouter;
  neuroMemory: typeof neuroMemory;
  blackboard: typeof blackboard;
  agentCoordinator: typeof agentCoordinator;
  wayfarer: typeof wayfarerService;
  screenshot: typeof screenshotService;
  sandbox: typeof sandboxService;
  embedding: {
    isAvailable: typeof isEmbeddingAvailable;
    probe: typeof probeEmbeddingModel;
  };
  context1: {
    service: typeof context1Service;
    isAvailable: typeof isContext1Available;
  };
  vfs: typeof vfs;
}

/**
 * Service Container — manages singleton service instances.
 */
class ServiceContainer {
  private services: Partial<ServiceRegistry> = {};
  private initialized = false;

  /**
   * Initialize all singleton services.
   * Called once at application startup.
   */
  async init(): Promise<void> {
    if (this.initialized) return;

    // Register all services
    this.services = {
      ollama: ollamaService,
      vram: vramManager,
      semanticRouter,
      neuroMemory,
      blackboard,
      agentCoordinator,
      wayfarer: wayfarerService,
      screenshot: screenshotService,
      sandbox: sandboxService,
      embedding: {
        isAvailable: isEmbeddingAvailable,
        probe: probeEmbeddingModel,
      },
      context1: {
        service: context1Service,
        isAvailable: isContext1Available,
      },
      vfs,
    };

    // Fire-and-forget probes
    probeEmbeddingModel().catch(() => {});

    this.initialized = true;
  }

  /**
   * Get a service instance by key.
   */
  get<K extends ServiceKey>(key: K): ServiceRegistry[K] {
    if (!this.initialized) {
      throw new Error(`Service container not initialized. Call init() first.`);
    }

    const service = this.services[key];
    if (!service) {
      throw new Error(`Service '${key}' not registered.`);
    }

    return service as ServiceRegistry[K];
  }

  /**
   * Check if a service is registered.
   */
  has(key: ServiceKey): boolean {
    return key in this.services;
  }

  /**
   * Reset all services (for testing).
   */
  reset(): void {
    this.services = {};
    this.initialized = false;
  }

  /**
   * Get all registered services.
   */
  getAll(): Partial<ServiceRegistry> {
    if (!this.initialized) {
      throw new Error(`Service container not initialized. Call init() first.`);
    }
    return this.services;
  }
}

/**
 * Global service container instance.
 */
export const container = new ServiceContainer();

/**
 * Factory for creating service-dependent components.
 * Useful for dependency injection in hooks and components.
 */
export interface ServiceFactory {
  createResearchOrchestrator(): any; // Replace 'any' with actual type
  createAgentEngine(): any; // Replace 'any' with actual type
  createMemoryStore(): any; // Replace 'any' with actual type
}

export function createServiceFactory(): ServiceFactory {
  return {
    createResearchOrchestrator() {
      const ollama = container.get('ollama');
      const vram = container.get('vram');
      const wayfarer = container.get('wayfarer');
      // TODO: Implement factory method using services
      return { ollama, vram, wayfarer };
    },

    createAgentEngine() {
      const ollama = container.get('ollama');
      const semanticRouter = container.get('semanticRouter');
      const neuroMemory = container.get('neuroMemory');
      const vfs = container.get('vfs');
      // TODO: Implement factory method using services
      return { ollama, semanticRouter, neuroMemory, vfs };
    },

    createMemoryStore() {
      const neuroMemory = container.get('neuroMemory');
      const blackboard = container.get('blackboard');
      // TODO: Implement factory method using services
      return { neuroMemory, blackboard };
    },
  };
}

/**
 * Helper to get a specific service with type safety.
 */
export function getService<K extends ServiceKey>(key: K): ServiceRegistry[K] {
  return container.get(key);
}
