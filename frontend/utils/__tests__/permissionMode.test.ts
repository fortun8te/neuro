/**
 * Permission Mode System Tests
 *
 * Tests the 6-mode permission system implementation:
 * - default, strict, auto, plan, permissive, bypass
 */

import { getPermissionMode, setPermissionMode, getModeDescription, PERMISSION_MODES } from '../permissionMode';
import { evaluateToolPermissions } from '../harness/wrapLegacyTool';
import type { PermissionMode, ToolUseContext } from '../harness/types';

describe('Permission Mode System', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe('Mode Management', () => {
    it('should default to "default" mode', () => {
      const mode = getPermissionMode();
      expect(mode).toBe('default');
    });

    it('should persist mode to localStorage', () => {
      setPermissionMode('strict');
      expect(localStorage.getItem('harness_permission_mode')).toBe('strict');
      expect(getPermissionMode()).toBe('strict');
    });

    it('should provide descriptions for all modes', () => {
      PERMISSION_MODES.forEach(m => {
        const desc = getModeDescription(m.mode);
        expect(desc).toBeTruthy();
        expect(desc.length > 10).toBe(true);
      });
    });
  });

  describe('Mode Behaviors', () => {
    const mockContext = (mode: PermissionMode): ToolUseContext => ({
      sessionId: 'test-123',
      abortController: new AbortController(),
      messages: [],
      model: 'test-model',
      tools: [],
      permissionContext: {
        mode,
        alwaysAllowRules: {},
        alwaysDenyRules: {},
        alwaysAskRules: {},
      },
    });

    describe('default mode', () => {
      it('should allow read-only tools', () => {
        const result = evaluateToolPermissions(
          'web_search',
          { query: 'test' },
          mockContext('default')
        );
        expect(result.type).toBe('allow');
      });

      it('should ask for destructive tools', () => {
        const result = evaluateToolPermissions(
          'file_delete',
          { path: '/test.txt' },
          mockContext('default')
        );
        expect(result.type).toBe('ask');
        expect(result.riskLevel).toBe('high');
      });
    });

    describe('strict mode', () => {
      it('should ask for all tools', () => {
        const webSearchResult = evaluateToolPermissions(
          'web_search',
          { query: 'test' },
          mockContext('strict')
        );
        expect(webSearchResult.type).toBe('ask');

        const fileDeleteResult = evaluateToolPermissions(
          'file_delete',
          { path: '/test.txt' },
          mockContext('strict')
        );
        expect(fileDeleteResult.type).toBe('ask');
      });
    });

    describe('auto mode', () => {
      it('should auto-approve safe read tools', () => {
        const safeTools = [
          'web_search',
          'browse',
          'file_read',
          'memory_search',
          'image_analyze',
        ];

        safeTools.forEach(tool => {
          const result = evaluateToolPermissions(
            tool,
            { query: 'test' },
            mockContext('auto')
          );
          expect(result.type).toBe('allow');
        });
      });

      it('should ask for destructive tools', () => {
        const result = evaluateToolPermissions(
          'file_delete',
          { path: '/test.txt' },
          mockContext('auto')
        );
        expect(result.type).toBe('ask');
      });
    });

    describe('plan mode', () => {
      it('should ask for first tool before plan approval', () => {
        const result = evaluateToolPermissions(
          'web_search',
          { query: 'test' },
          mockContext('plan')
        );
        expect(result.type).toBe('ask');
        expect(result.riskLevel).toBe('low');
      });

      it('should allow tools after plan approval', () => {
        const context = mockContext('plan');
        context.permissionContext.planApproved = true;

        const result = evaluateToolPermissions(
          'file_write',
          { path: '/test.txt', content: 'data' },
          context
        );
        expect(result.type).toBe('allow');
      });
    });

    describe('permissive mode', () => {
      it('should allow all tools', () => {
        const tools = ['web_search', 'file_delete', 'run_code', 'shell_exec'];
        tools.forEach(tool => {
          const result = evaluateToolPermissions(
            tool,
            { query: 'test' },
            mockContext('permissive')
          );
          expect(result.type).toBe('allow');
        });
      });
    });

    describe('bypass mode', () => {
      it('should be alias for permissive', () => {
        const tools = ['web_search', 'file_delete', 'run_code', 'shell_exec'];
        tools.forEach(tool => {
          const result = evaluateToolPermissions(
            tool,
            { query: 'test' },
            mockContext('bypass')
          );
          expect(result.type).toBe('allow');
        });
      });
    });
  });

  describe('Rule Precedence', () => {
    const mockContext = (mode: PermissionMode, rules = {}): ToolUseContext => ({
      sessionId: 'test-123',
      abortController: new AbortController(),
      messages: [],
      model: 'test-model',
      tools: [],
      permissionContext: {
        mode,
        alwaysAllowRules: {},
        alwaysDenyRules: {},
        alwaysAskRules: {},
        ...rules,
      },
    });

    it('should deny rules override mode', () => {
      const context = mockContext('permissive', {
        alwaysDenyRules: { web_search: ['malicious*'] },
      });
      const result = evaluateToolPermissions(
        'web_search',
        { query: 'malicious attack' },
        context
      );
      expect(result.type).toBe('deny');
    });

    it('should allow rules override mode', () => {
      const context = mockContext('strict', {
        alwaysAllowRules: { web_search: ['*'] },
      });
      const result = evaluateToolPermissions(
        'web_search',
        { query: 'test' },
        context
      );
      expect(result.type).toBe('allow');
    });

    it('should ask rules override mode', () => {
      const context = mockContext('permissive', {
        alwaysAskRules: { web_search: ['dangerous*'] },
      });
      const result = evaluateToolPermissions(
        'web_search',
        { query: 'dangerous operation' },
        context
      );
      expect(result.type).toBe('ask');
    });
  });
});
