"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { ProjectsTable, type ProjectListItem } from "@/components/home/ProjectsTable";
import { StyleSelector } from "@/components/agent/StyleSelector";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function HomePage() {
  const router = useRouter();
  const [projects, setProjects] = useState<ProjectListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isStyleSelectorOpen, setIsStyleSelectorOpen] = useState(false);
  const [creatorName, setCreatorName] = useState("");
  const [topic, setTopic] = useState("");

  useEffect(() => {
    const loadProjects = async () => {
      try {
        setIsLoading(true);
        const response = await fetch("/api/history/list");
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data?.error || "Failed to load projects");
        }
        setProjects(data.projects ?? []);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load projects");
      } finally {
        setIsLoading(false);
      }
    };

    loadProjects();
  }, []);

  const handleNewProject = () => {
    setIsStyleSelectorOpen(true);
  };

  const handleStyleSelected = (styleId: string) => {
    setIsStyleSelectorOpen(false);
    const query = new URLSearchParams();
    if (styleId) query.set("style", styleId);
    if (creatorName.trim()) query.set("creator", creatorName.trim());
    if (topic.trim()) query.set("topic", topic.trim());
    router.push(`/project/new?${query.toString()}`);
  };

  return (
    <div className="min-h-screen bg-zinc-950/98 text-white">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 pb-16 pt-8 md:px-6 lg:px-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-[0.6rem] font-semibold uppercase tracking-[0.35em] text-zinc-500">
              Projects
            </p>
            <h1 className="text-3xl font-semibold tracking-tight text-white md:text-4xl">
              Your Factoid Videos
            </h1>
          </div>
          <Button
            size="lg"
            className="rounded-full bg-white px-6 text-sm font-semibold uppercase tracking-[0.2em] text-zinc-900 hover:bg-zinc-200"
            onClick={handleNewProject}
          >
            New Project
          </Button>
        </div>

        <Card className="border border-zinc-900/70 bg-zinc-950/80">
          <CardContent className="p-6">
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="topic" className="text-xs uppercase tracking-[0.2em] text-zinc-500">
                  Topic
                </Label>
                <Input
                  id="topic"
                  placeholder="Enter a topic for your video"
                  value={topic}
                  onChange={(event) => setTopic(event.target.value)}
                  className="h-11 rounded-2xl border border-white/10 bg-zinc-900/80 text-sm text-white placeholder:text-zinc-600 focus-visible:ring-2 focus-visible:ring-white/70"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="creator-name" className="text-xs uppercase tracking-[0.2em] text-zinc-500">
                  Creator Name
                </Label>
                <Input
                  id="creator-name"
                  placeholder="Add your name for new projects"
                  value={creatorName}
                  onChange={(event) => setCreatorName(event.target.value)}
                  className="h-11 rounded-2xl border border-white/10 bg-zinc-900/80 text-sm text-white placeholder:text-zinc-600 focus-visible:ring-2 focus-visible:ring-white/70"
                />
              </div>
              <div className="flex items-end justify-end">
                <Button
                  size="lg"
                  className="w-full rounded-2xl border border-white/15 bg-zinc-900/70 px-5 text-sm font-semibold text-white hover:bg-zinc-800 sm:w-auto"
                  onClick={handleNewProject}
                >
                  Start a New Project
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {error && (
          <div className="rounded-2xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
            {error}
          </div>
        )}

        {isLoading ? (
          <div className="rounded-3xl border border-zinc-900/70 bg-zinc-950/80 px-6 py-10 text-center text-sm text-zinc-400">
            Loading projects…
          </div>
        ) : (
          <ProjectsTable projects={projects} />
        )}
      </div>

      <StyleSelector
        isOpen={isStyleSelectorOpen}
        onSelect={handleStyleSelected}
        onClose={() => setIsStyleSelectorOpen(false)}
      />
    </div>
  );
}

