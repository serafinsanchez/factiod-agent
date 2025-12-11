"use client";

import { Button } from "@/components/ui/button";

interface SettingsFormProps {
  title: string;
  description: string;
  children: React.ReactNode;
  onSave: () => void;
  onReset: () => void;
  isSaving?: boolean;
  hasChanges?: boolean;
}

export function SettingsForm({
  title,
  description,
  children,
  onSave,
  onReset,
  isSaving = false,
  hasChanges = false,
}: SettingsFormProps) {
  return (
    <div className="flex flex-col gap-6">
      <div className="border-b border-zinc-800 pb-4">
        <h2 className="text-2xl font-semibold text-white">{title}</h2>
        <p className="text-sm text-zinc-400 mt-1">{description}</p>
      </div>

      <div className="space-y-6">{children}</div>

      <div className="flex items-center gap-3 pt-4 border-t border-zinc-800">
        <Button
          onClick={onSave}
          disabled={isSaving || !hasChanges}
          className="bg-blue-600 hover:bg-blue-700 text-white"
        >
          {isSaving ? "Saving..." : "Save Changes"}
        </Button>
        <Button
          onClick={onReset}
          disabled={isSaving}
          variant="outline"
          className="border-zinc-700 bg-zinc-900 text-zinc-200 hover:bg-zinc-700 hover:text-white dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-600 dark:hover:text-white"
        >
          Reset to Defaults
        </Button>
        {hasChanges && (
          <span className="text-sm text-zinc-500 ml-2">
            Unsaved changes
          </span>
        )}
      </div>
    </div>
  );
}
