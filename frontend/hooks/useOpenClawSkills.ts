/**
 * useOpenClawSkills — Hook for OpenClaw skill installation and management
 */

import { useCallback, useState, useEffect } from 'react';
import {
  searchOpenClawSkills,
  getOpenClawSkill,
  installOpenClawSkill,
  uninstallOpenClawSkill,
  getInstalledSkills,
  autoInstallSkillForTask,
  type OpenClawSkill,
  type SkillInstallResult,
} from '../utils/openclawIntegrator';

export interface UseOpenClawSkillsState {
  installed: OpenClawSkill[];
  searching: boolean;
  installing: boolean;
  loadingInstalled: boolean;
  error?: string;
}

export function useOpenClawSkills() {
  const [state, setState] = useState<UseOpenClawSkillsState>({
    installed: [],
    searching: false,
    installing: false,
    loadingInstalled: true,
  });

  /**
   * Load installed skills on mount
   */
  useEffect(() => {
    loadInstalledSkills();
  }, []);

  /**
   * Load installed skills from storage
   */
  const loadInstalledSkills = useCallback(async () => {
    try {
      setState(prev => ({ ...prev, loadingInstalled: true, error: undefined }));
      const installed = await getInstalledSkills();
      setState(prev => ({ ...prev, installed, loadingInstalled: false }));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setState(prev => ({ ...prev, loadingInstalled: false, error: message }));
    }
  }, []);

  /**
   * Search OpenClaw marketplace for skills
   */
  const search = useCallback(async (query: string, limit: number = 5) => {
    try {
      setState(prev => ({ ...prev, searching: true, error: undefined }));
      const results = await searchOpenClawSkills(query, limit);
      setState(prev => ({ ...prev, searching: false }));
      return results;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setState(prev => ({ ...prev, searching: false, error: message }));
      return [];
    }
  }, []);

  /**
   * Get skill details
   */
  const getSkill = useCallback(async (skillId: string) => {
    try {
      const skill = await getOpenClawSkill(skillId);
      return skill;
    } catch (error) {
      console.error('Failed to get skill:', error);
      return null;
    }
  }, []);

  /**
   * Install a skill
   */
  const install = useCallback(async (skill: OpenClawSkill): Promise<SkillInstallResult> => {
    try {
      setState(prev => ({ ...prev, installing: true, error: undefined }));

      const result = await installOpenClawSkill(skill);

      if (result.success) {
        // Refresh installed skills list
        await loadInstalledSkills();
      }

      setState(prev => ({ ...prev, installing: false }));
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setState(prev => ({ ...prev, installing: false, error: message }));

      return {
        success: false,
        skillId: skill.id,
        skillName: skill.name,
        message: 'Installation failed',
        error: message,
      };
    }
  }, [loadInstalledSkills]);

  /**
   * Uninstall a skill
   */
  const uninstall = useCallback(async (skillId: string): Promise<boolean> => {
    try {
      const success = await uninstallOpenClawSkill(skillId);
      if (success) {
        await loadInstalledSkills();
      }
      return success;
    } catch (error) {
      console.error('Failed to uninstall skill:', error);
      return false;
    }
  }, [loadInstalledSkills]);

  /**
   * Auto-install skill for a task
   */
  const autoInstallForTask = useCallback(async (
    taskDescription: string,
    failureReason?: string,
  ): Promise<SkillInstallResult | null> => {
    try {
      setState(prev => ({ ...prev, installing: true, error: undefined }));

      const result = await autoInstallSkillForTask(taskDescription, failureReason);

      if (result?.success) {
        await loadInstalledSkills();
      }

      setState(prev => ({ ...prev, installing: false }));
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setState(prev => ({ ...prev, installing: false, error: message }));
      return null;
    }
  }, [loadInstalledSkills]);

  /**
   * Check if a skill is installed
   */
  const isInstalled = useCallback((skillId: string): boolean => {
    return state.installed.some(s => s.id === skillId);
  }, [state.installed]);

  /**
   * Get skill by id from installed list
   */
  const getInstalledSkill = useCallback((skillId: string): OpenClawSkill | undefined => {
    return state.installed.find(s => s.id === skillId);
  }, [state.installed]);

  return {
    // State
    ...state,

    // Methods
    search,
    getSkill,
    install,
    uninstall,
    autoInstallForTask,
    loadInstalledSkills,
    isInstalled,
    getInstalledSkill,
  };
}
