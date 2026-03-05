/**
 * Meta Ad Library API client for fetching competitor ads
 * Uses app access token (APP_ID|APP_SECRET) for public ad data access
 */

const APP_ID = import.meta.env.VITE_META_APP_ID;
const APP_SECRET = import.meta.env.VITE_META_APP_SECRET;
const ACCESS_TOKEN = APP_ID && APP_SECRET ? `${APP_ID}|${APP_SECRET}` : null;

export const hasMetaApiCredentials = !!ACCESS_TOKEN;

export interface MetaAdArchiveItem {
  id: string;
  ad_creative_bodies?: string[];
  ad_creative_link_titles?: string[];
  ad_creative_link_descriptions?: string[];
  ad_snapshot_url?: string;
  ad_delivery_start_time?: string;
  ad_delivery_stop_time?: string;
  page_name?: string;
}

/**
 * Fetch ads from Meta Ad Library API for a given brand/search term
 */
export async function fetchAdsFromLibrary(
  searchTerms: string,
  limit: number = 30,
  signal?: AbortSignal
): Promise<MetaAdArchiveItem[]> {
  if (!ACCESS_TOKEN) return [];

  const params = new URLSearchParams({
    access_token: ACCESS_TOKEN,
    search_terms: searchTerms,
    ad_type: 'ALL',
    ad_reached_countries: '["US","GB","CA","AU"]',
    fields: 'ad_creative_bodies,ad_creative_link_titles,ad_creative_link_descriptions,ad_snapshot_url,ad_delivery_start_time,ad_delivery_stop_time,page_name',
    limit: String(limit),
  });

  const response = await fetch(
    `https://graph.facebook.com/v21.0/ads_archive?${params}`,
    { signal }
  );

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(
      `Meta Ad Library API: ${response.status} — ${
        (errData as any)?.error?.message || 'unknown error'
      }`
    );
  }

  const data = (await response.json()) as { data?: MetaAdArchiveItem[] };
  return data.data || [];
}

/**
 * Estimate how long an ad has been running based on delivery timestamps
 */
export function estimateLongevity(item: MetaAdArchiveItem): string | undefined {
  if (!item.ad_delivery_start_time) return undefined;

  const start = new Date(item.ad_delivery_start_time);
  const end = item.ad_delivery_stop_time
    ? new Date(item.ad_delivery_stop_time)
    : new Date();
  const days = Math.round((end.getTime() - start.getTime()) / 86400000);

  if (days < 7) return 'Newly launched (<1 week)';
  if (days < 30) return `${days} days (testing phase)`;
  if (days < 90) return `${days} days (gaining traction)`;
  return `${days}+ days (proven converter)`;
}
