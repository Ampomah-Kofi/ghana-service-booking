"use client";

import { Button } from "@/components/ui/button";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="rounded-card bg-card p-6 text-center border border-border" role="alert">
      <h1 className="text-title font-semibold">Something went wrong</h1>
      <p className="mt-2 text-body text-ink-muted">Please check your connection and try again.</p>
      <Button className="mt-6" onClick={reset}>
        Try again
      </Button>
    </div>
  );
}
