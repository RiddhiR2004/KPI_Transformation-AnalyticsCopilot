import { api } from "./api";
import type { MetadataItem } from "../types/api";

export type MetadataCategory =
  | "industries"
  | "org-levels"
  | "functional-areas"
  | "priorities"
  | "challenges"
  | "kras"
  | "kpi-categories"
  | "quality-ratings";

const sessionCache: Record<string, MetadataItem[]> = {};

export const metadataService = {
  getMetadata: async (category: MetadataCategory): Promise<MetadataItem[]> => {
    if (sessionCache[category]) {
      console.log(`[FRONTEND CACHE HIT] Category: ${category}`);
      return sessionCache[category];
    }
    console.log(`[FRONTEND CACHE MISS] Category: ${category}`);
    const data = await api.getMetadata(category);
    sessionCache[category] = data;
    return data;
  },

  getMetadataNames: async (category: MetadataCategory): Promise<string[]> => {
    try {
      const items = await metadataService.getMetadata(category);
      return items.filter((item) => item.is_active).map((item) => item.name);
    } catch (error) {
      console.error(`Error loading metadata for category: ${category}`, error);
      return [];
    }
  },

  clearCache: () => {
    for (const key in sessionCache) {
      delete sessionCache[key];
    }
  }
};
