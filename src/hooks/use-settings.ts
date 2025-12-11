"use client";

import { useState, useEffect, useCallback } from "react";
import type { SettingsKey, SettingsMap } from "@/lib/settings/types";
import { getDefaultSettings } from "@/lib/settings/defaults";

const SETTINGS_CACHE_PREFIX = "settings:v1:";

/**
 * Hook for loading and saving settings
 * Includes client-side caching to avoid unnecessary fetches
 */
export function useSettings<K extends SettingsKey>(key: K) {
  type SettingsType = SettingsMap[K];

  const cacheKey = `${SETTINGS_CACHE_PREFIX}${key}`;
  const initialCached = (() => {
    if (typeof window === "undefined") {
      return null;
    }
    try {
      const raw = window.localStorage.getItem(cacheKey);
      if (!raw) {
        return null;
      }
      return JSON.parse(raw) as SettingsType;
    } catch {
      return null;
    }
  })();

  const [data, setData] = useState<SettingsType | null>(initialCached);
  const [isLoading, setIsLoading] = useState(initialCached === null);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const writeCache = useCallback(
    (value: SettingsType) => {
      if (typeof window === "undefined") {
        return;
      }
      try {
        window.localStorage.setItem(cacheKey, JSON.stringify(value));
      } catch {
        // ignore quota / privacy errors
      }
    },
    [cacheKey],
  );

  // Load settings from API
  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/settings/get?key=${key}`);
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to load settings");
      }

      // Use saved data or fall back to defaults
      const settingsData = result.data || getDefaultSettings(key);
      setData(settingsData as SettingsType);
      writeCache(settingsData as SettingsType);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setError(message);
      console.error("Error loading settings:", err);
      // Fall back to defaults on error
      const defaults = getDefaultSettings(key) as SettingsType;
      setData((prev) => prev ?? defaults);
    } finally {
      setIsLoading(false);
    }
  }, [key, writeCache]);

  // Save settings to API
  const save = useCallback(
    async (value: SettingsType) => {
      setIsSaving(true);
      setError(null);

      try {
        const response = await fetch("/api/settings/save", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ key, value }),
        });

        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.error || "Failed to save settings");
        }

        // Update local state
        setData(value);
        writeCache(value);
        return { success: true };
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        setError(message);
        console.error("Error saving settings:", err);
        return { success: false, error: message };
      } finally {
        setIsSaving(false);
      }
    },
    [key, writeCache]
  );

  // Reset to defaults
  const reset = useCallback(() => {
    const defaults = getDefaultSettings(key) as SettingsType;
    setData(defaults);
    writeCache(defaults);
  }, [key, writeCache]);

  // Load on mount
  useEffect(() => {
    load();
  }, [load]);

  return {
    data,
    isLoading,
    error,
    isSaving,
    save,
    reset,
    reload: load,
  };
}
