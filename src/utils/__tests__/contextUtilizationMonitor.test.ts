import { describe, test, expect } from 'vitest';
import { ContextUtilizationMonitor } from '../contextUtilizationMonitor';

describe('ContextUtilizationMonitor', () => {
  test('detects soft threshold at 50%', () => {
    const monitor = new ContextUtilizationMonitor(10000, 1000);
    const budget = monitor.calculateBudget(4500, 0, 0);
    expect(budget.percentUsed).toBe(50);
    expect(monitor.shouldTriggerCompression(budget)).toBe(true);
  });

  test('stays healthy below soft threshold', () => {
    const monitor = new ContextUtilizationMonitor(10000, 1000);
    const budget = monitor.calculateBudget(3600, 0, 0);
    expect(monitor.shouldTriggerCompression(budget)).toBe(false);
  });

  test('returns warning status at 70%', () => {
    const monitor = new ContextUtilizationMonitor(10000, 1000);
    const budget = monitor.calculateBudget(6300, 0, 0);
    const event = monitor.getStatus(budget);
    expect(event.type).toBe('warning');
  });

  test('returns critical status at 85%', () => {
    const monitor = new ContextUtilizationMonitor(10000, 1000);
    const budget = monitor.calculateBudget(7650, 0, 0);
    const event = monitor.getStatus(budget);
    expect(event.type).toBe('critical');
  });

  test('rejects tools at 95%+ utilization', () => {
    const monitor = new ContextUtilizationMonitor(10000, 1000);
    const budget = monitor.calculateBudget(8551, 0, 0); // 8551/9000 = 95.01%
    expect(monitor.shouldRejectNewTool(budget)).toBe(true);
  });

  test('returns emergency status when critical', () => {
    const monitor = new ContextUtilizationMonitor(10000, 1000);
    const budget = monitor.calculateBudget(8551, 0, 0); // 95.01%
    const event = monitor.getStatus(budget);
    expect(event.type).toBe('emergency');
  });

  test('calculates available tokens correctly', () => {
    const monitor = new ContextUtilizationMonitor(1000, 100);
    const budget = monitor.calculateBudget(400, 0, 0);
    // available = 1000 - 400 - 100 = 500
    expect(budget.available).toBe(500);
  });

  test('canAllocate returns true when space available', () => {
    const monitor = new ContextUtilizationMonitor(1000, 100);
    const budget = monitor.calculateBudget(400, 0, 0);
    expect(monitor.canAllocate(budget, 400)).toBe(true);
  });

  test('canAllocate returns false when insufficient space', () => {
    const monitor = new ContextUtilizationMonitor(1000, 100);
    const budget = monitor.calculateBudget(700, 0, 0);
    expect(monitor.canAllocate(budget, 300)).toBe(false);
  });

  test('accounts for images in budget', () => {
    const monitor = new ContextUtilizationMonitor(1000, 100);
    const budget = monitor.calculateBudget(400, 0, 0, 200);
    expect(budget.used).toBe(600);
    expect(budget.percentUsed).toBeCloseTo(66.67, 1);
  });

  test('healthy status message includes percentage', () => {
    const monitor = new ContextUtilizationMonitor(10000, 1000);
    const budget = monitor.calculateBudget(2700, 0, 0);
    const event = monitor.getStatus(budget);
    expect(event.message).toContain('30%');
    expect(event.type).toBe('healthy');
  });
});
