import { useState, useCallback, useEffect, useRef } from 'react';
import { storage } from '../utils/storage';
import type { Campaign, Cycle } from '../types';

export function useStorage() {
  const [error, setError] = useState<string | null>(null);

  // Guard against setState after unmount (async storage calls in-flight).
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const saveCampaign = useCallback(async (campaign: Campaign) => {
    try {
      await storage.saveCampaign(campaign);
      if (mountedRef.current) setError(null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to save campaign';
      if (mountedRef.current) setError(msg);
      throw err;
    }
  }, []);

  const getCampaign = useCallback(async (id: string) => {
    try {
      const campaign = await storage.getCampaign(id);
      if (mountedRef.current) setError(null);
      return campaign;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to get campaign';
      if (mountedRef.current) setError(msg);
      throw err;
    }
  }, []);

  const getAllCampaigns = useCallback(async () => {
    try {
      const campaigns = await storage.getAllCampaigns();
      if (mountedRef.current) setError(null);
      return campaigns;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to get campaigns';
      if (mountedRef.current) setError(msg);
      throw err;
    }
  }, []);

  const saveCycle = useCallback(async (cycle: Cycle) => {
    try {
      await storage.saveCycle(cycle);
      if (mountedRef.current) setError(null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to save cycle';
      if (mountedRef.current) setError(msg);
      throw err;
    }
  }, []);

  const getCyclesByCampaign = useCallback(async (campaignId: string) => {
    try {
      const cycles = await storage.getCyclesByCampaign(campaignId);
      if (mountedRef.current) setError(null);
      return cycles;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to get cycles';
      if (mountedRef.current) setError(msg);
      throw err;
    }
  }, []);

  const updateCycle = useCallback(async (cycle: Cycle) => {
    try {
      await storage.updateCycle(cycle);
      if (mountedRef.current) setError(null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to update cycle';
      if (mountedRef.current) setError(msg);
      throw err;
    }
  }, []);

  return {
    error,
    saveCampaign,
    getCampaign,
    getAllCampaigns,
    saveCycle,
    getCyclesByCampaign,
    updateCycle,
  };
}
