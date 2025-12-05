"use client";

import { FormEvent, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const getSafeRedirect = (value: string | null) => {
  if (!value) return "/";

  // Only allow same-origin relative paths (e.g., "/dashboard"), and block
  // protocol-relative or absolute URLs that could enable open redirects.
  const isRelativePath =
    value.startsWith("/") && !value.startsWith("//") && !value.includes("://");

  return isRelativePath ? value : "/";
};

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const redirectTo = getSafeRedirect(searchParams.get("redirect"));

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        setError(data?.error || "Login failed");
        return;
      }

      router.replace(redirectTo);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-950 px-4 py-12 text-white">
      <div className="w-full max-w-md">
        <Card className="border-zinc-800 bg-zinc-900/70 text-white">
          <CardHeader>
            <CardTitle className="text-xl font-semibold">Sign in</CardTitle>
            <CardDescription className="text-zinc-400">
              Enter the provided credentials to access the app.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-5" onSubmit={handleSubmit}>
              <div className="space-y-2">
                <Label htmlFor="email" className="text-xs uppercase tracking-[0.2em] text-zinc-500">
                  Email
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="sasha@getgoally.com"
                  value={email}
                  autoComplete="username"
                  onChange={(event) => setEmail(event.target.value)}
                  required
                  className="h-11 rounded-2xl border border-white/10 bg-zinc-900/80 text-sm text-white placeholder:text-zinc-600 focus-visible:ring-2 focus-visible:ring-white/70"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-xs uppercase tracking-[0.2em] text-zinc-500">
                  Password
                </Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={password}
                    autoComplete="current-password"
                    onChange={(event) => setPassword(event.target.value)}
                    required
                    className="h-11 rounded-2xl border border-white/10 bg-zinc-900/80 pr-10 text-sm text-white placeholder:text-zinc-600 focus-visible:ring-2 focus-visible:ring-white/70"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-200 transition-colors"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>

              {error && (
                <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-100">
                  {error}
                </div>
              )}

              <Button
                type="submit"
                disabled={isSubmitting}
                className="w-full rounded-2xl border border-white/15 bg-white/5 text-sm font-semibold text-white hover:bg-white/10"
              >
                {isSubmitting ? "Signing in..." : "Sign in"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
