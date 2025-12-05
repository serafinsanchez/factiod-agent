"use client";

import { useState, useEffect, useCallback } from "react";
import type { SettingsKey, SettingsMap } from "@/lib/settings/types";
import { getDefaultSettings } from "@/lib/settings/defaults";

/**
 * Hook for loading and saving settings
 * Includes client-side caching to avoid unnecessary fetches
 */
export function useSettings<K extends SettingsKey>(key: K) {
  type SettingsType = SettingsMap[K];

  const [data, setData] = useState<SettingsType | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

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
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setError(message);
      console.error("Error loading settings:", err);
      // Fall back to defaults on error
      setData(getDefaultSettings(key) as SettingsType);
    } finally {
      setIsLoading(false);
    }
  }, [key]);

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
    [key]
  );

  // Reset to defaults
  const reset = useCallback(() => {
    const defaults = getDefaultSettings(key) as SettingsType;
    setData(defaults);
  }, [key]);

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
